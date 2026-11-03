# The one sender

The Revenue Partner drafts partner emails and Jesse says yes in Slack. This script is the only thing that sends them. It's requirement 1 to 5 of `../SPEC.md`, built as one plain Python script with no add-ons.

What it does on every run:
1. Takes the lock. If another run holds it, it logs `SKIPPED_LOCKED` and stops.
2. Checks the stop file (`~/PartnerDesk/state/SEND-STOP`). If it's there, it logs `SKIPPED_STOPPED` and sends nothing.
3. Gets the right time (see "The clock" below). If it can't: `SKIPPED_CLOCK`, and nothing sends.
4. Checks NZ business hours (Mon to Fri, 08:00 to 17:00, Pacific/Auckland), on the right time. Outside them: `SKIPPED_HOURS`.
5. Checks the last send was at least 15 minutes ago. If not: `SKIPPED_GAP`.
6. Settles any unclear send first, by looking in Sent Items. Found: `FOUND_IN_SENT`, and it counts as sent. Not found: `FAILED`. It never retries by itself; it needs a fresh yes from Jesse.
7. Takes the oldest approved draft. It sends it only if Jesse's yes names the hash of the latest version. Otherwise `REFUSED_STALE` (a newer version exists) or `REFUSED_HASH` (the hash matches nothing, or the text was changed behind its back).
8. A draft id already sent: `NO_CHANGE`. A recipient on the suppression list: `REFUSED_SUPPRESSED`.
9. Checks the stop file and the hours once more, then sends one email and logs `SENT` with the mail system's ids.

It sends at most one email per run. A run with nothing to send logs `NO_CHANGE`.

## Files

In this folder (`~/PartnerDesk/sender/` on the computer):

| File | What |
|---|---|
| `sender.py` | The sender: `register`, `approve`, `run`, `status`, `selfcheck`, and `init-config` (writes `sender.json` once) |
| `graph_adapter.py` | Sends through Microsoft Graph, and checks Sent Items. Also a fake one for tests |
| `test_sender.py` | The tests: `python3 -m unittest` in this folder. No network |
| `sender.example.json` | The config to copy. No keys in it |

Its records, in `~/PartnerDesk/` (or `$PARTNERDESK_HOME`):

| Path | What |
|---|---|
| `sender.json` | The config, filled in on the computer |
| `state/SEND-STOP` | The stop file. `orgo.mjs hold` creates it; only Jesse's "sends back on" removes it |
| `state/sender.lock` | The run lock |
| `drafts/<id>.json` | Every version of each draft: recipient, subject, body, hash |
| `approvals.jsonl` | Jesse's approvals, one per line: draft id, version, hash, his words or the Slack thread |
| `send-log.jsonl` | Every outcome, one per line, never edited: NZ time with its offset, UTC time, `clock_offset_s` (how far the box clock was corrected), draft id, version, hash, recipient, and the Graph message id and internetMessageId when known |
| `state/clock.json` | The last clock measurement: the offset, when, and what each time source said |

## How the AI uses it

The AI never calls the mail API to send. It makes two calls:

1. When it posts a draft in Slack: `python3 ~/PartnerDesk/sender/sender.py register --id <id> --to <address> --subject "<subject>" --body-file <file>` (or `--body-file -` to read the body from standard input). It prints the id, the version and the sha256. The Slack post shows the version and the first 12 characters of the hash. An edit is a new `register` with the same id: a new version and a new hash.
2. When Jesse says yes in that draft's own thread: `python3 ~/PartnerDesk/sender/sender.py approve --id <id> --sha256 <hash> --by "<Jesse's words> (Slack ts <ts>)"`. It refuses if the hash isn't the latest version's.

The hash is the SHA-256 of the recipient, subject and body (line endings made the same). The sender sends exactly that text. It never adds or changes anything; the sign-off is part of the body the AI wrote.

A draft id is used for one email only. After it's sent, `register` and `approve` refuse that id.

## Config: `~/PartnerDesk/sender.json`

