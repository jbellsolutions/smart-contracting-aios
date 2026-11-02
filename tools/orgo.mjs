#!/usr/bin/env node
// The Chief of Staff's link to the Revenue Partner's Orgo computer. See skills/orgo-link/SKILL.md.
//
//   node tools/orgo.mjs status                 read-only: clock, Hermes, gateway, stop files, timers, send-like processes
//   node tools/orgo.mjs logs [lines] [gateway|errors|agent]   read-only: tail one Hermes log
//   node tools/orgo.mjs hold                   protective: create the stop file, then list every timer (never blocked)
//   node tools/orgo.mjs allow-ask [code]       turn on `ask` (needs Jesse's "yes <code>")
//   node tools/orgo.mjs ask "question"         one message to the Revenue Partner; the reply comes back here only
//   node tools/orgo.mjs plan "command"         stage one command that changes the computer; prints its code
//   node tools/orgo.mjs run <code>             run a staged command, only after Jesse typed "yes <code>" in chat
//   node tools/orgo.mjs sends-on [code]        remove the stop file (needs Jesse's "yes <code>")
//
// Keys come from .env.local (ORGO_API_KEY, ORGO_COMPUTER) and are never printed. Jesse's "yes <code>" is
// recorded by tools/hooks/approval_capture.mjs from what he types, into state/approvals/, which the model
// can't write (settings.json deny rules and the stop guard). Every call is logged in runs/.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "tools", ".orgo", "node_modules", "orgo", "dist", "cli.js");
const STATE = path.join(ROOT, "state");
const APPROVALS = path.join(STATE, "approvals");
const PENDING = path.join(STATE, "orgo-pending");
const SETTINGS = path.join(STATE, "orgo.json");

function die(msg, code = 1) { console.error(msg); process.exit(code); }

