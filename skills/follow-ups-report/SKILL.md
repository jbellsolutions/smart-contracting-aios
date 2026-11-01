---
name: follow-ups-report
description: Reads GoHighLevel (LeadConnector) read-only and writes a plain weekly report of new leads by source, the follow-ups sent and whether they were delivered, opened or answered, and who to call. Used by the follow-ups-weekly routine, or when Jesse asks "who's been followed up?" or "where are the leads coming from?".
---

# Follow-ups report

## Inputs
- GoHighLevel through HighLevel's official connector, read-only, the Smart Contracting sub-account
- Last week's `data/follow-ups-report.md`

## Steps
- [ ] New contacts this week, grouped by their recorded source (first and latest attribution). Missing source: "source not recorded", counted, never guessed.
- [ ] Follow-ups sent this week: per contact, which message (SMS or email, which workflow), and its status: delivered, opened, clicked, replied, failed.
- [ ] "Who to call": people who opened or clicked but didn't reply, and replies nobody has answered, at most 10, most recent first.
- [ ] Write `data/follow-ups-report.md` and list it in `queue/needs-jesse.md` with one line: "This week: N new leads, N followed up, N to call."

## Output
`data/follow-ups-report.md`, plain words, one table per section.

## Done means
Jesse can see where every lead came from and what happened to it, without opening GoHighLevel.

## Never
- Send a message, edit a workflow, change a contact or a pipeline.
- Report "all followed up" when the data couldn't be read.
