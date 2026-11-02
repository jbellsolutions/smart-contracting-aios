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

## v0.2 (2026-11-01): installs itself, builds itself, reaches the Revenue Partner

From Justin's instruction of 1 Nov ("drop it in Claude Code, and it self-installs and builds itself… one chat that's his master chat"), Jesse and Mike's recorded office chat (30 Oct NZ), Jesse's send-fix PDF and Slack messages (29–31 Oct). Ledger rows 106–128; rows 79, 91 and 92 updated with Jesse's answers.

**Built to Justin's AIOS standard**, adapted for Windows: the hooks and tools are Node scripts, because Node is already a prerequisite (the Xero connection needs it) and Python may not be on Jesse's PC. `cb verify` now runs the AIOS checks; the workspace has its own copy of them in `tools/check.mjs`, so it can check itself after each build.

| Piece | What it does | Asks |
|---|---|---|
| `skills/install`, `START-HERE.md` | One paste clones it; the chat installs and proves each step (folder, tools, STOP, both guards firing, module, private files, Obsidian, Slack, the Orgo link, subagents, self-check) and writes an install log | 125 |
| `skills/build` | Builds a new specialist, skill, routine or project spec after Jesse approves the scope; self-checks; shows it working in test mode; commits locally | 126 |
| `skills/roadmap`, `vault/_shared/roadmap.md` | Ranks what to build next (safety first, then more work in, then time back), as milestones and dependencies | 128 |
| `skills/orgo-link`, `tools/orgo.mjs` | Status, logs and `hold` on the Revenue Partner's Orgo computer; each question, and any change there, only after Jesse types the code for that exact command | 127, 49 |
| `projects/revenue-partner-sends/SPEC.md` | Jesse's fix list as requirements and checks: one sender, a real stop file, the right clock, latest draft only, each email once, the gateway kept up, then the model. Sends stay off until it passes | 106–111 |
| `.claude/settings.json`, `tools/hooks/` | Guards: connector sends blocked (this workspace drafts), outward actions blocked while `state/STOP` exists, keys kept out of chat, Jesse's typed `yes <code>` recorded | 107, rules |
| `agents/10-people.md`, `skills/staff-check-in`, `skills/hiring`, routine `staff-check-ins` (paused) | Weekly check-ins prepared and written up; hiring drafts and agreements from their own templates | 123, 124 |
| `skills/evening-brief`, routine (paused) | Where we landed, and everything that went out and who approved it | 117 |
| Work folders (`<role>/CONTEXT.md`), `.claude/agents/`, `docs/LOOPS.md`, `/calibrate`, glossary | The AIOS standard's structure: one contract and one check per specialist, subagents, event loops, corrections that stick | — |
| Charter updates | Money (Ascora-to-Xero mismatch list), Jobs and Quotes (quantities, rain days, customer texts), Follow-ups (review requests), Office (inbox triage, calendar by voice), SOPs (QA per job type, pre-starts), Fleet (Cartrack) | 112–122 |

**Tested here (offline):** the Orgo tool's approval flow with a stand-in Orgo CLI (staging, refusal without a typed code, refusal of a stale or reused code, one run, the run log, scrubbing), every script it sends to the computer checked with `bash -n`, the stop guard against 13 sample calls, the secret scan, and `add_secret.mjs` in a pseudo-terminal. A bug was found and fixed (two status lines printed a shell variable literally).

