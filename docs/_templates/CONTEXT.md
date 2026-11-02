# <role>: <one job>

The contract for a specialist's work folder. Copy it to `<role>/CONTEXT.md` and name the folder in the charter's title line (`**Work folder:** `<role>/``). The specialist's kits (templates, checklists) and outputs live inside this folder.

One job: <!-- WRITE: one sentence -->

## Inputs
- Working (this run): <!-- WRITE: exact paths this run reads, e.g. `../queue/jobs/<role>.md` -->
- Reference (every run): `../agents/NN-<role>.md`, `../vault/_shared/voice.md`, <!-- WRITE: this folder's kits -->

Do NOT load: other specialists' folders, other customers' or staff notes, <!-- WRITE -->

## Process
1. If an input is missing or empty, stop and say which.
2. <!-- WRITE: numbered steps, short; a step that is code names its command -->
3. Log the run to `../runs/<YYYY-MM>/<date>-<role>-<job>.md` with the sources read.

## Outputs
- <!-- WRITE: `<file>` -> `output/` -->
- Anything that leaves the workspace -> `../queue/drafts/<role>/`, plus one line in `../queue/needs-jesse.md`

## Check
<!-- WRITE: exactly one check. Anything that leaves the workspace is checked by Jesse, through the queue. -->
