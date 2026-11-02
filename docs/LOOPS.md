# Event loops: how work moves through the system by itself

A loop is a chain of jobs started by an event. Each step is one specialist's run under the run contract (`docs/CONVENTIONS.md`): it drafts, logs, and hands on through a file. Nothing leaves the workspace without Jesse's yes. Three rules keep loops safe:

1. **One key per thing.** Every loop item has a stable key, such as `radar-<post id>` or `jobs-<job id>-rainday-<date>`. A step first looks for its key in its output and the queue. If it's there, the step does nothing. So a repeated event, or a re-run after a failure, never makes a second draft or a second send.
2. **Approval doesn't send.** Jesse's yes ticks the queue item, with the draft's hash. This workspace drafts; Jesse sends from his own apps, or the Revenue Partner's one sender sends partner emails. The evening brief lists everything that went out.
3. **A quiet step logs NO_CHANGE and messages no one.** The briefs report what moved.

## The loops

| Loop | Event | Steps (owner) | Key | Waits on Jesse at |
|---|---|---|---|---|
| Homeowner lead | The radar finds a post asking for drain help | 1. Sort it and draft a reply (Radar). 2. Jesse posts the reply himself. 3. If they get in touch, it's an enquiry in Ascora (Jobs and Quotes reads it) | `radar-<post id>` | Every reply (he posts it) |
| Partner email | The Revenue Partner's 07:30 drafts | 1. Draft (Revenue Partner). 2. Jesse says yes in that draft's own thread. 3. The one sender sends it once, 15 minutes apart, after checking the stop file (`projects/revenue-partner-sends/SPEC.md`). 4. Replies become call cards | the draft's id and hash | Each draft. **Off until the one sender passes its checks** |
| Quote to job | Mike gives quantities for a job | 1. Quote draft priced from Mike's sheet (Jobs and Quotes). 2. Mike signs off and enters it. 3. Quiet quotes come back in the weekly report (Follow-ups) | `jobs-<enquiry id>-quote` | Mike's sign-off |
| Rain day | Jesse says "rain day" (or the forecast in the morning brief) | 1. Proposed new dates for the affected jobs, and which crew to bring when (Jobs and Quotes). 2. A text per customer, the ones needing a call flagged. 3. Jesse changes Ascora and sends the texts (or approves them once a texting channel exists) | `jobs-<job id>-rainday-<date>` | The plan and the texts |
| Job done to paid | A job is marked done in Ascora | 1. QA checklist for that job type (SOPs). 2. Ready-to-invoice line for Mike, QA attached (Money, M2). 3. Mike invoices. 4. Once paid, a review-request draft (Follow-ups) | `jobs-<job id>-done` | Mike's invoice; each review request |
| Invoice flow check | The money snapshot runs | 1. List invoices in Ascora not in Xero, and the reverse (Money). 2. Each stuck one, with the likely cause (job code, gmail.com sender) | `money-mismatch-<invoice id>` | Mike fixes them in Ascora |
| Pre-start check | Each work morning (once Site8 Pro can be read, M2) | 1. Who hasn't done their pre-start by the set time (SOPs). 2. A reminder text draft per person | `sops-prestart-<date>-<person>` | Each text, until a standing approval covers that exact reminder |
| Staff check-ins | Monday's `staff-check-ins` routine | 1. Who's due, with a one-screen agenda each (People). 2. Jesse has the chats. 3. Write-up and follow-ups from his voice note | `people-<person>-<week>` | The agenda (his conversation) |
| A new build | Jesse says "build me…" or approves a roadmap item | 1. Scope as a queue item (Chief of Staff, `build`). 2. Jesse's yes. 3. Built, self-checked, shown in test mode. 4. Jesse's yes that it's right. 5. Committed locally; roadmap updated | `build-<name>` | The scope, and the result |
| Revenue Partner check | Each morning brief, or "is it OK?" | 1. `orgo-link` status: gateway, stop file, timers, clock. 2. Anything that could send while held goes to the top of the brief | `orgo-status-<date>` | Any change on its computer (typed code) |

## A worked example: a rain day

1. Jesse, by voice: "Rain day tomorrow, push everything out."
2. The Chief of Staff hands it to Jobs and Quotes (`dispatch`). Jobs reads tomorrow's bookings from Ascora (read calls only) and writes `queue/drafts/jobs/rainday-<date>.md`: each job, the proposed new day, which crew, and a text for each customer, with two flagged "call instead".
3. One line in `queue/needs-jesse.md` under **Approve**: `jobs-rainday-<date> · jobs · New dates for 6 jobs and 4 texts; 2 customers to call · draft: queue/drafts/jobs/rainday-<date>.md`.
4. Jesse reads it, changes one date, says "yes". The Chief of Staff records his words with the edited draft's hash.
5. Jesse moves the bookings in Ascora and sends the texts (or the texting channel does, once it exists and he's approved that exact message). A second "rain day" for the same date finds the key and does nothing.
6. Run logs: `runs/<YYYY-MM>/<date>-jobs-and-quotes-rainday.md`. The evening brief lists the texts that went out and who approved them.
