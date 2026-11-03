# Project: one sender for the Revenue Partner

**Owner:** the Revenue Partner's computer (Orgo), built by Justin's team with Jesse · **Checked by:** the Chief of Staff, through `skills/orgo-link` · **Milestone:** M0 gate: sends stay off until every check below passes · **Asks:** 106–111 (Jesse's fix list), 66

## Why
Every draft thread was its own AI session, and each one wrote its own send script and timer. The sessions couldn't see each other, so they raced. "Hold" lived only in the AI's memory, so nothing that sent ever checked it. Sessions ran out of steps halfway through sending, so some approved emails never went. The clock was wrong and mixed NZ and UTC times. The fix is Jesse's own: the AI drafts, and one plain script sends.

## Until this passes
- The stop file (requirement 2) exists, and no sender or timer is scheduled.
- Drafting carries on. Jesse sends anything urgent himself, from Outlook.
- Jesse's interim rule stands: a "yes" or an edit goes only in that draft's own thread, one approval at a time, and he waits for "sent" before the next.

## Requirements and their checks

Each check is something `node tools/orgo.mjs status` shows, or one command run on the computer with Jesse's yes (`skills/orgo-link`, "Changing the computer").

| # | Requirement | Check |
|---|---|---|
| 1 | **One sender.** The AI only writes drafts and records Jesse's approval. One plain script, the sender, is the only code that calls the mail account. It runs from exactly one scheduler entry, holds a lock, and sends at most one email per run. Sends are at least 15 minutes apart and only in NZ business hours (the Revenue Partner's own rule, Slack 29 Oct). Every outbound email goes through it, including the partner program's. | `status` lists one scheduler entry for the sender, and no other cron line, `at` job, systemd timer, Hermes one-shot job or `sleep` process that sends. A search of the agent's skills finds the mail API called only from the sender. Starting the sender twice at once: the second exits on the lock. |
| 2 | **A real stop switch.** One stop file at a fixed path outside `/tmp` (`~/PartnerDesk/state/SEND-STOP`), so it survives a restart. The sender checks it before every email and, if it's there, sends nothing and logs `SKIPPED_STOPPED`. "Hold" creates it; "sends back on" removes it, only on Jesse's words. | With the file present, a sender run sends nothing and logs `SKIPPED_STOPPED`. `status` shows whether the file exists. |
| 3 | **The right clock, NZ time only.** The computer's clock is synced (NTP on). Everything shown to Jesse is NZ time (Pacific/Auckland); logs store full timestamps with their offset. | Pass if `status` shows NTP synced and the clock within 30 seconds of this PC. Or, when the box clock can't be set (for example an Orgo container): the sender's `status` shows a measured offset under 6 hours, and its corrected NZ time within 30 seconds of this PC (`sender_clock_off_by_seconds` in `node tools/orgo.mjs status`). |
| 4 | `sender-check`: "PASS check 4". On the computer: the check 4 command below prints `REFUSED_STALE check4 approved version 1, but version 2 is newer` and sends nothing |
| 5 | **Each email once.** The send log is the record: draft id, hash, recipient, NZ time and the mail system's message id. The sender never sends a draft id already in the log. After an unclear result it checks Sent Items before any retry. | Run the sender again after a send: `NO_CHANGE`. |
| 6 | **The gateway stays up.** The Slack gateway restarts by itself after a crash (the autorestart fix), and the Slack home channel is set, so the "no home channel" notice stops (ask 66). | `status` shows the gateway running. After its process is stopped it comes back on its own. |
| 7 | **Then the model.** Once 1–6 pass, review drafting quality on the chosen model and set a fallback model. | A week of drafts reviewed with Jesse; recorded in `docs/BUILD-RECORD.md`. |

## Testing with the stop file on
Checks 4 and 5 need the sender to send. The sender has a test mode that sends only to Jesse's own address (set in its config) and is allowed while the stop file exists; every other recipient is refused in test mode. Check: a test-mode run with the stop file present reaches Jesse's inbox, and a real recipient in the same run is refused and logged.

## How it gets built
1. The sender lives in this folder: `sender/` (`sender.py`, `graph_adapter.py`, `test_sender.py`, `README.md`, `sender.example.json`). It's plain Python with no add-ons. It's tested here with a fake mailbox: `python3 -m unittest` and `python3 sender.py selfcheck` in `sender/`. It meets the agent's real mail setup through one setting in `sender.json` on the computer, `token_from`, which points at the agent's own `msgraph_mail.get_token`. The sender never changes the email text.
2. It reaches the computer through `node tools/orgo.mjs install-sender`, with Jesse's code. That copies the files only: no `sender.json`, no timer, and the stop file stays. Everything after that (the config, the test send, removing the old send paths, the one cron line) is one `plan` command each, with Jesse's code, in the order in `sender/README.md` ("Install on the Revenue Partner's computer"). The change to the agent's outreach skill (call `register` when it posts a draft, `approve` when Jesse says yes in that thread, never the mail API) goes through `upgrade-revenue-partner` or `plan`, with Jesse's yes.
3. The Chief of Staff runs every check above through `orgo-link`, command by command as below, and writes the results to `runs/` and the daily note.
4. "Sends back on" is Jesse's alone, once every check passes.

## Checks, command by command

Read-only commands need no code. Every `plan` needs Jesse's code, then `node tools/orgo.mjs apply`. Inside a `plan`, `sender ...` runs `~/PartnerDesk/sender/sender.py` as the Hermes user (a helper `orgo.mjs` defines on the computer). Write Jesse's own address where it says `<test_recipient>`. Commands that send run in NZ business hours.

