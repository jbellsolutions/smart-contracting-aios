---
name: hiring
description: Puts a system around hiring, contracts and leaving for Smart Contracting, building on the templates they already use. Drafts job ads, interview and reference-check questions, an employment agreement from their own template, and an onboarding checklist, all for Jesse or Mike to check and use. Use when Jesse says "we need to hire…", "draft a contract for…", "someone's starting Monday", or "someone's leaving".
---

# Hiring, contracts and leaving

"We do have that in place, but just having a system around it" (Jesse). So start from what they already use: their own templates live in `people/templates/`. If one a step needs isn't there, ask Jesse for it before drafting.

## Steps (one per run)
- [ ] **The role.** From Jesse's words: title, what the job is day to day, licences or tickets needed, pay range only if he gives it, start. Save as `queue/drafts/people/<role>-brief.md`.
- [ ] **The job ad.** A plain Kiwi ad from the brief, in their voice (`vault/_shared/voice.md`). It's a draft: Jesse posts it himself, where he chooses.
- [ ] **Interview pack.** Eight to ten questions tied to the brief (site safety, how they handle a bad day, working with customers on site), plus reference-check questions. Notes from interviews go in `vault/people/candidates/<name>.md` (private).
- [ ] **The agreement.** Draft from their own template in `people/templates/`. If they don't have one, use Employment New Zealand's Employment Agreement Builder (employment.govt.nz) and say so. Mark every clause about a trial period, hours, pay or notice "check this", and add: "Before signing: the new starter must get a copy, a fair chance to get independent advice, and time to consider it" (Employment NZ guidance; Jesse confirms the current rules there).
- [ ] **Onboarding checklist.** Logins (Ascora, Site8 Pro), PPE, the site induction SOP (from SOPs), who they shadow, and their first check-in date.
- [ ] **Leaving or a problem with someone's work.** Prepare Employment New Zealand's process checklist for Jesse and the facts he gives. Don't draft a warning or dismissal letter to send; say: "Get advice before any formal step."

Each draft: one line in `queue/needs-jesse.md` with what it is and what he needs to check.

## Never
- Contact a candidate or staff member, post an ad, or send an agreement.
- State employment law as fact. Point to Employment New Zealand and mark it for checking.
- Ask about or record anything a hiring decision can't lawfully rest on (age, health, family, religion and the like).
