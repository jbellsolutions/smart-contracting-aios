# Build record: Smart Contracting AIOS

## v0.1 (2026-10-28): the spec and the starter workspace

**Sources:** the AIOS call (Justin's Wed 28 Oct evening = Jesse's Thu 29 Oct NZ, 45 min, digest `source/digests/2026-10-28.md` in the build folder); Justin's instructions the same evening; the partner-program build (calls Sep 16 – Oct 13, Slack to Oct 28); the Slack channel on Oct 28 (Jesse's builder-segment drafts and his "less clunky" note).

**What this is:** the structure Justin promised on the call ("take today's context and have the structure… on Monday… fill in any gaps"): the Chief of Staff and its skills, a charter for every specialist, the vault, the policies, the milestone plan and the open questions. Specialists past M0 are specified, not built: their connections need Jesse's or Mike's sign-ins and answers.

**How it was built:**
- Built by hand to Justin's team's package standard and checked with the team's package checks.
- Layout: Justin's team's AIOS layout (entry file, conventions, charter template, Chief of Staff, vault), written for Smart Contracting: NZ law, NZ time, Kiwi voice, their tools.
- The partner-program repo (public, 87ee435) is a module, cloned at install, not copied: one source for the Revenue Partner's upgrade and the Workshop skills.

**Integration facts used** (checked 2026-10-28 by a research pass; sources in the build folder's session notes):
- Ascora: REST API at api.ascora.com.au with webhooks (quotes, jobs, customers, bookings, supplier invoices, attachments incl. job photos; 10 photo-download requests an hour); Zapier app; plan tier for API UNKNOWN.
- Xero: official MCP server (XeroAPI/xero-mcp-server); Custom Connection at NZD 10/month ex GST or a free OAuth app; the server asks for write scopes (including payments) unless `XERO_SCOPES` lists read scopes only, so the install sets it and `money-snapshot` checks it. Bills by email become draft bills.
- GoHighLevel: official LeadConnector MCP as a Claude custom connector (OAuth, choose sub-account and scopes); message status and contact attribution available.
- Meta: Business Suite scheduling by Jesse (free); agent posting needs a private Meta app (standard access, no app review for app-role users) or GoHighLevel's Social Planner.
- Outlook: share calendars ("Can view all details"); shared jobs as meetings inviting both; Graph can create events.

**Choices where the call was unclear:**
- "Move it into the AIOS client builds folder": it already lives there (`~/Desktop/Client Builds` is a link to the AIOS folder).
- A new repo rather than growing the partner-program repo: the call changed the team's shape from an overlay to a whole-business system.
- The milestone order puts more work in the door first (Radar, partner program) and Money read-only in M1, following Jesse's priority on the call: more work in the door first.
- Reverse-engineering Ascora (suggested on the call) is not in the build: their data comes out through Ascora's API and exports, and copying a vendor's software is a risk they don't need. Recorded in the ledger as "not this way".
- Jesse's lost-refinements problem lives in the Revenue Partner's existing outreach skill, which this package doesn't edit. The fix (one house-style note for every segment) is Justin's team's, at the install session.

**Verified:** `cb verify` and `cb coverage` (see the commit). **Not verified:** anything on Jesse's PC; every connection (Xero, Ascora, GoHighLevel, Meta, Microsoft); whether nested Workshop skills load automatically from `modules/partner-program/` (the Chief of Staff reads them directly either way).

## Open items

| Item | Who | Next step |
|---|---|---|
| Answers to `OPEN_QUESTIONS.md` A1–A15 | Jesse and Mike | Brain dump in Slack before Monday |
| The outreach house-style fix (ask 84) | Justin's team | At the install session |
| Hosted radar for Christchurch | Justin's team | Switch on (M1) |
| How-to video they can pause | Justin | Record after the install |
| Publish this repo | Justin | His call (gate) |

## Independent review (2026-10-28)

A fresh reviewer read the Oct 28 transcript, Justin's instructions and this package cold. Findings and what was done:

| Finding | Severity | Fix |
|---|---|---|
| The three private context files the install needs didn't exist; the step-1 check needed them first | High | Written privately for Justin's team to hand over; START-HERE reordered so each check works when it runs |
| "Read-only Xero" wasn't set up: the server asks for write scopes unless `XERO_SCOPES` says otherwise; Node.js not listed | High | Read scopes set on both the connection and `XERO_SCOPES`; Node.js a prerequisite; `money-snapshot` checks the scopes every run |
| Routines were never registered with a scheduler | High | Switching one on also registers it as a scheduled task in the Claude app (CONVENTIONS, `getting-started`) |
| The Chief of Staff had no Slack connection step, and the Revenue Partner's routines post to Jesse's DM | High | Install step 4 connects Slack and reads the channel and the DM |
| Approval tiers contradicted each other on prices and on reports to Mike | Medium | APPROVALS rewritten: reports to Jesse and Mike are free; Mike signs off prices and the books; agents never change a price in Ascora |
| Ascora key is all-or-nothing; webhooks need an always-on address | Medium | Read calls only, every change on a yes; webhooks go to the Revenue Partner's computer or Zapier if used (decided at M2) |
| Ascora limits rest on the API guide PDF | Medium | Marked "per the API guide v1.16; confirm at M2" |
| GoHighLevel "read-only scopes" overclaimed | Medium | Now "narrowest read scopes; read-only set UNCONFIRMED, checked at M2" |
| Two "set me up" skills; the module's later milestones overlap Follow-ups and Jobs | Medium | AGENTS.md routes "set me up" here; the module's getting-started only for radar groups; its 90–92 ignored |
| Two ask ledgers would collide | Medium | Rows added on Jesse's PC start at 1001 |
| Install folder disagreed (Documents vs home) | Medium | Home folder, never OneDrive |
| Mike's calendar writable without a yes | Low | Read his calendar; he gets invites |
| Missing asks: ongoing support after the build, "by your Saturday", "so much more" for the Revenue Partner | Medium | Ledger rows 103–105; the Revenue Partner charter lists what it could take on |
| Internal build jargon in files Jesse reads | Low | Removed |
| A digest timestamp written as "[17:xx]"; "new digs" read as an office | Low | Corrected in the digest |

## Public (2026-10-31)

Pushed to GitHub privately on 2026-10-29, then made public on 2026-10-31 on Justin's word ("for now"), as one squashed commit. Before going public, Jesse's own words about where the business stands moved out of the repo into `context/owner.md` (handed over privately at the install), and those phrases joined the blocked-terms list so `cb verify` keeps them out.

Before every push: `cb verify` with the blocked terms, and confirm nothing under `private/` or `context/`, and no `CLIENT-CONTEXT.md`, is tracked.
