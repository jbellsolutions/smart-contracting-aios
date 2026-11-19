# Ascora API: the endpoint list

Read on 2026-11-19 from Ascora's own guide, "API Endpoints V1.16" (132 pages), linked from https://www.ascora.com.au/kb/api-endpoints. The guide is the source; this page is the index. Base URL `https://api.ascora.com.au`. The key goes in a request header named `Auth`.

## The two paths the reader couldn't find

- **Enquiries have no read endpoint.** The only enquiry path is `POST /Enquiry`, which creates one. There is no `GET` that lists or fetches enquiries. The only way to see them through the API is a web hook: subscribe to `EnquiryCreated` and `EnquiryModified` and Ascora posts each enquiry to a URL we host. The hook payload carries no enquiry ID. Creating a web hook is a write (`POST /WebHooks`), so it needs Jesse's yes and somewhere to receive it. Until then enquiries stay UNKNOWN in reports, or come from the Ascora screen.
- **Customer invoices have no general list endpoint.** The only customer-invoice read is `GET /Accounting/GetInvoicesToSend?priorToDate=YYYY-MM-DD`, and the guide says the Accounting functions are only for businesses without a direct accounting connection such as Xero. Smart Contracting uses Xero, so expect this to return nothing useful: try it once and record what comes back. Invoices are better read from Xero. Supplier invoices do have a proper search (below).

## Reads (GET): safe for the reader

| Path | What | Notes |
|---|---|---|
| `/Customers/Customers` | Search customers | `Page`, `PageSize` |
| `/Customers/Customer/<id>` | One customer | |
| `/Customers/Contacts` | Search contacts | `Page`, `PageSize` |
| `/Customers/GetContactsForCustomer/<id>` | A customer's contacts | |
| `/Quotes/Quotes` | Search quotes | `QuoteStatus=...`; default page 1, 250 a page |
| `/Quotes/Quote/<number>` | One quote | |
| `/Quotes/LabourRoles`, `/Quotes/StandardSections`, `/Quotes/StandardStages` | Quote reference lists | |
| `/Jobs/Jobs` | Search jobs | default page 1, 250 a page |
| `/Jobs/Job/<number>` | One job | |
| `/Jobs/JobLabour/<job number>`, `/Jobs/jobTimesheets/<job number>` | Labour and timesheets on a job | |
| `/Bookings/Bookings` | Search bookings | `ModifiedSince`, `IncludeArchived=true`, `SortBy=LastModified`; default 1,000 a page, top 5,000 |
| `/Bookings/Booking/<id>` | One booking | |
| `/Bookings/ActivityTypes` | Booking activity types | |
| `/Inventory/Supplies`, `/Inventory/Kits`, `/Inventory/Categories` | Price book | |
| `/SupplierInvoices/SupplierInvoices` | Search supplier invoices | `SupplierName`, `ToBeSentToAccountsOnly=true`; 250 a page |
| `/SupplierInvoices/SupplierInvoice/<id>` | One supplier invoice | |
| `/Suppliers/Suppliers`, `/Suppliers/Supplier/<id>` | Suppliers | `SupplierName`, `BusinessNumber` |
| `/Users/Users` | Staff | `FullDetails=true`; default 1,000 a page |
| `/WebHooks` | Web hook subscriptions we hold | |
| `/Attachments/Zip` | Photos and files for a job, quote, customer or purchase order as a ZIP | `entityType`, `entityNumber` or `entityId`, `createdFrom`; **10 requests an hour, one at a time** |
| `/Accounting/GetInvoicesToSend`, `/Accounting/GetPaymentsToSend` | Invoices and payments waiting to go to an accounting package | `priorToDate`; see the note above |

## Writes: never from a reader

Each of these changes Ascora. None runs without Jesse's yes for that exact action (`policies/APPROVALS.md`); the ones marked "never" are tier 2.

- `POST /Enquiry`, `POST /Customers/Customer`, `POST /Customers/Contact`
- `POST /Quotes/Quote`, `/Quotes/AddSupplies`, `/Quotes/AddKits`, `/Quotes/AddWriteIns`, `/Quotes/AddLabourItems`, `/Quotes/AddQuoteSections`, `/Quotes/ClearQuoteItems`, `/Quotes/UpdateStatus`, `/Quotes/UpdateSecondaryStatus`, `/Quotes/UpdatePipelinePhase`, `/Quotes/ConvertToJob`, `/Quotes/DeleteQuote`
- `POST /Jobs/Job`, `/Jobs/AddSupplies`, `/Jobs/AddKits`, `/Jobs/AddLabourItems`, `/Jobs/UpdateSecondaryStatus`, `/Jobs/UpdatePipelinePhase`
- `POST /Bookings/Booking`, `/Bookings/ArchiveBooking`
- `POST /Notes/Note`, `POST /Attachments/{EntityType}/{EntityId}`
- `POST /Suppliers/Supplier`, `POST /SupplierInvoices/SupplierInvoice`
- `POST /WebHooks`, `DELETE /WebHooks/<id>`
- Never: `POST /Accounting/CreatePayment`, `/Accounting/MarkInvoicesAsSent`, `/Accounting/MarkPaymentsAsSent`, `/SupplierInvoices/MarkInvoicesAsSent` (these move the books)

## Not checked here

Exact parameter names for each search beyond those listed, and response field names: read the guide's section for the path before relying on one.
