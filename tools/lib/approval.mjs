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
export function stage(root, kind, text, title, what) {
  const { pending } = dirs(root);
  fs.mkdirSync(pending, { recursive: true });
  for (const f of fs.readdirSync(pending)) {           // one staged item per kind at a time
    const p = path.join(pending, f);
    try { if (JSON.parse(fs.readFileSync(p, "utf8")).kind === kind) fs.rmSync(p); } catch { fs.rmSync(p, { force: true }); }
  }
  const code = newCode();
  if (!popup(title, `${what}\n\n${text}\n\nTo allow this once, type in the Claude chat:\n\nyes ${code}\n\nIf you don't want it, just ignore this.`)) {
    console.error("No window could be shown on this computer, so nothing was staged (the code must never appear in the chat).");
    process.exit(6);
  }
  fs.writeFileSync(path.join(pending, `${hashCode(code)}.json`), JSON.stringify({ kind, text, created: Date.now() }, null, 2));
  console.log(`${what}\n\n    ${text}\n\nA window on Jesse's screen shows this and an 8-character code. To allow it once, Jesse types "yes <code>" in this chat. The code isn't shown here, so nobody else can approve it. Then run the same tool's apply step.`);
}

// Called by the approval hook with the exact prompt Jesse typed.
export function capture(root, prompt) {
  const m = String(prompt).trim().match(/^yes\s+([A-Za-z0-9]{8})[.!]?$/i);
  if (!m) return false;
  const { pending, approvals } = dirs(root);
  const h = hashCode(m[1]);
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
    console.error(hits.length ? "More than one approved item; nothing run. Stage it again." : 'Nothing approved yet. Jesse types "yes <code>" from the window, exactly, in this chat.');
    process.exit(5);
  }
  const { f, item, approval } = hits[0];
  fs.rmSync(path.join(pending, f)); fs.rmSync(path.join(approvals, f));
  return { ...item, words: approval.words, at: approval.at };
}
