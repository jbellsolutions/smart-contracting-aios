#!/usr/bin/env node
// PreToolUse hook for Bash, PowerShell, Write/Edit and every connector (mcp__) tool. Exit 2 blocks the call and
// tells Claude why. It guards against mistakes and injected instructions; it isn't a wall against someone with
// a shell on this PC. What it enforces:
// - Connector tools: only reads and drafts (of the Claude app's own mcp__ccd_ tools, only its task list, wrap-up, chapters, sidebar and start_session go past this rule; a command started in the Terminal panel follows the command rules). A tool is allowed when its name's first verb is a read verb (get,
//   list, search, read…) or it makes a draft. Everything else (send, post, reply, create, a generic "execute"
//   or an unknown verb) is blocked: this workspace drafts and Jesse sends. Browser clicking and typing are
//   blocked; reading pages, scrolling and screenshots aren't. Registering a scheduled task is allowed (routines check STOP).
// - Files: the guards, tools, policies, settings and approval records can't be written from chat.
// - Commands: no keys, no approval records, no removing STOP, no editing the guards, no driving the Orgo CLI
//   directly, and no outward network writes. While state/STOP exists, no network commands at all.
import fs from "node:fs";
import path from "node:path";

let p;
try { p = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
const root = process.env.CLAUDE_PROJECT_DIR || p.cwd || process.cwd();
const stopped = fs.existsSync(path.join(root, "state", "STOP"));
const tool = String(p.tool_name || "");
const input = p.tool_input || {};
const block = (why) => { process.stderr.write(`Blocked: ${why}\n`); process.exit(2); };

const PROTECTED = /(^|[\\/])(\.claude|tools|policies)([\\/]|$)|settings(\.local)?\.json|state[\\/]+(approvals|pending)|\.env/i;

// Files written through Claude's own tools
if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const file = String(input.file_path || input.notebook_path || "");
  const rel = path.relative(root, path.resolve(root, file)).replace(/\\/g, "/");
  if (rel.startsWith("..") ) process.exit(0);
  if (PROTECTED.test(rel)) block(`${rel} is one of the guards, tools, policies or approval records. Those change only through Justin's team (git pull) or Jesse himself. Put the proposed change in queue/needs-jesse.md.`);
  process.exit(0);
}

