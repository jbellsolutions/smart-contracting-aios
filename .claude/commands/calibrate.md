---
description: Turn today's corrections into rules that load next time. Run at the end of a working session, or whenever Jesse has had to correct the same thing twice.
---

# /calibrate

Collect what Jesse (or Mike) corrected or decided in this session, and put each lesson in the one file that loads the next time it matters.

1. **Collect**, from this chat and today's `runs/<YYYY-MM>/` logs: corrections ("no, do it like this"), decisions, failures and their fixes, and setup facts nobody wrote down. Skip anything already recorded.
2. **Route each lesson to one home:**
   - how a job is done → that skill's `SKILL.md`;
   - what an agent owns or never does → its charter in `agents/`;
   - a fix to how we write, for every audience unless Jesse says otherwise → `vault/_shared/voice.md`;
   - a name or word → `vault/_shared/glossary.md`;
   - a fact about the business → its note in `vault/`, with one line in `vault/MEMORY.md`;
   - something that must always hold → a proposed hook or deny rule, for Justin's team.
3. **Show a numbered table**: lesson, home, the exact edit.
4. **Apply** only the skill, charter, voice, glossary and vault edits. Changes to `.claude/settings.json`, `tools/hooks/` or `policies/APPROVALS.md` go to `queue/needs-jesse.md` (the first two are Justin's team's to make).
5. If a charter changed: `node tools/build_subagents.mjs`, `node tools/build_manifest.mjs`, then `node tools/check.mjs`.
6. **End with a receipt**: what changed, where, and what is waiting on Jesse.

Never write a key, password or a customer's or staff member's private details into any file in git.
