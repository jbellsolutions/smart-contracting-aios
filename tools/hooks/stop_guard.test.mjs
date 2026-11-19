#!/usr/bin/env node
// Tests for stop_guard.mjs: node tools/hooks/stop_guard.test.mjs
// Each case feeds the guard one tool call and checks whether it passes or is blocked. Runs in two temporary
// folders (one with state/STOP, one without); touches nothing in the workspace.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GUARD = path.join(path.dirname(fileURLToPath(import.meta.url)), "stop_guard.mjs");
const open = fs.mkdtempSync(path.join(os.tmpdir(), "guard-open-"));
const shut = fs.mkdtempSync(path.join(os.tmpdir(), "guard-stop-"));
fs.mkdirSync(path.join(shut, "state")); fs.writeFileSync(path.join(shut, "state", "STOP"), "");

const run = (dir, tool_name, tool_input) => spawnSync(process.execPath, [GUARD], {
  input: JSON.stringify({ tool_name, tool_input, cwd: dir }), env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: "utf8" }).status === 0;
const sh = (command) => ["Bash", { command }];
const term = (command) => ["mcp__terminal__run_in_terminal", { command }];
const batch = (...steps) => ["mcp__Claude_Browser__browser_batch", { actions: steps.map(([name, input]) => ({ name, input })) }];