**Not proven yet:** anything on Jesse's PC (Windows hooks firing, the trust prompt, `node` on the app's PATH, `add_secret` in PowerShell), and anything against the real Revenue Partner computer (Hermes's location and user, `hermes cron list`, `--source tool`). The install proves the first set; the first `orgo-link status` proves the second. A read-only test against a live Orgo box from Justin's Mac was refused by the session's safety check and not worked around.

**Open:** the hard stop Justin asked for on 30 Oct is unconfirmed, so treat the Revenue Partner as able to send until `orgo-link status` shows otherwise.

### Independent review of v0.2 (fresh Opus reviewer, given the sources and the package, not the build summary)

| Finding | Severity | Fixed how |
|---|---|---|
| `ask` started an AI session on the Revenue Partner's computer, gated once and then forever; ignored STOP; no profile | High | Each question needs its own code; refused while STOP exists; sent with "answer only"; at most 4 turns; `ORGO_PROFILE` supported |
| The model could approve its own changes: the code was printed in the chat and the guard missed some ways of writing approval files; "do NOT approve <code>" counted | High | Codes are random, shown only in a window on Jesse's screen, stored only as a slow hash; only a message that is exactly `yes <code>` counts, and only for a staged item; `apply` takes the one approved item |
| Guard gaps: wildcard `.env` reads, `rm state/STOP`, `sed` on the guards, Write/Edit on tools and local settings, camelCase and dispatcher connector tools, browser typing, network writes by other commands | High | Connector tools allowlisted to reads and drafts; Write/Edit blocked on `.claude/`, `tools/`, `policies/` and approval records; Bash rules widened; `check.mjs` fails on a local settings file that turns hooks off; docs now say what the guards don't cover. 44 sample calls pass, including every bypass the reviewer found |
| A build or `/calibrate` could weaken the guarantees | Medium | Both now send rule changes (charter Never lines, the install, `orgo-link` and `build` skills, anything under `.claude/`, `tools/`, `policies/`) to `queue/needs-jesse.md`; the hooks block those files anyway |
| The send spec's checks 4–5 couldn't run with the stop file on | Medium | Test mode: sends only to Jesse's own address while the stop file exists |
| `status` checked Hermes jobs without a profile | Medium | Lists the profiles and checks jobs in each |
| Cold Windows install: Git on PATH before a restart; `npm.ps1` blocked in PowerShell | Medium | Restart the app after installing Git; `npm.cmd` in PowerShell. The install now also tests the approval window and a refused Slack send |
| Contradictions: who edits APPROVALS.md; how the local STOP is lifted; `hold` changing the computer without a code; the Revenue Partner's owner row and clock line; standing approvals can't send | Medium | APPROVALS.md is changed only by Jesse or Justin's team; `tools/switch.mjs stop-off` with Jesse's code; `hold` named as the one exception (it only adds the stop file, no recursive ownership change); charter rows fixed; asks 117 and 118 say their sending needs a send path opened by Justin's team |
| Jesse's "top heavy and system heavy" remark, and a family nickname, in the public repo | Low | Removed (nickname kept privately) |
| Cheapest materials; the Instagram name; NZ time only; the deemed-consent wording; ledger rows 110–111 numbering | Low | Fixed |

Where the Orgo and Hermes command lines come from: `orgo computers bash <name> [--workspace] --timeout -c` was read from the Orgo CLI's own help (version 2.3.0) on Justin's Mac; `hermes [-p profile] chat -q … -Q --source tool --max-turns` and `hermes cron list` come from Justin's own Orgo tooling, proven on his boxes. None of it is proven on Jesse's computer yet.

After the review, each skill's real tool calls were replayed through the hook (install, getting-started, radar, orgo-link, briefs, build). That found three more, now fixed: the module's `revenue-partner-doctor` types into Orgo's web terminal, which the guard blocks, so its job moves to `orgo-link` (Jesse types in the terminal himself only if the computer can't be reached); STOP blocked registering the first morning brief, so registering a routine is allowed (each routine checks STOP itself); and the rewrite had dropped the `--send` rule the install's own guard test relies on. Dictated approvals ("Yes, K7QF 2M9X.") now count; a reply with anything else in it still doesn't. 45 guard cases and the replays pass.

## Install replay fixes (2026-11-02, Xander's team, from the Nov 1 install call)
What failed on Jesse's PC on Nov 1, and what changed:
- **The approval window never showed on his screen** (the Claude app ran it where his desktop couldn't see it), so the approval test was skipped. Now every staged item can also be approved from Jesse's own PowerShell window: `node tools/approve.mjs` shows exactly what's waiting and asks him to type yes. It runs only in a real terminal, and the stop guard blocks the chat from running it. Staging no longer fails when no window can be shown.
- **The Orgo tool's download was incomplete** ("one of its parts is missing a file") and the clean reinstall was blocked by the recursive-delete rule. New `node tools/setup_orgo.mjs` removes only `tools/.orgo`, reinstalls `orgo@2.3.0` (npm.cmd on Windows), and proves the tool starts. `orgo.mjs` now names it whenever the tool is missing or broken. The rule itself stays.
- **The Revenue Partner's computer couldn't be named** (it took a browser sign-in and the name still didn't match). New `node tools/orgo.mjs computers` lists what Jesse's key sees, and `use "<name>"` saves it only if it matches exactly (it suggests near names). `ORGO_COMPUTER` is no longer a key Jesse types.
- **The first chat started in another folder, so the guards didn't load.** Install step 1 now stops and tells Jesse the exact clicks to open a new session in the right folder; START-HERE says why.

**Verified (Linux, with a stub Orgo tool and the real `orgo@2.3.0` install):** the computers/use/status flow, the terminal approval and the "yes <code>" approval both end in "Approval test: PASS", the chat can't run `approve.mjs`, `setup_orgo.mjs` reinstalls cleanly twice in a row, and the existing guard cases still block (`--send` under STOP, Slack send, fake key). **Not verified:** anything on Jesse's Windows PC or his Orgo account.
