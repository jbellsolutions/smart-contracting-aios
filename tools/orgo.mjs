#!/usr/bin/env node
// The Chief of Staff's link to the Revenue Partner's Orgo computer. See skills/orgo-link/SKILL.md.
//
//   node tools/orgo.mjs computers              read-only: list the computers Jesse's Orgo key can see (name, workspace, status)
//   node tools/orgo.mjs use "name"             save which one is the Revenue Partner (ORGO_COMPUTER; must match the list)
//   node tools/orgo.mjs workspace "name"       only if two computers share the name: save which workspace (ORGO_WORKSPACE)
//   node tools/orgo.mjs status                 read-only: NZ time and clock drift, NTP and whether the box is a container,
//                                              the sender's own corrected clock, Hermes and its profiles, the gateway,
//                                              the stop files, every timer (per profile) and any send-like process
//   node tools/orgo.mjs logs [lines] [gateway|errors|agent]   read-only: tail one Hermes log
//   node tools/orgo.mjs hold                   protective: create the stop file, then list every timer (never blocked)
//   node tools/orgo.mjs ask "question"         stage one question to the Revenue Partner (needs Jesse's code each time)
//   node tools/orgo.mjs plan "command"         stage one command that changes the computer (needs Jesse's code)
//   node tools/orgo.mjs sends-on               stage removing the stop file (needs Jesse's code)
//   node tools/orgo.mjs install-sender         stage copying the one sender (projects/revenue-partner-sends/sender/) to
//                                              ~/PartnerDesk/sender/ there (needs Jesse's code). No sender.json, no timer,
//                                              the stop file stays
//   node tools/orgo.mjs sender-check           read-only: the sender's selfcheck and status, every timer that mentions
//                                              sending, and any other code that calls the mail API (file paths only)
//   node tools/orgo.mjs apply                  run the one staged item Jesse has approved, once
//
// Approvals: tools/lib/approval.mjs shows the code in a window on Jesse's screen, never in the chat, and only
// Jesse typing exactly "yes <code>" (or yes in node tools/approve.mjs, in his own window) approves it. Keys come from .env.local (ORGO_API_KEY, ORGO_COMPUTER, and
// ORGO_WORKSPACE / ORGO_PROFILE when needed) and are never printed. Every call is logged in runs/.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { stage, take } from "./lib/approval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "tools", ".orgo", "node_modules", "orgo", "dist", "cli.js");

function die(msg, code = 1) { console.error(msg); process.exit(code); }

function readEnvFile() {
  const vals = {};
  const file = path.join(ROOT, ".env.local");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(ORGO_API_KEY|ORGO_COMPUTER|ORGO_WORKSPACE|ORGO_PROFILE)=(.*)$/);
      if (m) vals[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return vals;
}

// needComputer=false for `computers` and `use`, which run before the computer is chosen.
function env(needComputer = true) {
  const vals = { ...process.env, ...readEnvFile() };
  if (!fs.existsSync(CLI)) die("The Orgo tool isn't installed here, or its download is incomplete. Run: node tools/setup_orgo.mjs (it reinstalls it cleanly and checks it starts).", 4);
  if (!vals.ORGO_API_KEY) die("No ORGO_API_KEY. Jesse adds it himself, in his own PowerShell window: node tools/add_secret.mjs ORGO_API_KEY", 4);
  if (needComputer && !vals.ORGO_COMPUTER) die('No Revenue Partner computer chosen yet. Run: node tools/orgo.mjs computers, then node tools/orgo.mjs use "<its name exactly as listed>".', 4);
  if (vals.ORGO_PROFILE && !/^[\w.-]+$/.test(vals.ORGO_PROFILE)) die("ORGO_PROFILE must be a plain profile name.", 4);
  return vals;
}

// Orgo's tool, run directly with the key in its environment. Explains a broken install instead of a stack trace.
function cli(vals, args, timeoutMs = 120000) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, ORGO_API_KEY: vals.ORGO_API_KEY }, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024,
  });
  const err = String(r.stderr || "");
  if (/ERR_MODULE_NOT_FOUND|Cannot find (module|package)/.test(err)) die("The Orgo tool's download is incomplete (a part of it is missing). Run: node tools/setup_orgo.mjs", 4);
  return r;
}

function listComputers(vals) {
  const r = cli(vals, ["--json", "computers", "list"]);
  if (r.error || r.status !== 0) return { error: scrub(String(r.stderr || r.stdout || r.error?.message || "no answer")).trim().slice(0, 400) };
  try { return { list: (JSON.parse(r.stdout).computers || []).map((c) => ({ name: c.name, workspace: c.workspace_name, status: c.status })) }; }
  catch { return { error: "Orgo answered in an unexpected format: " + scrub(r.stdout).slice(0, 300) }; }
}

