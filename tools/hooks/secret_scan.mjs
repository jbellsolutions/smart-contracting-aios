#!/usr/bin/env node
// UserPromptSubmit hook: stop a pasted key before it reaches the chat, and say how keys go in instead.
import fs from "node:fs";

let p = {};
try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
const prompt = String(p.prompt || "");
const shapes = [
  /\bsk-[A-Za-z0-9_-]{20,}/,                       // OpenAI-style and Anthropic keys
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/, // Stripe
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,                // Slack
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,                  // GitHub
  /\bAKIA[0-9A-Z]{16}\b/,                          // AWS
  /\bAIza[0-9A-Za-z_-]{35}\b/,                     // Google
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, // JWT-style tokens
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
if (shapes.some((r) => r.test(prompt))) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "That looks like a key or password, so it wasn't sent. Keys go in through your own terminal: node tools/add_secret.mjs NAME. If it was a real key, rotate it.",
  }));
}
process.exit(0);
