#!/usr/bin/env node
// Usage, in your own terminal (PowerShell or Windows Terminal), in this folder:  node tools/add_secret.mjs NAME
// Reads the value with the typing hidden and saves NAME=value in .env.local (kept out of git). Never paste a key into the chat.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] || "";
if (!/^[A-Z][A-Z0-9_]*$/.test(name)) { console.error("Usage: node tools/add_secret.mjs NAME   (NAME in CAPITALS, like ORGO_API_KEY)"); process.exit(1); }
if (!process.stdin.isTTY) { console.error("Run this in your own terminal window, not from the chat, so the key never passes through it."); process.exit(1); }

process.stdout.write(`Paste ${name} and press Enter (it won't show): `);
let value = "";
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  for (const ch of chunk) {
    if (ch === "\r" || ch === "\n") return save();
    if (ch === "\u0003") { process.stdout.write("\nCancelled; nothing saved.\n"); process.exit(1); }
    if (ch === "\u0008" || ch === "\u007f") { value = value.slice(0, -1); continue; }
    value += ch;
  }
});

function save() {
  process.stdin.setRawMode(false);
  process.stdout.write("\n");
  value = value.trim();
  if (!value) { console.error("Empty; nothing saved."); process.exit(1); }
  const file = path.join(ROOT, ".env.local");
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith(`${name}=`)) : [];
  lines.push(`${name}=${value}`);
  fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
  console.log(`Saved ${name} to .env.local.`);
  process.exit(0);
}
