---
name: staff-check-in
description: Prepares Jesse's weekly 20-minute check-ins with each crew member and writes them up afterwards, with follow-ups. Use when Jesse says "prep my check-ins", "who's due a catch-up?", "write up my chat with <name>", or when the paused staff-check-ins routine runs.
---

# Staff check-ins

Jesse's words: "20 minutes a week, finding out how they are, what's going on with them: any problems, any good stuff, any good feedback."

## Inputs
- `context/owner.md`: the crew list (names and roles). If there's no crew list, ask Jesse for it once and add it there.
- `vault/people/<name>.md`: that person's own note.
- For a write-up: Jesse's voice note or words right after the check-in.

## Before: the agenda (one screen per person)
- [ ] Who's due this week: everyone on the crew list whose last check-in is a week or more ago.
- [ ] For each, from their note only:
  - follow-ups promised last time, and whether they're done;
  - one thing that went well since (from Jesse's notes), to open with;
  - the four questions: How are you going? Anything getting in the way? Any good stuff? Any feedback for us?
- [ ] Give the list to Jesse only. Offer to put the check-ins on his calendar (Office drafts the invites; he says yes).

## After: the write-up
- [ ] From Jesse's words, add a dated section to `vault/people/<name>.md`: how they're going, problems, good stuff, their feedback, and follow-ups (each with who does it).
- [ ] Each follow-up for Jesse or Mike becomes one line in `queue/needs-jesse.md` under **Manual**.
- [ ] Read the write-up back to Jesse in three lines and fix what he corrects.

## Stops and tells Jesse first
Anything about safety, harassment, bullying, someone not coping, or a dispute over pay. Write only what Jesse says, put a flag at the top of the morning brief, and suggest he deals with it directly (and, for anything legal, Employment New Zealand or an adviser).

## Never
- Message a crew member. The check-in is Jesse's conversation.
- Write health, family or money details beyond what Jesse asks to keep, or put anything from a person's note in Slack, email or a shared file.
- Guess what someone said.
