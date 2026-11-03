"""Tests for the one sender. Run from this folder: python3 -m unittest
No network: the fake adapter stands in for Graph, and the Graph adapter is tested with a fake urlopen."""
import datetime as dt
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import sender  # noqa: E402
from graph_adapter import GRAPH, FakeAdapter, GraphAdapter, LookupFailed, SendFailed, SendUnclear, measure_clock  # noqa: E402

NZ = sender.NZ
TUE_10 = dt.datetime(2026, 11, 3, 10, 1, tzinfo=NZ)  # Tuesday, NZ daylight time (+13:00)
SIG = "\n\nCheers,\nJesse\n"


class Clock:
    def __init__(self, t):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, minutes):
        self.t += dt.timedelta(minutes=minutes)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="sender-test-")
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.clock = Clock(TUE_10)
        self.fake = FakeAdapter()
        self.cfg = {"adapter": "fake", "test_recipient": "jesse@example.invalid"}
        self.desk = self.make()

    def make(self, **cfg):
        self.cfg.update(cfg)
        with open(os.path.join(self.tmp, "sender.json"), "w") as f:
            json.dump(self.cfg, f)
        self.out = io.StringIO()
        return sender.Desk(self.tmp, now=self.clock, adapter=self.fake, out=self.out)

    def draft(self, did, to="partner@example.invalid", subject="Hello", body="Kia ora" + SIG, approve=True):
        v, h = self.desk.register(did, to, subject, body)
        if approve:
            self.desk.approve(did, h, "Jesse: yes (slack ts 1730000000.000100)")
        return v, h

    def log(self):
        return sender.read_jsonl(self.desk.log_path)

    def outcomes(self):
        return [e["outcome"] for e in self.log()]

    def stop(self):
        os.makedirs(self.desk.state_dir, exist_ok=True)
        open(self.desk.stopfile, "w").close()


class RegisterAndApprove(Base):
    def test_versions_and_hash(self):
        v1, h1 = self.desk.register("d1", "a@example.invalid", "S", "one\r\ntwo\r\n")
        v1b, h1b = self.desk.register("d1", "a@example.invalid", "S", "one\ntwo\n")
        self.assertEqual((v1, h1), (v1b, h1b), "CRLF and LF are the same text; no new version")
        v2, h2 = self.desk.register("d1", "a@example.invalid", "S", "one\ntwo, edited\n")
        self.assertEqual(v2, 2)
        self.assertNotEqual(h1, h2)
        self.assertEqual(h1, sender.text_hash("a@example.invalid", "S", "one\ntwo\n"))
        d = self.desk.load_draft("d1")
        self.assertEqual([v["version"] for v in d["versions"]], [1, 2])

    def test_hash_covers_recipient_and_subject(self):
        h = sender.text_hash("a@example.invalid", "S", "b")
        self.assertNotEqual(h, sender.text_hash("b@example.invalid", "S", "b"))
        self.assertNotEqual(h, sender.text_hash("a@example.invalid", "S2", "b"))

    def test_bad_input_refused(self):
        for args in [("../x", "a@example.invalid", "S", "b"), ("d", "not-an-address", "S", "b"),
                     ("d", "a@example.invalid, b@example.invalid", "S", "b"), ("d", "a@example.invalid", "S\nBcc: x", "b"),
                     ("d", "a@example.invalid", "S", "   ")]:
            with self.assertRaises(ValueError, msg=args):
                self.desk.register(*args)

    def test_approve_needs_latest_hash(self):
        _, h1 = self.draft("d", approve=False)
        _, h2 = self.desk.register("d", "partner@example.invalid", "Hello", "Edited" + SIG)
        with self.assertRaisesRegex(ValueError, "not the latest"):
            self.desk.approve("d", h1, "Jesse")
        with self.assertRaisesRegex(ValueError, "not any version"):
            self.desk.approve("d", "0" * 64, "Jesse")
        with self.assertRaises(ValueError):
            self.desk.approve("d", h2, "  ")
        with self.assertRaises(ValueError):
            self.desk.approve("nope", h2, "Jesse")
        rec = self.desk.approve("d", h2, "Jesse: yes")
        self.assertEqual(rec["version"], 2)
        again = self.desk.approve("d", h2, "Jesse: yes again")
        self.assertEqual(again["approval_id"], rec["approval_id"], "a repeat yes doesn't queue the email twice")
        self.assertEqual(len(sender.read_jsonl(self.desk.approvals_path)), 1)

    def test_sent_draft_cannot_be_changed_or_reapproved(self):
        _, h = self.draft("d")
        self.desk.run()
        with self.assertRaisesRegex(ValueError, "already sent"):
            self.desk.approve("d", h, "Jesse")
        with self.assertRaisesRegex(ValueError, "already sent"):
            self.desk.register("d", "partner@example.invalid", "Hello", "New text")