function saveSetting(name, value) {
  const file = path.join(ROOT, ".env.local");
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith(`${name}=`)) : [];
  lines.push(`${name}=${value}`);
  fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
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
SPY=python3; [ -n "$SENDER_PY" ] && SPY="$SENDER_PY"
sender() { as_u env PARTNERDESK_HOME="$HH/PartnerDesk" "$SPY" "$HH/PartnerDesk/sender/sender.py" "$@"; }
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
if command -v timedatectl >/dev/null 2>&1; then
  echo "ntp_detail: $(timedatectl show -p NTP -p NTPSynchronized -p CanNTP 2>&1 | tr '\n' ' ' | cut -c1-200)"
else
  TS=""; for t in chronyd systemd-timesyncd ntpd; do w=$(command -v "$t" 2>/dev/null || ls /lib/systemd/"$t" /usr/lib/systemd/"$t" 2>/dev/null | head -1); TS="$TS $t=$([ -n "$w" ] && echo "$w" || echo none)"; done
  echo "ntp_detail: timedatectl missing; time services:$TS"
fi
CT=""; [ -e /.dockerenv ] && CT="$CT /.dockerenv"; [ -e /run/.containerenv ] && CT="$CT /run/.containerenv"
V=$(systemd-detect-virt -c 2>/dev/null); [ -n "$V" ] && [ "$V" != none ] && CT="$CT systemd-detect-virt=$V"
[ -n "$CT" ] && echo "container: yes ($(echo $CT)); the clock belongs to the host and can't be set here" || echo "container: no sign of one"
SJ="$HH/PartnerDesk/sender.json"
if [ -n "$HH" ] && [ -f "$HH/PartnerDesk/sender/sender.py" ] && [ -f "$SJ" ]; then
  echo "## the sender's own clock (read-only; it corrects for a wrong box clock)"
  ( cd / && sender status 2>&1 ) | sed -n '/^## clock/,/^## stop file/p' | grep -v '^## '
fi
echo "## hermes"
[ -n "$H" ] && echo "binary: $H" || echo "binary: UNKNOWN"
[ -n "$U" ] && echo "runs_as: $U" || echo "runs_as: UNKNOWN"
echo "profiles: $PROFILES"
[ -n "$H" ] && as_u timeout 30 "$H" --version 2>&1 | head -2
[ -n "$H" ] && as_u timeout 30 "$H" profile list 2>&1 | head -15
echo "## gateway"
ps -eo pid,user,etime,args 2>/dev/null | grep -E '[h]ermes.*gateway' | cut -c1-200 || echo "none running"
echo "## one sender"
[ -n "$HH" ] && [ -f "$HH/PartnerDesk/sender/sender.py" ] && echo "installed: $HH/PartnerDesk/sender/sender.py" || echo "not installed: $HH/PartnerDesk/sender/sender.py"
SL="$HH/PartnerDesk/send-log.jsonl"
if [ -n "$HH" ] && [ -f "$SL" ]; then echo "send-log, last 3:"; tail -n 3 "$SL" | cut -c1-300; else echo "send-log: none yet"; fi
` + TIMERS;

// Read-only: the one sender's own checks, every scheduler entry that mentions sending, and any other code that
// calls the mail API. Prints file paths only, never file contents.
const SENDER_CHECK = PRELUDE + String.raw`
[ -z "$HH" ] && { echo "UNKNOWN: no Hermes home found"; exit 3; }
D="$HH/PartnerDesk/sender"
P='send|msgraph|graph\.microsoft'
cd / || true
if [ -f "$D/sender.py" ]; then
  echo "## sender selfcheck (temporary folder, fake mail; touches nothing real)"; sender selfcheck 2>&1 | tail -20
  echo "## sender status"; sender status 2>&1 | tail -60
