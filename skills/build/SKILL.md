---
name: build
description: Builds the next piece of the business inside this workspace (a new specialist, a skill for an existing one, a routine or a project spec) to the workspace's own standard, after Jesse approves the scope. Use when Jesse says "build me an agent for…", "add…", "can it do…?", "turn on Fleet", or says yes to an item from the roadmap.
---

# Build: the workspace builds itself

The 10-80-10 rule: Jesse approves the scope (the first 10%), you build (the middle 80%), Jesse checks the result (the last 10%). Nothing is built before his yes to the scope, and nothing new goes out until he's seen it work.

## Inputs
- Jesse's request, in his words (the chat or a brain dump).
- `context/asks.md` (what he's asked for before), `PROJECT_CHARTER.md` (the team, who writes what, the milestones), `vault/_shared/roadmap.md` if it exists.
- `docs/CONVENTIONS.md` (the run contract and the routine header), `docs/_templates/charter.md` and `docs/_templates/CONTEXT.md`.
- One existing example of the same kind of piece, e.g. `agents/05-jobs-and-quotes.md` with `jobs-and-quotes/CONTEXT.md`.

## 1. Scope (Jesse's first 10%)
Write the scope as one item in `queue/needs-jesse.md` under **Decide**, and say it in the chat in under ten lines:
- what it does, in Jesse's words, and which asks it answers (row numbers in `context/asks.md`; add rows with `ask-ledger` for anything new);
- what it reads, and what it may never do;
- what leaves the workspace (always drafts first) and who sees it;
- any connection, key or account it needs, and who signs in;
- any new cost, per month, and that it starts only on Jesse's yes;
- how you'll both know it works (one real example you'll run in test mode);
- its milestone and what it depends on.

Write the requirement first and then check the tool against it. If a tool can't meet it, say that's the tool's limit and offer the version that can. Never shrink the requirement to fit the tool.

Stop here until Jesse says yes in words. Record his words on the queue item.

## 2. Decide the shape
- **A skill on an existing specialist** when an existing one already reads the same things and makes the same kind of decision. This is the usual answer.
- **A new specialist** only when the reader, the decision or the gate is different. Each record has exactly one writer: check the records table in `PROJECT_CHARTER.md` and never give a second agent the same record.
- **A routine** when it must happen on a clock. It's created paused.
- **A project spec** (`projects/<name>/SPEC.md`) when it needs code on another computer, a payment, a new way to send by itself, or a change to the guards. Those are built by Justin's team: write the spec, add it to the roadmap, and tell Jesse.
- Turning on a reserved role (90+): build it as a new active charter with the next free number below 90, and delete the reserved file.

## 3. Build it (your 80%)
Write only the files the shape needs:
- `agents/NN-<role>.md` from `docs/_templates/charter.md`: the next free number below 90; the title line names `**Model:**` (sonnet unless the job is bulk mechanical work (haiku) or planning (opus)) and `**Work folder:** `<role>/``; the full Operating contract; a Profile block.
- `<role>/CONTEXT.md` from `docs/_templates/CONTEXT.md`: Inputs, Process, Outputs, and exactly one Check.
- `skills/<name>/SKILL.md`: frontmatter `name` equal to the folder name, a third-person description that says when to use it, under 500 lines, and exact commands for any risky step.
- `routines/<name>.prompt`: the header from `docs/CONVENTIONS.md` with `KIND`, `WHERE: jesse-pc`, a five-field `CRON`, `CRON_TZ: Pacific/Auckland`, `SKILLS`, `MILESTONE` and `STATUS: Created paused`, then the guard lines (switch, test, stop, isolation, lean, run log).
- A route row in `AGENTS.md` (it must stay under 60 lines; move detail to `docs/CONVENTIONS.md`), the team and records rows in `PROJECT_CHARTER.md`, and each ask's "Where it's solved" in `context/asks.md`.
- Anything only Jesse or Mike can answer goes to `OPEN_QUESTIONS.md`, one plain question each.
Then run:
```
node tools/build_subagents.mjs
node tools/build_manifest.mjs
node tools/check.mjs
```
Fix everything `check.mjs` names until it prints `ok`.

## 4. Show it working (Jesse's last 10%)
Run the new job once in test mode on one real example, read-only, with its output going to Jesse only. Show him the result and the run log. It's done when he says it's right. Switching a routine on is a separate yes (`dispatch`).

## 5. Record it
- `docs/BUILD-RECORD.md`: what was built, why, which asks, the check result, and what's not proven yet.
- A decision note in `vault/decisions/` and one line in `vault/MEMORY.md`.
- Commit locally: `git add -A` then `git commit -m "Build: <what>"`. Never push. Justin's team pulls updates in with `git pull`, and local commits keep Jesse's builds safe through that.
- Update `vault/_shared/roadmap.md` (`roadmap` skill).

## Never
- Edit `.claude/settings.json` or `tools/hooks/` (the guards). If a build needs a guard changed, it's a project spec for Justin's team.
- Change `policies/APPROVALS.md` without Jesse's typed `yes <code>` for that exact line.
- Switch on a routine, remove `state/STOP`, connect an account or spend money as part of a build.
- Build a piece that sends, posts or changes another system by itself. It drafts; Jesse sends.
- Invent a fact, price, rate or result to make a piece look finished. Unknown stays UNKNOWN.
- Start a second build while one Jesse approved is unfinished.