| Setting | What |
|---|---|
| `adapter` | `graph` on the computer. `fake` only in tests |
| `token_from` | Where the access token comes from: `<folder>:<module>:<function>`, the folder holding the agent's `msgraph_mail.py`, then `msgraph_mail:get_token`. The sender calls `get_token(force_refresh=False)`, and once with `force_refresh=True` if Graph answers 401. The token is never printed or stored |
| `test_recipient` | Jesse's own address. Test mode sends only there |
| `body_content_type` | `text` or `html`: match what the agent's `send_mail` used, so emails look the same as before |
| `business_days`, `business_start`, `business_end` | NZ business hours. The time zone is always Pacific/Auckland and can't be changed |
| `min_gap_minutes` | Minutes between sends. Anything under 15 counts as 15 |
| `suppression_list` | Optional path to a text file. Any email address on any line is suppressed (lines starting `#` are skipped). If it's set and the file is missing, nothing sends |
| `timeout_seconds` | How long each Graph call may take (5 to 120). A time source gets at most 15 seconds |
| `time_sources` | Where the sender reads the right time: 1 to 5 `https://` URLs. Default: Graph and Microsoft's sign-in server |

An unknown setting, or a value still starting `FILL-ME`, stops every send until it's fixed. `status` lists the problems.

## Test mode

`sender.py run --test` sends only to `test_recipient`, and it's allowed while the stop file exists. Any other recipient in the queue is refused and logged `REFUSED_TEST_RECIPIENT`, and stays queued for a normal run. Everything else still applies in test mode: business hours, the 15-minute gap, the lock, latest-version-only, each draft once.

## The clock

