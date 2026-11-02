#!/usr/bin/env node
// Jesse's approvals, typed in his OWN terminal window (PowerShell, in this folder):  node tools/approve.mjs
// The other way to approve, when the code window doesn't show up on his screen (Nov 1: the Claude app ran it
// where his desktop couldn't see it). It lists what's waiting, shows exactly what each will do, and asks him to
// type yes. It only runs in a real terminal, so the chat can't approve anything by running it.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { approveInTerminal, listPending } from "./lib/approval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Run this in your own terminal window (PowerShell, in this folder), not from the chat. Approvals have to come from you.");
  process.exit(1);
}
const items = listPending(ROOT);
if (!items.length) { console.log("Nothing is waiting for your approval."); process.exit(0); }

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
let n = 0;
for (const it of items) {
  console.log(`\n=== ${it.title || it.kind} (staged ${new Date(it.created).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })} NZ) ===`);
  console.log(it.what || "This will:");
  console.log(`\n    ${it.text}\n`);
  const a = String(await ask("Type yes to allow this once (anything else skips it): ")).trim().toLowerCase();
  if (a === "yes" || a === "y") { approveInTerminal(ROOT, it.file); n++; console.log("Approved. Tell the chat: \"approved, carry on\"."); }
  else console.log("Skipped. Nothing changes.");
}
rl.close();
console.log(n ? `\n${n} approved. Back in the Claude chat, say "approved, carry on" so it runs the apply step.` : "\nNothing approved.");
