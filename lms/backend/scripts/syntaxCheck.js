// Static syntax check: `node --check` on every backend source file.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const skip = new Set(["node_modules", "uploads", ".git"]);
let failed = 0, count = 0;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(f.name)) continue;
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (f.name.endsWith(".js")) {
      count++;
      try { execFileSync(process.execPath, ["--check", full], { stdio: "pipe" }); }
      catch (e) { failed++; console.error("SYNTAX ERROR:", full, "\n", e.stderr.toString()); }
    }
  }
})(root);
console.log(`Checked ${count} files, ${failed} failed`);
process.exit(failed ? 1 : 0);
