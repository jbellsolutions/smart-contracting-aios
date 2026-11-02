---
name: install
description: Installs this workspace on Jesse's Windows PC and proves each step works, writing an install log. Used on the first chat in this folder, when Jesse says "install", or when the self-check finds something missing. Jesse does only what a person must (Windows prompts, sign-ins, keys in his own terminal, the private files); this skill does the rest.
---

# Install

Run the steps in order. After each one, run its check, write one line to `runs/<YYYY-MM>/<YYYY-MM-DD>-install.md` (step, PASS or FAIL, what the check showed), and tell Jesse in one short line. If a check fails, stop at that step, say exactly what you saw, and offer the fix. Never skip ahead past a failed check. Already-passed steps are skipped on a re-run (read the install log first).

Before step 1, say: "I'll set everything up and check each piece as I go. You'll only need to click a few Windows prompts, sign in to a couple of things, and type two keys into your own window. Nothing gets sent to anyone while we do this."

## 1. The right folder
- This folder must have `AGENTS.md`, and its path must not contain `OneDrive` or `Documents` (OneDrive would sync the vault, the keys and `.git`). The intended place is `C:\Users\<Jesse>\Smart-Contracting-AIOS`.
- Check: `git rev-parse --show-toplevel` prints this folder, and the path has neither word. If it's in OneDrive: stop and say "Let's move it first", then give the exact `git clone` into the home folder.

## 2. The tools
- Check each: `git --version`, `node --version` (20 or newer), and ask Jesse whether Obsidian opens.
- Missing ones, with his go-ahead (Windows asks him to allow each):
  - `winget install --id Git.Git -e`
  - `winget install --id OpenJS.NodeJS.LTS -e`
  - `winget install --id Obsidian.Obsidian -e`
- After installing Node: Jesse closes and reopens the Claude app, so it finds `node` (the app ignores PowerShell profiles). Then he opens this folder again and says "carry on with the install".

## 3. Nothing goes out yet
- Create the working folders `queue/drafts` and `runs`, then `node tools/switch.mjs stop-on` (creates `state/STOP`).
- Check: `state/STOP` exists.

## 4. The guards are on
The rules that must always hold are hooks in `.claude/settings.json`, not just words. They only run once this folder is trusted, and when `node` is on the PATH the app sees.
- If the app asked "Do you trust this folder?", Jesse says yes.
- Prove the stop guard: run the Bash command `echo install-test --send`. **It must be refused** with "Blocked: state/STOP exists". If it ran instead, the hooks are off: stop. Ask Jesse to trust the folder and restart the app, then try again. If it still runs, send Justin's team a note with what you saw.
- Prove the key guard: ask Jesse to type `sk-test-` followed by twenty-four letter a's, with no spaces (a fake key). It must be blocked with "That looks like a key".
- Prove Jesse's approvals: run `node tools/switch.mjs test`. A window opens on Jesse's screen with an 8-character code (it isn't shown in the chat; if he can't see it, it may be behind the Claude app, so check the taskbar). Jesse types `yes` and the code. Typing is safer than dictating it, because dictation can mishear letters. Then run `node tools/switch.mjs apply`: it must print "Approval test: PASS". If no window opened, stop: the Orgo link's changes can't be approved on this PC until it does; tell Justin's team.
- Check: the send and the key were both refused, and the approval test passed. Log all three.

## 5. The partner-program module
- `git clone https://github.com/jbellsolutions/smart-contracting-dream-team modules/partner-program`
- Check: `modules/partner-program/START-HERE.md` exists.

## 6. The private files
- Justin's team sends Jesse three files by DM (never the shared channel): `owner.md`, `asks.md`, `standing-approvals.md`. Jesse saves them into this folder's `context/` folder (create it if needed).
- Check: `context/owner.md` exists and its first line names Smart Contracting. Read it back to Jesse in two lines; don't read out anything private aloud if Mike or the crew are in earshot (ask first).

## 7. Memory in Obsidian
- Jesse opens Obsidian → Open folder as vault → this folder's `vault`.
- Check: Jesse confirms he sees `MEMORY.md`; then open `obsidian://open?vault=vault` and he confirms it opens. Write today's daily note `vault/daily/<YYYY-MM-DD>.md` with "Installed today."

## 8. Slack
- Jesse: Claude app → Settings → Connectors → Slack → Connect, and he signs in himself.
- Check: read the latest message in #mike-and-jesse-drainage and quote its first line back. List the Slack tools you can see and log their names.
- Prove the connector guard: try Slack's send-message tool once, to Jesse's own DM, with the text "install test: if you can read this, the guard is off". It must be refused with "Blocked". If it went through, Jesse gets a harmless note to himself and the guard is off: stop and tell Justin's team. This workspace only ever reads and drafts through connectors.

## 9. The Orgo link
- `npm install --prefix tools/.orgo orgo@2.3.0 --no-audit --no-fund` (if this runs in PowerShell, use `npm.cmd`)
- Jesse, in **his own PowerShell window** in this folder (Start → PowerShell, then `cd` to the folder; you give him the exact `cd` line), runs:
  - `node tools/add_secret.mjs ORGO_API_KEY` (from orgo.ai, API keys)
  - `node tools/add_secret.mjs ORGO_COMPUTER` (the Revenue Partner computer's name in Orgo)
- Check: `node tools/orgo.mjs status` prints a `clock_off_by_seconds` line and a `binary:` line that isn't UNKNOWN. If it says the computer can't be found, the computer may sit in a different Orgo account or workspace from Jesse's key (for example Justin's team's). Stop and ask Justin's team which account holds it and whose key to use.
- Then, while it's fresh: if `status` shows any timer or send-like process, or the stop file is absent, run `node tools/orgo.mjs hold` and go through each timer with Jesse using the "Changing the computer" steps in `skills/orgo-link/SKILL.md`. Sending stays off until `projects/revenue-partner-sends/SPEC.md` passes.

## 10. The team
- `node tools/build_subagents.mjs` then `node tools/build_manifest.mjs`.
- Check: the first prints one subagent per active specialist; `.claude/agents/` has those files.

## 11. The self-check
- `node tools/check.mjs`
- Check: it prints `ok`. Anything else: fix what it names (it says which file and why), or log it for Justin's team.

## 12. Hand over
- Tell Jesse: "Installed. Nothing sends yet: that switch is yours. Next, say **set me up** and we'll go through your details, your tools and the first morning brief." Then follow `skills/getting-started/SKILL.md` if he says so.
- The install is done when the install log shows every step PASS (or a named reason), `state/STOP` exists, and no routine is switched on.

## Never
- Ask for a key, password or token in chat, or read `.env.local`. Keys go in through `node tools/add_secret.mjs NAME` in Jesse's own window.
- Remove `state/STOP`, switch on a routine, or send anything during the install.
- Edit `.claude/settings.json` or `tools/hooks/`. If they need changing, that's Justin's team.
