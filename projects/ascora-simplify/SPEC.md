# Project: make Ascora simple (M2–M3)

Jesse, Oct 28: "It's not the smoothest bit of kit… I don't see why we couldn't pull our data out of it and put it into another system… not saying I want to change." "It just needs to be simplified… it would only be maybe 10 [things]."

Justin's method, same call: field-service tools are specialised, so "first isolate the things that are clunky that are actually slowing you down", measure what each costs in time or money, and only rebuild if it's costing "thousands of dollars".

## Steps
1. **The clunk list.** Jesse names the steps that slow him down (target: his "maybe 10"). Each gets: who does it, how often, minutes each time. Example from the call: job photos can't be dragged out; they have to be downloaded.
2. **Fix on top, not instead.** For each item, the cheapest fix that keeps Ascora as the record: an SOP (`sop-writer`), an API pull (photos, quote status), a webhook alert (quote accepted, job booked), or a Zapier step.
3. **The measured decision.** After the fixes, total what Ascora still costs (subscription plus remaining clunk time). Only if that's large does a replacement get scoped, and that's Jesse's and Mike's decision, with an export of all their data first.

## Fix first: invoices stuck on their way to Xero (ask 120, Oct 30)
Jesse found two causes (Oct 30, with Mike):
1. **Job coding.** Jobs are coded commercial, civils or domestic, and invoices sit in Ascora when the code is wrong: "It's just contracting. It's a job. There's no point splitting it apart." The agent writes the exact steps to merge the codes from Ascora's own help pages (cited), and lists the invoices waiting now. Mike, as admin, makes the change.
2. **gmail.com senders.** Ascora picks up supplier invoices from business email domains but not from gmail.com addresses, so a small builder's invoice never lands. The agent finds Ascora's setting or support answer (cited) and writes the steps; Mike makes the change.
Check: the Money mismatch list (Ascora vs Xero) shows no invoice held back for either reason.

## Ascora facts (checked 2026-10-28, ascora.com.au/kb/api-endpoints and the API guide v1.16)
- REST API at api.ascora.com.au; key from Administration → API Settings.
- Quotes (create, status, convert to job), jobs, customers, bookings, suppliers, supplier invoices, notes; attachments up and down (job photos as a ZIP, 500 files / 200 MB, 10 requests an hour).
- Webhooks for enquiry, customer, quote, job and booking events.
- Zapier app (10 triggers, 7 actions). Reports export to Excel.
- Plan tier that includes the API: UNKNOWN; ask Ascora.

## Not this way
Reverse-engineering Ascora's software to copy it (suggested on the call) isn't part of this build: their own data comes out through the API and exports, and a simpler layer goes on top. Copying a vendor's software is a legal and support risk the business doesn't need.
