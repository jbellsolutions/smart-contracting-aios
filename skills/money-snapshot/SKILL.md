---
name: money-snapshot
description: Reads Xero (read-only) and writes the weekday money snapshot for Jesse and Mike: cash in the bank, who owes us, bills due, this month in and out, each figure with its source and time read. Used by the money-snapshot routine, or when Jesse or Mike asks "how are we tracking?", "who owes us?" or "what's due?".
---

# Money snapshot

## Inputs
- Xero through the official Xero MCP server, read-only scopes only
- Yesterday's `data/money-snapshot.md` (to spot jumps)

## Steps
- [ ] Check the connection is read-only: the Xero server's `XERO_SCOPES` setting (in the Claude Code MCP config) lists only scopes ending in `.read`. If it's missing or lists any other scope, stop and tell Jesse: "The Xero connection can make changes. It should be read-only. Justin's team needs to fix the scopes before I use it."
- [ ] Read: bank account balances; aged receivables (who owes us, how overdue); bills due this week and next; money in and out this month so far.
- [ ] Write `data/money-snapshot.md`: each figure in NZD exactly as Xero shows it, with "read from Xero at <time>". Overdue invoices over 30 days listed by customer and amount.
- [ ] Compare with yesterday. A change bigger than the day's transactions explain: flag it for Mike, don't explain it away.
- [ ] Give the Chief of Staff three lines for the brief: cash now, owed to us (overdue part), due out this week.

## Output
`data/money-snapshot.md` and three lines for the brief.

## Done means
Mike can trust every number without opening Xero, because each one names where and when it was read.

## Never
- Create, edit, approve, send or void anything in Xero; record or make a payment.
- Show a figure as zero when it couldn't be read: write UNKNOWN.
- Forecast or round without saying so.
