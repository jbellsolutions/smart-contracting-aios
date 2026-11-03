#!/usr/bin/env python3
"""The one sender for the Revenue Partner (projects/revenue-partner-sends/SPEC.md).

The AI only drafts and records Jesse's approval. This script is the only code that sends. It runs from one
cron line, holds a lock, sends at most one email per run, checks the stop file before every email, sends only
in NZ business hours and at least 15 minutes apart, and sends only a draft whose latest text Jesse approved.

It doesn't trust the box clock. Each run measures the clock's offset from the HTTPS Date header of trusted time
sources (Graph itself, and Microsoft's sign-in server), and every decision and log time uses the box clock plus
that offset. No source answers: it uses the last offset if it was measured in the last 6 hours, and otherwise
sends nothing (SKIPPED_CLOCK). An offset over 6 hours is refused too.

  sender.py register --id <id> --to <addr> --subject <s> --body-file <path|->   add a version of a draft
  sender.py approve --id <id> --sha256 <hash> --by "<Jesse's words / Slack ts>" record Jesse's yes
  sender.py run [--test]                                                        send at most one email
  sender.py init-config --token-from <dir:module:fn> --test-recipient <addr>    write sender.json once
  sender.py status                                                              read-only summary
  sender.py selfcheck                                                           the SPEC checks, in a temp folder

Files, under ~/PartnerDesk (or $PARTNERDESK_HOME):
  sender.json          config (see sender.example.json)
  state/SEND-STOP      the stop file: while it exists, nothing sends (test mode excepted, to the test address only)
  state/sender.lock    the run lock
  drafts/<id>.json     every version of each draft
  approvals.jsonl      Jesse's approvals, one per line
  send-log.jsonl       every outcome, one per line, append-only
  state/clock.json     the last clock measurement: offset, when, and each source's answer

Python 3.9+, standard library only.
"""
import argparse
import datetime as dt
import errno
import fcntl
import hashlib
import io
import json
import os
import re
import secrets
import shutil
import statistics
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from graph_adapter import FakeAdapter, GraphAdapter, LookupFailed, SendFailed, SendUnclear  # noqa: E402

try:
    from zoneinfo import ZoneInfo
    NZ = ZoneInfo("Pacific/Auckland")
except Exception:  # noqa: BLE001 - no time zone data: refuse to send rather than guess NZ time
    NZ = None

UTC = dt.timezone.utc
MIN_GAP_FLOOR = 15
DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DEFAULTS = {
    "adapter": "graph",
    "token_from": None,
    "test_recipient": None,
    "body_content_type": "text",
    "business_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "business_start": "08:00",
    "business_end": "17:00",
    "min_gap_minutes": 15,
    "suppression_list": None,
    "timeout_seconds": 30,
    "time_sources": ["https://graph.microsoft.com/v1.0/", "https://login.microsoftonline.com/"],
}
CLOCK_MAX_AGE_S = 6 * 3600     # a saved offset older than this isn't used
CLOCK_MAX_OFFSET_S = 6 * 3600  # an offset bigger than this is a mistake, not a slow clock
# Outcomes that close an approval for good. A new approval is needed after any of these except SENT/FOUND_IN_SENT.
CLOSING = {"SENT", "FOUND_IN_SENT", "NO_CHANGE", "REFUSED_HASH", "REFUSED_STALE", "REFUSED_SUPPRESSED", "FAILED"}
SENT_LIKE = {"SENT", "FOUND_IN_SENT"}
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
ADDR_RE = re.compile(r"^[^@\s,;<>\"']+@[^@\s,;<>\"']+\.[^@\s,;<>\"']+$")
ADDR_FIND = re.compile(r"[^@\s,;<>\"']+@[^@\s,;<>\"']+\.[^@\s,;<>\"']+")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")


class BrokenFile(Exception):
    pass


def scrub(text):
    """Keep anything shaped like a token out of the log."""
    t = str(text)
    t = re.sub(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}", "[redacted]", t)
    t = re.sub(r"(?i)\b(bearer|token|secret|password)(\s*[:=]\s*|\s+)\S{8,}", r"\1\2[redacted]", t)
    t = re.sub(r"\b[A-Za-z0-9+/_-]{60,}={0,2}", "[redacted]", t)
    return t[:300]


