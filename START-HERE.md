# Start here

This is Smart Contracting's AI operating system: one Claude Code chat, the Chief of Staff, that runs the business with Jesse and Mike. It installs itself. Jesse only does what a person has to.

## 1. Drop it in (one paste)
On Jesse's PC, open the Claude app → Code, start a new session in your home folder, and paste:

> Clone https://github.com/jbellsolutions/smart-contracting-aios into my home folder as Smart-Contracting-AIOS (not Documents or OneDrive). If git isn't installed, install it with winget first. Then tell me how to open a new Claude Code session in that folder.

Then open a new session in `Smart-Contracting-AIOS`, say yes if the app asks whether you trust the folder, and say **install**.

## 2. The chat installs itself
`skills/install/SKILL.md` runs each step and proves it worked, in an install log in `runs/`. Jesse's part:
- allow the Windows prompts (Git, Node.js, Obsidian, if they're missing) and restart the Claude app once after Node;
- save the three private files Justin's team DMs him (`owner.md`, `asks.md`, `standing-approvals.md`) into the `context` folder;
- open the `vault` folder in Obsidian;
- sign in to Slack in the Claude app's connectors;
- type two keys into his own PowerShell window (`node tools/add_secret.mjs ORGO_API_KEY` and `ORGO_COMPUTER`). Never into the chat.

**Installed means** the install log shows every step passed, including the two guard tests (a send refused while `state/STOP` exists, and a fake key refused), and the Orgo link reads the Revenue Partner's computer.

## 3. Then it builds itself
- **"Set me up"**: your details, your tools, the open questions, the first morning brief (`skills/getting-started`).
- **"What should we build next?"**: a ranked plan from everything you've asked for (`skills/roadmap`).
- **"Build me an agent for …"**: it designs and builds a new specialist to this workspace's standard, after you approve the scope (`skills/build`).
- **"Is the Revenue Partner OK?" / "Hold sends"**: straight to its Orgo computer (`skills/orgo-link`).

## Before sends go back on (M0 gate)
The Revenue Partner's sending stays off until every check in `projects/revenue-partner-sends/SPEC.md` passes: one sender, a real stop switch, the right clock, only the latest draft approvable, each email once, the gateway staying up.

## After the install (M1, one connection at a time)
Each one is signed in by Jesse or Mike themselves, never with a password typed into chat.
- **Calendars:** both on Outlook. Jesse and Mike share calendars with each other ("Can view all details"), then connect Outlook in the Claude app.
- **Xero, read-only (Mike's yes):** Mike creates a Xero Custom Connection with read scopes only (every scope ends in `.read`; Xero lists it at NZD 10/month ex GST). The official Xero MCP server is added with `XERO_SCOPES` set to exactly those read scopes; without that setting the server asks for write scopes. Check: `money-snapshot` runs its read-only check and reads one balance.
- **Radar:** say "run the radar" with Facebook logged in, in the browser Claude uses.
- **SOPs:** drop the SOP PDFs and screenshots in and say "make an SOP from these".

Stuck at any step: send Justin a voice note in Slack saying which step and what it said.
