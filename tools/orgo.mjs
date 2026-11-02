#!/usr/bin/env node
// The Chief of Staff's link to the Revenue Partner's Orgo computer. See skills/orgo-link/SKILL.md.
//
//   node tools/orgo.mjs status                 read-only: NZ time and clock drift, Hermes and its profiles, the gateway,
//                                              the stop files, every timer (per profile) and any send-like process
//   node tools/orgo.mjs logs [lines] [gateway|errors|agent]   read-only: tail one Hermes log
//   node tools/orgo.mjs hold                   protective: create the stop file, then list every timer (never blocked)
//   node tools/orgo.mjs ask "question"         stage one question to the Revenue Partner (needs Jesse's code each time)
//   node tools/orgo.mjs plan "command"         stage one command that changes the computer (needs Jesse's code)
//   node tools/orgo.mjs sends-on               stage removing the stop file (needs Jesse's code)
//   node tools/orgo.mjs apply                  run the one staged item Jesse has approved, once
//
// Approvals: tools/lib/approval.mjs shows the code in a window on Jesse's screen, never in the chat, and only
// Jesse typing exactly "yes <code>" approves it. Keys come from .env.local (ORGO_API_KEY, ORGO_COMPUTER, and
// ORGO_WORKSPACE / ORGO_PROFILE when needed) and are never printed. Every call is logged in runs/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stage, take } from "./lib/approval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "tools", ".orgo", "node_modules", "orgo", "dist", "cli.js");

function die(msg, code = 1) { console.error(msg); process.exit(code); }

