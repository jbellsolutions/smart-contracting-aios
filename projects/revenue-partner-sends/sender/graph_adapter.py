"""Mail adapters for the one sender (sender.py). Python 3.9+, standard library only.

GraphAdapter sends one email through Microsoft Graph's REST API in two steps, so the send log gets the
message's ids:
  1. POST /me/messages            creates the message (in Drafts) and returns its id and internetMessageId
  2. POST /me/messages/{id}/send  sends it (Graph answers 202)
A failure in step 1, or a clear refusal in step 2 (HTTP 4xx), means nothing was sent: SendFailed.
A timeout, a dropped connection or an HTTP 5xx in step 2 means it may have gone: SendUnclear. The sender then
checks Sent Items (find_in_sent) before anything else, and never retries by itself.

The access token comes from the agent's own mail code. sender.json names it as "token_from":
"<folder>:<module>:<function>", for example "/home/u/.hermes/scripts:msgraph_mail:get_token". The folder is
added to sys.path, and the function is called as fn(force_refresh=False), then once with force_refresh=True if
Graph answers 401. The token is never printed, logged or stored here.

measure_clock reads the time from the HTTPS Date header of each time source (by default Graph itself and
Microsoft's sign-in server). It sends no token and no mail: one HEAD request each, and any answer counts, even
401 or 405, because every answer carries Date. The offset is the server's time minus the middle of the request,
on this computer's own clock. The sender uses it when the box clock is wrong and can't be set (an Orgo container).

FakeAdapter is for tests and selfcheck: it records what it would send and never touches the network.
"""
import email.utils
import importlib
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

GRAPH = "https://graph.microsoft.com/v1.0"
MAX_CLOCK_RTT_S = 10  # a slower answer is too vague to set the clock by


class SendFailed(Exception):
    """Definitely not sent."""

    def __init__(self, reason, message_id=None, internet_message_id=None):
        super().__init__(reason)
        self.message_id = message_id
        self.internet_message_id = internet_message_id


class SendUnclear(Exception):
    """May have been sent. Check Sent Items before anything else; never retry blindly."""

    def __init__(self, reason, message_id=None, internet_message_id=None):
        super().__init__(reason)
        self.message_id = message_id
        self.internet_message_id = internet_message_id


class LookupFailed(Exception):
    """Sent Items couldn't be checked. The result stays unclear."""


class TokenError(Exception):
    """The token function failed or returned nothing."""


def load_token_fn(spec):
    """Import the callable named "<folder>:<module>:<function>"."""
    parts = str(spec or "").rsplit(":", 2)
    if len(parts) != 3 or not all(p.strip() for p in parts[1:]):
        raise TokenError('token_from must look like "<folder>:<module>:<function>"')
    folder, module, func = (p.strip() for p in parts)
    if folder:
        folder = os.path.expanduser(folder)
        if not os.path.isdir(folder):
            raise TokenError("token_from's folder doesn't exist: " + folder)
        if folder not in sys.path:
            sys.path.insert(0, folder)
    try:
        mod = importlib.import_module(module)
    except Exception as e:  # noqa: BLE001 - any import problem is reported plainly
        raise TokenError("couldn't import %s: %s" % (module, type(e).__name__))
    fn = getattr(mod, func, None)
    if not callable(fn):
        raise TokenError("%s has no function %s" % (module, func))
    return fn


def describe(err):
    """A short, key-free description of an error."""
    if isinstance(err, urllib.error.HTTPError):
        code = ""
        try:
            body = json.loads(err.read() or b"{}")
            code = (body.get("error") or {}).get("code") or ""
        except Exception:  # noqa: BLE001
            pass
        return "HTTP %s%s" % (err.code, (" " + code) if code else "")
    if isinstance(err, urllib.error.URLError):
        return "network error: %s" % (getattr(err, "reason", err),)
    if isinstance(err, TimeoutError) or "timed out" in str(err).lower():
        return "timed out"
    if isinstance(err, TokenError):
        return "token: %s" % (err,)
    return "%s: %s" % (type(err).__name__, str(err)[:160])


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect answer is answer enough: its Date header is read, and it isn't followed."""

    def redirect_request(self, *args, **kwargs):
        return None


_CLOCK_OPENER = urllib.request.build_opener(_NoRedirect)


