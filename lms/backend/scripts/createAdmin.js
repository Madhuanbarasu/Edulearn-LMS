#!/usr/bin/env node
/**
 * Secure admin bootstrap. There is no public admin registration; run this on the server instead.
 *
 *   cd lms/backend && npm run create-admin
 *
 * Inputs come from environment variables (ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD) or interactive prompts.
 * The password is never accepted as a command-line argument (it would land in shell history).
 * The script ONLY creates a new admin. It never edits, promotes, or deletes an existing account.
 */
require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { validateEmail, passwordMessage } = require("../utils/validators");

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write(""); };
    }
    rl.question(question, (a) => { rl.close(); if (hidden) process.stdout.write("\n"); resolve(a); });
  });
}

(async () => {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI is not set in backend/.env"); process.exit(1); }
  try {
    const name = (process.env.ADMIN_NAME || (await ask("Admin full name: "))).trim();
    const email = (process.env.ADMIN_EMAIL || (await ask("Admin email: "))).trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || (await ask("Admin password (hidden): ", { hidden: true }));
    if (!name) throw new Error("Name is required");
    const emailErr = validateEmail(email); if (emailErr) throw new Error(emailErr);
    const pwErr = passwordMessage(password); if (pwErr) throw new Error(pwErr);

    await mongoose.connect(process.env.MONGO_URI);
    const target = `${mongoose.connection.host}/${mongoose.connection.name}`;
    console.log(`Target database: ${target}`);
    if (process.env.ADMIN_CONFIRM !== "yes") {
      const ok = (await ask(`Create admin "${email}" in this database? Type "yes" to continue: `)).trim().toLowerCase();
      if (ok !== "yes") { console.log("Aborted. Nothing was changed."); await mongoose.disconnect(); return; }
    }
    if (await User.findOne({ email })) throw new Error("An account with that email already exists. Nothing was changed.");

    const admin = await User.create({ name, email, password, role: "admin", status: "active" });
    await AuditLog.create({ actor: admin._id, actorName: admin.name, action: "admin.bootstrap", targetType: "user", targetId: String(admin._id), summary: `Admin account created via bootstrap script for ${email}` });
    console.log(`Admin created: ${email}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error(`Failed: ${String(err.message).replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "<uri hidden>")}`);
    try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
    process.exit(1);
  }
})();
