#!/usr/bin/env node
// UserPromptSubmit hook: when the person at Jesse's PC types exactly "yes <code>" (the code from the approval
// window), record the approval for that staged item. Only typed prompts reach this hook, the code is never in
// the chat beforehand, and a prompt with anything else in it approves nothing. See tools/lib/approval.mjs.
import fs from "node:fs";
import { capture } from "../lib/approval.mjs";

let p = {};
try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
const root = process.env.CLAUDE_PROJECT_DIR || p.cwd || process.cwd();
try { capture(root, p.prompt || ""); } catch { /* never block Jesse's message */ }
process.exit(0);
