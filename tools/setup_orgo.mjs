#!/usr/bin/env node
// Installs (or cleanly reinstalls) Orgo's own command-line tool into tools/.orgo, then proves it starts.
//   node tools/setup_orgo.mjs
// Safe to run again: it removes only tools/.orgo first, so a half-finished download can't linger
// (Nov 1: "one of its parts is missing a file, so the tool can't start"). Jesse can also run it himself in his
// own PowerShell window in this folder, if the chat isn't allowed to.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "tools", ".orgo");
const CLI = path.join(DIR, "node_modules", "orgo", "dist", "cli.js");
const VERSION = "2.3.0";
const win = process.platform === "win32";

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) { console.error(`Node ${process.versions.node} is too old; Orgo's tool needs 20 or newer. Install Node LTS (winget install --id OpenJS.NodeJS.LTS -e), restart the Claude app, then run this again.`); process.exit(1); }

// The only thing this removes: the tool's own folder inside this workspace.
if (path.relative(ROOT, DIR) !== path.join("tools", ".orgo")) { console.error("Refusing: unexpected install folder."); process.exit(1); }
if (fs.existsSync(DIR)) { fs.rmSync(DIR, { recursive: true, force: true }); console.log("Removed the old copy in tools/.orgo."); }
fs.mkdirSync(DIR, { recursive: true });

console.log(`Installing orgo@${VERSION} into tools/.orgo (a minute or two)...`);
// npm on Windows is npm.cmd, which Node only starts through a shell. Every argument here is fixed text.
const npm = spawnSync(win ? "npm.cmd" : "npm", ["install", "--prefix", DIR, `orgo@${VERSION}`, "--no-audit", "--no-fund", "--loglevel=error"], {
  cwd: ROOT, encoding: "utf8", shell: win, timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024,
});
if (npm.error || npm.status !== 0) {
  console.error(`The install didn't finish (${npm.error ? npm.error.message : `npm exited ${npm.status}`}).`);
  console.error(String(npm.stderr || "").split(/\r?\n/).filter(Boolean).slice(-8).join("\n"));
  console.error("Check the internet connection and run it again. If it fails twice, send Justin's team a screenshot of this.");
  process.exit(2);
}
if (!fs.existsSync(CLI)) { console.error("npm finished but tools/.orgo/node_modules/orgo/dist/cli.js is missing. Run this again; if it fails twice, tell Justin's team."); process.exit(3); }

const v = spawnSync(process.execPath, [CLI, "--version"], { encoding: "utf8", timeout: 60 * 1000 });
if (v.status !== 0) {
  console.error("Installed, but the tool doesn't start:");
  console.error(String(v.stderr || v.stdout || v.error?.message || "").split(/\r?\n/).filter(Boolean).slice(0, 6).join("\n"));
  process.exit(3);
}
console.log(`Orgo tool OK: ${String(v.stdout).trim()}`);