def measure_clock(urls, urlopen=None, timeout=15, wall=time.time):
    """One result per URL: {"url", "offset_s", "rtt_s"} or {"url", "error"}. Never raises.
    offset_s = the server's Date (plus half a second, as Date drops the fraction) minus the middle of the request."""
    urlopen = urlopen or _CLOCK_OPENER.open
    results = []
    for url in urls or []:
        r = {"url": str(url)}
        results.append(r)
        if not str(url).startswith("https://"):
            r["error"] = "not an https URL"
            continue
        req = urllib.request.Request(str(url), method="HEAD", headers={"Cache-Control": "no-cache", "User-Agent": "partnerdesk-sender"})
        t0 = wall()
        headers = None
        try:
            with urlopen(req, timeout=timeout) as resp:
                headers = getattr(resp, "headers", None)
        except urllib.error.HTTPError as e:  # 401, 405, a redirect: still a server answer with a Date
            headers = e.headers
        except Exception as e:  # noqa: BLE001 - no answer from this source
            r["error"] = describe(e)
            continue
        t1 = wall()
        date = headers.get("Date") if headers is not None else None
        try:
            server = email.utils.parsedate_to_datetime(date).timestamp() + 0.5
        except (TypeError, ValueError, AttributeError, IndexError):
            r["error"] = "no usable Date header"
            continue
        rtt = t1 - t0
        if rtt < 0 or rtt > MAX_CLOCK_RTT_S:
            r["error"] = "answer took %.1f s; too slow to set the clock by" % rtt
            continue
        r["offset_s"] = round(server - (t0 + t1) / 2, 3)
        r["rtt_s"] = round(rtt, 3)
    return results


class GraphAdapter:
    name = "graph"

    def __init__(self, token_from, content_type="text", timeout=30, urlopen=None, time_urlopen=None):
        self._token_from = token_from
        self._fn = token_from if callable(token_from) else None
        self._token = None
        self.content_type = "HTML" if str(content_type).lower() == "html" else "Text"
        self.timeout = timeout
        self._urlopen = urlopen or urllib.request.urlopen
        self._time_urlopen = time_urlopen

    def measure_clock(self, urls):
        """The box clock's offset from each time source. No token, nothing sent."""
        return measure_clock(urls, self._time_urlopen, timeout=min(float(self.timeout), 15))

    def _get_token(self, force):
        try:
            if self._fn is None:
                self._fn = load_token_fn(self._token_from)
            tok = self._fn(force_refresh=force)
        except TokenError:
            raise
        except Exception as e:  # noqa: BLE001
            raise TokenError("the token function failed (%s)" % type(e).__name__)
        if not isinstance(tok, str) or not tok.strip():
            raise TokenError("the token function returned no token")
        return tok.strip()

    def _call(self, method, url, payload=None):
        """One Graph call. Returns (status, parsed JSON or None). On 401, gets a fresh token and tries once more."""
        if not url.startswith(GRAPH + "/"):
            raise ValueError("refusing a URL outside Microsoft Graph")
        for attempt in (0, 1):
            if self._token is None or attempt == 1:
                self._token = self._get_token(force=attempt == 1)
            headers = {"Authorization": "Bearer " + self._token, "Accept": "application/json"}
            data = b""
            if payload is not None:
                data = json.dumps(payload).encode("utf-8")
                headers["Content-Type"] = "application/json"
            req = urllib.request.Request(url, data=data if method != "GET" else None, method=method, headers=headers)
            try:
                with self._urlopen(req, timeout=self.timeout) as resp:
                    status = getattr(resp, "status", None) or resp.getcode()
                    raw = resp.read()
                    return status, (json.loads(raw) if raw else None)
            except urllib.error.HTTPError as e:
                if e.code == 401 and attempt == 0:
                    continue
                raise
        raise RuntimeError("unreachable")

    def send(self, to, subject, body):
        message = {
            "subject": subject,
            "body": {"contentType": self.content_type, "content": body},
            "toRecipients": [{"emailAddress": {"address": to}}],
        }
        try:
            status, data = self._call("POST", GRAPH + "/me/messages", message)
        except Exception as e:  # noqa: BLE001 - creating a draft never sends
            raise SendFailed("creating the message failed, nothing sent: " + describe(e))
        if status not in (200, 201) or not isinstance(data, dict) or not data.get("id"):
            raise SendFailed("creating the message gave HTTP %s and no id, nothing sent" % status)
        mid, imid = data["id"], data.get("internetMessageId")
        url = "%s/me/messages/%s/send" % (GRAPH, urllib.parse.quote(mid, safe=""))
        try:
            status, _ = self._call("POST", url)
        except urllib.error.HTTPError as e:
            if e.code >= 500:
                raise SendUnclear("the send call gave " + describe(e), mid, imid)
            raise SendFailed("Graph refused the send: " + describe(e), mid, imid)
        except TokenError as e:
            # Only reached after a 401 on the send call, which Graph answers before sending anything.
            raise SendFailed("Graph refused the send (401) and a fresh token failed: " + describe(e), mid, imid)
        except Exception as e:  # noqa: BLE001 - timeouts, dropped connections: it may have gone
            raise SendUnclear("the send call didn't answer cleanly: " + describe(e), mid, imid)
        if not 200 <= int(status) < 300:
            raise SendUnclear("the send call gave HTTP %s" % status, mid, imid)
        return {"message_id": mid, "internet_message_id": imid}

    def find_in_sent(self, internet_message_id, to, subject, since_utc):
        """Look for the email in Sent Items: by internetMessageId first, then by recipient and subject since
        since_utc (a datetime in UTC). Returns a dict of ids, or None. Raises LookupFailed if it can't check."""
        base = GRAPH + "/me/mailFolders/SentItems/messages"
        select = "id,internetMessageId,subject,toRecipients,sentDateTime"
        enc = lambda q: urllib.parse.urlencode(q, quote_via=urllib.parse.quote)  # noqa: E731
        try:
            if internet_message_id:
                flt = "internetMessageId eq '%s'" % internet_message_id.replace("'", "''")
                _, data = self._call("GET", base + "?" + enc({"$filter": flt, "$select": select}))
                for m in (data or {}).get("value", []):
                    if m.get("internetMessageId") == internet_message_id:
                        return _hit(m)
            since = since_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
            url = base + "?" + enc({"$filter": "sentDateTime ge " + since, "$select": select, "$top": "50"})
            for _ in range(10):
                _, data = self._call("GET", url)
                for m in (data or {}).get("value", []):
                    addrs = [((r.get("emailAddress") or {}).get("address") or "").lower() for r in m.get("toRecipients") or []]
                    if m.get("subject") == subject and to.lower() in addrs:
                        return _hit(m)
                url = (data or {}).get("@odata.nextLink")
                if not url or not url.startswith(GRAPH + "/"):
                    break
            return None
        except Exception as e:  # noqa: BLE001
            raise LookupFailed("couldn't check Sent Items: " + describe(e))