class StopFile(Base):  # SPEC requirement 2
    def test_stop_file_blocks_and_logs(self):
        self.draft("d")
        self.stop()
        self.assertEqual(self.desk.run(), 0)
        self.assertEqual(self.fake.attempts, [])
        self.assertEqual(self.outcomes(), ["SKIPPED_STOPPED"])

    def test_stop_file_checked_first(self):
        self.draft("d")
        self.stop()
        os.remove(os.path.join(self.tmp, "sender.json"))  # even a broken setup stops on the stop file first
        self.desk.run()
        self.assertEqual(self.outcomes(), ["SKIPPED_STOPPED"])

    def test_stop_file_checked_right_before_the_email(self):
        self.draft("d")
        desk = self.desk
        real = desk.suppressed

        def sneaky(cfg):  # the stop file appears after the run started
            self.stop()
            return real(cfg)
        desk.suppressed = sneaky
        desk.run()
        self.assertEqual(self.fake.attempts, [])
        self.assertEqual(self.outcomes()[-1], "SKIPPED_STOPPED")

    def test_removing_stop_file_lets_it_send(self):
        self.draft("d")
        self.stop()
        self.desk.run()
        os.remove(self.desk.stopfile)
        self.desk.run()
        self.assertEqual(len(self.fake.sent), 1)


class Hours(Base):
    def test_outside_hours_skipped(self):
        self.draft("d")
        for t in [dt.datetime(2026, 11, 7, 10, 0, tzinfo=NZ),   # Saturday
                  dt.datetime(2026, 11, 3, 7, 59, tzinfo=NZ),   # before 08:00
                  dt.datetime(2026, 11, 3, 17, 0, tzinfo=NZ)]:  # 17:00 is closed
            self.clock.t = t
            self.desk.run()
            self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS", t)
        self.assertEqual(self.fake.attempts, [])
        self.clock.t = dt.datetime(2026, 11, 3, 8, 0, tzinfo=NZ)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SENT")

    def test_hours_are_nz_time_whatever_the_clock_zone(self):
        self.draft("d")
        # 19:30 UTC Tuesday = 08:30 NZDT Wednesday: open. 05:00 UTC Tuesday = 18:00 NZDT: closed.
        self.clock.t = dt.datetime(2026, 11, 3, 5, 0, tzinfo=dt.timezone.utc)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS")
        self.clock.t = dt.datetime(2026, 11, 3, 19, 30, tzinfo=dt.timezone.utc)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SENT")
        self.assertTrue(self.log()[-1]["at"].startswith("2026-11-04T08:30:00+13:00"))

    def test_hours_configurable(self):
        self.desk = self.make(business_days=["Sat"], business_start="09:00", business_end="12:00")
        self.draft("d")
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS")
        self.clock.t = dt.datetime(2026, 11, 7, 9, 30, tzinfo=NZ)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SENT")


class Gap(Base):
    def test_fifteen_minutes_apart(self):
        self.draft("a")
        self.draft("b")
        self.desk.run()
        self.clock.advance(10)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_GAP")
        self.clock.advance(5)
        self.desk.run()
        self.assertEqual(len(self.fake.sent), 2)

    def test_gap_never_below_fifteen(self):
        self.desk = self.make(min_gap_minutes=1)
        self.draft("a")
        self.draft("b")
        self.desk.run()
        self.clock.advance(14)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_GAP")

    def test_gap_can_be_longer(self):
        self.desk = self.make(min_gap_minutes=30)
        self.draft("a")
        self.draft("b")
        self.desk.run()
        self.clock.advance(20)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_GAP")


class OneSender(Base):  # SPEC requirement 1
    def test_one_email_per_run_oldest_first(self):
        self.draft("first", to="one@example.invalid")
        self.draft("second", to="two@example.invalid")
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.sent], ["one@example.invalid"])
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.sent], ["one@example.invalid", "two@example.invalid"])

    def test_second_run_exits_on_the_lock(self):
        self.draft("d")
        fd = self.desk.lock()
        try:
            self.assertEqual(self.desk.run(), 0)
        finally:
            sender.Desk.unlock(fd)
        self.assertEqual(self.outcomes(), ["SKIPPED_LOCKED"])
        self.assertEqual(self.fake.attempts, [])

    def test_lock_holds_across_processes(self):
        self.draft("d")
        fd = self.desk.lock()
        try:
            env = dict(os.environ, PARTNERDESK_HOME=self.tmp, PARTNERDESK_FAKE_NOW=TUE_10.isoformat())
            p = subprocess.run([sys.executable, os.path.join(HERE, "sender.py"), "run"], env=env,
                               capture_output=True, text=True, timeout=60)
        finally:
            sender.Desk.unlock(fd)
        self.assertIn("SKIPPED_LOCKED", p.stdout)
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "fake-outbox.jsonl")))

    def test_nothing_to_do_is_no_change(self):
        self.assertEqual(self.desk.run(), 0)
        self.assertEqual(self.outcomes(), ["NO_CHANGE"])

    def test_unapproved_draft_never_sends(self):
        self.draft("d", approve=False)
        self.desk.run()
        self.assertEqual(self.fake.attempts, [])

    def test_bad_config_refuses(self):
        self.desk = self.make(adapter="graph", token_from="FILL-ME: path")
        self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.outcomes()[-1], "FAILED")
        self.assertIn("token_from isn't filled in", self.log()[-1]["reason"])
        self.desk = self.make(adapter="fake", typo_setting=1)
        self.desk.run()
        self.assertIn("unknown setting", self.log()[-1]["reason"])
        self.assertEqual(self.fake.attempts, [])

    def test_broken_log_line_refuses(self):
        self.draft("d")
        with open(self.desk.log_path, "a") as f:
            f.write('{"outcome": "SENT", "draft_id": "d"\n')
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.fake.attempts, [])

    def test_frozen_clock_env_ignored_with_graph_adapter(self):
        with open(os.path.join(self.tmp, "sender.json"), "w") as f:
            json.dump({"adapter": "graph", "token_from": "/x:m:f"}, f)
        os.environ["PARTNERDESK_FAKE_NOW"] = "2020-01-01T10:00:00+13:00"
        try:
            t = sender.Desk(self.tmp).now()
        finally:
            del os.environ["PARTNERDESK_FAKE_NOW"]
        self.assertGreater(t.year, 2020)


