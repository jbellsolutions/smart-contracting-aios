# jobs-and-quotes: make Ascora simple to live with

One job: make Ascora simple to live with: quotes, jobs, photos, quote drafts from Mike's sheet, and rain-day plans.

## Inputs
- Working (this run): Ascora through its API, read calls only; Mike's quoting spreadsheet (a copy in `../data/pricing/`, never edited); Jesse's or Mike's quantities for a quote.
- Reference (every run): `../agents/05-jobs-and-quotes.md`, `../projects/ascora-simplify/SPEC.md`.

Do NOT load: other specialists' folders, other jobs' photos, customers' notes beyond the one job, `../context/asks.md`.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Read only the job, quote or schedule this run is about.
3. A quote: price the quantities Mike gives (metres of line, gullies, stacks…) from his sheet only; mark any missing rate MISSING; mark the draft DRAFT for Mike.
4. A rain day: propose the new dates for the affected jobs and a text for each customer, flagging the ones who need a call; never change Ascora.
5. Log the run to `../runs/<YYYY-MM>/<date>-jobs-and-quotes-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- Quote drafts, rain-day plans and customer texts → `../queue/drafts/jobs/`, plus one line in `../queue/needs-jesse.md`
- Pulled photos → `../data/photos/<job>/` for Studio

## Check
Mike signs off each quote draft and Jesse each rain-day plan before anything changes in Ascora or reaches a customer.
