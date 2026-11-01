---
name: ask-ledger
description: Records every new ask from Jesse or Mike as a numbered row, so nothing they want gets lost. Used when either of them says "can it…", "I want…", "it would be good if…", or any new idea.
---

# Ask ledger

## Inputs
- `context/asks.md` (the build's ledger, copied at install; rows numbered, never renumbered)
- The new ask, in their words

## Steps
- [ ] Check it isn't already a row. If it is, add today's date to its "When" and tell Jesse which row.
- [ ] Otherwise append a row. Rows added here are numbered from 1001 up (1001, 1002…), so they never clash with the build's numbers; Justin's team copies them into the build ledger with the same numbers. Then: their words in quotes, the date and who said it, status, and the planned owner from `AGENTS.md`.
- [ ] Status: 🧩 if a specialist can do it now; ⏳ if it's a later milestone; 🟡 if it needs a fact or a yes from Jesse or Mike (also add it to `OPEN_QUESTIONS.md`); 🔵 if Justin's team owes it.
- [ ] Tell Jesse in one line: "Logged as #N. <Owner> takes it at <milestone>."

## Done means
Every new ask has a row, an owner and a status.

## Never
- Renumber rows or delete one. A dropped ask stays, marked with the reason.