class LatestOnly(Base):  # SPEC requirement 4
    def test_edit_after_approval_refused_stale(self):
        _, h1 = self.draft("d")
        self.desk.register("d", "partner@example.invalid", "Hello", "Edited after the yes" + SIG)
        self.desk.run()
        self.assertEqual(self.fake.attempts, [])
        e = self.log()[0]
        self.assertEqual(e["outcome"], "REFUSED_STALE")
        self.assertIn("version 2 is newer", e["reason"])
        self.assertEqual(e["sha256"], h1)
        self.clock.advance(15)
        self.desk.run()  # the dead approval stays dead
        self.assertEqual(self.fake.attempts, [])

    def test_approve_latest_then_sends_latest_text(self):
        self.draft("d")
        _, h2 = self.desk.register("d", "partner@example.invalid", "Hello", "Version two" + SIG)
        self.desk.approve("d", h2, "Jesse: yes to v2")
        self.desk.run()
        self.assertEqual([m["body"] for m in self.fake.sent], ["Version two" + SIG])
        self.assertIn("REFUSED_STALE", self.outcomes())

    def test_draft_file_edited_in_place_refused(self):
        self.draft("d")
        p = self.desk.draft_path("d")
        with open(p) as f:
            d = json.load(f)
        d["versions"][-1]["body"] = "Sneaky change"
        with open(p, "w") as f:
            json.dump(d, f)
        self.desk.run()
        self.assertEqual(self.fake.attempts, [])
        self.assertEqual(self.outcomes()[0], "REFUSED_HASH")

    def test_approval_with_unknown_hash_refused(self):
        self.draft("d", approve=False)
        sender.append_line(self.desk.approvals_path, {"approval_id": "x1", "draft_id": "d", "sha256": "f" * 64, "by": "forged"})
        self.desk.run()
        self.assertEqual(self.fake.attempts, [])
        self.assertEqual(self.outcomes()[0], "REFUSED_HASH")

    def test_approval_without_draft_refused(self):
        sender.append_line(self.desk.approvals_path, {"approval_id": "x2", "draft_id": "ghost", "sha256": "a" * 64, "by": "?"})
        self.desk.run()
        self.assertEqual(self.outcomes()[0], "REFUSED_HASH")

    def test_sends_exact_approved_text(self):
        body = "Kia ora Sam,\r\n\r\nLine with  two spaces.\r\n" + SIG
        self.draft("d", body=body, subject="Re: drains")
        self.desk.run()
        m = self.fake.sent[0]
        self.assertEqual((m["to"], m["subject"], m["body"]), ("partner@example.invalid", "Re: drains", body.replace("\r\n", "\n")))


class EachOnce(Base):  # SPEC requirement 5
    def test_run_again_after_send_is_no_change(self):
        _, h = self.draft("d")
        self.desk.run()
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "SENT")
        for k in ("draft_id", "version", "sha256", "to", "graph_message_id", "internet_message_id", "approval_id", "at", "at_utc"):
            self.assertTrue(e.get(k), k)
        self.assertEqual(e["sha256"], h)
        self.assertTrue(e["at"].endswith("+13:00"))
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "NO_CHANGE")
        self.assertEqual(len(self.fake.sent), 1)

    def test_second_approval_line_for_sent_draft_is_no_change(self):
        _, h = self.draft("d")
        self.desk.run()
        sender.append_line(self.desk.approvals_path, {"approval_id": "dup", "draft_id": "d", "sha256": h, "by": "dup"})
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual(len(self.fake.sent), 1)
        self.assertIn({"NO_CHANGE"}, [{e["outcome"]} for e in self.log() if e.get("approval_id") == "dup"])

    def test_failed_send_not_retried(self):
        self.fake.mode = "fail"
        _, h = self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.outcomes()[-1], "FAILED")
        self.fake.mode = "ok"
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual(self.fake.sent, [], "a failed send waits for a fresh approval")
        self.desk.approve("d", h, "Jesse: yes, try again")
        self.desk.run()
        self.assertEqual(len(self.fake.sent), 1)


