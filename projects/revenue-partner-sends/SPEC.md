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
| 3 | **The right clock, NZ time only.** The computer's clock is synced (NTP on). Everything shown to Jesse is NZ time (Pacific/Auckland); logs store full timestamps with their offset. | `status` shows the computer's UTC time next to this PC's, within 30 seconds, and NTP synced. |
| 4 | **Only the latest draft can be approved.** A draft has an id, a version and the SHA-256 of its text. An approval names the id and the hash. The sender refuses an approval whose hash doesn't match the current draft, or when a newer version exists. | Approve a test draft, edit it, run the sender: it refuses, and the log says why. |
| 5 | **Each email once.** The send log is the record: draft id, hash, recipient, NZ time and the mail system's message id. The sender never sends a draft id already in the log. After an unclear result it checks Sent Items before any retry. | Run the sender again after a send: `NO_CHANGE`. |
| 6 | **The gateway stays up.** The Slack gateway restarts by itself after a crash (the autorestart fix), and the Slack home channel is set, so the "no home channel" notice stops (ask 66). | `status` shows the gateway running. After its process is stopped it comes back on its own. |
| 7 | **Then the model.** Once 1–6 pass, review drafting quality on the chosen model and set a fallback model. | A week of drafts reviewed with Jesse; recorded in `docs/BUILD-RECORD.md`. |

## Testing with the stop file on
Checks 4 and 5 need the sender to send. The sender has a test mode that sends only to Jesse's own address (set in its config) and is allowed while the stop file exists; every other recipient is refused in test mode. Check: a test-mode run with the stop file present reaches Jesse's inbox, and a real recipient in the same run is refused and logged.

## How it gets built
1. Justin's team writes the sender and its tests against the Revenue Partner's real outreach skill and mail setup on its computer. That code isn't in this repo, because it has to match what's on the computer.
2. It reaches the computer through the partner-program module's `upgrade-revenue-partner` path, with Jesse's yes at each prompt.
3. The Chief of Staff runs every check above through `orgo-link`, and writes the results to `runs/` and the daily note.
4. "Sends back on" is Jesse's alone, once every check passes.

## Not in scope
Changing who gets emailed, the templates or the daily volume. Those stay with the Revenue Partner's own skills and Jesse.
