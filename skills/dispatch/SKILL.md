---
name: dispatch
description: Hands one job from Jesse to the one specialist that owns it, and brings the result back. Used by the Chief of Staff whenever Jesse or Mike asks for something a specialist owns.
---

# Dispatch

## Inputs
- Jesse's request (this chat).
- `AGENTS.md`: the routing table.
- The owning specialist's charter in `agents/`.

## Steps
- [ ] Name the one owner from the routing table. If two could own it, pick the one whose charter says "Only writer of" for the record it changes. If none fits, it's a new ask: use `ask-ledger`.
- [ ] If the owner is reserved (90+) or its milestone isn't switched on, say so in one line, log the ask, and offer what can be done now.
- [ ] Check `state/STOP`. If it exists, draft only and say so.
- [ ] Hand off with a job note: what Jesse said (quoted), the outcome he wants, a deadline only if he gave one, and what must come back. Call the subagent, or append the note to `queue/jobs/<role>.md`.
- [ ] Partner-program and radar jobs: use the Workshop skill in `modules/partner-program/.claude/skills/` (see `AGENTS.md`). Revenue Partner jobs: draft the Slack message for Jesse to send it, or use `upgrade-revenue-partner`.
- [ ] When the result is back, check it against the specialist's "Done means". Anything outward goes to `queue/needs-jesse.md` as one decision with the draft linked and the exact reply words.
- [ ] Log the run in `runs/<YYYY-MM>/`.

## Output
One line to Jesse: who's on it and what comes back, then the result when it lands.

## Done means
The job has exactly one owner, the result is in its owner's output folder, and anything that needs Jesse is in the Needs-Jesse list.

## Never
- Do the specialist's outward action yourself.
- Give one job to two specialists.