| # | What proves it |
|---|---|
| 1 | `node tools/orgo.mjs sender-check`: "PASS check 1" (a second sender process exits on the lock; one email per run); under "scheduler entries that mention sending" only the sender's own cron line; under "code that calls the mail API" nothing outside `~/PartnerDesk/sender/` except `msgraph_mail.py` itself (it defines `send_mail`; nothing else may call it). `node tools/orgo.mjs status`: exactly one cron line runs `sender.py run`, and no `at` job, systemd timer, Hermes one-shot job or `sleep` process sends |
| 2 | `node tools/orgo.mjs status`: `present: .../PartnerDesk/state/SEND-STOP`. `sender-check`: "PASS check 2". On the computer: `node tools/orgo.mjs plan 'sender run'` prints `SKIPPED_STOPPED`, and once the cron line is in, `status` shows `SKIPPED_STOPPED` in the send log's last entries |
| 3 | `node tools/orgo.mjs status`: `clock_off_by_seconds` within 30 and `NTPSynchronized=yes`. If NTP is off: `node tools/orgo.mjs plan 'timedatectl set-ntp true'`, then `status` again. If the clock is still more than 30 seconds off, follow the fallback order below |
| 4 | `sender-check`: "PASS check 4". On the computer: the check 4 command below prints `REFUSED_STALE check4 approved version 1, but version 2 is newer` and sends nothing |
| Test mode | With the stop file present, the test-mode command below prints `REFUSED_TEST_RECIPIENT testmode-refuse` and `SENT testmode`, and Jesse confirms the email reached his inbox. Its last part makes a new version of the refused draft, so that approval is dead and it can never send |
| 5 | `sender-check`: "PASS check 5" (including an unclear send settled from Sent Items, never resent). On the computer, at least 15 minutes after the test-mode send: `node tools/orgo.mjs plan 'sender run --test'` sends nothing and prints `NO_CHANGE`; `sender-check`'s status shows the `SENT testmode` line with its Graph message id and internetMessageId |
| 6 | `node tools/orgo.mjs status`, "## gateway": the gateway process, its user and its command line. How it's kept running differs from box to box, so find it before changing anything, one read per `plan`: a systemd unit (`plan 'systemctl status --no-pager <pid>'` names the unit, for the system or the Hermes user), supervisord (`plan 'supervisorctl status'`), or a Hermes service command (`ask "how is your Slack gateway started and kept running?"`). If nothing restarts it, that's the fix: one `plan` per change (for example a restart setting on the unit it's in), each with Jesse's code. The test: `plan 'kill <gateway pid>'`, then `status` a minute later shows a new gateway process. The Slack home channel is a Hermes setting: find where it lives (`ask`, or a read-only search of `~/.hermes` through `plan`) before setting it through `plan`. Done when the "no home channel" notice stops in `logs 80 gateway` |
| 7 | A week of drafts reviewed with Jesse, recorded in `docs/BUILD-RECORD.md` |

Check 3, the fallback order when the clock is more than 30 seconds off. `status` shows what's there: `ntp_detail` (timedatectl's answer, or which time services exist if it's missing) and `container`. One command per `plan`, each with Jesse's code, then `status` again:
- a. `node tools/orgo.mjs plan 'timedatectl set-ntp true'`.
- b. If that says NTP isn't supported (or timedatectl is missing) and `status` says `container: no sign of one`: install a time service, then turn NTP on. `plan 'apt-get install -y systemd-timesyncd'` (if apt can't find it, `plan 'apt-get update'` first), then `plan 'timedatectl set-ntp true'`. Or chrony: `plan 'apt-get install -y chrony'`, then `plan 'systemctl enable --now chrony'`.
- c. If `status` says `container: yes`, the clock belongs to Orgo's host and can't be set from inside. The sender measures its own clock (`sender/README.md`, "The clock"), so sending is covered: check 3 passes on the sender's corrected time. Hermes's own cron jobs still run on the box clock, so their times shift by the offset: with the clock 32 minutes slow, the 07:30 NZ draft job runs at about 08:02 NZ, after the 07:47 morning brief on Jesse's PC. Justin's team can raise it with Orgo.

Check 4, one `plan`:
```
node tools/orgo.mjs plan 'H=$(printf "Sender check 4, version 1.\n" | sender register --id check4 --to <test_recipient> --subject "Sender check 4" --body-file - | sed -n "s/^sha256: //p") && sender approve --id check4 --sha256 "$H" --by "check 4, approved with Jesse code" && printf "Sender check 4, version 2.\n" | sender register --id check4 --to <test_recipient> --subject "Sender check 4" --body-file - && sender run --test'
```

Test mode, one `plan`:
```
node tools/orgo.mjs plan 'R=$(printf "Must never send.\n" | sender register --id testmode-refuse --to refuse-check@example.invalid --subject "Sender test: must be refused" --body-file - | sed -n "s/^sha256: //p") && sender approve --id testmode-refuse --sha256 "$R" --by "test-mode check, approved with Jesse code" && T=$(printf "Kia ora Jesse, this is the one sender in test mode.\n" | sender register --id testmode --to <test_recipient> --subject "Sender test mode" --body-file - | sed -n "s/^sha256: //p") && sender approve --id testmode --sha256 "$T" --by "test-mode check, approved with Jesse code" && sender run --test && printf "Withdrawn after the test.\n" | sender register --id testmode-refuse --to refuse-check@example.invalid --subject "Sender test: must be refused" --body-file -'
```

## Not in scope
Changing who gets emailed, the templates or the daily volume. Those stay with the Revenue Partner's own skills and Jesse.