class Unclear(Base):
    def unclear_first(self, delivered):
        self.fake.mode = "unclear"
        self.fake.unclear_delivered = delivered
        _, h = self.draft("d")
        self.draft("next", to="other@example.invalid")
        self.assertEqual(self.desk.run(), 2)
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "UNCLEAR")
        self.assertTrue(e.get("internet_message_id"))
        self.fake.mode = "ok"
        return h

    def test_unclear_counts_for_the_gap(self):
        self.unclear_first(True)
        self.clock.advance(5)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_GAP")

    def test_unclear_found_in_sent_is_sent(self):
        h = self.unclear_first(True)
        with self.assertRaisesRegex(ValueError, "unclear"):
            self.desk.approve("d", h, "Jesse")
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "FOUND_IN_SENT")
        self.assertEqual(len(self.fake.attempts), 1, "nothing else sent in the run that settled it")
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.attempts], ["partner@example.invalid", "other@example.invalid"])
        with self.assertRaisesRegex(ValueError, "already sent"):
            self.desk.approve("d", h, "Jesse")

    def test_unclear_not_found_is_failed_and_not_retried(self):
        h = self.unclear_first(False)
        self.clock.advance(15)
        self.desk.run()
        outs = self.outcomes()
        self.assertIn("FAILED", outs)
        self.assertEqual([m["to"] for m in self.fake.sent], ["other@example.invalid"], "the failed one isn't retried")
        self.clock.advance(15)
        self.desk.approve("d", h, "Jesse: yes, send it again")
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.sent], ["other@example.invalid", "partner@example.invalid"])

    def test_sent_items_unreachable_stays_unclear(self):
        self.unclear_first(True)
        self.fake.lookup = "fail"
        self.clock.advance(15)
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.outcomes()[-1], "UNCLEAR")
        self.assertEqual(len(self.fake.attempts), 1, "nothing sent while unclear")


class Suppression(Base):
    def test_suppressed_recipient_refused(self):
        path = os.path.join(self.tmp, "suppress.txt")
        with open(path, "w") as f:
            f.write("# opted out\nPartner@Example.invalid\n2026-10-30, other@example.invalid, said no\n")
        self.desk = self.make(suppression_list=path)
        self.draft("d")
        self.draft("e", to="other@example.invalid")
        self.draft("f", to="fine@example.invalid")
        self.desk.run()
        self.assertEqual(self.outcomes().count("REFUSED_SUPPRESSED"), 2)
        self.assertEqual([m["to"] for m in self.fake.sent], ["fine@example.invalid"])

    def test_missing_suppression_file_refuses_to_send(self):
        self.desk = self.make(suppression_list=os.path.join(self.tmp, "missing.txt"))
        self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.fake.attempts, [])


class TestMode(Base):
    def test_test_mode_with_stop_file(self):
        self.draft("real")
        self.draft("t", to="Jesse@Example.invalid")
        self.stop()
        self.desk.run(test=True)
        self.assertEqual([m["to"] for m in self.fake.sent], ["Jesse@Example.invalid"])
        refused = [e for e in self.log() if e["outcome"] == "REFUSED_TEST_RECIPIENT"]
        self.assertEqual([e["draft_id"] for e in refused], ["real"])
        self.assertTrue(all(e["mode"] == "test" for e in self.log()))
        # The real one stays queued: it goes only after the stop file is removed, in a normal run.
        self.clock.advance(15)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_STOPPED")
        os.remove(self.desk.stopfile)
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.sent], ["Jesse@Example.invalid", "partner@example.invalid"])

    def test_test_mode_only_real_recipients_sends_nothing(self):
        self.draft("real")
        self.desk.run(test=True)
        self.assertEqual(self.fake.attempts, [])
        self.assertEqual(self.outcomes(), ["REFUSED_TEST_RECIPIENT", "NO_CHANGE"])

    def test_test_mode_needs_test_recipient(self):
        self.desk = self.make(test_recipient=None)
        self.draft("t", to="jesse@example.invalid")
        self.assertEqual(self.desk.run(test=True), 2)
        self.assertEqual(self.fake.attempts, [])

    def test_test_mode_keeps_hours_and_latest_only(self):
        self.draft("t", to="jesse@example.invalid")
        self.desk.register("t", "jesse@example.invalid", "Hello", "edited" + SIG)
        self.desk.run(test=True)
        self.assertEqual(self.outcomes()[0], "REFUSED_STALE")
        self.clock.t = dt.datetime(2026, 11, 7, 10, 0, tzinfo=NZ)
        self.desk.run(test=True)
        self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS")
        self.assertEqual(self.fake.attempts, [])


