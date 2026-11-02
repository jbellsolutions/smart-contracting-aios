# people: the crew's check-ins and hiring

One job per run: prepare or write up one person's check-in, or take one hiring step.

## Inputs
- Working (this run): the person's note `../vault/people/<name>.md` (check-ins), or the role being hired for (hiring); Jesse's words for this run.
- Reference (every run): `../agents/10-people.md`, `../context/owner.md` (the crew list), `templates/` (their own agreement and policy templates), `../vault/_shared/voice.md`.

Do NOT load: other people's notes, customers' or partners' notes, `../context/asks.md`.

## Process
1. If the person's note or the template the step needs is missing, stop and say which.
2. Follow `../skills/staff-check-in/SKILL.md` or `../skills/hiring/SKILL.md` for this one step.
3. Log the run to `../runs/<YYYY-MM>/<date>-people-<job>.md` with the sources read, and no personal detail in the log.

## Outputs
- A check-in agenda or write-up → `../vault/people/<name>.md` (private, never in git)
- A hiring draft → `../queue/drafts/people/`, plus one line in `../queue/needs-jesse.md`

## Check
Jesse reads each agenda before the check-in, and each draft before it's used; nothing goes to a staff member or candidate from here.
