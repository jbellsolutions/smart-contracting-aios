# money: give Jesse and Mike the true money position from Xero

One job: give Jesse and Mike the true money position from Xero, read-only, and the invoice-flow checks Mike wants.

## Inputs
- Working (this run): Xero through the official Xero MCP server, read scopes only; Ascora's completed jobs and invoices (through Jobs and Quotes, M2).
- Reference (every run): `../agents/04-money.md`, `../skills/money-snapshot/SKILL.md`.

Do NOT load: other specialists' folders, customers' notes, crew notes, the partner ledger.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Confirm the Xero connection is read-only (the `money-snapshot` skill's check). If not, stop.
3. Read bank balances, aged receivables, bills due, this month in and out.
4. M1: list invoices that are in Ascora but not in Xero, and Xero lines that don't match Ascora (Mike's "any errors between Ascora and Xero").
5. Log the run to `../runs/<YYYY-MM>/<date>-money-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- The snapshot → `../data/money-snapshot.md`
- Mismatches and invoicing prep for Mike → `../queue/drafts/money/`, plus one line in `../queue/needs-jesse.md`

## Check
Every figure in the snapshot names Xero and the time it was read, and no call to Xero wrote anything (the run log lists only read calls).
