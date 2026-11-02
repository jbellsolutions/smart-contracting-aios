#!/usr/bin/env node
// UserPromptSubmit hook: when Jesse (or Mike) types "yes <code>" in chat, record it in state/approvals/<code>.json.
// Only typed prompts reach this hook, so an email, page or tool result can't approve anything.
// Tools that act outside this PC (tools/orgo.mjs run, sends-on, allow-ask) need a record written after
// the item was staged, and use it once.
import fs from "node:fs";
import path from "node:path";

let p = {};
try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
const prompt = String(p.prompt || "");
const codes = [...prompt.matchAll(/\b(?:yes|approve|approved|go)\s*[:,-]?\s*([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
if (codes.length) {
  const root = process.env.CLAUDE_PROJECT_DIR || p.cwd || process.cwd();
  const dir = path.join(root, "state", "approvals");
  fs.mkdirSync(dir, { recursive: true });
  for (const code of new Set(codes)) {
    fs.writeFileSync(path.join(dir, `${code}.json`), JSON.stringify({ code, words: prompt.slice(0, 300), at: new Date().toISOString() }, null, 2));
  }
}
process.exit(0);
