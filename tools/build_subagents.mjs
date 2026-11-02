#!/usr/bin/env node
// Make .claude/agents/<role>.md from each active charter's Profile block, so the Chief of Staff can call
// each specialist as a subagent. Run after adding or editing a charter: node tools/build_subagents.mjs
// Skipped: 01 (the main chat), reserved charters (90+), and charters whose title line says "**Subagent:** no".
// "**Model:**" on the title line picks the model (default sonnet); "**Work folder:**" names its folder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".claude", "agents");
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const file of fs.readdirSync(path.join(ROOT, "agents")).filter((f) => /^[0-8]\d-.+\.md$/.test(f)).sort()) {
  const [num, ...rest] = file.replace(/\.md$/, "").split("-");
  const role = rest.join("-");
  const text = fs.readFileSync(path.join(ROOT, "agents", file), "utf8");
  if (num === "01" || /\*\*Subagent:\*\*\s*no\b/i.test(text)) continue;
  const prof = text.match(/## Profile\s*```[a-z]*\r?\n([\s\S]*?)```/);
  if (!prof) { console.log(`skip ${file}: no Profile block`); continue; }
  const job = (text.match(/## (?:Role|Mission)\s*\r?\n+(.+)/) || [])[1] || `The ${role} specialist.`;
  const bot = ((text.match(/\*\*Bot name:\*\*\s*([^·\n]+)/) || [])[1] || role).trim();
  const model = (text.match(/\*\*Model:\*\*\s*([\w.-]+)/) || [])[1] || "sonnet";
  const folder = ((text.match(/\*\*Work folder:\*\*\s*`?([\w./-]+?)`?(?:\s|·|$)/) || [])[1] || `${role}/`).replace(/\/?$/, "/");
  const desc = `${bot}: ${job.trim()} Use for any job its charter agents/${file} owns.`.replace(/"/g, "'");
  fs.writeFileSync(path.join(OUT, `${role}.md`),
    `---\nname: ${role}\ndescription: "${desc}"\nmodel: ${model}\n---\n\n${prof[1].trim()}\n\n` +
    `Before acting, read agents/${file}, ${folder}CONTEXT.md and the one skill the job needs. Follow docs/CONVENTIONS.md ` +
    `(the run contract). Draft, log the run in runs/, and return what needs Jesse's yes.\n`);
  made.push(role);
}
const stale = fs.readdirSync(OUT).filter((f) => f.endsWith(".md") && !made.includes(f.replace(/\.md$/, "")));
console.log(`subagents: ${made.join(", ") || "none"}${stale.length ? `; not from any charter (check them): ${stale.join(", ")}` : ""}`);
