#!/usr/bin/env node
// The workspace's self-check: node tools/check.mjs
// Run by the install, by the build skill before it reports done, and whenever something seems off.
// Prints "ok", or one line per problem (file: what's wrong) and exits 1. Reads files only; changes nothing.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const warn = [];
const bad = (file, why) => problems.push(`${file}: ${why}`);
const has = (...p) => fs.existsSync(path.join(ROOT, ...p));
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const ls = (d, re) => (has(d) ? fs.readdirSync(path.join(ROOT, d)).filter((f) => re.test(f)).sort() : []);
const MARKER = new RegExp("<" + "!-- (WRITE|FILL)"); // built here so this file doesn't contain the marker itself
const front = (t) => { const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/); return m ? m[1] : ""; };

// Entry files
if (!has("AGENTS.md")) bad("AGENTS.md", "missing");
else {
  const a = rd("AGENTS.md");
  if (a.split(/\r?\n/).length >= 60) bad("AGENTS.md", "must stay under 60 lines (move detail to docs/CONVENTIONS.md)");
  if (!a.includes("queue/needs-jesse.md")) bad("AGENTS.md", "must name queue/needs-jesse.md");
}
if (!has("CLAUDE.md") || rd("CLAUDE.md").trim() !== "@AGENTS.md") bad("CLAUDE.md", "must be exactly @AGENTS.md");

// Guarantees
try {
  const s = JSON.parse(rd(".claude", "settings.json"));
  if (!(s.permissions?.deny || []).length) bad(".claude/settings.json", "permissions.deny is empty");
  if (JSON.stringify(s).includes("bypassPermissions")) bad(".claude/settings.json", "must never use bypassPermissions");
  const pre = s.hooks?.PreToolUse || [];
  if (!pre.some((h) => /\bBash\b/.test(h.matcher || ""))) bad(".claude/settings.json", "no PreToolUse hook on Bash");
  if (!pre.some((h) => /mcp__/.test(h.matcher || ""))) bad(".claude/settings.json", "no PreToolUse hook on connector (mcp__) tools");
  if (!pre.some((h) => /\bWrite\b/.test(h.matcher || "") && /\bEdit\b/.test(h.matcher || ""))) bad(".claude/settings.json", "no PreToolUse hook on Write and Edit");
  const scripts = JSON.stringify(s.hooks || {}).match(/tools\/hooks\/[\w.-]+/g) || [];
  for (const sc of new Set(scripts)) if (!has(sc)) bad(".claude/settings.json", `hook script ${sc} is missing`);
  if (!scripts.some((sc) => has(sc) && rd(sc).includes("STOP"))) bad("tools/hooks", "no hook honours state/STOP");
} catch (e) { bad(".claude/settings.json", `missing or not valid JSON (${e.message})`); }

if (has(".claude", "settings.local.json")) {
  const local = rd(".claude", "settings.local.json");
  if (/disableAllHooks|"hooks"|bypassPermissions/.test(local)) bad(".claude/settings.local.json", "turns hooks off or replaces them; delete it (only Justin's team changes the guards)");
}

