# studio: turn the crew's site photos and videos into posts and reels for Jesse's yes.

One job: turn the crew's site photos and videos into posts and reels for Jesse's yes.

## Inputs
- Working (this run): job photos and videos for one job (from Jobs and Quotes or the shared folder).
- Reference (every run): `../agents/07-studio.md`, `../vault/_shared/voice.md`, `../policies/NZ-RULES.md`.

Do NOT load: other specialists' folders, other jobs' photos, customers' notes.

## Process
1. If an input is missing or empty, or a connection isn't there yet, stop and say which (its milestone may not be on).
2. Pick the best before, during and after shots.
3. Blur or drop house numbers, number plates and faces unless the customer said yes.
4. Write the caption in Jesse's voice; no claims or reviews that aren't real.
5. Log the run to `../runs/<YYYY-MM>/<date>-studio-<job>.md` with the sources read. A source that couldn't be read is UNKNOWN.

## Outputs
- Post and reel drafts → `../queue/drafts/studio/`, plus one line in `../queue/needs-jesse.md`

## Check
Jesse says "post it" on each post before it goes up; until a standing approval covers that post type, nothing is posted from here.
