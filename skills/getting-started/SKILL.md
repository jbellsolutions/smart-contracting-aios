---
name: getting-started
description: Runs the first session with Jesse after the install: confirms the owner facts and the crew list, fills the tool map, asks the open questions he can answer now, and switches on the first routine with his yes. Used when Jesse says "set me up" or "where do I start", right after `install`.
---

# Getting started

## Inputs
- `context/owner.md` (from the install; if it's missing, run `skills/install/SKILL.md` first), `OPEN_QUESTIONS.md`, `vault/_shared/tool-map.md`, `vault/_shared/glossary.md`

## Steps
- [ ] Say hello in one line and what this is: "I'm your Chief of Staff. Tell me what you want done; I'll get the right agent on it and only bring you decisions."
- [ ] Confirm the owner facts, one at a time. Fix any that are wrong in `context/owner.md`.
- [ ] The crew list for check-ins (names and roles), if `context/owner.md` doesn't have it (OPEN_QUESTIONS A19). Add any names and words he uses to `vault/_shared/glossary.md`.
- [ ] Run `systems-map` together for the tools he knows.
- [ ] Radar groups: follow the groups section of `modules/partner-program/.claude/skills/getting-started/SKILL.md` (which local Facebook groups he's in).
- [ ] Go through `OPEN_QUESTIONS.md` and ask only what he can answer now; the rest stay open.
- [ ] Offer `roadmap`: "Want me to map out what we build next?"
- [ ] Offer the morning brief: "Want a short brief each weekday at 7:47? It reads what's changed and lists your decisions. Nothing goes to anyone else. Reply **brief on** or **not yet**." On **brief on**: add `morning-brief: on` to `state/routines-on.md`, then register `routines/morning-brief.prompt` as a scheduled task in the Claude app with its CRON (NZ time). Check it shows in the app's scheduled tasks. Tell Jesse it runs only while the PC is on and the app is open. Offer the evening brief the same way (`routines/evening-brief.prompt`).

## Done means
Owner facts and the crew list confirmed, the tool map started, and Jesse knows the one thing to do next.

## Never
- Ask for a password or key in chat.
- Switch on any routine without his exact words.