class InitConfig(Base):
    def test_init_config_once(self):
        home = os.path.join(self.tmp, "fresh")
        d = sender.Desk(home)
        mod = os.path.join(self.tmp, "mods")
        os.mkdir(mod)
        open(os.path.join(mod, "msgraph_mail.py"), "w").close()
        left = d.init_config(mod + ":msgraph_mail:get_token", "jesse@example.invalid")
        self.assertEqual(left, [])
        cfg, problems = d.config()
        self.assertEqual((cfg["adapter"], cfg["test_recipient"], cfg["min_gap_minutes"]), ("graph", "jesse@example.invalid", 15))
        with self.assertRaisesRegex(ValueError, "already exists"):
            d.init_config(mod + ":msgraph_mail:get_token", "jesse@example.invalid")
        with self.assertRaises(ValueError):
            sender.Desk(os.path.join(self.tmp, "x")).init_config("a:b:c", "not an address")

    def test_example_config_needs_filling(self):
        shutil.copy(os.path.join(HERE, "sender.example.json"), os.path.join(self.tmp, "sender.json"))
        cfg, problems = self.desk.config()
        self.assertIn("token_from isn't filled in", problems)
        self.assertIn("test_recipient isn't filled in", problems)
        self.assertEqual(len(problems), 2, problems)


class Status(Base):
    def test_status_creates_nothing(self):
        empty = os.path.join(self.tmp, "empty")
        os.mkdir(empty)
        out = io.StringIO()
        sender.Desk(empty, out=out).status()
        self.assertEqual(os.listdir(empty), [])
        self.assertIn("MISSING", out.getvalue())

    def test_status_shows_queue_and_stop(self):
        self.draft("d")
        self.stop()
        self.desk.run()
        self.desk.status()
        text = self.out.getvalue()
        for s in ("present:", "approved: d v1", "SKIPPED_STOPPED", "nz:", "utc:", "problems: none"):
            self.assertIn(s, text)


class Selfcheck(unittest.TestCase):
    def test_selfcheck_passes(self):
        out = io.StringIO()
        self.assertEqual(sender.selfcheck(out), 0, out.getvalue())
        self.assertEqual(out.getvalue().count("PASS"), 6)
        self.assertIn("PASS  clock: a 32-minute-slow system clock", out.getvalue())


SLOW = -1932  # the Revenue Partner's box clock on 3 Nov 2026: 32 minutes behind


