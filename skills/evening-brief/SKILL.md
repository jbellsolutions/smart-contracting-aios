---
name: evening-brief
description: Writes Jesse's evening brief, covering what is still waiting (decisions first), what got done today, what went out and to whom, and what would move things along tomorrow. Used by the evening-brief routine and whenever Jesse asks "where did we land today?".
---

# Evening brief

## Inputs
- Today's run logs in `runs/<YYYY-MM>/`.
- `queue/needs-jesse.md`.
- Today's `vault/daily/<YYYY-MM-DD>.md`, which holds this morning's brief.

## Steps
- [ ] **Still waiting**, decisions first: each open item as a yes/no with the exact reply words, oldest first. A draft that's finished but not sent is waiting, not done.
- [ ] **What went out today**: every message, post or change that left the workspace, who it went to and who approved it, from the run logs. If none, say "Nothing went out." (Mike's "report on what messages were sent", ask 117.)
- [ ] **Done today**: one line per finished job, with its run log linked. Mark which morning items were resolved.
- [ ] **The Revenue Partner**: if `skills/orgo-link` ran today, one line: stop file on or off, any timer that could send.
- [ ] **Tomorrow, to move things along**: the next step for each open item, as a milestone or a decision. Never a time estimate.
- [ ] Append it under "Evening" in today's daily note, below the morning brief, and give it to Jesse in the Chief of Staff chat.

## Output
Under 200 words. Waiting first, then what went out, then done, then tomorrow.

## Done means
Every open decision appears once, every "done" line links its run log, and nothing unsent is called done.

## Never
- Fill a gap with a guess. A job with no run log is "no run".
- Put customer, crew or partner contact details in anything that leaves this computer.
