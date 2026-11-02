// Jesse's typed approvals, shared by tools/orgo.mjs, tools/switch.mjs and the approval hook.
//
// stage() writes the item to state/pending/ under a slow hash of a fresh random code, and shows the code
// and the exact action in a window on Jesse's screen. The code never goes into the chat, so the model
// can't approve anything itself. Jesse types exactly "yes <code>"; the UserPromptSubmit hook (capture)
// hashes it and, only if that item is staged, writes state/approvals/<hash>.json. take() then hands the
// tool the approved item once. Guards against mistakes and injected instructions, not a determined attacker
// with shell access to the PC.
import { randomInt, scryptSync } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
const dirs = (root) => ({ pending: path.join(root, "state", "pending"), approvals: path.join(root, "state", "approvals") });

export const hashCode = (code) => scryptSync(code.trim().toUpperCase(), "smart-contracting-aios", 16, { N: 16384 }).toString("hex");

function newCode() {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALPHABET[randomInt(ALPHABET.length)];
  return c;
}

// Show the code and the action in a window the model can't read. Returns false where no window can be shown.
// "true" only means the window was started: the Claude app can run commands where Jesse's desktop can't see
// them, so stage() always names the terminal route too.
export function popup(title, body) {
  try {
    if (process.platform === "win32") {
      const q = (s) => s.replace(/'/g, "''");
      const ps = `Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${q(body)}','${q(title)}') | Out-Null`;
      const enc = Buffer.from(ps, "utf16le").toString("base64");
      spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", enc], { detached: true, stdio: "ignore", windowsHide: false }).unref();
      return true;
    }
    if (process.platform === "darwin") {
      const q = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      spawn("osascript", ["-e", `display dialog "${q(body)}" with title "${q(title)}" buttons {"OK"} default button "OK"`], { detached: true, stdio: "ignore" }).unref();
      return true;
    }
  } catch { /* fall through */ }
  return false;
}

// Stage one action. Prints what the chat may see; the code itself goes only to the window.
// Two ways for Jesse to approve: type "yes <code>" from the window in the chat, or run node tools/approve.mjs in
// his own terminal window (for when the window doesn't show up on his screen, as on Nov 1).
export function stage(root, kind, text, title, what) {
  const { pending } = dirs(root);
  fs.mkdirSync(pending, { recursive: true });
  for (const f of fs.readdirSync(pending)) {           // one staged item per kind at a time
    const p = path.join(pending, f);
    try { if (JSON.parse(fs.readFileSync(p, "utf8")).kind === kind) fs.rmSync(p); } catch { fs.rmSync(p, { force: true }); }
  }
  const code = newCode();
  const shown = popup(title, `${what}\n\n${text}\n\nTo allow this once, type in the Claude chat:\n\nyes ${code}\n\nIf you don't want it, just ignore this.`);
  fs.writeFileSync(path.join(pending, `${hashCode(code)}.json`), JSON.stringify({ kind, text, title, what, created: Date.now() }, null, 2));
  console.log(`${what}\n\n    ${text}\n`);
  if (shown) console.log(`A window on Jesse's screen shows this and an 8-character code (check the taskbar if it's behind the Claude app). To allow it once, Jesse types "yes <code>" in this chat. The code isn't shown here, so nobody else can approve it.`);
  console.log(`${shown ? "If no window appears" : "No window can be shown here"}, Jesse approves it in his own PowerShell window in this folder instead: node tools/approve.mjs (it shows exactly this and asks him to type yes).`);
  console.log("Then run the same tool's apply step.");
}

// Everything staged and not yet approved, oldest first (for tools/approve.mjs). Never includes a code.
export function listPending(root) {
  const { pending, approvals } = dirs(root);
  const out = [];
  for (const f of fs.existsSync(pending) ? fs.readdirSync(pending) : []) {
    if (fs.existsSync(path.join(approvals, f))) continue;
    try { out.push({ file: f, ...JSON.parse(fs.readFileSync(path.join(pending, f), "utf8")) }); } catch { /* skip unreadable */ }
  }
  return out.sort((a, b) => a.created - b.created);
}

// Record Jesse's yes from his own terminal for one staged item (tools/approve.mjs only).
export function approveInTerminal(root, file) {
  const { pending, approvals } = dirs(root);
  if (!/^[a-f0-9]{32}\.json$/.test(file) || !fs.existsSync(path.join(pending, file))) throw new Error("No such staged item.");
  fs.mkdirSync(approvals, { recursive: true });
  fs.writeFileSync(path.join(approvals, file), JSON.stringify({ words: "yes (typed in Jesse's own terminal)", at: new Date().toISOString() }, null, 2));
}

// Called by the approval hook with the exact prompt Jesse typed.
export function capture(root, prompt) {
  // Exactly "yes <code>", allowing how dictation writes it: "Yes, K7QF 2M9X." The message may hold nothing else.
  const m = String(prompt).trim().match(/^yes[\s,:;.-]+([A-Za-z0-9][A-Za-z0-9 -]{6,14}[A-Za-z0-9])[.!]*$/i);
  if (!m) return false;
  const code = m[1].replace(/[\s-]/g, "");
  if (code.length !== 8) return false;
  const { pending, approvals } = dirs(root);
  const h = hashCode(code);
  if (!fs.existsSync(path.join(pending, `${h}.json`))) return false;
  fs.mkdirSync(approvals, { recursive: true });
  fs.writeFileSync(path.join(approvals, `${h}.json`), JSON.stringify({ words: String(prompt).trim().slice(0, 80), at: new Date().toISOString() }, null, 2));
  return true;
}

// The one approved item of these kinds, consumed. Exits with a plain message if there isn't exactly one.
export function take(root, kinds) {
  const { pending, approvals } = dirs(root);
  const hits = [];
  for (const f of fs.existsSync(pending) ? fs.readdirSync(pending) : []) {
    let item; try { item = JSON.parse(fs.readFileSync(path.join(pending, f), "utf8")); } catch { continue; }
    if (!kinds.includes(item.kind)) continue;
    const a = path.join(approvals, f);
    if (!fs.existsSync(a)) continue;
    const approval = JSON.parse(fs.readFileSync(a, "utf8"));
    if (Date.parse(approval.at) < item.created) { fs.rmSync(a); continue; }
    hits.push({ f, item, approval });
  }
  if (hits.length !== 1) {
    console.error(hits.length ? "More than one approved item; nothing run. Stage it again." : 'Nothing approved yet. Jesse types "yes <code>" from the window, exactly, in this chat, or runs node tools/approve.mjs in his own PowerShell window.');
    process.exit(5);
  }
  const { f, item, approval } = hits[0];
  fs.rmSync(path.join(pending, f)); fs.rmSync(path.join(approvals, f));
  return { ...item, words: approval.words, at: approval.at };
}