class SlowClock(Base):
    """The box clock is 32 minutes slow and can't be set. The sender measures the offset and uses corrected time."""

    def setUp(self):
        super().setUp()
        self.fake.clock_offset = -SLOW
        self.at(TUE_10)

    def at(self, true_nz):
        self.clock.t = true_nz + dt.timedelta(seconds=SLOW)  # what the box clock says at that true time

    def test_opens_at_eight_on_corrected_time(self):
        self.draft("d")
        self.at(dt.datetime(2026, 11, 3, 7, 59, 30, tzinfo=NZ))  # box says 07:27
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS")
        self.assertIn("07:59 NZ", self.log()[-1]["reason"])
        self.at(dt.datetime(2026, 11, 3, 8, 0, 0, tzinfo=NZ))  # box says 07:28: the box alone would wait 32 minutes
        self.desk.run()
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "SENT")
        self.assertEqual(e["at"], "2026-11-03T08:00:00+13:00")
        self.assertEqual(e["at_utc"], "2026-11-02T19:00:00+00:00")

    def test_closes_at_five_on_corrected_time(self):
        self.draft("a")
        self.draft("b", to="other@example.invalid")
        self.at(dt.datetime(2026, 11, 3, 16, 59, 0, tzinfo=NZ))  # box says 16:27
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SENT")
        self.at(dt.datetime(2026, 11, 3, 17, 14, 0, tzinfo=NZ))  # box says 16:42: the box alone would still send
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_HOURS")
        self.assertEqual(len(self.fake.sent), 1)

    def test_gap_on_corrected_time(self):
        self.draft("a")
        self.draft("b", to="other@example.invalid")
        self.desk.run()
        self.assertEqual(self.log()[-1]["at"], "2026-11-03T10:01:00+13:00")
        self.clock.advance(14)
        self.desk.run()
        self.assertEqual(self.outcomes()[-1], "SKIPPED_GAP")
        self.assertIn("next from 10:16 NZ", self.log()[-1]["reason"])
        self.clock.advance(1)  # 15 real minutes later; the box clock alone would say 09:44, before the last send
        self.desk.run()
        self.assertEqual([m["to"] for m in self.fake.sent], ["partner@example.invalid", "other@example.invalid"])

    def test_every_log_entry_carries_the_offset(self):
        self.draft("d")
        self.desk.run()
        self.stop()
        self.clock.advance(15)
        self.desk.run()  # SKIPPED_STOPPED, before any measuring: the saved offset is used
        fd = self.desk.lock()
        try:
            self.desk.run()  # SKIPPED_LOCKED
        finally:
            sender.Desk.unlock(fd)
        self.assertEqual(self.outcomes(), ["SENT", "SKIPPED_STOPPED", "SKIPPED_LOCKED"])
        self.assertEqual([e["clock_offset_s"] for e in self.log()], [1932, 1932, 1932])
        self.assertEqual(self.log()[1]["at"], "2026-11-03T10:16:00+13:00")
        a = sender.read_jsonl(self.desk.approvals_path)[0]
        self.assertIn("clock_offset_s", a)

    def test_measurement_saved(self):
        self.draft("d")
        self.desk.run()
        with open(self.desk.clock_path) as f:
            c = json.load(f)
        self.assertEqual(c["offset_s"], 1932)
        self.assertEqual(c["measured_at_utc"], "2026-11-02T21:01:00+00:00")
        self.assertEqual([x["url"] for x in c["sources"]], sender.DEFAULTS["time_sources"])

    def test_median_of_sources(self):
        self.fake.measure_clock = lambda urls: [{"url": "a", "offset_s": 5.0}, {"url": "b", "offset_s": 1932.0},
                                                {"url": "c", "offset_s": 1933.0}, {"url": "d", "error": "down"}]
        self.draft("d")
        self.desk.run()
        self.assertEqual(self.log()[-1]["clock_offset_s"], 1932)

    def test_no_source_fresh_saved_offset_used(self):
        self.draft("a")
        self.draft("b", to="other@example.invalid")
        self.desk.run()
        self.fake.clock = "fail"
        self.clock.advance(5 * 60 + 50)  # 5 h 50 min later: 15:51 NZ, box says 15:19
        self.desk.run()
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "SENT")
        self.assertEqual(e["at"], "2026-11-03T15:51:00+13:00")
        self.assertEqual(e["clock_offset_s"], 1932)

    def test_no_source_stale_saved_offset_refuses(self):
        self.draft("a")
        self.draft("b", to="other@example.invalid")
        self.desk.run()
        self.fake.clock = "fail"
        self.clock.advance(6 * 60 + 1)
        self.assertEqual(self.desk.run(), 2)
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "SKIPPED_CLOCK")
        self.assertIn("no time source answered", e["reason"])
        self.assertIsNone(e["clock_offset_s"])
        self.assertEqual(len(self.fake.attempts), 1)

    def test_no_source_and_nothing_saved_refuses(self):
        self.fake.clock = "fail"
        self.draft("d", to="jesse@example.invalid")
        self.assertEqual(self.desk.run(), 2)
        self.assertEqual(self.desk.run(test=True), 2)
        self.assertEqual(self.outcomes(), ["SKIPPED_CLOCK", "SKIPPED_CLOCK"])
        self.assertEqual(self.fake.attempts, [])
        self.assertFalse(os.path.exists(self.desk.clock_path))

    def test_implausible_offset_refuses(self):
        self.fake.clock_offset = 6 * 3600 + 60
        self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        e = self.log()[-1]
        self.assertEqual(e["outcome"], "SKIPPED_CLOCK")
        self.assertIn("clock offset implausible", e["reason"])
        self.assertEqual(self.fake.attempts, [])
        self.assertFalse(os.path.exists(self.desk.clock_path), "an implausible offset isn't saved")

    def test_implausible_saved_offset_refuses(self):
        os.makedirs(self.desk.state_dir, exist_ok=True)
        with open(self.desk.clock_path, "w") as f:
            json.dump({"offset_s": -8 * 3600, "system_utc": self.clock.t.astimezone(dt.timezone.utc).isoformat()}, f)
        self.fake.clock = "fail"
        self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        self.assertIn("clock offset implausible", self.log()[-1]["reason"])
        self.assertEqual(self.fake.attempts, [])

    def test_unclear_from_box_clock_widens_lookup(self):
        _, h = self.draft("d")
        a = sender.read_jsonl(self.desk.approvals_path)[0]
        sender.append_line(self.desk.log_path, {"outcome": "UNCLEAR", "mode": "live", "approval_id": a["approval_id"], "draft_id": "d",
                                                "to": "partner@example.invalid", "subject": "Hello", "at_utc": "2026-11-02T20:00:00+00:00"})
        seen = []
        self.fake.find_in_sent = lambda imid, to, subject, since: seen.append(since)
        self.desk.run()
        self.assertEqual(seen, [dt.datetime(2026, 11, 2, 19, 50, tzinfo=dt.timezone.utc) - dt.timedelta(seconds=1932)])

    def test_fake_now_and_fake_offset_from_the_command_line(self):
        self.draft("d")
        env = dict(os.environ, PARTNERDESK_HOME=self.tmp, PARTNERDESK_FAKE_NOW=self.clock.t.isoformat(),
                   PARTNERDESK_FAKE_CLOCK_OFFSET="1932")
        p = subprocess.run([sys.executable, os.path.join(HERE, "sender.py"), "run"], env=env, capture_output=True, text=True, timeout=60)
        self.assertIn("SENT d", p.stdout, p.stdout + p.stderr)
        self.assertEqual(self.log()[-1]["at"], "2026-11-03T10:01:00+13:00")

    def test_status_shows_the_clock(self):
        self.desk.status()
        text = self.out.getvalue()
        self.assertIn("system_utc: 2026-11-02T20:28:48+00:00", text)
        self.assertIn("offset: +1932.0 s, measured just now", text)
        self.assertIn("nz:  2026-11-03T10:01:00+13:00 (corrected)", text)
        self.assertIn("corrected_epoch: %d" % TUE_10.timestamp(), text)
        self.assertFalse(os.path.exists(self.desk.clock_path), "status saves nothing")
        self.fake.clock = "fail"
        self.out.truncate(0)
        self.desk.status()
        self.assertIn("offset: UNKNOWN; a run would send nothing (SKIPPED_CLOCK)", self.out.getvalue())

    def test_bad_time_sources_refused(self):
        self.desk = self.make(time_sources=["http://example.invalid/"])
        self.draft("d")
        self.assertEqual(self.desk.run(), 2)
        self.assertIn("time_sources", self.log()[-1]["reason"])
        self.assertEqual(self.fake.attempts, [])