The box clock can be wrong, and on an Orgo computer it may not be settable (a container's clock belongs to its host). On 3 Nov 2026 it was 32 minutes slow (`clock_off_by_seconds: -1932`). So the sender doesn't trust it.

Each run asks each time source in `time_sources` for the time: one plain HEAD request, no token, nothing sent. Every HTTPS answer carries a `Date` header, even a 401. The offset is that time minus the middle of the request on the box clock; an answer that takes over 10 seconds doesn't count. It uses the middle value of the sources that answered. The right time is then the box clock plus the offset, and every decision uses it: business hours, the 15-minute gap, the Sent Items check after an unclear send, and every log time. Each log line records `clock_offset_s`.

- Each measurement is saved to `state/clock.json`.
- No source answers: it uses the saved offset if it was measured in the last 6 hours. Otherwise `SKIPPED_CLOCK`: nothing sends on an unknown clock.
- An offset over 6 hours is a mistake, not a slow clock: `SKIPPED_CLOCK` ("clock offset implausible"), and it isn't saved.
- `status` shows the box clock in UTC, what each source said, the offset and how old it is, and the corrected NZ time. Once `sender.json` exists, `node tools/orgo.mjs status` shows the same, with `sender_clock_off_by_seconds` against Jesse's PC.

This only fixes the sender. Hermes's own cron jobs still run on the box clock (see `../SPEC.md`, check 3).

## Unclear sends

Graph sends in two steps: create the message (it gets its ids), then send it. If the create step fails, nothing went: `FAILED`. If Graph clearly refuses the send step (HTTP 4xx), nothing went: `FAILED`. If the send step times out, drops, or gives HTTP 5xx, the email may have gone: `UNCLEAR`. The next run looks in Sent Items by internetMessageId, then by recipient and subject. It sends nothing else until that's settled. A failed send leaves an unsent copy in Drafts; it never goes on its own.

## The one cron line

In the Hermes user's crontab, and nowhere else:

```
*/15 * * * * cd "$HOME/PartnerDesk/sender" && python3 sender.py run >> "$HOME/PartnerDesk/state/sender-cron.log" 2>&1
```

Cron on the computer runs in UTC. That's fine: the sender checks the hours in NZ time itself, on its corrected clock. If the box clock is off, `*/15` still runs every 15 minutes; only the minute it lands on shifts. Use the same `python3` the agent's mail code runs under (if `msgraph_mail.py` needs packages from the agent's own Python, put that Python's full path in the line). Because each run takes a second or two, the next run is usually just under 15 minutes after a send, so sends land about 30 minutes apart. That's on the safe side of the rule.

## Install on the Revenue Partner's computer, in this order

Each step that changes the computer goes through `node tools/orgo.mjs plan '...'` (or `install-sender`) and Jesse's code. Read-only steps need none.

a. **The hold stays on.** `node tools/orgo.mjs status` shows `present: .../PartnerDesk/state/SEND-STOP`. If not, `node tools/orgo.mjs hold` first.

b. **Copy the files.** `node tools/orgo.mjs install-sender`, Jesse's code, then `node tools/orgo.mjs apply`. It writes this folder's five files into `~/PartnerDesk/sender/`, owned by the Hermes user, and creates `~/PartnerDesk/state`. It doesn't create `sender.json`, touch any timer, or remove the stop file.

c. **Fill in `sender.json`.** `node tools/orgo.mjs sender-check` (read-only) prints where `msgraph_mail.py` is, under "the agent's mail code", and which Python Hermes runs under. Check its `send_mail` for the body's content type: `node tools/orgo.mjs plan 'grep -n -i contenttype <path to msgraph_mail.py>'`. Then write the config once: `node tools/orgo.mjs plan 'sender init-config --token-from "<folder>:msgraph_mail:get_token" --test-recipient <test_recipient>'` (`<test_recipient>` is Jesse's own address; add `--content-type html` if `send_mail` sent HTML). It refuses if `sender.json` already exists, and prints any problems left. Inside a `plan`, `sender ...` runs `~/PartnerDesk/sender/sender.py` as the Hermes user. If `msgraph_mail.py` needs the agent's own Python (the test send in step e says `couldn't import msgraph_mail`), start each `plan` command with `SENDER_PY=<that Python>` and use that Python in the cron line.

d. **Selfcheck.** `node tools/orgo.mjs sender-check`. Every line must say PASS, and the status section must say `problems: none`.

e. **Test-mode send to Jesse** (in NZ business hours). Through `plan`, using the checks in `../SPEC.md` ("Checks, command by command"). Jesse confirms the test email reached his inbox, and the log shows the refused real recipient.

f. **Remove every other send path, one at a time, each with Jesse's code.** Every old timer, Hermes one-shot job, `at` job, `sleep` process and send script that `status` and `sender-check` list. Then change the agent's outreach skill (and the partner program's outbox, if it sends) so it calls `register` when it posts a draft and `approve` when Jesse says yes in that draft's thread, and never calls the mail API to send. Its `msgraph_mail.py` stays, because the sender uses its `get_token`; nothing else may call its `send_mail`.

g. **Add the one cron line** above, as the Hermes user, through `plan`:
   ```
   node tools/orgo.mjs plan '(crontab -l -u "$U" 2>/dev/null; echo "*/15 * * * * cd \"\$HOME/PartnerDesk/sender\" && python3 sender.py run >> \"\$HOME/PartnerDesk/state/sender-cron.log\" 2>&1") | crontab -u "$U" - && crontab -l -u "$U"'
   ```
   Then `sender-check` must show this line and no other.

h. **The Chief of Staff runs the SPEC checks** (`../SPEC.md`, "Checks, command by command") and writes the results to `runs/` and the daily note.

i. **Sends back on only on Jesse's words.** Once every check passes and Jesse says "sends back on": `node tools/orgo.mjs sends-on`, his code, `node tools/orgo.mjs apply`. Nothing else removes the stop file.

## Check it here

```
cd projects/revenue-partner-sends/sender
python3 -m unittest
python3 sender.py selfcheck
```

`selfcheck` runs SPEC checks 1, 2, 4 and 5, the test-mode check and the clock check (a 32-minute-slow box clock still gives the right NZ hours and gap) in a temporary folder with the fake adapter. It touches nothing real and sends nothing.

## Not proven yet

Nothing here has run on the real computer or against Jesse's mailbox. Still to prove there: where `msgraph_mail.py` lives and that its `get_token(force_refresh=...)` works as described; that the cron environment can import it; that Graph keeps the internetMessageId from create to Sent Items (the recipient-and-subject fallback covers it if not); that `~/PartnerDesk/drafts/` isn't already used by the partner program (`install-sender` lists what's already in `~/PartnerDesk`); and that the computer reaches both time sources and their `Date` agrees with Jesse's PC to within a few seconds (`status`, under "the sender's own clock").
