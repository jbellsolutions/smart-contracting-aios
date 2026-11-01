# Start here: installing the AIOS (Monday session)

For Justin's team and Jesse, together. Each step says how to check it worked. Nothing here sends anything to anyone.

## Before the session (Jesse's PC)
1. **Claude desktop app** with the Code tab, signed in to their Claude Team plan. Check: open a Code session and say hello.
2. **Git for Windows** (Claude Code on Windows uses it). Check: ask Claude Code to run `git --version`.
3. **Node.js (LTS)**, for the Xero connection at M1. Check: `node --version`.
4. **Obsidian** (obsidian.md). Check: it opens.
5. Optional: **Wispr Flow**, for talking instead of typing.

## Install (M0)
1. **Get the workspace.** Justin's team sends `smart-contracting-aios` (a zip, or the repo link). Put it at `C:\Users\<Jesse>\Smart-Contracting-AIOS`, not in Documents or anything OneDrive syncs (OneDrive would sync the vault and `.git`). Open a Claude Code session in that folder. Check: ask "what's in this folder?" and it describes the Chief of Staff and the team from `AGENTS.md`.
2. **Add the partner-program module.** Claude Code runs:
   `git clone https://github.com/jbellsolutions/smart-contracting-dream-team modules/partner-program`
   Check: `modules/partner-program/START-HERE.md` exists.
3. **Add the private context.** Justin's team gives Jesse three files privately (a DM, not the shared channel): `owner.md`, `asks.md`, `standing-approvals.md`. They go in a new `context/` folder. Check: ask "who are Jesse and Mike?" and it answers from `context/owner.md`.
4. **Connect Slack.** In the Claude app, connect Slack (Jesse signs in himself) and allow it to read #mike-and-jesse-drainage and Jesse's DM with the Revenue Partner, where its routines post. Check: the Chief of Staff quotes the Revenue Partner's latest post.
5. **Upgrade the Revenue Partner**, if it isn't done yet: say "upgrade the Revenue Partner". The module's `upgrade-revenue-partner` skill does it step by step, with Jesse's yes at each prompt.
6. **The outreach house-style fix** (Justin's team, with Jesse): one note the Revenue Partner's outreach skill reads for every audience, so a fix Jesse makes once carries over (ask 84).
7. **Set me up.** Say "set me up": `skills/getting-started/SKILL.md` confirms the owner facts, opens the vault in Obsidian, starts the tool map, sets up the radar's groups, and offers the morning brief. Switching the brief on also registers it as a scheduled task in the Claude app; writing `state/routines-on.md` alone runs nothing.

**M0 is done when** the Chief of Staff writes the first daily note and answers "what's going on?" from the Revenue Partner's real Slack posts.

## After the session (M1, one connection at a time)
Each one is signed in by Jesse or Mike themselves, never with a password typed into chat.
- **Calendars:** if both are on Outlook (OPEN_QUESTIONS A8), Jesse and Mike share calendars with each other ("Can view all details").
- **Xero, read-only (Mike's yes):** Mike creates a Xero Custom Connection with read scopes only (every scope ends in `.read`; Xero lists it at NZD 10/month ex GST). The official Xero MCP server is added to Claude Code with `XERO_SCOPES` set to exactly those read scopes; without that setting the server asks for write scopes. Check: `money-snapshot` runs its read-only check and reads one balance.
- **Radar:** say "run the radar" with Facebook logged in, in the browser Claude uses.
- **SOPs:** drop the screenshots in and say "make an SOP from these".

Stuck at any step: send Justin a voice note in Slack with what step and what it said.