class Hdrs(dict):
    def get(self, k, default=None):
        return dict.get(self, k, default)


class TimeResp:
    def __init__(self, date):
        self.headers = Hdrs({"Date": date} if date else {})
        self.status = 200

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Wall:
    def __init__(self, *ticks):
        self.ticks = list(ticks)

    def __call__(self):
        return self.ticks.pop(0)


class MeasureClockTests(unittest.TestCase):
    DATE = "Mon, 02 Nov 2026 21:01:00 GMT"
    SERVER = dt.datetime(2026, 11, 2, 21, 1, 0, tzinfo=dt.timezone.utc).timestamp()

    def test_offset_from_the_middle_of_the_request(self):
        net = FakeNet(TimeResp(self.DATE))
        t0 = self.SERVER - 1932
        res = measure_clock(["https://graph.microsoft.com/v1.0/"], net, wall=Wall(t0, t0 + 0.4))
        self.assertEqual(res, [{"url": "https://graph.microsoft.com/v1.0/", "offset_s": 1932.3, "rtt_s": 0.4}])
        req = net.requests[0]
        self.assertEqual(req.get_method(), "HEAD")
        self.assertIsNone(req.get_header("Authorization"), "no token goes to a time source")

    def test_an_error_answer_still_tells_the_time(self):
        err = urllib.error.HTTPError("u", 401, "x", Hdrs({"Date": self.DATE}), io.BytesIO(b""))
        res = measure_clock(["https://login.microsoftonline.com/"], FakeNet(err), wall=Wall(self.SERVER, self.SERVER))
        self.assertEqual(res[0]["offset_s"], 0.5)

    def test_no_answer_no_date_slow_answer_not_https(self):
        res = measure_clock(["https://a.invalid/", "https://b.invalid/", "https://c.invalid/", "http://d.invalid/"],
                            FakeNet(urllib.error.URLError("down"), TimeResp(None), TimeResp(self.DATE)),
                            wall=Wall(0, 0, 0, self.SERVER, self.SERVER + 11))
        self.assertTrue(all("error" in r and "offset_s" not in r for r in res), res)
        self.assertIn("network error", res[0]["error"])
        self.assertIn("no usable Date", res[1]["error"])
        self.assertIn("too slow", res[2]["error"])
        self.assertIn("not an https", res[3]["error"])

    def test_graph_adapter_uses_its_own_time_opener(self):
        net = FakeNet(TimeResp(self.DATE), TimeResp(self.DATE))
        g = GraphAdapter(Tokens(), urlopen=FakeNet(), time_urlopen=net)
        res = g.measure_clock(sender.DEFAULTS["time_sources"])
        self.assertEqual(len(res), 2)
        self.assertEqual([r.full_url for r in net.requests], sender.DEFAULTS["time_sources"])


# ---- the Graph adapter, with a fake urlopen ----------------------------------------------------------------
class Resp:
    def __init__(self, status, body=None):
        self.status = status
        self._b = json.dumps(body).encode() if body is not None else b""

    def read(self):
        return self._b

    def getcode(self):
        return self.status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def http_error(url, code):
    return urllib.error.HTTPError(url, code, "x", {}, io.BytesIO(json.dumps({"error": {"code": "E%d" % code}}).encode()))


class FakeNet:
    """Answers each call from a list of handlers; records requests."""

    def __init__(self, *answers):
        self.answers = list(answers)
        self.requests = []

    def __call__(self, req, timeout=None):
        self.requests.append(req)
        a = self.answers.pop(0)
        if isinstance(a, BaseException):
            raise a
        return a


class Tokens:
    def __init__(self):
        self.calls = []

    def __call__(self, force_refresh=False):
        self.calls.append(force_refresh)
        return "tok-refreshed" if force_refresh else "tok-1"