else echo "not installed: $D/sender.py"; fi
echo "## the agent's mail code"
find "$HH" -xdev -maxdepth 7 -name msgraph_mail.py -not -path "*/node_modules/*" 2>/dev/null | head -5
[ -n "$H" ] && echo "hermes runs under: $(head -1 "$(readlink -f "$H")" 2>/dev/null | cut -c1-160)"
echo "## scheduler entries that mention sending (the sender's own cron line should be the only one)"
for u in root $(ls /home 2>/dev/null); do crontab -l -u "$u" 2>/dev/null | grep -v -E '^[[:space:]]*#' | grep -i -E "$P" | sed "s|^|crontab $u: |"; done
grep -i -E "$P" /etc/crontab /etc/cron.d/* 2>/dev/null | grep -v -E ':[[:space:]]*#' | cut -c1-200 | sed 's|^|system cron: |'
if command -v atq >/dev/null 2>&1; then atq | while read -r n rest; do at -c "$n" 2>/dev/null | grep -q -i -E "$P" && echo "at job $n: $rest"; done; fi
for svc in $(systemctl list-timers --all --no-legend 2>/dev/null | awk '{print $NF}'); do systemctl cat "$svc" 2>/dev/null | grep -q -i -E "$P" && echo "systemd timer runs $svc"; done
if [ -n "$U" ] && [ "$U" != root ]; then UID_U=$(id -u "$U"); for svc in $(as_u env XDG_RUNTIME_DIR="/run/user/$UID_U" systemctl --user list-timers --all --no-legend 2>/dev/null | awk '{print $NF}'); do as_u env XDG_RUNTIME_DIR="/run/user/$UID_U" systemctl --user cat "$svc" 2>/dev/null | grep -q -i -E "$P" && echo "user systemd timer runs $svc"; done; fi
if [ -n "$H" ]; then for p in $PROFILES; do as_u timeout 60 "$H" $(pflag "$p") cron list 2>&1 | grep -i -E -B3 -A3 "$P" | sed "s|^|hermes job ($p): |" | head -40; done; else echo "UNKNOWN: no hermes"; fi
ps -eo pid,user,etime,args 2>/dev/null | grep -E -i '[s]leep [0-9]|[s]end|[s]mtp|graph\.microsoft' | grep -v -E 'ps -eo|base64|sender-check' | cut -c1-200 | sed 's|^|process: |' | head -20
echo "## code that calls the mail API outside $D (file paths only; msgraph_mail.py itself shows because it defines send_mail)"
timeout 120 grep -r -l -I -E 'sendMail|/send\b|send_mail\(' "$HH" /tmp /usr/local/bin --exclude-dir={node_modules,.git,.cache,.npm,site-packages,__pycache__,logs,sessions,.venv,venv} 2>/dev/null | grep -v "^$D/" | head -60
echo "## end"
`;

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

// The one sender's files, read from this repo. What Jesse approves names each file's hash; apply re-reads them and
// refuses if anything changed in between.
const SENDER_DIR = path.join(ROOT, "projects", "revenue-partner-sends", "sender");
const SENDER_FILES = ["sender.py", "graph_adapter.py", "test_sender.py", "README.md", "sender.example.json"];
function senderFiles() {
  return SENDER_FILES.map((name) => {
    const p = path.join(SENDER_DIR, name);
    if (!fs.existsSync(p)) die(`Missing ${path.relative(ROOT, p)}. Run git pull, then stage it again.`, 4);
    const buf = fs.readFileSync(p);
    return { name, buf, sha: createHash("sha256").update(buf).digest("hex") };
  });
}
const senderText = (files) => `Into ~/PartnerDesk/sender/ on the Revenue Partner's computer, owned by the Hermes user:\n${files.map((f) => `  ${f.name} (sha256 ${f.sha.slice(0, 16)})`).join("\n")}\nIt also creates ~/PartnerDesk/state. It doesn't create sender.json, add or change any timer, or remove the stop file. It sends nothing.`;

// The remote scripts for install-sender: each file goes up gzipped and in base64 pieces small enough for one
// command line (Windows caps a command line at 32,767 characters), into a holding folder. The last script checks
// every file's hash and only then moves them all into place, so a broken upload installs nothing.
export function installSenderScripts(files, piece = 16000) {
  const scripts = [];
  const I = `"$HH/PartnerDesk/sender/.incoming"`;
  const guard = `[ -z "$HH" ] && { echo "UNKNOWN: no Hermes home found; nothing installed"; exit 3; }\n`;
  scripts.push(guard + `echo "## already in $HH/PartnerDesk"; ls -1A "$HH/PartnerDesk" 2>/dev/null | head -40\nmkdir -p ${I} && rm -f ${I}/*.b64 && echo "upload started"\n`);
  for (const f of files) {
    const data = gzipSync(f.buf, { level: 9 }).toString("base64");
    for (let i = 0; i < data.length; i += piece) scripts.push(guard + `printf '%s' '${data.slice(i, i + piece)}' >> ${I}/${f.name}.b64 || exit 4\n`);
  }
  const lines = [guard.trimEnd(), `D="$HH/PartnerDesk/sender"`, `OK=1`];
  for (const f of files) {
    lines.push(`base64 -d ${I}/${f.name}.b64 2>/dev/null | gzip -dc > ${I}/${f.name} 2>/dev/null; [ "$(sha256sum ${I}/${f.name} | cut -d' ' -f1)" = "${f.sha}" ] || { echo "FAILED: ${f.name} didn't arrive intact"; OK=0; }`);
  }
  lines.push(`[ "$OK" = 1 ] || { rm -f ${I}/*; rmdir ${I} 2>/dev/null; echo "Nothing installed."; exit 4; }`);
  lines.push(`mkdir -p "$HH/PartnerDesk/state"`);
  for (const f of files) lines.push(`mv -f ${I}/${f.name} "$D/${f.name}" && chmod ${f.name === "sender.py" ? 755 : 644} "$D/${f.name}"`);
  lines.push(`rm -f ${I}/*.b64; rmdir ${I} 2>/dev/null`);
  // Only the folders this touches, and only when the command runs as root: never a recursive ownership change.
  lines.push(`if [ "$(id -un)" = root ] && [ -n "$U" ] && [ "$U" != root ]; then [ "$(stat -c %U "$HH/PartnerDesk")" = root ] && chown "$U" "$HH/PartnerDesk"; chown "$U" "$HH/PartnerDesk/state" "$D" ${files.map((f) => `"$D/${f.name}"`).join(" ")}; fi`);
  lines.push(`echo "## installed"; for f in ${files.map((f) => f.name).join(" ")}; do echo "$f $(sha256sum "$D/$f" | cut -c1-16) $(stat -c %U "$D/$f")"; done`);
  lines.push(`[ -e "$HH/PartnerDesk/sender.json" ] && echo "sender.json: present (left as it was)" || echo "sender.json: not yet (next step: fill it in)"`);
  lines.push(`[ -e "$STOPFILE" ] && echo "stop file: present" || echo "stop file: ABSENT (run node tools/orgo.mjs hold)"`);
  scripts.push(lines.join("\n") + "\n");
  return scripts;
}

function onBox(vals, script, timeoutSec = 120) {
  const wrapped = `echo ${b64(script)} | base64 -d | bash`;
  const r = cli(vals, ["computers", "bash", vals.ORGO_COMPUTER, ...(vals.ORGO_WORKSPACE ? ["--workspace", vals.ORGO_WORKSPACE] : []), "--timeout", String(timeoutSec), "-c", wrapped], (timeoutSec + 60) * 1000);
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

// The computer prints its clock as box_epoch (its own) and corrected_epoch (the sender's corrected time). Compare
// each with this PC's clock when the call started: the computer prints them near the start, and the whole call
// (connecting, Hermes, timers) can take longer than the 30 seconds that matter.
function offsets(out, t0, t1) {
  const took = `the call took ${Math.round(t1 - t0)} s`;
  return String(out || "")
    .replace(/^box_epoch: (\d+)$/m, (_, e) => `clock_off_by_seconds: ${Math.round(Number(e) - t0)} (the computer vs this PC when the call started; ${took}; over 30 is a problem)`)
    .replace(/^corrected_epoch: (\d+)$/gm, (_, e) => `sender_clock_off_by_seconds: ${Math.round(Number(e) - t0)} (the sender's corrected time vs this PC when the call started; ${took}; over 30 is a problem)`);
}
const done = (r) => process.exit(r.code === 0 ? 0 : 2);
const stopped = () => fs.existsSync(path.join(ROOT, "state", "STOP"));

function main() {
  const [sub, ...args] = process.argv.slice(2);
  if (!sub || sub === "help") { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\nimport ")[0]); return; }

  if (sub === "computers") {
    const { list, error } = listComputers(env(false));
    if (error) die(`Couldn't list the computers: ${error}\nIf it says the key is invalid, Jesse adds it again in his own window: node tools/add_secret.mjs ORGO_API_KEY`, 2);
    if (!list.length) die("This Orgo key sees no computers. The Revenue Partner's computer is in Jesse's own Orgo account: check the key came from that account (orgo.ai, API keys).", 2);
    list.forEach((c, i) => console.log(`${i + 1}. ${c.name}  (workspace: ${c.workspace}; ${c.status})`));
    console.log('\nPick the Revenue Partner\'s computer with Jesse, then: node tools/orgo.mjs use "<name exactly as above>"');
    logRun("computers", "EXECUTED", `listed ${list.length} computer(s)`);
    return;
  }

  if (sub === "use") {
    const name = args.join(" ").trim().replace(/^["']|["']$/g, "");
    if (!name) die('Usage: node tools/orgo.mjs use "<computer name exactly as listed>"');
    const { list, error } = listComputers(env(false));
    if (error) die(`Couldn't check the name against Orgo: ${error}`, 2);
    const hits = list.filter((c) => c.name === name);
    if (!hits.length) {
      const near = list.filter((c) => c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase()));
      die(`No computer is named exactly "${name}". ${near.length ? `Did you mean: ${near.map((c) => `"${c.name}"`).join(", ")}?` : "Run node tools/orgo.mjs computers to see the names."}`, 2);
    }
    saveSetting("ORGO_COMPUTER", name);
    if (hits.length > 1) {
      console.log(`Saved, but ${hits.length} computers share that name. Save the workspace too: node tools/orgo.mjs workspace "<one of: ${hits.map((c) => c.workspace).join(", ")}>"`);
    } else console.log(`Saved: the Revenue Partner's computer is "${name}" (workspace: ${hits[0].workspace}). Next: node tools/orgo.mjs status`);
    logRun("use", "EXECUTED", `chose computer "${name}"`);
    return;
  }

  if (sub === "workspace") {
    const ws = args.join(" ").trim().replace(/^["']|["']$/g, "");
    const { list, error } = listComputers(env(false));
    if (error) die(`Couldn't check the workspace against Orgo: ${error}`, 2);
    if (!ws || !list.some((c) => c.workspace === ws)) die(`No workspace is named exactly "${ws}". Workspaces: ${[...new Set(list.map((c) => c.workspace))].join(", ")}`, 2);
    saveSetting("ORGO_WORKSPACE", ws);
    console.log(`Saved the workspace "${ws}". Next: node tools/orgo.mjs status`);
    return;
  }

  const vals = env();
  process.env.ORGO_COMPUTER_LABEL = vals.ORGO_COMPUTER;
  const profile = vals.ORGO_PROFILE ? `-p ${vals.ORGO_PROFILE}` : "";

  if (sub === "status") {
    const t0 = Date.now() / 1000;
    const r = onBox(vals, STATUS, 150);
    const out = offsets(r.out, t0, Date.now() / 1000);
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

  if (sub === "sender-check") {
    const t0 = Date.now() / 1000;
    const r = onBox(vals, SENDER_CHECK, 300);
    r.out = offsets(r.out, t0, Date.now() / 1000);
    show(r);
    logRun("sender-check", r.code === 0 ? "EXECUTED" : "FAILED", r.code === 0 ? "ran the sender's selfcheck and status, listed send timers and mail-API callers" : "couldn't run the sender check");
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

  if (sub === "install-sender") {
    // Installing files sends nothing, so like plan it can be staged and applied while state/STOP exists.
    stage(ROOT, "orgo-install-sender", senderText(senderFiles()), "Install the one sender on the Revenue Partner's computer", "This copies the one sender's files to the Revenue Partner's computer. It runs nothing and turns nothing on. It will copy:");
    return;
  }

  if (sub === "sends-on") {
    stage(ROOT, "orgo-sends-on", "remove the stop file on the Revenue Partner's computer", "Turn the Revenue Partner's sending back on", "This turns the Revenue Partner's sending back on. Only do it once every check in projects/revenue-partner-sends/SPEC.md has passed. It will:");
    return;
  }

  if (sub === "apply") {
    const item = take(ROOT, ["orgo-ask", "orgo-run", "orgo-sends-on", "orgo-install-sender"]);
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
    if (item.kind === "orgo-install-sender") {
      const files = senderFiles();
      if (senderText(files) !== item.text) die("The sender's files changed since Jesse approved them, so nothing was installed. Stage it again: node tools/orgo.mjs install-sender", 5);
      const scripts = installSenderScripts(files);
      const tooLong = scripts.find((s) => `echo ${b64(PRELUDE + s)} | base64 -d | bash`.length > 30000);
      if (tooLong) die("An upload piece is too long for one command line; nothing was sent. Tell Justin's team.", 4);
      let r = { code: 0, out: "", err: "" };
      for (const [i, s] of scripts.entries()) {
        r = onBox(vals, PRELUDE + s, 120);
        if (i === 0 || i === scripts.length - 1 || r.code !== 0) show(r);
        if (r.code !== 0) { console.log(`Stopped at upload step ${i + 1} of ${scripts.length}; nothing was installed.`); break; }
      }
      logRun("install-sender", r.code === 0 ? "EXECUTED" : "FAILED", r.code === 0 ? "copied the one sender's files to ~/PartnerDesk/sender/" : "the sender's upload stopped; nothing installed", words);
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
