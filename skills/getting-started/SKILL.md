---
name: getting-started
description: Runs the first session with Jesse after install: confirms the owner facts, opens the vault in Obsidian, fills the tool map, and switches on the first routine with his yes. Used when Jesse says "set me up", "where do I start", or on the first chat after install.
---

# Getting started

## Inputs
- `context/owner.md` (from the install; if it's missing, stop and say: "Step 3 of the install isn't done: I need the context files from Justin's team."), `OPEN_QUESTIONS.md`, `vault/_shared/tool-map.md`

## Steps
- [ ] Say hello in one line and what this is: "I'm your Chief of Staff. Tell me what you want done; I'll get the right agent on it and only bring you decisions."
- [ ] Confirm the owner facts, one at a time. Fix any that are wrong in `context/owner.md`.
- [ ] Show him the vault: "Open Obsidian → Open folder as vault → pick the `vault` folder. That's my memory; you can read everything I know."
- [ ] Run `systems-map` together for the tools he knows.
- [ ] Radar groups: follow the groups section of `modules/partner-program/.claude/skills/getting-started/SKILL.md` (which local Facebook groups he's in).
- [ ] Go through `OPEN_QUESTIONS.md` and ask only what he can answer now; the rest stay open.
- [ ] Offer the morning brief: "Want a short brief each weekday at 7:47? It reads what's changed and lists your decisions. Nothing goes to anyone else. Reply **brief on** or **not yet**." On **brief on**: add `morning-brief: on` to `state/routines-on.md`, then register `routines/morning-brief.prompt` as a scheduled task in the Claude app with its CRON (NZ time). Check it shows in the app's scheduled tasks. Tell Jesse it runs only while the PC is on and the app is open.

## Done means
Owner facts confirmed, the vault opened in Obsidian, the tool map started, and Jesse knows the one thing to do next.

## Never
- Ask for a password or key in chat.
- Switch on any routine without his exact words.