class GraphAdapterTests(unittest.TestCase):
    def created(self):
        return Resp(201, {"id": "AAMk/id+1=", "internetMessageId": "<abc@x>"})

    def test_create_then_send(self):
        net = FakeNet(self.created(), Resp(202))
        g = GraphAdapter(Tokens(), content_type="html", urlopen=net)
        res = g.send("a@example.invalid", "Subj", "<p>Hi</p>")
        self.assertEqual(res, {"message_id": "AAMk/id+1=", "internet_message_id": "<abc@x>"})
        create, send = net.requests
        self.assertEqual(create.full_url, GRAPH + "/me/messages")
        payload = json.loads(create.data)
        self.assertEqual(payload["body"], {"contentType": "HTML", "content": "<p>Hi</p>"})
        self.assertEqual(payload["toRecipients"][0]["emailAddress"]["address"], "a@example.invalid")
        self.assertEqual(send.full_url, GRAPH + "/me/messages/AAMk%2Fid%2B1%3D/send")
        self.assertEqual(send.get_method(), "POST")
        self.assertEqual(send.get_header("Authorization"), "Bearer tok-1")

    def test_401_refreshes_token_once(self):
        tokens = Tokens()
        net = FakeNet(http_error("u", 401), self.created(), Resp(202))
        GraphAdapter(tokens, urlopen=net).send("a@example.invalid", "S", "b")
        self.assertEqual(tokens.calls, [False, True])
        self.assertEqual(net.requests[1].get_header("Authorization"), "Bearer tok-refreshed")

    def test_create_failure_is_failed(self):
        for err in (http_error("u", 400), urllib.error.URLError("down"), TimeoutError("timed out")):
            with self.assertRaises(SendFailed):
                GraphAdapter(Tokens(), urlopen=FakeNet(err)).send("a@example.invalid", "S", "b")

    def test_send_timeout_is_unclear_with_ids(self):
        for err in (TimeoutError("timed out"), urllib.error.URLError("reset"), http_error("u", 503), ConnectionResetError()):
            with self.assertRaises(SendUnclear) as cm:
                GraphAdapter(Tokens(), urlopen=FakeNet(self.created(), err)).send("a@example.invalid", "S", "b")
            self.assertEqual(cm.exception.internet_message_id, "<abc@x>")

    def test_send_refused_is_failed(self):
        with self.assertRaises(SendFailed):
            GraphAdapter(Tokens(), urlopen=FakeNet(self.created(), http_error("u", 400))).send("a@example.invalid", "S", "b")

    def test_token_never_in_errors(self):
        try:
            GraphAdapter(Tokens(), urlopen=FakeNet(http_error("u", 403))).send("a@example.invalid", "S", "b")
        except SendFailed as e:
            self.assertNotIn("tok-1", str(e))
            self.assertIn("HTTP 403", str(e))

    def test_find_by_internet_message_id(self):
        net = FakeNet(Resp(200, {"value": [{"id": "S1", "internetMessageId": "<a'b@x>", "sentDateTime": "2026-11-03T00:00:00Z"}]}))
        hit = GraphAdapter(Tokens(), urlopen=net).find_in_sent("<a'b@x>", "a@example.invalid", "S", dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc))
        self.assertEqual(hit["message_id"], "S1")
        self.assertIn("internetMessageId%20eq%20%27%3Ca%27%27b%40x%3E%27", net.requests[0].full_url)
        self.assertTrue(net.requests[0].full_url.startswith(GRAPH + "/me/mailFolders/SentItems/messages?"))

    def test_find_falls_back_to_recipient_and_subject(self):
        net = FakeNet(Resp(200, {"value": []}),
                      Resp(200, {"value": [{"id": "S0", "subject": "Other", "toRecipients": [{"emailAddress": {"address": "a@example.invalid"}}]}],
                                 "@odata.nextLink": GRAPH + "/me/mailFolders/SentItems/messages?page=2"}),
                      Resp(200, {"value": [{"id": "S2", "subject": "S", "toRecipients": [{"emailAddress": {"address": "A@example.invalid"}}]}]}))
        hit = GraphAdapter(Tokens(), urlopen=net).find_in_sent("<gone@x>", "a@example.invalid", "S", dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc))
        self.assertEqual(hit["message_id"], "S2")
        self.assertIn("sentDateTime%20ge%202026-11-03T00%3A00%3A00Z", net.requests[1].full_url)

    def test_find_not_found_and_lookup_failure(self):
        net = FakeNet(Resp(200, {"value": []}))
        self.assertIsNone(GraphAdapter(Tokens(), urlopen=net).find_in_sent(None, "a@example.invalid", "S", dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc)))
        with self.assertRaises(LookupFailed):
            GraphAdapter(Tokens(), urlopen=FakeNet(urllib.error.URLError("down"))).find_in_sent("<x>", "a@example.invalid", "S", dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc))

    def test_next_link_off_graph_not_followed(self):
        net = FakeNet(Resp(200, {"value": [], "@odata.nextLink": "https://evil.example/steal"}))
        self.assertIsNone(GraphAdapter(Tokens(), urlopen=net).find_in_sent(None, "a@example.invalid", "S", dt.datetime(2026, 11, 3, tzinfo=dt.timezone.utc)))
        self.assertEqual(len(net.requests), 1)

    def test_token_from_spec(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, True)
        with open(os.path.join(d, "msgraph_mail_testmod.py"), "w") as f:
            f.write("CALLS = []\ndef get_token(force_refresh=False):\n    CALLS.append(force_refresh)\n    return 'from-module'\n")
        net = FakeNet(self.created(), Resp(202))
        GraphAdapter(d + ":msgraph_mail_testmod:get_token", urlopen=net).send("a@example.invalid", "S", "b")
        self.assertEqual(net.requests[0].get_header("Authorization"), "Bearer from-module")
        with self.assertRaises(SendFailed):
            GraphAdapter("/no/such/dir:msgraph_mail:get_token", urlopen=FakeNet()).send("a@example.invalid", "S", "b")


if __name__ == "__main__":
    unittest.main()
