# sops: write and keep the SOPs and checklists for the office and the crew

One job: write and keep the SOPs and checklists for the office and the crew, including QA per job type, and get Jesse unstuck.

## Inputs
- Working (this run): Jesse's or Mike's screenshots, PDFs, recordings and voice notes for one SOP; the vendor's help pages (read live, cited).
- Reference (every run): `../agents/09-sops.md`, `../skills/sop-writer/SKILL.md`, `../vault/sops/README.md`.

Do NOT load: other specialists' folders, crew notes, customers' notes.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. One SOP per run: Who, When, Steps, Check it's done, If you get stuck.
3. For a job type, add its QA list: the photos (before, during, after), the forms (commissioning), and what goes with the invoice.
4. Mark any button or menu it couldn't confirm UNCONFIRMED.
5. Log the run to `../runs/<YYYY-MM>/<date>-sops-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- The SOP draft → `../queue/drafts/sops/`, plus one line in `../queue/needs-jesse.md`; once Jesse approves → `../vault/sops/`

## Check
Jesse approves each SOP before it moves into `vault/sops/`, and every step that came from a vendor page cites it.