function env() {
  const vals = { ...process.env };
  const file = path.join(ROOT, ".env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(ORGO_API_KEY|ORGO_COMPUTER|ORGO_WORKSPACE|ORGO_PROFILE)=(.*)$/);
      if (m) vals[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  if (!vals.ORGO_API_KEY) die("No ORGO_API_KEY. Jesse adds it himself, in his own PowerShell window: node tools/add_secret.mjs ORGO_API_KEY", 4);
  if (!vals.ORGO_COMPUTER) die("No ORGO_COMPUTER (the Revenue Partner computer's name or id). Jesse adds it: node tools/add_secret.mjs ORGO_COMPUTER", 4);
  if (!fs.existsSync(CLI)) die("The Orgo CLI isn't installed here. Run: npm install --prefix tools/.orgo orgo@2.3.0 --no-audit --no-fund (in PowerShell: npm.cmd ...)", 4);
  if (vals.ORGO_PROFILE && !/^[\w.-]+$/.test(vals.ORGO_PROFILE)) die("ORGO_PROFILE must be a plain profile name.", 4);
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

// Shell prelude run on the computer: find Hermes, the user it runs as, that user's home, and its profiles. Read-only.
const PRELUDE = String.raw`
set +e
H=$(command -v hermes 2>/dev/null)
[ -z "$H" ] && H=$(ls -1 /home/*/.local/bin/hermes /root/.local/bin/hermes /usr/local/bin/hermes 2>/dev/null | head -1)
U=""; [ -n "$H" ] && U=$(stat -c %U "$(readlink -f "$H")" 2>/dev/null)
HH=""; [ -n "$U" ] && HH=$(getent passwd "$U" | cut -d: -f6)
as_u() { if [ "$(id -un)" = root ] && [ -n "$U" ] && [ "$U" != root ]; then runuser -u "$U" -- "$@"; else "$@"; fi; }
STOPFILE="$HH/PartnerDesk/state/SEND-STOP"
PROFILES="default"; [ -d "$HH/.hermes/profiles" ] && PROFILES="default $(ls -1 "$HH/.hermes/profiles" 2>/dev/null | tr '\n' ' ')"
pflag() { [ "$1" = default ] && return; echo "-p $1"; }
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
echo "## hermes jobs, per profile"
if [ -n "$H" ]; then for p in $PROFILES; do echo "-- profile $p"; as_u timeout 60 "$H" $(pflag "$p") cron list 2>&1 | head -40; done; else echo "UNKNOWN: no hermes"; fi
`;

const STATUS = PRELUDE + String.raw`
echo "## clock"
echo "box_epoch: $(date +%s)"
echo "box_nz: $(TZ=Pacific/Auckland date '+%Y-%m-%d %H:%M %Z')"
timedatectl show -p NTPSynchronized -p Timezone 2>/dev/null || echo "ntp: UNKNOWN"
echo "## hermes"
[ -n "$H" ] && echo "binary: $H" || echo "binary: UNKNOWN"
[ -n "$U" ] && echo "runs_as: $U" || echo "runs_as: UNKNOWN"
echo "profiles: $PROFILES"
[ -n "$H" ] && as_u timeout 30 "$H" --version 2>&1 | head -2
[ -n "$H" ] && as_u timeout 30 "$H" profile list 2>&1 | head -15
echo "## gateway"
ps -eo pid,user,etime,args 2>/dev/null | grep -E '[h]ermes.*gateway' | cut -c1-200 || echo "none running"
` + TIMERS;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function onBox(vals, script, timeoutSec = 120) {
  const wrapped = `echo ${b64(script)} | base64 -d | bash`;
  const r = spawnSync(process.execPath, [CLI, "computers", "bash", vals.ORGO_COMPUTER, ...(vals.ORGO_WORKSPACE ? ["--workspace", vals.ORGO_WORKSPACE] : []), "--timeout", String(timeoutSec), "-c", wrapped], {
    env: { ...process.env, ORGO_API_KEY: vals.ORGO_API_KEY }, encoding: "utf8",
    timeout: (timeoutSec + 60) * 1000, maxBuffer: 16 * 1024 * 1024,
  });
  if (r.error) return { code: 1, out: "", err: String(r.error.message) };
  return { code: r.status ?? 1, out: scrub(r.stdout || ""), err: scrub(r.stderr || "") };
}

const nzNow = () => new Date().toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" });

function logRun(sub, outcome, result, extra = "") {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  const dir = path.join(ROOT, "runs", day.slice(0, 7));
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${day}-chief-of-staff-orgo.md`),
    `\n## ${nzNow()} (NZ) · orgo ${sub}\n- Outcome: ${outcome}\n- Result: ${result}\n${extra}- Sources read: orgo:${process.env.ORGO_COMPUTER_LABEL || "revenue-partner computer"}\n`);
}

const show = (r) => console.log(r.out || r.err);
const done = (r) => process.exit(r.code === 0 ? 0 : 2);
const stopped = () => fs.existsSync(path.join(ROOT, "state", "STOP"));

function main() {
  const [sub, ...args] = process.argv.slice(2);
  if (!sub || sub === "help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\nimport ")[0]); return; }
  const vals = env();
  process.env.ORGO_COMPUTER_LABEL = vals.ORGO_COMPUTER;
  const profile = vals.ORGO_PROFILE ? `-p ${vals.ORGO_PROFILE}` : "";

  if (sub === "status") {
    const r = onBox(vals, STATUS, 150);
    const out = r.out.replace(/^box_epoch: (\d+)$/m, (_, e) => `clock_off_by_seconds: ${Math.round(Number(e) - Date.now() / 1000)} (the computer vs this PC; over 30 is a problem)`);
    console.log(`this_pc_nz: ${nzNow()}`);
    console.log(out || r.err);
    logRun("status", r.code === 0 ? "EXECUTED" : "FAILED", r.code === 0 ? "read the computer's state" : "couldn't reach the computer");
    done(r);
  }

  if (sub === "logs") {
    const n = Math.min(parseInt(args[0] || "80", 10) || 80, 500);
    const file = ["gateway", "errors", "agent"].includes(args[1]) ? args[1] : "gateway";
    const dir = vals.ORGO_PROFILE ? `$HH/.hermes/profiles/${vals.ORGO_PROFILE}/logs` : "$HH/.hermes/logs";
    const r = onBox(vals, PRELUDE + `[ -n "$HH" ] && tail -n ${n} "${dir}/${file}.log" 2>&1 || echo "UNKNOWN: no Hermes home found"`, 60);
    show(r);
    logRun(`logs ${file}`, r.code === 0 ? "EXECUTED" : "FAILED", `last ${n} lines of ${file}.log`);
    done(r);
  }

  if (sub === "hold") {
    // Protective: never needs an approval and is never blocked by state/STOP. It only adds the stop file.
    const script = PRELUDE + `[ -n "$HH" ] && { mkdir -p "$HH/PartnerDesk/state" && touch "$STOPFILE" && chown "$U" "$HH/PartnerDesk/state" "$STOPFILE" 2>/dev/null; }\ntouch /tmp/SEND-HOLD\necho "hold set"\n` + TIMERS;
    const r = onBox(vals, script, 120);
    show(r);
    console.log("\nThe stop file is set. Until the one sender exists, scripts that don't check it can still send: stop each timer above with `plan` and Jesse's code.");
    logRun("hold", r.code === 0 ? "EXECUTED" : "FAILED", "stop file set; timers listed");
    done(r);
  }

  if (sub === "ask") {
    const q = args.join(" ").trim();
    if (!q) die('Usage: node tools/orgo.mjs ask "question"');
    if (stopped()) die("state/STOP exists. A question starts an AI session on the Revenue Partner's computer that could act, so it waits until Jesse lifts STOP. `status` and `logs` still work.", 5);
    stage(ROOT, "orgo-ask", q, "Question for the Revenue Partner", "This starts a short session with the Revenue Partner on its computer to answer one question. It's told not to send, schedule, approve, delete or change anything. The question:");
    return;
  }

  if (sub === "plan") {
    const cmd = args.join(" ").trim();
    if (!cmd) die('Usage: node tools/orgo.mjs plan "command to run on the computer"');
    stage(ROOT, "orgo-run", cmd, "Change the Revenue Partner's computer", "This changes the Revenue Partner's computer. It runs exactly this command, once:");
    return;
  }

  if (sub === "sends-on") {
    stage(ROOT, "orgo-sends-on", "remove the stop file on the Revenue Partner's computer", "Turn the Revenue Partner's sending back on", "This turns the Revenue Partner's sending back on. Only do it once every check in projects/revenue-partner-sends/SPEC.md has passed. It will:");
    return;
  }

  if (sub === "apply") {
    const item = take(ROOT, ["orgo-ask", "orgo-run", "orgo-sends-on"]);
    const words = `- Jesse's words: ${item.words}\n`;
    if (item.kind === "orgo-ask") {
      if (stopped()) die("state/STOP exists; the question wasn't asked.", 5);
      const prompt = `Answer this one question from Jesse's Chief of Staff. Answer only: do not send, schedule, approve, delete or change anything, and do not start any job. Question: ${item.text}`;
      const script = PRELUDE + `[ -z "$H" ] && { echo "UNKNOWN: no hermes"; exit 3; }\nMSG=$(echo ${b64(prompt)} | base64 -d)\nas_u timeout -k 10 300 "$H" ${profile} chat -q "$MSG" -Q --source tool --max-turns 4 2>&1 | tail -n 200`;
      const r = onBox(vals, script, 330);
      show(r);
      logRun("ask", r.code === 0 ? "EXECUTED" : "FAILED", `asked: ${scrub(item.text).slice(0, 120)}`, words);
      done(r);
    }
    if (item.kind === "orgo-sends-on") {
      const r = onBox(vals, PRELUDE + `rm -f "$STOPFILE" /tmp/SEND-HOLD && echo "stop file removed"`, 60);
      show(r);
      logRun("sends-on", r.code === 0 ? "EXECUTED" : "FAILED", "stop file removed", words);
      done(r);
    }
    const r = onBox(vals, PRELUDE + item.text, 300);
    show(r);
    logRun("run", r.code === 0 ? "EXECUTED" : "FAILED", `ran: ${scrub(item.text).slice(0, 160)}`, words);
    done(r);
  }

  die(`Unknown command: ${sub}. Run: node tools/orgo.mjs help`);
}

main();
