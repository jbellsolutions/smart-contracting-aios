#!/usr/bin/env node
// PreToolUse hook (Bash and connector tools). Exit 2 blocks the call and tells Claude why.
// Always blocked: touching state/approvals (only Jesse's typed "yes <code>" writes there), reading .env.local,
// driving the Orgo CLI directly (tools/orgo.mjs is the only door), and connector tools that send, post,
// reply, forward or delete (this workspace drafts; Jesse sends).
// While state/STOP exists, also blocked: outward Bash commands and connector tools that create or change
// anything outside this PC. Protective Orgo commands (status, logs, hold) are never blocked.
import fs from "node:fs";
import path from "node:path";

let raw = "";
try { raw = fs.readFileSync(0, "utf8"); } catch { process.exit(0); }
let p;
try { p = JSON.parse(raw); } catch { process.exit(0); }
const root = process.env.CLAUDE_PROJECT_DIR || p.cwd || process.cwd();
const stopped = fs.existsSync(path.join(root, "state", "STOP"));
const tool = p.tool_name || "";
const input = p.tool_input || {};
const block = (why) => { process.stderr.write(`Blocked: ${why}\n`); process.exit(2); };

if (tool === "Bash" || tool === "PowerShell") {
  const cmd = String(input.command || "");
  if (/state[\\/]+approvals/i.test(cmd)) block("state/approvals is written only by Jesse's own \"yes <code>\" in chat.");
  if (/\.env\.local\b|\.env\b(?![\w.-])/i.test(cmd)) block("keys in .env.local are never read or written from chat. Jesse adds keys himself: node tools/add_secret.mjs NAME (in his own terminal).");
  if (/\borgo(\.cmd)?\s+(computers|c)\b|[\\/]orgo[\\/]dist[\\/]cli\.js/i.test(cmd)) block("the Orgo computer is reached only through tools/orgo.mjs (it logs every call and gates changes on Jesse's yes).");
  if (stopped) {
    const outward = /--live\b|--send\b|\bcurl\b[^|;&]*\s-X\s*(POST|PATCH|PUT|DELETE)|\bcurl\b[^|;&]*\s(-d|--data\S*)\s|Invoke-(RestMethod|WebRequest)[^|;]*-Method\s+(Post|Put|Patch|Delete)|Send-MailMessage/i;
    if (outward.test(cmd)) block("state/STOP exists, so nothing goes out. Remove it only on Jesse's word.");
  }
  process.exit(0);
}

if (tool.startsWith("mcp__")) {
  const name = tool.split("__").slice(2).join("__").toLowerCase() || tool.toLowerCase();
  const isDraft = /draft/.test(name);
  if (!isDraft && /(^|[_-])(send|post|publish|reply|forward|delete|trash|remove|archive)([_-]|$)/.test(name)) {
    block(`${tool} would act outside this PC. This workspace drafts; Jesse sends. Put a draft in queue/drafts/ and an item in queue/needs-jesse.md.`);
  }
  if (stopped && !isDraft && /(^|[_-])(create|update|schedule|upload|move|share|add|set|write|insert|patch)([_-]|$)/.test(name)) {
    block(`state/STOP exists, so ${tool} can't change anything outside this PC. Remove STOP only on Jesse's word.`);
  }
}
process.exit(0);
