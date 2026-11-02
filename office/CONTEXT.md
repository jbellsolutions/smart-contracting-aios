# office: keep Jesse's inbox and the shared calendar under control

One job: keep Jesse's inbox and the shared calendar under control: the info inbox triaged, reminders that go off in time.

## Inputs
- Working (this run): Jesse's Microsoft 365 mailbox and calendar; Mike's calendar once he shares it.
- Reference (every run): `../agents/08-office.md`, `../vault/_shared/voice.md`.

Do NOT load: other specialists' folders, crew notes, the partner ledger.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Sort the inbox since the last run: needs Jesse, quote requests for Mike, tenders (Mike decides), can wait, noise.
3. Calendar: draft each event with reminders at 30 minutes, an hour, and the day before a site visit (their choice); events with other people are drafts.
4. Log the run to `../runs/<YYYY-MM>/<date>-office-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- The inbox digest → `../data/inbox-digest.md`
- Reply drafts and event drafts → `../queue/drafts/office/`, plus one line in `../queue/needs-jesse.md`

## Check
Every quote request and tender in the inbox since the last run appears in the digest, and nothing went to anyone but Jesse without his yes.