// Charters, work folders, subagents
const active = [];
for (const f of ls("agents", /^\d\d-.+\.md$/)) {
  const t = rd("agents", f); const num = Number(f.slice(0, 2)); const role = f.slice(3, -3);
  if (num >= 90) continue; // reserved: a short charter until the build skill turns it on
  if (!/## Operating contract/.test(t)) bad(`agents/${f}`, "no Operating contract table");
  if (!/## Profile/.test(t)) bad(`agents/${f}`, "no Profile block");
  if (num === 1 || /\*\*Subagent:\*\*\s*no\b/i.test(t)) continue;
  active.push(role);
  const folder = (t.match(/\*\*Work folder:\*\*\s*`?([\w./-]+?)`?(?:\s|·|$)/) || [])[1];
  if (!folder) { bad(`agents/${f}`, "title line names no **Work folder:**"); continue; }
  const ctx = path.join(folder.replace(/\/?$/, "/"), "CONTEXT.md");
  if (!has(ctx)) { bad(ctx, "missing (each active specialist's work folder has its contract)"); continue; }
  const c = rd(ctx);
  for (const h of ["Inputs", "Process", "Outputs"]) if (!new RegExp(`^## ${h}`, "m").test(c)) bad(ctx, `no ## ${h}`);
  const checks = (c.match(/^## Check\b/gm) || []).length;
  if (checks !== 1) bad(ctx, `needs exactly one ## Check (has ${checks})`);
  const sub = path.join(".claude", "agents", `${role}.md`);
  if (!has(sub)) bad(sub, "missing: run node tools/build_subagents.mjs");
  else { const fm = front(rd(sub)); for (const k of ["name", "description", "model"]) if (!new RegExp(`^${k}:`, "m").test(fm)) bad(sub, `frontmatter has no ${k}`); }
}

// Skills
const skillNames = new Set();
for (const d of ls("skills", /^[\w-]+$/)) {
  const p = path.join("skills", d, "SKILL.md");
  if (!has(p)) { bad(`skills/${d}`, "no SKILL.md"); continue; }
  const t = rd(p); const fm = front(t);
  const name = (fm.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  if (name !== d) bad(p, `frontmatter name "${name}" must equal the folder name "${d}"`);
  if (!/^description:\s*\S/m.test(fm)) bad(p, "no description");
  if (t.split(/\r?\n/).length >= 500) bad(p, "must stay under 500 lines");
  skillNames.add(d);
}
for (const must of ["morning-brief", "evening-brief", "getting-started", "dispatch", "ask-ledger", "install", "build"]) if (!skillNames.has(must)) bad(`skills/${must}`, "required skill missing");

// Routines
for (const f of ls("routines", /\.prompt$/)) {
  const t = rd("routines", f); const [head, ...body] = t.split(/^---\s*$/m); const rest = body.join("---");
  const p = `routines/${f}`;
  for (const k of ["NAME", "OWNER", "KIND", "WHERE", "WHEN", "CRON", "SKILLS", "MILESTONE", "STATUS"]) if (!new RegExp(`^${k}:`, "m").test(head)) bad(p, `no ${k}: line`);
  const cron = (head.match(/^CRON:\s*(?:CRON_TZ=\S+\s+)?(.+)$/m) || [])[1]?.trim() || "";
  if (cron && cron.split(/\s+/).length !== 5) bad(p, `CRON must have exactly five fields ("${cron}")`);
  if (!/CRON_TZ/.test(head)) bad(p, "no CRON_TZ (the routine's time zone)");
  for (const s of ((head.match(/^SKILLS:\s*(.+)$/m) || [])[1] || "").split(/[,\s]+/).filter(Boolean)) if (!skillNames.has(s)) bad(p, `SKILLS names "${s}", which isn't in skills/`);
  if (!/paused/i.test((head.match(/^STATUS:\s*(.+)$/m) || [])[1] || "")) bad(p, "STATUS must say it was created paused");
  if (!/state\/STOP/.test(rest)) bad(p, "no stop check on state/STOP");
  if (!/runs\//.test(rest)) bad(p, "no run log in runs/");
}

// Memory, privacy, unfinished markers
if (!has("vault", "MEMORY.md")) bad("vault/MEMORY.md", "missing");
if (!has("vault", "daily")) bad("vault/daily/", "missing");
const git = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
if (git.status === 0) {
  for (const p of [".env.local", "queue/needs-jesse.md", "queue/drafts/x/y.md", "runs/2026-01/x.md", "state/STOP", "context/owner.md", "tools/.orgo/x"]) {
    if (spawnSync("git", ["check-ignore", "-q", p], { cwd: ROOT }).status !== 0) bad(".gitignore", `${p} would be committed`);
  }
  const keyShapes = /\bsk-[A-Za-z0-9_-]{20,}|\b(?:sk|rk)_live_[A-Za-z0-9]{10,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|\bgh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  for (const f of git.stdout.split("\0").filter(Boolean)) {
    if (/\.(png|jpe?g|pdf|zip|gif)$/i.test(f) || !has(f)) continue;
    const t = rd(f);
    if (keyShapes.test(t) && !f.startsWith("tools/hooks/") && f !== "tools/orgo.mjs") bad(f, "holds something shaped like a key");
    if (MARKER.test(t) && !f.startsWith("docs/_templates/")) bad(f, "has an unfilled WRITE or FILL template marker");
  }
} else warn.push("git not found: skipped the .gitignore and key checks");

if (!active.length) warn.push("no active specialists found");
for (const w of warn) console.log(`warning: ${w}`);
if (problems.length) { for (const p of problems) console.log(p); process.exit(1); }
console.log("ok");
