#!/usr/bin/env node
// The local stop switch, and the install's approval test.
//
//   node tools/switch.mjs stop-on     create state/STOP: nothing goes out from this workspace (protective, no approval)
//   node tools/switch.mjs stop-off    stage lifting STOP (needs Jesse's code from the window)
//   node tools/switch.mjs test        stage a harmless test approval (the install proves the code flow works)
//   node tools/switch.mjs apply       carry out the one staged item Jesse approved
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stage, take } from "./lib/approval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STOP = path.join(ROOT, "state", "STOP");
const [sub] = process.argv.slice(2);

if (sub === "stop-on") {
  fs.mkdirSync(path.dirname(STOP), { recursive: true });
  if (!fs.existsSync(STOP)) fs.writeFileSync(STOP, `Set ${new Date().toISOString()}. Nothing goes out while this file exists. Jesse lifts it with: node tools/switch.mjs stop-off\n`);
  console.log("STOP is on: nothing goes out from this workspace.");
} else if (sub === "stop-off") {
  if (!fs.existsSync(STOP)) { console.log("STOP is already off."); process.exit(0); }
  stage(ROOT, "stop-off", "remove state/STOP in this workspace", "Lift STOP on Jesse's PC", "This lets this workspace act outside the PC again (still only what its rules and Jesse's yes allow). It will:");
} else if (sub === "test") {
  stage(ROOT, "test", "nothing (an install test)", "Install test", "This is only a test that your typed approvals work. Approving it changes:");
} else if (sub === "apply") {
  const item = take(ROOT, ["stop-off", "test"]);
  if (item.kind === "test") console.log(`Approval test: PASS (recorded from "${item.words}").`);
  else { fs.rmSync(STOP, { force: true }); console.log(`STOP lifted on Jesse's word ("${item.words}").`); }
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\nimport ")[0]);
}