// [what it shows, passes?, tool call, folder]
const cases = [
  // The app's own tools (Jesse, Nov 19)
  ["wrap-up", true, ["mcp__ccd_turn__wrap_up", {}]],
  ["task list", true, ["mcp__ccd_turn__update_plan", {}]],
  ["chapters", true, ["mcp__ccd_session__mark_chapter", {}]],
  ["start a session", true, ["mcp__ccd_session__start_session", {}]],
  ["sidebar: create a group", true, ["mcp__ccd_sidebar__create_group", {}]],
  ["sidebar: pin", true, ["mcp__ccd_sidebar__set_pinned", {}]],
  ["app settings stay blocked", false, ["mcp__ccd_settings__set_setting", {}]],
  ["moving a session to the cloud stays blocked", false, ["mcp__ccd_session__move_to_cloud", {}]],
  ["deleting a session stays blocked", false, ["mcp__ccd_session_mgmt__delete_session", {}]],
  // Browser batch
  ["batch of reads", true, batch(["navigate", { url: "https://example.com" }], ["get_page_text", {}], ["computer", { action: "screenshot" }], ["find", { query: "x" }])],
  ["batch with a click", false, batch(["navigate", { url: "https://example.com" }], ["computer", { action: "left_click" }])],
  ["batch with typing", false, batch(["computer", { action: "type", text: "hi" }])],
  ["batch with a form fill", false, batch(["form_input", { ref: "r", value: "x" }])],
  ["batch with page script", false, batch(["javascript_tool", { text: "1" }])],
  ["batch inside a batch", false, batch(["browser_batch", { actions: [] }])],
  ["a lone click stays blocked", false, ["mcp__Claude_Browser__computer", { action: "left_click" }]],
  ["a lone screenshot", true, ["mcp__Claude_Browser__computer", { action: "screenshot" }]],
  // Terminal panel
  ["terminal: a plain command", true, term("git status")],
  ["terminal: the self-check", true, term("node tools/check.mjs")],
  ["terminal: read", true, ["mcp__terminal__read_terminal", {}]],
  ["terminal: git push stays with Jesse", false, term("git push origin main")],
  ["terminal: approvals stay with Jesse", false, term("node tools/approve.mjs abc")],
  ["terminal: keys stay with Jesse", false, term("node tools/add_secret.mjs GHL_KEY")],
  ["terminal: .env", false, term("type .env.local")],
  ["terminal: rm -rf", false, term("rm -rf vault")],
  ["terminal: the Orgo CLI", false, term("orgo computers list")],
  ["terminal: a network write", false, term("curl -X POST https://example.com")],
  // False alarm 1: the word "curl"
  ["searching for the word curl, STOP on", true, sh("grep -rn curl docs"), shut],
  ["a note that mentions curl -d, STOP on", true, sh('echo "they said use curl -d to post" >> vault/notes.md'), shut],
  ["a file with curl in its name, STOP on", true, sh("cat docs/curl-notes.md"), shut],
  ["the word curl with a data flag elsewhere", true, sh("grep -d skip curl README.md")],
  ["curl GET, STOP off", true, sh("curl -s https://example.com")],
  ["curl GET, STOP on", false, sh("curl -s https://example.com"), shut],
  ["curl GET after &&, STOP on", false, sh("cd docs && curl -s https://example.com"), shut],
  ["curl in a pipe, STOP on", false, sh("echo x | curl -s https://example.com"), shut],
  ["curl in $( ), STOP on", false, sh("echo $(curl -s https://example.com)"), shut],
  ["curl.exe, STOP on", false, sh("curl.exe https://example.com"), shut],
  ["curl POST", false, sh("curl -X POST https://example.com")],
  ["curl with data", false, sh("curl https://example.com -d a=1")],
  ["curl POST after ;", false, sh("echo hi; curl --json '{}' https://example.com")],
  ["Invoke-RestMethod POST", false, ["PowerShell", { command: "Invoke-RestMethod https://example.com -Method Post -Body $b" }]],
  ["Invoke-RestMethod GET", true, ["PowerShell", { command: "Invoke-RestMethod https://example.com" }]],
  ["node -e fetch", false, sh('node -e "fetch(\'https://example.com\')"')],
  ["--send while stopped", false, sh("node sender.js --send"), shut],
  // False alarm 2: writing a file and running a tool together
  ["write a note, then run a tool", true, sh('echo "ran the check" >> vault/daily/today.md && node tools/check.mjs')],
  ["run a tool into a file", true, sh("node tools/check.mjs > runs/check.txt")],
  ["run a reader into a file", true, sh("node tools/ghl-reader.mjs --since 7d > follow-ups/data/ghl.json")],
  ["run the Ascora reader", true, sh("node tools/ascora-reader.mjs jobs")],
  ["copy a file, then run a reader", true, sh("cp a.md b.md; node tools/ascora-reader.mjs quotes")],
  ["PowerShell: save a note, run a tool", true, ["PowerShell", { command: "Set-Content vault/note.md 'x'; node tools/check.mjs" }]],
  ["redirect into tools/", false, sh("echo x > tools/ghl-reader.mjs")],
  ["redirect into the guard", false, sh("node tools/check.mjs > tools/hooks/stop_guard.mjs")],
  ["append to a policy", false, sh("echo x >> policies/APPROVALS.md")],
  ["redirect into settings", false, sh("echo {} > .claude/settings.local.json")],
  ["copy over a tool", false, sh("cp x.mjs tools/check.mjs")],
  ["copy over a tool, after running one", false, sh("node tools/check.mjs && cp x.mjs tools/hooks/stop_guard.mjs")],
  ["sed on the guard", false, sh("sed -i s/a/b/ tools/hooks/stop_guard.mjs")],
  ["git checkout on a tool", false, sh("git checkout -- tools/orgo.mjs")],
  ["PowerShell pipe into a policy", false, ["PowerShell", { command: "Get-Content x | Set-Content policies/DATA.md" }]],
  ["remove a policy", false, sh("rm policies/DATA.md")],
  // Rules that were there before and must still hold
  ["approve from chat", false, sh("node tools/approve.mjs abc")],
  ["reading .env.local", false, sh("cat .env.local")],
  ["approval records", false, sh("ls state/approvals")],
  ["removing STOP", false, sh("rm state/STOP")],
  ["the Orgo CLI", false, sh("orgo computers list")],
  ["staging an Orgo question", true, sh("node tools/orgo.mjs ask 'is the hold on?'")],
  ["editing a tool with Write", false, ["Write", { file_path: "tools/x.mjs" }]],
  ["writing a note with Write", true, ["Write", { file_path: "vault/note.md" }]],
  ["a connector send", false, ["mcp__slack__slack_send_message", {}]],
  ["a connector draft", true, ["mcp__slack__slack_send_message_draft", {}]],
  ["a connector read", true, ["mcp__slack__slack_read_channel", {}]],
  ["a scheduled task", true, ["mcp__scheduled-tasks__create_scheduled_task", {}]],
];

let failed = 0;
for (const [what, want, [tool, input], dir] of cases) {
  const got = run(dir || open, tool, input);
  if (got !== want) { failed++; console.log(`FAIL ${what}: expected ${want ? "pass" : "block"}, got ${got ? "pass" : "block"}`); }
}
fs.rmSync(open, { recursive: true, force: true }); fs.rmSync(shut, { recursive: true, force: true });
console.log(failed ? `${failed} of ${cases.length} failed` : `ok: ${cases.length} cases`);
process.exit(failed ? 1 : 0);
