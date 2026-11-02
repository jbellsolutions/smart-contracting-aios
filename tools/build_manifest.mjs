#!/usr/bin/env node
// Refresh manifest.json's agents, skills, routines and projects from agents/, routines/, skills/ and projects/.
// Run after adding or renaming a charter, routine or skill: node tools/build_manifest.mjs
// The manifest's other fields (name, description, platform, owner...) are kept as they are.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const ls = (d, re) => (fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter((f) => re.test(f)).sort() : []);
const mpath = path.join(ROOT, "manifest.json");
const man = fs.existsSync(mpath) ? JSON.parse(fs.readFileSync(mpath, "utf8")) : { schema_version: 1 };
const account = Object.keys(man.accounts || { business: {} })[0];
const roles = {}; const byName = {};
for (const f of ls("agents", /^\d\d-.+\.md$/)) {
  const [num, ...rest] = f.replace(/\.md$/, "").split("-"); const role = rest.join("-"); const t = rd("agents", f);
  const name = ((t.match(/\*\*Bot name:\*\*\s*([^·\n]+)/) || [])[1] || role).trim();
  const ms = ((t.match(/\*\*Milestone:\*\*\s*([^·\n]+)/) || [])[1] || "later").trim();
  const acct = /\*\*Subagent:\*\*\s*no\b/i.test(t) && man.accounts && Object.keys(man.accounts)[1] ? Object.keys(man.accounts)[1] : account;
  roles[role] = { name, charter: `agents/${f}`, account: acct, milestone: ms, routines: [], skills: [], reserved: Number(num) >= 90, text: t };
  byName[name.toLowerCase()] = role;
}
for (const f of ls("routines", /\.prompt$/)) {
  const owner = ((rd("routines", f).match(/^OWNER:\s*(.+)$/m) || [])[1] || "").trim().toLowerCase();
  const role = roles[owner] ? owner : byName[owner];
  if (role) roles[role].routines.push(`routines/${f}`); else console.log(`routine ${f}: OWNER '${owner}' matches no charter`);
}
const skills = ls("skills", /^[\w-]+$/).filter((d) => fs.existsSync(path.join(ROOT, "skills", d, "SKILL.md"))).map((d) => {
  const n = ((rd("skills", d, "SKILL.md").match(/^name:\s*(.+)$/m) || [])[1] || d).trim();
  return { name: n, path: `skills/${d}` };
});
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const v of Object.values(roles)) {
  v.skills = [...new Set(skills.filter((s) => new RegExp("`" + esc(s.name) + "`|" + esc(s.path) + "/").test(v.text)).map((s) => s.name))].sort();
}
const all = Object.values(roles);
man.agents = all.filter((v) => !v.reserved).map(({ name, charter, account, milestone, routines, skills }) => ({ name, charter, account, milestone, routines, skills }));
man.reserved_agents = all.filter((v) => v.reserved).map(({ name, charter }) => ({ name, charter }));
man.skills = skills;
man.projects = ls("projects", /^[\w-]+$/).filter((d) => fs.existsSync(path.join(ROOT, "projects", d, "SPEC.md"))).map((d) => `projects/${d}/SPEC.md`);
fs.writeFileSync(mpath, JSON.stringify(man, null, 2) + "\n");
const used = new Set(man.agents.flatMap((a) => a.skills));
console.log(`agents ${man.agents.length}, reserved ${man.reserved_agents.length}, skills ${skills.length}, routines ${man.agents.reduce((n, a) => n + a.routines.length, 0)}; unclaimed skills: ${skills.filter((s) => !used.has(s.name)).map((s) => s.name).join(", ") || "none"}`);
