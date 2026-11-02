# follow-ups: tell Jesse in plain words who got which follow-up

One job: tell Jesse in plain words who got which follow-up, what happened, where each lead came from, and who to call.

## Inputs
- Working (this run): GoHighLevel, read-only: contacts and their source, message status, workflows, pipelines.
- Reference (every run): `../agents/06-follow-ups.md`, `../skills/follow-ups-report/SKILL.md`.

Do NOT load: other specialists' folders, the partner ledger, crew notes.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Read since the last report only.
3. List each lead: source, last follow-up, delivered/opened/replied, next step.
4. Build the "who to call" list, and review requests for jobs paid since the last report (drafts).
5. Log the run to `../runs/<YYYY-MM>/<date>-follow-ups-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- The report → `../data/follow-ups-report.md`
- Call list and review-request drafts → `../queue/drafts/follow-ups/`, plus one line in `../queue/needs-jesse.md`

## Check
Every lead in the report names its source and its last follow-up as GoHighLevel shows it; anything unread is UNKNOWN.