function env() {
  const vals = { ...process.env };
  const file = path.join(ROOT, ".env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(ORGO_API_KEY|ORGO_COMPUTER)=(.*)$/);
      if (m) vals[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  if (!vals.ORGO_API_KEY) die("No ORGO_API_KEY. Jesse adds it himself: node tools/add_secret.mjs ORGO_API_KEY", 4);
  if (!vals.ORGO_COMPUTER) die("No ORGO_COMPUTER (the Revenue Partner computer's name or id). Add it: node tools/add_secret.mjs ORGO_COMPUTER", 4);
  if (!fs.existsSync(CLI)) die("The Orgo CLI isn't installed here. Run: npm install --prefix tools/.orgo orgo@2.3.0 --no-audit --no-fund", 4);
  return vals;
}

// Remove anything shaped like a key, token, JWT, long secret or pairing link before it's shown or logged.
export function scrub(text) {
  return String(text)
    .replace(/\b(sk|rk|pk)[-_][A-Za-z0-9_-]{16,}/g, "[redacted]")
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[redacted]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, "[redacted-jwt]")
    .replace(/\b(api[_-]?key|token|secret|password|bearer)\b(\s*[:=]\s*|\s+)\S{8,}/gi, "$1$2[redacted]")
    .replace(/https?:\/\/t\.me\/\S+/g, "[redacted-link]")
    .replace(/\b[A-Fa-f0-9]{40,}\b/g, "[redacted-hex]")
    .replace(/\b[A-Za-z0-9+/]{48,}={0,2}/g, "[redacted-b64]");
}

// Shell prelude run on the computer: find Hermes, the user it runs as, and that user's home. Read-only.
const PRELUDE = String.raw`
set +e
H=$(command -v hermes 2>/dev/null)
[ -z "$H" ] && H=$(ls -1 /home/*/.local/bin/hermes /root/.local/bin/hermes /usr/local/bin/hermes 2>/dev/null | head -1)
U=""; [ -n "$H" ] && U=$(stat -c %U "$(readlink -f "$H")" 2>/dev/null)
HH=""; [ -n "$U" ] && HH=$(getent passwd "$U" | cut -d: -f6)
as_u() { if [ "$(id -un)" = root ] && [ -n "$U" ] && [ "$U" != root ]; then runuser -u "$U" -- "$@"; else "$@"; fi; }
STOPFILE="$HH/PartnerDesk/state/SEND-STOP"
`;

const TIMERS = String.raw`
echo "## stop files"
for f in "$STOPFILE" /tmp/SEND-HOLD; do [ -n "$HH" ] || f=/tmp/SEND-HOLD; [ -e "$f" ] && echo "present: $f" || echo "absent: $f"; done
echo "## send-like processes"
ps -eo pid,user,etime,args 2>/dev/null | grep -E -i '[s]leep [0-9]|[s]end|[s]mtp|graph\.microsoft' | grep -v -E 'ps -eo|base64' | cut -c1-200 | head -20
echo "## timers"
for u in root $(ls /home 2>/dev/null); do c=$(crontab -l -u "$u" 2>/dev/null); [ -n "$c" ] && { echo "-- crontab $u"; echo "$c"; }; done
command -v atq >/dev/null 2>&1 && { echo "-- at jobs"; atq; }
systemctl list-timers --no-pager 2>/dev/null | head -12
echo "## hermes jobs"
[ -n "$H" ] && as_u timeout 60 "$H" cron list 2>&1 | head -40 || echo "UNKNOWN: no hermes"
`;

const STATUS = PRELUDE + String.raw`
echo "## clock"
echo "box_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "box_nz: $(TZ=Pacific/Auckland date '+%Y-%m-%d %H:%M %Z')"
timedatectl show -p NTPSynchronized -p Timezone 2>/dev/null || echo "ntp: UNKNOWN"
echo "## hermes"
[ -n "$H" ] && echo "binary: $H" || echo "binary: UNKNOWN"
[ -n "$U" ] && echo "runs_as: $U" || echo "runs_as: UNKNOWN"
[ -n "$H" ] && as_u timeout 30 "$H" --version 2>&1 | head -2
[ -n "$H" ] && as_u timeout 30 "$H" profile list 2>&1 | head -15
echo "## gateway"
ps -eo pid,user,etime,args 2>/dev/null | grep -E '[h]ermes.*gateway' | cut -c1-200 || echo "none running"
` + TIMERS;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function onBox(vals, script, timeoutSec = 120) {
  const wrapped = `echo ${b64(script)} | base64 -d | bash`;
  const r = spawnSync(process.execPath, [CLI, "computers", "bash", vals.ORGO_COMPUTER, "--timeout", String(timeoutSec), "-c", wrapped], {
    env: { ...process.env, ORGO_API_KEY: vals.ORGO_API_KEY }, encoding: "utf8",
    timeout: (timeoutSec + 60) * 1000, maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) return { code: 1, out: "", err: String(r.error.message) };
  return { code: r.status ?? 1, out: scrub(r.stdout || ""), err: scrub(r.stderr || "") };
}

function logRun(sub, outcome, result, extra = "") {
  const now = new Date();
  const nz = now.toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" });
  const day = now.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  const dir = path.join(ROOT, "runs", day.slice(0, 7));
  fs.mkdirSync(dir, { recursive: true });
  const line = `\n## ${nz} · orgo ${sub}\n- Outcome: ${outcome}\n- Result: ${result}\n${extra}- Sources read: orgo:${process.env.ORGO_COMPUTER_LABEL || "revenue-partner computer"}\n`;
  fs.appendFileSync(path.join(dir, `${day}-chief-of-staff-orgo.md`), line);
}

function codeFor(kind, text, computer) {
  return createHash("sha256").update(`${kind}\n${computer}\n${text}`).digest("hex").slice(0, 6);
}

function stage(kind, text, computer) {
  const code = codeFor(kind, text, computer);
  fs.mkdirSync(PENDING, { recursive: true });
  fs.writeFileSync(path.join(PENDING, `${code}.json`), JSON.stringify({ kind, text, created: Date.now() }, null, 2));
  return code;
}

// An approval counts only if the hook wrote it from Jesse's own typed words after the item was staged.
function consumeApproval(code, kind) {
  const p = path.join(PENDING, `${code}.json`);
  if (!/^[0-9a-f]{6}$/.test(code || "") || !fs.existsSync(p)) die(`Nothing staged under code ${code}.`, 5);
  const pending = JSON.parse(fs.readFileSync(p, "utf8"));
  if (pending.kind !== kind) die(`Code ${code} was staged for ${pending.kind}, not ${kind}.`, 5);
  const a = path.join(APPROVALS, `${code}.json`);
  if (!fs.existsSync(a)) die(`No approval for ${code}. Jesse types "yes ${code}" in this chat himself; nothing else counts.`, 5);
  const approval = JSON.parse(fs.readFileSync(a, "utf8"));
  if (Date.parse(approval.at) < pending.created) die(`The approval for ${code} is older than what was staged. Ask Jesse again.`, 5);
  fs.rmSync(a); fs.rmSync(p);
  return { pending, approval };
}

function main() {
  const [sub, ...args] = process.argv.slice(2);
  if (!sub || sub === "help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\nimport ")[0]); return; }
  const vals = env();
  process.env.ORGO_COMPUTER_LABEL = vals.ORGO_COMPUTER;

  if (sub === "status") {
    const r = onBox(vals, STATUS, 150);
    console.log(`this_pc_utc: ${new Date().toISOString().slice(0, 19)}Z`);
    console.log(r.out || r.err);
    logRun("status", r.code === 0 ? "EXECUTED" : "FAILED", r.code === 0 ? "read the computer's state" : "couldn't reach the computer");
    process.exit(r.code === 0 ? 0 : 2);
  }

  if (sub === "logs") {
    const n = Math.min(parseInt(args[0] || "80", 10) || 80, 500);
    const file = ["gateway", "errors", "agent"].includes(args[1]) ? args[1] : "gateway";
    const r = onBox(vals, PRELUDE + `[ -n "$HH" ] && tail -n ${n} "$HH/.hermes/logs/${file}.log" 2>&1 || echo "UNKNOWN: no Hermes home found"`, 60);
    console.log(r.out || r.err);
    logRun(`logs ${file}`, r.code === 0 ? "EXECUTED" : "FAILED", `last ${n} lines of ${file}.log`);
    process.exit(r.code === 0 ? 0 : 2);
  }

  if (sub === "hold") {
    // Protective: never needs an approval and is never blocked by state/STOP.
    const script = PRELUDE + `[ -n "$HH" ] && { mkdir -p "$HH/PartnerDesk/state" && touch "$STOPFILE" && chown -R "$U" "$HH/PartnerDesk/state" 2>/dev/null; }\ntouch /tmp/SEND-HOLD\necho "hold set"\n` + TIMERS;
    const r = onBox(vals, script, 120);
    console.log(r.out || r.err);
    console.log("\nThe stop file is set. Until the one sender exists, scripts that don't check it can still send: stop each timer above with `plan` and Jesse's yes.");
    logRun("hold", r.code === 0 ? "EXECUTED" : "FAILED", "stop file set; timers listed");
    process.exit(r.code === 0 ? 0 : 2);
  }

  if (sub === "allow-ask" || sub === "sends-on") {
    const label = sub === "allow-ask" ? "let the Chief of Staff ask the Revenue Partner questions" : "turn sending back on (remove the stop file)";
    if (!args[0]) {
      const code = stage(sub, label, vals.ORGO_COMPUTER);
      console.log(`To ${label}, Jesse types in this chat:\n\n    yes ${code}\n`);
      return;
    }
    const { approval } = consumeApproval(args[0], sub);
    if (sub === "allow-ask") {
      fs.mkdirSync(STATE, { recursive: true });
      fs.writeFileSync(SETTINGS, JSON.stringify({ askAllowed: true, by: approval.words, at: approval.at }, null, 2));
      console.log("ask is on.");
      logRun("allow-ask", "EXECUTED", "ask turned on", `- Jesse's words: ${approval.words}\n`);
      return;
    }
    const r = onBox(vals, PRELUDE + `rm -f "$STOPFILE" /tmp/SEND-HOLD && echo "stop file removed"`, 60);
    console.log(r.out || r.err);
    logRun("sends-on", r.code === 0 ? "EXECUTED" : "FAILED", "stop file removed", `- Jesse's words: ${approval.words}\n`);
    process.exit(r.code === 0 ? 0 : 2);
  }

  if (sub === "ask") {
    const msg = args.join(" ").trim();
    if (!msg) die('Usage: node tools/orgo.mjs ask "question"');
    const s = fs.existsSync(SETTINGS) ? JSON.parse(fs.readFileSync(SETTINGS, "utf8")) : {};
    if (!s.askAllowed) die("ask is off. The first message to the Revenue Partner needs Jesse's go-ahead: node tools/orgo.mjs allow-ask", 5);
    const script = PRELUDE + `[ -z "$H" ] && { echo "UNKNOWN: no hermes"; exit 3; }\nMSG=$(echo ${b64(msg)} | base64 -d)\nas_u timeout -k 10 300 "$H" chat -q "$MSG" -Q --source tool --max-turns 8 2>&1 | tail -n 200`;
    const r = onBox(vals, script, 330);
    console.log(r.out || r.err);
    logRun("ask", r.code === 0 ? "EXECUTED" : "FAILED", `asked: ${scrub(msg).slice(0, 120)}`);
    process.exit(r.code === 0 ? 0 : 2);
  }

  if (sub === "plan") {
    const cmd = args.join(" ").trim();
    if (!cmd) die('Usage: node tools/orgo.mjs plan "command to run on the computer"');
    const code = stage("run", cmd, vals.ORGO_COMPUTER);
    console.log(`This changes the Revenue Partner's computer. It runs exactly:\n\n    ${cmd}\n\nTo allow it once, Jesse types in this chat:\n\n    yes ${code}\n\nThen: node tools/orgo.mjs run ${code}`);
    return;
  }

  if (sub === "run") {
    const { pending, approval } = consumeApproval(args[0], "run");
    const r = onBox(vals, PRELUDE + pending.text, 300);
    console.log(r.out || r.err);
    logRun("run", r.code === 0 ? "EXECUTED" : "FAILED", `ran: ${scrub(pending.text).slice(0, 160)}`, `- Jesse's words: ${approval.words}\n`);
    process.exit(r.code === 0 ? 0 : 2);
  }

  die(`Unknown command: ${sub}. Run: node tools/orgo.mjs help`);
}

main();
