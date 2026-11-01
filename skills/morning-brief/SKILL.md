---
name: morning-brief
description: Writes Jesse's weekday morning brief: what ran overnight, what's waiting on him, and the true numbers that changed. Used by the morning-brief routine, or when Jesse asks "what's going on?".
---

# Morning brief

## Inputs
- `queue/needs-jesse.md`
- `runs/<this month>/` (since the last brief)
- The Slack channel (read): the Revenue Partner's 07:30 drafts and any replies
- Each live specialist's latest output (Money snapshot, radar list, follow-up report) if its milestone is on

## Steps
- [ ] Read only what changed since the last brief.
- [ ] Top: at most 5 decisions, newest and most urgent first, each with the exact reply words.
- [ ] Then one line per area that changed: partners and drafts, homeowner leads, money (from the Money snapshot, with the date read), follow-ups, posts, calendar today. Skip areas with no change.
- [ ] Any source that couldn't be read: one line, UNKNOWN: <source>.
- [ ] Write it to today's `vault/daily/YYYY-MM-DD.md` and show it in the chat.
- [ ] Log the run.

## Output
Under 200 words. Decisions first. Every number names where it came from.

## Done means
Jesse can act on everything in the brief without opening another app.

## Never
- Pad it. If nothing changed, say "Nothing new since yesterday" and list what's still waiting.
- Show a money figure without its source and date.