def canonical(to, subject, body):
    """The exact bytes Jesse's approval is tied to: recipient, subject and body, with line endings normalised."""
    norm = lambda s: str(s).replace("\r\n", "\n").replace("\r", "\n")  # noqa: E731
    return json.dumps({"to": norm(to).strip(), "subject": norm(subject), "body": norm(body)},
                      sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def text_hash(to, subject, body):
    return hashlib.sha256(canonical(to, subject, body)).hexdigest()


def read_jsonl(path):
    """Every line as a dict. A broken line raises BrokenFile: the sender won't guess what a damaged log said."""
    out = []
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                raise BrokenFile("%s line %d isn't valid JSON; fix it by hand before the sender runs again" % (os.path.basename(path), n))
            if not isinstance(rec, dict):
                raise BrokenFile("%s line %d isn't a record" % (os.path.basename(path), n))
            out.append(rec)
    return out


def append_line(path, rec):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    try:
        os.write(fd, (json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)


def write_atomic(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def parse_hhmm(s):
    m = re.match(r"^([01]\d|2[0-3]):([0-5]\d)$", str(s))
    if not m:
        raise ValueError("%r isn't HH:MM" % (s,))
    return int(m.group(1)) * 60 + int(m.group(2))


def parse_time(s):
    t = dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    if t.tzinfo is None:
        raise ValueError("timestamp has no offset")
    return t.astimezone(UTC)


class State:
    """What the log and the approvals say, read fresh each time."""

    def __init__(self, log, approvals):
        self.log = log
        self.approvals = approvals
        self.sent_ids = {e.get("draft_id") for e in log if e.get("outcome") in SENT_LIKE}
        last_by_approval = {}
        for e in log:
            if e.get("approval_id"):
                last_by_approval.setdefault(e["approval_id"], []).append(e)
        self.by_approval = last_by_approval
        self.open = []          # approvals still waiting to be sent, oldest first
        self.unclear = []       # UNCLEAR entries not yet resolved
        for a in approvals:
            entries = last_by_approval.get(a.get("approval_id"), [])
            outcomes = [e.get("outcome") for e in entries]
            if any(o in CLOSING for o in outcomes):
                continue
            if "UNCLEAR" in outcomes:
                self.unclear.append([e for e in entries if e.get("outcome") == "UNCLEAR"][0])
                continue
            self.open.append(a)
        times = []
        for e in log:
            if e.get("outcome") in ("SENT", "FOUND_IN_SENT", "UNCLEAR"):
                try:
                    times.append(parse_time(e.get("at_utc") or e.get("at")))
                except (ValueError, TypeError):
                    pass
        self.last_send = max(times) if times else None


class Desk:
    """One PartnerDesk folder. now() and adapter can be injected for tests."""

    def __init__(self, home=None, now=None, adapter=None, out=None):
        self.home = os.path.abspath(os.path.expanduser(home or os.environ.get("PARTNERDESK_HOME") or "~/PartnerDesk"))
        self._now = now
        self._adapter = adapter
        self.out = out or sys.stdout
        self.state_dir = os.path.join(self.home, "state")
        self.stopfile = os.path.join(self.state_dir, "SEND-STOP")
        self.lockfile = os.path.join(self.state_dir, "sender.lock")
        self.drafts_dir = os.path.join(self.home, "drafts")
        self.approvals_path = os.path.join(self.home, "approvals.jsonl")
        self.log_path = os.path.join(self.home, "send-log.jsonl")
        self.config_path = os.path.join(self.home, "sender.json")
        self.clock_path = os.path.join(self.state_dir, "clock.json")
        self._offset = None        # the clock offset this run measured (or took from clock.json)
        self._offset_set = False   # True once this run has decided its offset (None = unknown)

    # ---- small helpers ------------------------------------------------------------------------------------
    def say(self, msg):
        print(msg, file=self.out)

    def system_now(self):
        """The box's own clock, which may be wrong."""
        if self._now is not None:
            t = self._now() if callable(self._now) else self._now
            return t.astimezone(UTC)
        fake = os.environ.get("PARTNERDESK_FAKE_NOW")
        if fake and self._raw_config().get("adapter") == "fake":  # a frozen clock only ever works with the fake adapter
            return parse_time(fake)
        return dt.datetime.now(UTC)

    def now(self):
        """The corrected time: the box clock plus the measured offset. Unknown offset: the box clock."""
        off = self.offset()
        t = self.system_now()
        return t + dt.timedelta(seconds=off) if off is not None else t

    def offset(self):
        """This run's offset once measured; before that (and in register/approve) the saved one, if fresh."""
        if self._offset_set:
            return self._offset
        saved = self.saved_clock()
        return saved["offset_s"] if saved and saved["fresh"] else None

    def saved_clock(self):
        """state/clock.json as {"offset_s", "age_s", "fresh", ...}, or None. Age is on the box clock, like the
        measurement itself. Fresh: measured in the last 6 hours and plausible."""
        try:
            with open(self.clock_path, encoding="utf-8") as f:
                c = json.load(f)
            off = float(c["offset_s"])
            age = (self.system_now() - parse_time(c["system_utc"])).total_seconds()
        except (OSError, ValueError, KeyError, TypeError):
            return None
        c.update(offset_s=off, age_s=age, fresh=-60 <= age <= CLOCK_MAX_AGE_S and abs(off) <= CLOCK_MAX_OFFSET_S)
        return c

    def read_clock(self, cfg, ad):
        """Ask every time source. Returns (median offset or None, the sources' answers)."""
        try:
            answers = ad.measure_clock(list(cfg["time_sources"]))
        except Exception as e:  # noqa: BLE001 - a broken clock read is the same as no answer
            answers = [{"url": "?", "error": "%s: %s" % (type(e).__name__, str(e)[:100])}]
        good = [float(a["offset_s"]) for a in answers if isinstance(a, dict) and a.get("offset_s") is not None]
        return (statistics.median(good) if good else None), answers

    def measure_clock(self, cfg, ad):
        """Decide this run's offset. Returns None if it can, else the reason nothing may send (SKIPPED_CLOCK)."""
        self._offset, self._offset_set = None, True
        off, answers = self.read_clock(cfg, ad)
        if off is not None:
            if abs(off) > CLOCK_MAX_OFFSET_S:
                return "clock offset implausible: the time sources say the box clock is off by %+.0f s (over 6 hours)" % off
            sys_t = self.system_now()
            self._offset = off
            write_atomic(self.clock_path, {"offset_s": round(off, 3), "system_utc": sys_t.isoformat(timespec="seconds"),
                                           "measured_at_utc": (sys_t + dt.timedelta(seconds=off)).isoformat(timespec="seconds"),
                                           "sources": answers})
            return None
        why = "; ".join("%s: %s" % (a.get("url"), a.get("error")) for a in answers if isinstance(a, dict))
        saved = self.saved_clock()
        if saved and saved["fresh"]:
            self._offset = saved["offset_s"]
            return None
        if saved and abs(saved["offset_s"]) > CLOCK_MAX_OFFSET_S:
            return "clock offset implausible: the saved offset is %+.0f s (over 6 hours)" % saved["offset_s"]
        return "no time source answered (%s) and no offset was measured in the last 6 hours; nothing sends on an unknown clock" % why

    def _raw_config(self):
        try:
            with open(self.config_path, encoding="utf-8") as f:
                c = json.load(f)
            return c if isinstance(c, dict) else {}
        except (OSError, ValueError):
            return {}

    def config(self):
        """(config, problems). Any problem means run refuses to send."""
        problems = []
        if not os.path.exists(self.config_path):
            return dict(DEFAULTS), ["no sender.json in " + self.home + " (copy sender.example.json and fill it in)"]
        try:
            with open(self.config_path, encoding="utf-8") as f:
                raw = json.load(f)
        except (OSError, ValueError) as e:
            return dict(DEFAULTS), ["sender.json isn't valid JSON (%s)" % type(e).__name__]
        if not isinstance(raw, dict):
            return dict(DEFAULTS), ["sender.json must be one JSON object"]
        cfg = dict(DEFAULTS)
        for k, v in raw.items():
            if k.startswith("_"):
                continue
            if k not in DEFAULTS:
                problems.append("unknown setting %r in sender.json" % k)
                continue
            cfg[k] = v
        for k, v in cfg.items():
            if isinstance(v, str) and v.strip().upper().startswith("FILL-ME"):
                problems.append("%s isn't filled in" % k)
        if cfg["adapter"] not in ("graph", "fake"):
            problems.append('adapter must be "graph" or "fake"')
        if cfg["adapter"] == "graph" and not cfg["token_from"]:
            problems.append("token_from is empty")
        if str(cfg["body_content_type"]).lower() not in ("text", "html"):
            problems.append('body_content_type must be "text" or "html"')
        try:
            days = cfg["business_days"]
            if not isinstance(days, list) or not days or any(d not in DAY_NAMES for d in days):
                raise ValueError
        except (ValueError, TypeError):
            problems.append("business_days must be a list like [\"Mon\", \"Tue\"]")
        try:
            if parse_hhmm(cfg["business_start"]) >= parse_hhmm(cfg["business_end"]):
                problems.append("business_start must be before business_end")
        except ValueError as e:
            problems.append("business hours: %s" % e)
        try:
            cfg["min_gap_minutes"] = max(MIN_GAP_FLOOR, float(cfg["min_gap_minutes"]))
        except (TypeError, ValueError):
            problems.append("min_gap_minutes must be a number")
            cfg["min_gap_minutes"] = MIN_GAP_FLOOR
        try:
            cfg["timeout_seconds"] = min(120, max(5, float(cfg["timeout_seconds"])))
        except (TypeError, ValueError):
            problems.append("timeout_seconds must be a number")
        tr = cfg["test_recipient"]
        if tr and not (isinstance(tr, str) and ADDR_RE.match(tr.strip())) and not str(tr).upper().startswith("FILL-ME"):
            problems.append("test_recipient isn't an email address")
        sl = cfg["suppression_list"]
        if sl and not os.path.isfile(os.path.expanduser(str(sl))):
            problems.append("suppression_list file doesn't exist: %s" % sl)
        ts = cfg["time_sources"]
        if not isinstance(ts, list) or not 1 <= len(ts) <= 5 or not all(isinstance(u, str) and u.startswith("https://") for u in ts):
            problems.append("time_sources must be a list of 1 to 5 https:// URLs")
        if NZ is None:
            problems.append("Python has no Pacific/Auckland time zone data (install tzdata)")
        return cfg, problems

    def in_hours(self, cfg, t):
        nz = t.astimezone(NZ)
        if DAY_NAMES[nz.weekday()] not in cfg["business_days"]:
            return False
        mins = nz.hour * 60 + nz.minute
        return parse_hhmm(cfg["business_start"]) <= mins < parse_hhmm(cfg["business_end"])

    def suppressed(self, cfg):
        path = cfg.get("suppression_list")
        if not path:
            return set()
        with open(os.path.expanduser(str(path)), encoding="utf-8", errors="replace") as f:
            return {a.lower() for line in f if not line.lstrip().startswith("#") for a in ADDR_FIND.findall(line)}

    def adapter(self, cfg):
        if self._adapter is not None:
            return self._adapter
        if cfg["adapter"] == "fake":
            return FakeAdapter(outbox=os.path.join(self.home, "fake-outbox.jsonl"),
                               mode=os.environ.get("PARTNERDESK_FAKE_MODE", "ok"),
                               clock_offset=float(os.environ.get("PARTNERDESK_FAKE_CLOCK_OFFSET") or 0),
                               clock=os.environ.get("PARTNERDESK_FAKE_CLOCK", "ok"))
        return GraphAdapter(cfg["token_from"], cfg["body_content_type"], cfg["timeout_seconds"])

    def state(self):
        return State(read_jsonl(self.log_path), read_jsonl(self.approvals_path))

    def draft_path(self, draft_id):
        return os.path.join(self.drafts_dir, draft_id + ".json")

    def load_draft(self, draft_id):
        p = self.draft_path(draft_id)
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        if not isinstance(d, dict) or not d.get("versions"):
            raise BrokenFile("drafts/%s.json has no versions" % draft_id)
        return d

    def log(self, outcome, mode, **fields):
        t = self.now()
        off = self.offset()
        rec = {"at": t.astimezone(NZ).isoformat(timespec="seconds") if NZ else None,
               "at_utc": t.isoformat(timespec="seconds"), "outcome": outcome, "mode": mode,
               "clock_offset_s": round(off, 3) if off is not None else None}  # None: the box clock, unmeasured
        for k, v in fields.items():
            if v is not None:
                rec[k] = scrub(v) if k == "reason" else v
        append_line(self.log_path, rec)
        bits = [outcome] + ([fields["draft_id"]] if fields.get("draft_id") else []) + ([fields["reason"]] if fields.get("reason") else [])
        self.say(" ".join(str(b) for b in bits))
        return rec

    def lock(self, wait_seconds=0):
        """The run lock (an flock on state/sender.lock). Returns the open fd, or None if another process holds it."""
        os.makedirs(self.state_dir, mode=0o700, exist_ok=True)
        fd = os.open(self.lockfile, os.O_RDWR | os.O_CREAT, 0o600)
        deadline = time.monotonic() + wait_seconds
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return fd
            except OSError as e:
                if e.errno not in (errno.EAGAIN, errno.EACCES, errno.EWOULDBLOCK):
                    os.close(fd)
                    raise
                if time.monotonic() >= deadline:
                    os.close(fd)
                    return None
                time.sleep(0.2)

    @staticmethod
    def unlock(fd):
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)

    # ---- register ------------------------------------------------------------------------------------------
    def register(self, draft_id, to, subject, body):
        """Add a version of a draft. Returns (version, sha256). Same text as the latest version: no new version."""
        if not ID_RE.match(draft_id or ""):
            raise ValueError("--id must be letters, digits, dot, dash or underscore (up to 100), starting with a letter or digit")
        to = (to or "").strip()
        if not ADDR_RE.match(to):
            raise ValueError("--to must be one email address")
        if not subject or "\n" in subject or "\r" in subject:
            raise ValueError("--subject must be one non-empty line")
        body = str(body).replace("\r\n", "\n").replace("\r", "\n")
        if not body.strip():
            raise ValueError("the body is empty")
        fd = self.lock(wait_seconds=60)
        if fd is None:
            raise RuntimeError("the sender is busy (lock held for over a minute); try again")
        try:
            if draft_id in self.state().sent_ids:
                raise ValueError("draft %s was already sent; a new email needs a new id" % draft_id)
            d = self.load_draft(draft_id) or {"id": draft_id, "versions": []}
            h = text_hash(to, subject, body)
            latest = d["versions"][-1] if d["versions"] else None
            if latest and latest["sha256"] == h:
                return latest["version"], h
            v = (latest["version"] + 1) if latest else 1
            t = self.now()
            d["versions"].append({"version": v, "to": to, "subject": subject, "body": body, "sha256": h,
                                  "registered_at": t.astimezone(NZ).isoformat(timespec="seconds") if NZ else t.isoformat()})
            write_atomic(self.draft_path(draft_id), d)
            return v, h
        finally:
            self.unlock(fd)

    # ---- approve -------------------------------------------------------------------------------------------
    def approve(self, draft_id, sha256, by):
        """Record Jesse's yes for the latest version. Returns the approval record."""
        sha256 = (sha256 or "").strip().lower()
        if not HASH_RE.match(sha256):
            raise ValueError("--sha256 must be the 64-character hash that register printed")
        if not (by or "").strip():
            raise ValueError('--by must say who approved and where (Jesse\'s words, the Slack thread ts)')
        fd = self.lock(wait_seconds=60)
        if fd is None:
            raise RuntimeError("the sender is busy (lock held for over a minute); try again")
        try:
            st = self.state()
            d = self.load_draft(draft_id) if ID_RE.match(draft_id or "") else None
            if d is None:
                raise ValueError("no draft %s; register it first" % draft_id)
            latest = d["versions"][-1]
            if sha256 != latest["sha256"]:
                older = [v["version"] for v in d["versions"] if v["sha256"] == sha256]
                raise ValueError("that hash is %s; the latest is version %d, sha256 %s. Jesse approves the latest text only"
                                 % ("version %d, not the latest" % older[0] if older else "not any version of this draft",
                                    latest["version"], latest["sha256"]))
            if text_hash(latest["to"], latest["subject"], latest["body"]) != latest["sha256"]:
                raise ValueError("drafts/%s.json was changed outside register; register the text again" % draft_id)
            if draft_id in st.sent_ids:
                raise ValueError("draft %s was already sent" % draft_id)
            if any(u.get("draft_id") == draft_id for u in st.unclear):
                raise ValueError("draft %s has an unclear send waiting on the Sent Items check; wait for the next run" % draft_id)
            for a in st.open:
                if a.get("draft_id") == draft_id and a.get("sha256") == sha256:
                    return a
            t = self.now()
            off = self.offset()
            rec = {"approval_id": secrets.token_hex(8), "draft_id": draft_id, "version": latest["version"], "sha256": sha256,
                   "to": latest["to"], "by": by.strip()[:500],
                   "at": t.astimezone(NZ).isoformat(timespec="seconds") if NZ else None, "at_utc": t.isoformat(timespec="seconds"),
                   "clock_offset_s": round(off, 3) if off is not None else None}
            append_line(self.approvals_path, rec)
            return rec
        finally:
            self.unlock(fd)

    # ---- run -----------------------------------------------------------------------------------------------
    def run(self, test=False):
        """At most one email. Returns an exit code: 0 for sent, skipped or nothing to do; 2 for a problem."""
        mode = "test" if test else "live"
        self._offset, self._offset_set = None, False  # each run measures the clock afresh
        fd = self.lock()
        if fd is None:
            self.log("SKIPPED_LOCKED", mode, reason="another sender run holds the lock")
            return 0
        try:
            return self._run_locked(test, mode)
        finally:
            self.unlock(fd)

    def _run_locked(self, test, mode):
        if os.path.exists(self.stopfile) and not test:
            self.log("SKIPPED_STOPPED", mode, reason="stop file present")
            return 0
        cfg, problems = self.config()
        if problems:
            self.log("FAILED", mode, reason="config: " + "; ".join(problems))
            return 2
        test_to = (cfg.get("test_recipient") or "").strip().lower()
        if test and not test_to:
            self.log("FAILED", mode, reason="test mode needs test_recipient in sender.json")
            return 2
        ad = self.adapter(cfg)
        why = self.measure_clock(cfg, ad)
        if why:
            self.log("SKIPPED_CLOCK", mode, reason=why)
            return 2
        now = self.now()
        if not self.in_hours(cfg, now):
            self.log("SKIPPED_HOURS", mode, reason="outside NZ business hours (%s NZ)" % now.astimezone(NZ).strftime("%a %H:%M"))
            return 0
        try:
            st = self.state()
        except BrokenFile as e:
            self.log("FAILED", mode, reason=str(e))
            return 2
        gap = dt.timedelta(minutes=cfg["min_gap_minutes"])
        if st.last_send and now - st.last_send < gap:
            nxt = (st.last_send + gap).astimezone(NZ).strftime("%H:%M")
            self.log("SKIPPED_GAP", mode, reason="last send %s NZ; next from %s NZ"
                     % (st.last_send.astimezone(NZ).strftime("%H:%M"), nxt))
            return 0

        # An unclear send is settled from Sent Items before anything else, and never retried.
        for u in st.unclear:
            since = parse_time(u.get("at_utc") or u.get("at")) - dt.timedelta(minutes=10)
            if u.get("clock_offset_s") is None:  # logged on the box clock: widen the window by today's offset
                since -= dt.timedelta(seconds=abs(self.offset() or 0))
            try:
                hit = ad.find_in_sent(u.get("internet_message_id"), u.get("to", ""), u.get("subject", ""), since)
            except LookupFailed as e:
                self.log("UNCLEAR", mode, draft_id=u.get("draft_id"), version=u.get("version"), sha256=u.get("sha256"),
                         to=u.get("to"), subject=u.get("subject"), approval_id=u.get("approval_id"),
                         graph_message_id=u.get("graph_message_id"), internet_message_id=u.get("internet_message_id"),
                         reason="still unclear, nothing else sent: " + str(e))
                return 2
            common = dict(draft_id=u.get("draft_id"), version=u.get("version"), sha256=u.get("sha256"), to=u.get("to"),
                          subject=u.get("subject"), approval_id=u.get("approval_id"), adapter=getattr(ad, "name", None))
            if hit:
                self.log("FOUND_IN_SENT", mode, graph_message_id=hit.get("message_id") or u.get("graph_message_id"),
                         internet_message_id=hit.get("internet_message_id") or u.get("internet_message_id"),
                         reason="the unclear send is in Sent Items; counted as sent", **common)
                return 0  # that was this window's email
            self.log("FAILED", mode, graph_message_id=u.get("graph_message_id"), internet_message_id=u.get("internet_message_id"),
                     reason="not in Sent Items after an unclear send; not retried, needs a fresh approval", **common)
        if st.unclear:
            st = self.state()

        try:
            blocked = self.suppressed(cfg)
        except OSError as e:
            self.log("FAILED", mode, reason="couldn't read the suppression list (%s)" % type(e).__name__)
            return 2

        attempted = False
        refused = 0
        code = 0
        for a in st.open:
            did = a.get("draft_id")
            base = dict(draft_id=did, approval_id=a.get("approval_id"), sha256=a.get("sha256"), to=a.get("to"))
            if did in st.sent_ids:
                self.log("NO_CHANGE", mode, reason="already sent; not sent again", **base)
                continue
            try:
                d = self.load_draft(did) if ID_RE.match(did or "") else None
            except (BrokenFile, ValueError) as e:
                self.log("REFUSED_HASH", mode, reason="draft file unreadable: %s" % e, **base)
                refused += 1
                continue
            if d is None:
                self.log("REFUSED_HASH", mode, reason="no draft file for this approval", **base)
                refused += 1
                continue
            latest = d["versions"][-1]
            base.update(version=latest["version"], to=latest["to"])
            if text_hash(latest["to"], latest["subject"], latest["body"]) != latest["sha256"]:
                self.log("REFUSED_HASH", mode, reason="the latest text doesn't match its hash (changed outside register)", **base)
                refused += 1
                continue
            if a.get("sha256") != latest["sha256"]:
                older = [v["version"] for v in d["versions"][:-1] if v["sha256"] == a.get("sha256")]
                if older:
                    self.log("REFUSED_STALE", mode, reason="approved version %d, but version %d is newer; Jesse approves the latest"
                             % (older[0], latest["version"]), **base)
                else:
                    self.log("REFUSED_HASH", mode, reason="the approved hash matches no version of this draft", **base)
                refused += 1
                continue
            if latest["to"].lower() in blocked:
                self.log("REFUSED_SUPPRESSED", mode, reason="recipient is on the suppression list", **base)
                refused += 1
                continue
            if test and latest["to"].strip().lower() != test_to:
                self.log("REFUSED_TEST_RECIPIENT", mode, reason="test mode sends only to test_recipient; stays queued", **base)
                refused += 1
                continue
            if attempted:
                continue  # one email per run; the rest wait for the next run
            # The last checks, right before the email.
            if not test and os.path.exists(self.stopfile):
                self.log("SKIPPED_STOPPED", mode, reason="stop file appeared during the run")
                return 0
            if not self.in_hours(cfg, self.now()):
                self.log("SKIPPED_HOURS", mode, reason="business hours ended during the run")
                return 0
            attempted = True
            fields = dict(base, subject=latest["subject"], approved_by=a.get("by"), adapter=getattr(ad, "name", None))
            try:
                res = ad.send(latest["to"], latest["subject"], latest["body"])
            except SendUnclear as e:
                self.log("UNCLEAR", mode, graph_message_id=e.message_id, internet_message_id=e.internet_message_id,
                         reason="%s; the next run checks Sent Items, never resends blindly" % e, **fields)
                code = 2
                continue
            except SendFailed as e:
                self.log("FAILED", mode, graph_message_id=e.message_id, internet_message_id=e.internet_message_id,
                         reason="%s; not retried, needs a fresh approval" % e, **fields)
                code = 2
                continue
            except Exception as e:  # noqa: BLE001 - anything unexpected during a send is treated as unclear
                self.log("UNCLEAR", mode, reason="unexpected %s during the send; the next run checks Sent Items" % type(e).__name__, **fields)
                code = 2
                continue
            self.log("SENT", mode, graph_message_id=res.get("message_id"), internet_message_id=res.get("internet_message_id"), **fields)
        if not attempted:
            self.log("NO_CHANGE", mode, reason=("nothing sent; %d refused" % refused) if refused else "nothing approved to send")
        return code

    # ---- init-config ---------------------------------------------------------------------------------------
    def init_config(self, token_from, test_recipient, content_type="text"):
        """Write sender.json once, from the example's defaults. Refuses if it exists. Returns the problems left."""
        if os.path.exists(self.config_path):
            raise ValueError("sender.json already exists; change it by hand (through plan) instead")
        if not ADDR_RE.match((test_recipient or "").strip()):
            raise ValueError("--test-recipient must be one email address")
        cfg = dict(DEFAULTS, token_from=token_from, test_recipient=test_recipient.strip(), body_content_type=content_type)
        os.makedirs(self.home, exist_ok=True)
        write_atomic(self.config_path, cfg)
        return self.config()[1]

    # ---- status --------------------------------------------------------------------------------------------
    def status(self):
        """Read-only. Creates nothing."""
        say = self.say
        say("## clock")
        sys_t = self.system_now()
        say("system_utc: %s (this computer's own clock)" % sys_t.isoformat(timespec="seconds"))
        off, how = None, None
        if os.path.exists(self.config_path):  # with no sender.json there's nothing to send, so no network either
            cfg, _ = self.config()
            if isinstance(cfg.get("time_sources"), list) and all(isinstance(u, str) and u.startswith("https://") for u in cfg["time_sources"]):
                live, answers = self.read_clock(cfg, self.adapter(cfg))
                for a in answers:
                    say("source: %s %s" % (a.get("url"), ("%+.1f s (answer took %.1f s)" % (a["offset_s"], a.get("rtt_s") or 0))
                                           if a.get("offset_s") is not None else "no answer: %s" % a.get("error")))
                if live is not None:
                    off, how = live, "measured just now (median of %d)" % sum(1 for a in answers if a.get("offset_s") is not None)
        saved = self.saved_clock()
        if saved:
            say("saved: %+.1f s, measured %.0f min ago (%s)" % (saved["offset_s"], saved["age_s"] / 60, self.clock_path))
            if off is None and saved["fresh"]:
                off, how = saved["offset_s"], "saved %.0f min ago; no source answered just now" % (saved["age_s"] / 60)
        else:
            say("saved: none yet (%s)" % self.clock_path)
        if off is None:
            say("offset: UNKNOWN; a run would send nothing (SKIPPED_CLOCK)")
        elif abs(off) > CLOCK_MAX_OFFSET_S:
            say("offset: %+.1f s, %s: implausible (over 6 hours); a run would send nothing (SKIPPED_CLOCK)" % (off, how))
        else:
            say("offset: %+.1f s, %s%s" % (off, how, "" if abs(off) <= 30 else "; the box clock is wrong, the sender corrects for it"))
        t = sys_t + dt.timedelta(seconds=off or 0)
        tag = "(corrected)" if off is not None else "(the box clock, not corrected)"
        say("nz:  %s %s" % (t.astimezone(NZ).isoformat(timespec="seconds") if NZ else "UNKNOWN (no time zone data)", tag))
        say("utc: %s %s" % (t.isoformat(timespec="seconds"), tag))
        say("corrected_epoch: %d" % int(t.timestamp()))
        say("## stop file")
        say(("present: " if os.path.exists(self.stopfile) else "absent: ") + self.stopfile)
        say("## lock")
        if not os.path.exists(self.lockfile):
            say("free (no lock file yet)")
        else:
            fd = os.open(self.lockfile, os.O_RDONLY)
            try:
                fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
                fcntl.flock(fd, fcntl.LOCK_UN)
                say("free")
            except OSError:
                say("held: a sender run is going now")
            finally:
                os.close(fd)
        say("## config")
        cfg, problems = self.config()
        say("file: %s (%s)" % (self.config_path, "present" if os.path.exists(self.config_path) else "MISSING"))
        say("adapter: %s" % cfg["adapter"])
        tf = str(cfg.get("token_from") or "")
        if cfg["adapter"] == "graph" and tf and not tf.upper().startswith("FILL-ME"):
            parts = tf.rsplit(":", 2)
            ok = len(parts) == 3 and os.path.isfile(os.path.join(os.path.expanduser(parts[0]), parts[1] + ".py"))
            say("token_from: %s (%s)" % (tf, "module file found" if ok else "module file NOT found"))
        say("test_recipient: %s" % (cfg.get("test_recipient") or "not set"))
        say("hours: %s %s-%s NZ; gap: %g min" % (",".join(cfg["business_days"]) if isinstance(cfg["business_days"], list) else "?",
                                                cfg["business_start"], cfg["business_end"], cfg["min_gap_minutes"]))
        say("suppression_list: %s" % (cfg.get("suppression_list") or "none"))
        say("problems: " + ("; ".join(problems) if problems else "none"))
        say("## queue")
        try:
            st = self.state()
            for u in st.unclear:
                say("UNCLEAR, waiting on the Sent Items check: %s to %s at %s" % (u.get("draft_id"), u.get("to"), u.get("at")))
            if not st.open:
                say("no approved drafts waiting")
            for a in st.open:
                say("approved: %s v%s to %s, sha256 %s..., by %s, at %s" % (a.get("draft_id"), a.get("version"), a.get("to"),
                                                                        str(a.get("sha256"))[:12], a.get("by"), a.get("at")))
        except BrokenFile as e:
            say("BROKEN: %s" % e)
        say("## send log (last 10)")
        if not os.path.exists(self.log_path):
            say("empty")
        else:
            with open(self.log_path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()[-10:]
            for line in lines:
                try:
                    e = json.loads(line)
                    say("%s %s %s %s %s" % (e.get("at"), e.get("mode"), e.get("outcome"), e.get("draft_id") or "-",
                                            e.get("reason") or e.get("to") or ""))
                except ValueError:
                    say("BROKEN LINE: " + line.strip()[:120])
        return 0


# ---- selfcheck ---------------------------------------------------------------------------------------------
class _Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, minutes):
        self.t = self.t + dt.timedelta(minutes=minutes)


def _fresh(tmp, name, clock, adapter, test_recipient="jesse@example.invalid"):
    home = os.path.join(tmp, name)
    os.makedirs(home)
    with open(os.path.join(home, "sender.json"), "w", encoding="utf-8") as f:
        json.dump({"adapter": "fake", "test_recipient": test_recipient}, f)
    return Desk(home, now=clock, adapter=adapter, out=io.StringIO())


def _outcomes(desk):
    return [e["outcome"] for e in read_jsonl(desk.log_path)]


def selfcheck(out=None):
    """The SPEC checks 1, 2, 4, 5, test mode and the clock, with a fake adapter in a temporary folder. Touches nothing real."""
    out = out or sys.stdout
    if NZ is None:
        print("FAIL  no Pacific/Auckland time zone data", file=out)
        return 1
    tmp = tempfile.mkdtemp(prefix="sender-selfcheck-")
    start = dt.datetime(2026, 11, 3, 10, 1, tzinfo=NZ)  # a Tuesday, 10:01 NZ
    results = []

    def check(name, fn):
        try:
            fn()
            results.append((name, True, ""))
        except AssertionError as e:
            results.append((name, False, str(e)))
        except Exception as e:  # noqa: BLE001
            results.append((name, False, "%s: %s" % (type(e).__name__, e)))

    def body(text):
        return text + "\n\nCheers,\nJesse\n"

    def c1():
        clock = _Clock(start)
        fake = FakeAdapter()
        d = _fresh(tmp, "c1", clock, fake)
        for i in (1, 2):
            v, h = d.register("c1-%d" % i, "partner%d@example.invalid" % i, "Hello %d" % i, body("Draft %d" % i))
            d.approve("c1-%d" % i, h, "selfcheck")
        fd = d.lock()
        try:
            env = dict(os.environ, PARTNERDESK_HOME=d.home, PARTNERDESK_FAKE_NOW=start.isoformat())
            p = subprocess.run([sys.executable, os.path.abspath(__file__), "run"], env=env, capture_output=True, text=True, timeout=60)
            assert "SKIPPED_LOCKED" in p.stdout, "a second run didn't exit on the lock: %r" % (p.stdout + p.stderr)
        finally:
            d.unlock(fd)
        assert not fake.sent and not os.path.exists(os.path.join(d.home, "fake-outbox.jsonl")), "a locked-out run sent"
        d.run()
        assert len(fake.sent) == 1, "one run sent %d emails, not 1" % len(fake.sent)
        clock.advance(15)
        d.run()
        assert len(fake.sent) == 2, "the second email didn't go in the next run"

    def c2():
        clock = _Clock(start)
        fake = FakeAdapter()
        d = _fresh(tmp, "c2", clock, fake)
        v, h = d.register("c2", "partner@example.invalid", "Hello", body("Stop check"))
        d.approve("c2", h, "selfcheck")
        os.makedirs(d.state_dir, exist_ok=True)
        open(d.stopfile, "w").close()
        d.run()
        assert not fake.sent, "sent with the stop file present"
        assert _outcomes(d)[-1] == "SKIPPED_STOPPED", "didn't log SKIPPED_STOPPED"

    def c4():
        clock = _Clock(start)
        fake = FakeAdapter()
        d = _fresh(tmp, "c4", clock, fake)
        v1, h1 = d.register("c4", "partner@example.invalid", "Hello", body("Version one"))
        d.approve("c4", h1, "selfcheck")
        v2, h2 = d.register("c4", "partner@example.invalid", "Hello", body("Version two, edited"))
        assert v2 == 2 and h2 != h1, "the edit didn't make a new version"
        d.run()
        assert not fake.sent, "sent an approval for an older version"
        log = read_jsonl(d.log_path)
        assert log[0]["outcome"] == "REFUSED_STALE" and "newer" in log[0]["reason"], "the log doesn't say why: %r" % log
        try:
            d.approve("c4", h1, "selfcheck")
            raise AssertionError("approve accepted an old hash")
        except ValueError:
            pass

    def c5():
        clock = _Clock(start)
        fake = FakeAdapter()
        d = _fresh(tmp, "c5", clock, fake)
        v, h = d.register("c5", "partner@example.invalid", "Hello", body("Once only"))
        d.approve("c5", h, "selfcheck")
        d.run()
        sent = read_jsonl(d.log_path)[-1]
        assert sent["outcome"] == "SENT" and sent.get("graph_message_id") and sent["sha256"] == h, "SENT entry incomplete"
        assert sent["at"].endswith("+13:00"), "log time isn't NZ time with its offset"
        clock.advance(20)
        d.run()
        assert len(fake.sent) == 1 and _outcomes(d)[-1] == "NO_CHANGE", "second run wasn't NO_CHANGE"
        # An unclear send is checked in Sent Items and never resent.
        fake2 = FakeAdapter(mode="unclear", unclear_delivered=True)
        d2 = _fresh(tmp, "c5u", clock, fake2)
        v, h = d2.register("c5u", "partner@example.invalid", "Hello", body("Unclear"))
        d2.approve("c5u", h, "selfcheck")
        d2.run()
        assert _outcomes(d2)[-1] == "UNCLEAR", "a timeout wasn't logged UNCLEAR"
        fake2.mode = "ok"
        clock.advance(20)
        d2.run()
        assert _outcomes(d2)[-1] == "FOUND_IN_SENT" and len(fake2.attempts) == 1, "the unclear email was resent"

    def ct():
        clock = _Clock(start)
        fake = FakeAdapter()
        d = _fresh(tmp, "ct", clock, fake, test_recipient="jesse@example.invalid")
        v, hr = d.register("ct-real", "partner@example.invalid", "Hello", body("Real recipient"))
        d.approve("ct-real", hr, "selfcheck")
        v, ht = d.register("ct-test", "jesse@example.invalid", "Test", body("Test send"))
        d.approve("ct-test", ht, "selfcheck")
        os.makedirs(d.state_dir, exist_ok=True)
        open(d.stopfile, "w").close()
        d.run(test=True)
        assert [m["to"] for m in fake.sent] == ["jesse@example.invalid"], "test mode sent to %r" % [m["to"] for m in fake.sent]
        outs = _outcomes(d)
        assert "REFUSED_TEST_RECIPIENT" in outs and "SENT" in outs, "test mode log: %r" % outs

    def cclock():
        slow = -1932  # the Revenue Partner's box clock on 3 Nov 2026: 32 minutes behind
        true_t = dt.datetime(2026, 11, 3, 8, 0, 30, tzinfo=NZ)  # 08:00:30 NZ, just open
        clock = _Clock(true_t + dt.timedelta(seconds=slow))      # the box thinks it's 07:28
        fake = FakeAdapter(clock_offset=-slow)
        d = _fresh(tmp, "cclock", clock, fake)
        for i in (1, 2):
            v, h = d.register("cc-%d" % i, "partner%d@example.invalid" % i, "Hello %d" % i, body("Clock %d" % i))
            d.approve("cc-%d" % i, h, "selfcheck")
        d.run()
        e = read_jsonl(d.log_path)[-1]
        assert e["outcome"] == "SENT", "a slow box clock at 08:00 NZ didn't send: %s %s" % (e["outcome"], e.get("reason"))
        assert e["at"].startswith("2026-11-03T08:00:30+13:00"), "the log time isn't the corrected NZ time: %s" % e["at"]
        assert e.get("clock_offset_s") == 1932, "the log doesn't carry clock_offset_s"
        clock.advance(14)
        d.run()
        assert _outcomes(d)[-1] == "SKIPPED_GAP", "the gap wasn't kept on corrected time"
        clock.advance(1)
        d.run()
        assert _outcomes(d)[-1] == "SENT", "the second email didn't go 15 minutes later"
        clock.t = dt.datetime(2026, 11, 3, 17, 0, 30, tzinfo=NZ) + dt.timedelta(seconds=slow)  # box says 16:28; really 17:00
        v, h = d.register("cc-3", "partner3@example.invalid", "Hello 3", body("Clock 3"))
        d.approve("cc-3", h, "selfcheck")
        d.run()
        assert _outcomes(d)[-1] == "SKIPPED_HOURS", "a slow box clock sent after 17:00 NZ"

    check("check 1: one sender (lock, one email per run)", c1)
    check("check 2: stop file", c2)
    check("check 4: only the latest draft", c4)
    check("check 5: each email once (and unclear sends)", c5)
    check("test mode: only the test address, even with the stop file", ct)
    check("clock: a 32-minute-slow system clock still gives the right NZ hours and gap", cclock)
    shutil.rmtree(tmp, ignore_errors=True)
    for name, ok, why in results:
        print("%s  %s%s" % ("PASS" if ok else "FAIL", name, "" if ok else ": " + why), file=out)
    return 0 if all(ok for _, ok, _ in results) else 1


# ---- command line ------------------------------------------------------------------------------------------
def main(argv=None):
    p = argparse.ArgumentParser(prog="sender.py", description="The one sender for the Revenue Partner.")
    sub = p.add_subparsers(dest="cmd")
    r = sub.add_parser("register", help="add a version of a draft")
    r.add_argument("--id", required=True)
    r.add_argument("--to", required=True)
    r.add_argument("--subject", required=True)
    r.add_argument("--body-file", required=True, help="a file with the body, or - for standard input")
    a = sub.add_parser("approve", help="record Jesse's yes for the latest version")
    a.add_argument("--id", required=True)
    a.add_argument("--sha256", required=True)
    a.add_argument("--by", required=True)
    rn = sub.add_parser("run", help="send at most one approved email")
    rn.add_argument("--test", action="store_true", help="send only to test_recipient; allowed while the stop file exists")
    ic = sub.add_parser("init-config", help="write sender.json once (refuses if it exists)")
    ic.add_argument("--token-from", required=True, help="<folder>:msgraph_mail:get_token")
    ic.add_argument("--test-recipient", required=True, help="Jesse's own address")
    ic.add_argument("--content-type", default="text", choices=["text", "html"])
    sub.add_parser("status", help="read-only summary")
    sub.add_parser("selfcheck", help="the SPEC checks in a temporary folder")
    args = p.parse_args(argv)
    if args.cmd == "selfcheck":
        return selfcheck()
    if args.cmd is None:
        p.print_help()
        return 1
    desk = Desk()
    if args.cmd == "status":
        return desk.status()
    if args.cmd == "run":
        return desk.run(test=args.test)
    try:
        if args.cmd == "register":
            if args.body_file == "-":
                text = sys.stdin.read()
            else:
                with open(args.body_file, encoding="utf-8") as f:
                    text = f.read()
            v, h = desk.register(args.id, args.to, args.subject, text)
            print("id: %s\nversion: %d\nsha256: %s" % (args.id, v, h))
            return 0
        if args.cmd == "init-config":
            left = desk.init_config(args.token_from, args.test_recipient, args.content_type)
            print("wrote %s; problems: %s" % (desk.config_path, "; ".join(left) if left else "none"))
            return 0 if not left else 1
        if args.cmd == "approve":
            rec = desk.approve(args.id, args.sha256, args.by)
            print("approved: %s version %s sha256 %s (approval %s)" % (rec["draft_id"], rec["version"], rec["sha256"], rec["approval_id"]))
            return 0
    except (ValueError, RuntimeError, OSError, BrokenFile) as e:
        print("refused: %s" % e, file=sys.stderr)
        return 1
    return 1


if __name__ == "__main__":
    sys.exit(main())