// The tools this workspace may run from chat or a routine. The two readers only make GET requests, read their
// key from .env.local themselves and never print it (Jesse, Nov 19).
const OWN = "orgo|switch|check|build_subagents|build_manifest|setup_orgo|ghl[-_]reader|ascora[-_]reader";
const RUN_OWN = new RegExp(String.raw`^node\s+(\.[\\/])?tools[\\/](${OWN})\.mjs(\s|$)`);
const GUARDED = /settings(\.local)?\.json|(^|[\s"'\\/])\.claude[\\/]|tools[\\/](hooks|lib)|tools[\\/][\w.-]+\.mjs|(^|[\s"'\\/])policies[\\/]/i;
const WRITER = /\b(sed|tee|mv|cp|rm|del|ren|move|copy|Set-Content|Add-Content|Out-File|New-Item|Remove-Item|writeFile|appendFile|truncate|perl|python|node\s+-e|patch|git\s+(checkout|restore|apply|rm|mv))\b/i;
// A network program counts only where a command starts (line start, or after ; & | ( { $( or a backtick), so a
// command that merely mentions the word "curl" (a search, a note, a file name) isn't a network command.
const AT = String.raw`(?:^|[;&|({\n]|\$\(|` + "`" + String.raw`)\s*(?:(?:sudo|xargs|env)\s+)?`;
const NET_WRITE = new RegExp(
  AT + String.raw`curl(\.exe)?\b[^\n]*(\s-X\s*(POST|PUT|PATCH|DELETE)|\s(-d|--data\S*|--json|-F|--form\S*|-T|--upload-file)\b)` +
  "|" + AT + String.raw`wget(\.exe)?\b[^\n]*--(post|method|body)` +
  "|" + AT + String.raw`(Invoke-RestMethod|Invoke-WebRequest|irm|iwr)\b[^\n]*-(Method\s+(Post|Put|Patch|Delete)|Body)\b` +
  String.raw`|\bSend-MailMessage\b|\b(node|python3?|py)\s+(-e|-c|--eval)\b[^\n]*(fetch|request|urlopen|https?:)`, "i");
const NET_ANY = new RegExp(AT + String.raw`(curl|wget|Invoke-RestMethod|Invoke-WebRequest|irm|iwr|ssh|scp|sftp|ftp|nc|telnet)(\.exe)?\b`, "i");

function checkCommand(cmd) {
  // Staging a remote command or question only writes a pending item; it runs on the Revenue Partner's computer
  // after Jesse's code. Allowed as exactly one quoted argument that the local shell can't expand.
  if (/^\s*node\s+(?:\.[\\/])?tools[\\/]orgo\.mjs\s+(plan|ask)\s+('[^']*'|"[^"$`\\]*")\s*$/.test(cmd)) return;
  if (/tools[\\/](approve|add_secret)\.mjs/i.test(cmd)) block("approvals and keys are typed by Jesse in his own PowerShell window, never run from chat. Give him the exact line to run there.");
  if (/\.env/i.test(cmd)) block("keys in .env.local are never read or written from chat. Jesse adds keys himself: node tools/add_secret.mjs NAME (in his own PowerShell window).");
  if (/approvals|pending/i.test(cmd) && /state/i.test(cmd)) block("approval records are written only from Jesse's own typed code.");
  if (/\bSTOP\b/.test(cmd) && /\b(rm|del|erase|rmdir|unlink|mv|move|ren|rename|Remove-Item|ri|Move-Item|Rename-Item)\b|>\s*\S*STOP/i.test(cmd)) block("only Jesse lifts STOP: node tools/switch.mjs stop-off, then he types the code from the window.");
  // The guards, tools and policies: looked at one piece of the command at a time, so writing a note and running
  // a tool in the same command is fine. Blocked: output sent into a guarded path, or a piece that both names a
  // guarded path and changes files. Running one of the workspace's own tools is never "changing" it.
  const guarded = "the guards, tools and policies change only through Justin's team (git pull) or Jesse himself.";
  for (const m of cmd.matchAll(/>>?\s*("[^"]*"|'[^']*'|[^\s;&|)]+)/g)) if (GUARDED.test(m[1])) block(guarded);
  for (const piece of cmd.split(/&&|\|\||[;&|\n]/)) {
    const seg = piece.trim();
    if (!seg || RUN_OWN.test(seg)) continue;
    if (GUARDED.test(seg) && WRITER.test(seg)) block(guarded);
  }
  if (/\borgo(\.cmd)?\s+(computers|c)\b|[\\/]orgo[\\/]dist[\\/]cli\.js|npx\s+orgo/i.test(cmd)) block("the Orgo computer is reached only through tools/orgo.mjs (it logs every call and gates changes on Jesse's code).");
  if (NET_WRITE.test(cmd)) block("this workspace doesn't send or change things over the network from the command line. Draft it and put it in queue/needs-jesse.md.");
  if (stopped && (/--live\b|--send\b/i.test(cmd) || NET_ANY.test(cmd))) block("state/STOP exists, so nothing goes out. Remove it only on Jesse's word.");
}

if (tool === "Bash" || tool === "PowerShell") {
  checkCommand(String(input.command || ""));
  process.exit(0);
}

// The app's Terminal panel (mcp__terminal__*): a command started in Jesse's terminal goes through the same
// command rules as one run from chat, plus the three things settings.json denies there (Jesse, Nov 19).
if (/^mcp__terminal__/.test(tool)) {
  const own = tool.split("__").slice(2).join("__").toLowerCase();
  if (own === "run_in_terminal") {
    const cmd = String(input.command || "");
    if (/\bgit\s+push\b|\brm\s+-rf\b|(^|[;&|(\n])\s*(npx\s+)?orgo\b/i.test(cmd)) block("git push, rm -rf and the Orgo CLI stay with Jesse: give him the exact line to run himself.");
    checkCommand(cmd);
    process.exit(0);
  }
  if (/^(read_terminal|list_terminal_tabs|open_terminal_tab|stop_terminal_tab)$/.test(own)) process.exit(0);
}

// The Claude app's own tools (mcp__ccd_*): only its task list, the wrap-up and start_session are let through (Jesse,
// Nov 3). They stay on this PC, and a new session in this folder loads these same guards. Every other ccd tool
// (app settings, moving a session to the cloud, messaging other sessions) goes through the connector rule below:
// reads pass, anything that changes something is blocked and named, so Jesse can ask Justin's team to add it.
const CCD_ALLOWED = [
  /^start_?session$/,
  /^update_plan$/, // the app's task list: mcp__ccd_turn__update_plan (Jesse, Nov 5)
  /^wrap_?up(_session)?$/,
  /^mark_chapter$/, // chapter dividers in the transcript (Jesse, Nov 19)
  /^dismiss_task$/, // withdraws a session card the chat itself proposed
  /^read_widget_context$/,
  /^(list|get|read|create|add|update|complete|check|write)_?(task|tasks|todo|todos|task_list)$/,
  /^(task|tasks|todo|todos|task_list)_?(list|get|read|create|add|update|complete|check|write)$/,
];
if (/^mcp__ccd_/.test(tool)) {
  const own = tool.split("__").slice(2).join("__").toLowerCase();
  if (CCD_ALLOWED.some((re) => re.test(own))) process.exit(0);
  // The sidebar (groups, sections, pins, unread marks) only arranges this PC's own session list (Jesse, Nov 19).
  if (/^mcp__ccd_sidebar__/.test(tool)) process.exit(0);
}

// Why a connector tool call is blocked, or null when it may run.
function connectorReason(tool, input, inBatch) {
  const name = tool.split("__").slice(2).join("_") || tool;
  const tokens = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const READ = new Set(["get", "list", "search", "read", "fetch", "find", "query", "view", "describe", "show", "count", "check",
    "status", "whoami", "lookup", "look", "preview", "resolve", "inspect", "navigate", "screenshot", "tabs", "download", "export"]);
  if (tokens.includes("draft") || tokens.includes("drafts")) return null;
  // Registering a routine as a scheduled task stays on this PC, and every routine checks state/STOP itself.
  if (tokens.includes("scheduled") && (tokens.includes("task") || tokens.includes("tasks"))) return null;
  // A browser batch is several browser steps in one call: it passes only when every step would pass on its own
  // (reading, navigating, scrolling, screenshots). One click or typed key blocks the whole batch (Jesse, Nov 19).
  if (tokens.includes("batch") && Array.isArray(input.actions)) {
    if (inBatch) return `${tool} nests a batch inside a batch.`;
    for (const a of input.actions) {
      const why = connectorReason(`mcp__batch__${String(a?.name || "unknown")}`, a?.input || {}, true);
      if (why) return why.replace("mcp__batch__", "a step in the browser batch: ");
    }
    return null;
  }
  if (tokens.includes("computer")) {
    const safe = ["screenshot", "scroll", "scroll_to", "wait", "zoom", "hover"];
    if (safe.includes(String(input.action || ""))) return null;
    return `${tool} (${input.action || "an action"}) would click or type in a browser. This workspace reads pages; Jesse does the clicking and posting.`;
  }
  const verb = tokens.find((t) => READ.has(t) || /^(send|post|publish|reply|forward|delete|trash|remove|archive|create|update|edit|set|add|insert|upload|move|share|invite|respond|execute|run|call|invoke|schedule|write|patch|put|cancel|accept|decline|approve|assign|merge|import|save|apply|form|javascript|type|click|submit)$/.test(t));
  if (verb && READ.has(verb)) return null;
  return `${tool} isn't a read or a draft, so it could act outside this PC. This workspace drafts; Jesse sends. Put a draft in queue/drafts/ and an item in queue/needs-jesse.md. If this tool is really read-only, tell Justin's team so they can allow it.`;
}
if (tool.startsWith("mcp__")) {
  const why = connectorReason(tool, input, false);
  if (why) block(why);
}
process.exit(0);
