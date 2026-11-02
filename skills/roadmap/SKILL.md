---
name: roadmap
description: Maps out what to build next for Smart Contracting and why, from everything Jesse and Mike have asked for, what's already working and what's blocked, ranked as milestones and dependencies, never dates. Use when Jesse asks "what should we build next?", "what's the plan?", "where are we at?", after a build finishes, or when a new idea needs a place in the order.
---

# Roadmap: what to build next

## Inputs
- `context/asks.md`: every ask, its status and where it's solved.
- `PROJECT_CHARTER.md`: the milestones (M0–M3), the team, the records.
- `OPEN_QUESTIONS.md`: what's waiting on an answer.
- `queue/needs-jesse.md`: what's waiting on Jesse now.
- The last two weeks of `runs/`: what ran, what failed, what Jesse corrected.
- `vault/_shared/roadmap.md` (the last plan) and `vault/decisions/`.

## Steps
- [ ] List every ask that isn't done (not ✅), grouped by the piece that would answer it.
- [ ] Mark each piece's blockers: an answer only Jesse or Mike can give, a connection or key, a cost needing a yes, another piece that must come first, or work for Justin's team.
- [ ] Rank the unblocked pieces by these rules, in order:
  1. **Safety first.** Anything that keeps sends and money safe comes before anything new that sends (the Revenue Partner's one sender, `projects/revenue-partner-sends/SPEC.md`).
  2. **More work in the door first**, then time back: the radar, the partner program and quote follow-ups before inbox, invoicing and scheduling help.
  3. **What saves Mike's hours** next: invoices flowing from Ascora to Xero, the reconcile check, quoting by quantities.
  4. **Smallest working version first.** A read-only report before a drafting agent, and a drafting agent before anything that acts.
  5. **One build at a time.** Finish an approved build before starting the next.
- [ ] Write `vault/_shared/roadmap.md` (the Chief of Staff is its only writer). Use four headings:
  - **Now**: one build, with its asks, what Jesse or Mike must do for it, and how we'll know it works.
  - **Next**: two or three builds, each with what it depends on.
  - **Later**: the rest, by milestone.
  - **Blocked**: each blocked piece and the one thing that unblocks it (who, what).
  Put any cost per month next to its piece, marked "needs a yes".
- [ ] Tell Jesse in under eight lines: what's Now and why, the one thing he could do today that unblocks the most, and the question "Build the Now one?". On his yes, follow `skills/build/SKILL.md` from step 1.

## Done means
The roadmap note is current, every not-done ask sits under Now, Next, Later or Blocked, and Jesse has one clear next step.

## Never
- Put a date or a time estimate on anything. Milestones and dependencies only.
- Propose paid lead-enrichment services (Clay, Apollo, Hunter, ZoomInfo and the like). Agents gather public data themselves.
- Rank a piece above a safety gate it depends on.