def _hit(m):
    return {"message_id": m.get("id"), "internet_message_id": m.get("internetMessageId"), "sent_at": m.get("sentDateTime")}


class FakeAdapter:
    """Sends nothing. Records each email in memory and, when outbox is a path, in that file (one JSON per line).

    mode: "ok" sends; "fail" raises SendFailed; "unclear" raises SendUnclear (and, if unclear_delivered, also puts
    the email in Sent Items, as when the send went through but the answer was lost).
    lookup: "ok" checks Sent Items; "fail" raises LookupFailed.
    clock_offset: what measure_clock reports, in seconds (+1932 = the box clock is 32 minutes slow).
    clock: "ok" answers from every time source; "fail" from none.
    """

    name = "fake"

    def __init__(self, outbox=None, mode="ok", lookup="ok", unclear_delivered=False, clock_offset=0.0, clock="ok"):
        self.outbox = outbox
        self.mode = mode
        self.lookup = lookup
        self.unclear_delivered = unclear_delivered
        self.clock_offset = clock_offset
        self.clock = clock
        self.sent = []          # emails that went out
        self.attempts = []      # every send call
        self.clock_reads = 0

    def measure_clock(self, urls):
        self.clock_reads += 1
        if self.clock == "fail":
            return [{"url": u, "error": "fake adapter: no answer"} for u in urls]
        return [{"url": u, "offset_s": float(self.clock_offset), "rtt_s": 0.0} for u in urls]

    def _items(self):
        items = list(self.sent)
        if self.outbox and os.path.exists(self.outbox):
            with open(self.outbox, encoding="utf-8") as f:
                items += [json.loads(line) for line in f if line.strip()]
        return items

    def send(self, to, subject, body):
        mid = "fake-" + secrets.token_hex(6)
        rec = {"to": to, "subject": subject, "body": body, "message_id": mid, "internet_message_id": "<%s@fake.invalid>" % mid}
        self.attempts.append(rec)
        if self.mode == "fail":
            raise SendFailed("fake adapter: refused")
        if self.mode == "unclear":
            if self.unclear_delivered:
                self._record(rec)
            raise SendUnclear("fake adapter: timed out", mid, rec["internet_message_id"])
        self._record(rec)
        return {"message_id": mid, "internet_message_id": rec["internet_message_id"]}

    def _record(self, rec):
        if self.outbox:
            with open(self.outbox, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec) + "\n")
        else:
            self.sent.append(rec)

    def find_in_sent(self, internet_message_id, to, subject, since_utc):
        if self.lookup == "fail":
            raise LookupFailed("fake adapter: Sent Items unreachable")
        for m in self._items():
            if internet_message_id and m.get("internet_message_id") == internet_message_id:
                return {"message_id": m["message_id"], "internet_message_id": m["internet_message_id"], "sent_at": None}
        for m in self._items():
            if m.get("subject") == subject and m.get("to", "").lower() == to.lower():
                return {"message_id": m["message_id"], "internet_message_id": m["internet_message_id"], "sent_at": None}
        return None
