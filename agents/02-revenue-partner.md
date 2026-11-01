# Agent charter: Revenue Partner (existing)

**Bot name:** Revenue Partner · **Runs on:** its Orgo computer (Hermes), in their Slack · **Milestone:** M0 (upgrade) · **Reports to:** Jesse; the Chief of Staff reads its posts

Replaces: Jesse finding partner prospects, writing every cold email, chasing replies and keeping partner records by hand.

## Role
Their always-on agent. Today it finds partner prospects, drafts cold emails for Jesse's tick every weekday at 07:30, sends after his yes and watches replies. The partner-program upgrade (`modules/partner-program/`, built Oct 27) adds call cards, signing partners, campaigns, referrals, the 5% fee ledger, payouts and the Friday scoreboard. "Your revenue partner is just one cog… one employee, one role" (Justin, Oct 28).

## Operating contract

| | |
|---|---|
| **Owner** | Jesse. Changes reach it only through `upgrade-revenue-partner` (the Workshop skill) or Jesse's own Slack messages. |
| **Reads** | Its own skills and files on its computer; Jesse's Slack messages |
| **Only writer of** | The outreach tracker and suppression list (its existing skills); partner, referral, campaign, payout, call-card and outbox records in `~/PartnerDesk` through `partner_ledger.py` |
| **Produces** | Daily partner drafts; reply alerts and call cards; the Friday scoreboard |
| **Never** | The AIOS never writes its records or edits its computer directly. The Chief of Staff drafts Slack messages for Jesse to send it |
| **Stops and tells Jesse when** | As its own skills say (`modules/partner-program/skills/revenue-partner/`) |
| **Tools and scopes** | Its own Hermes tools on its computer, as installed: sending from their Microsoft mailbox, email checks, Slack, and the partner ledger tool |
| **Hands off to** | Jesse in Slack (drafts, call cards, the scoreboard); the Chief of Staff reads those posts |
| **Limits per run** | As its own routines set (partner drafts: Jesse asked for "the 10 a day minimum"); starting values live in the module |
| **Wakes on** | Its own crons on its computer (UTC) and Jesse's Slack messages |
| **If a run fails** | It posts an honest status in Slack and sends nothing; it reruns only when Jesse asks |
| **Done means** | As the partner-program package's charter says (`modules/partner-program/agents/01-revenue-partner.md`) |

## What it owns
Asks 1–35 and 61–72 in the build's ledger (the partner program and outreach), plus:

| Ask | How |
|---|---|
| 84: Jesse's fixes carry across audiences ("it went back to… standard operating settings" when outreach moved from property managers to builders) | Justin's team, at the install session: one house-style note the outreach skill reads for every segment, with segment notes layered on top, so a fix made once applies everywhere unless Jesse says it's segment-only. Mirrored in `vault/_shared/voice.md` |
| 49: run it without logging into Orgo | Jesse talks to the Chief of Staff; `revenue-partner-doctor` and `upgrade-revenue-partner` do the Orgo work |

## What it could take on next
Justin, Oct 28: "sending out the emails for you is great. There's so much more [it] could be doing." Jobs that must run while Jesse's PC sleeps belong here, decided with Justin at M1–M2 (ask 105): receiving Ascora's webhooks (quote accepted, job booked), emailing Mike his money snapshot once Jesse approves that as a standing job, and the hosted radar's hand-off. Each one goes on only through `upgrade-revenue-partner` and Jesse's yes.

## Platform limits, named
- Its crons run in UTC (07:30 NZDT shows as 18:30). Never change its clock or time zone.
- It runs on OpenRouter credit; `scdt-credit-watch` warns before it runs out.

## Profile
Lives on its own computer; see `modules/partner-program/START-HERE.md`. This charter only tells the AIOS how to work with it.
