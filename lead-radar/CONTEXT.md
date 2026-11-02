# lead-radar: find homeowners asking for drain help online and give Jesse a reply to post himself.

One job: find homeowners asking for drain help online and give Jesse a reply to post himself.

## Inputs
- Working (this run): the radar's latest results (`../modules/partner-program/data/radar.csv`, or the hosted radar's list at M1); the Facebook groups Jesse is in, through his own logged-in browser, read only.
- Reference (every run): `../agents/03-lead-radar.md`, `../modules/partner-program/.claude/skills/lead-radar/SKILL.md`, `../vault/_shared/voice.md`, `../policies/NZ-RULES.md`.

Do NOT load: other specialists' folders, customers' notes, partners' notes, `../context/asks.md`.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Run the module's `lead-radar` skill for one sweep, with paths relative to `../modules/partner-program/`.
3. Sort each post: hot, worth a reply, skip. Keep the post link with each.
4. Draft a helpful reply for each hot one in Jesse's voice; no prices, no promised times.
5. Log the run to `../runs/<YYYY-MM>/<date>-lead-radar-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- The sorted list → `output/radar-<date>.md`
- Reply drafts → `../queue/drafts/radar/`, plus one line in `../queue/needs-jesse.md`

## Check
Every hot lead in `output/radar-<date>.md` has a link to its post and a reply draft; Jesse posts each reply himself.
