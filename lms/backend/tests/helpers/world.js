"use strict";
const crypto = require("crypto");
// Test-only configuration. No real secrets or databases are involved.
delete process.env.MONGO_URI;
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
process.env.CLIENT_URL = "http://localhost:5173";
process.env.RATE_LIMIT_DISABLED = "true";
process.env.NODE_ENV = "test";

const mem = require("./memoryDb");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
["User", "Course", "Assignment", "Submission", "Quiz", "QuizAttempt", "QuizStart", "Attendance", "ForumPost", "AcademicOption", "AuditLog"].forEach((m) => require(`../../models/${m}`));
mem.install();
const app = require("../../app");

// Tests must never leave uploaded files behind: remove anything created in uploads/ during this process.
const fs = require("fs");
const path = require("path");
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
const preExisting = new Set(fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []);
process.on("exit", () => {
  try { fs.readdirSync(uploadsDir).filter((f) => !preExisting.has(f)).forEach((f) => fs.rmSync(path.join(uploadsDir, f), { force: true })); } catch (e) { /* ignore */ }
});
const { User, Course, Assignment, Quiz } = mongoose.models;

const PASSWORD = "Test1234pass";

async function startServer() {
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { token, body, form, headers = {} } = {}) => {
    const h = { ...headers };
    let payload;
    if (token) h.Authorization = `Bearer ${token}`;
    if (form) payload = form;
    else if (body !== undefined) { h["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(base + path, { method, headers: h, body: payload });
    let json = null;
    const text = await res.text();
    try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: res.status, body: json, headers: res.headers };
  };
  return { server, base, call, close: () => new Promise((r) => server.close(r)) };
}

const tokenFor = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });

async function mkUser(over = {}) {
  const n = crypto.randomBytes(4).toString("hex");
  const u = await User.create({ name: `User ${n}`, email: `u${n}@test.edu`, password: PASSWORD, role: "student", status: "active", ...over });
  return Object.assign(u, { token: tokenFor(u) });
}

/** Standard fixture: 1 admin, 2 active faculty, 1 pending faculty, 3 students, 2 courses. */
async function seedWorld() {
  mem.reset();
  const admin = await mkUser({ role: "admin", name: "Admin" });
  const facA = await mkUser({ role: "faculty", name: "Faculty A" });
  const facB = await mkUser({ role: "faculty", name: "Faculty B" });
  const facPending = await mkUser({ role: "faculty", status: "pending", name: "Pending Fac" });
  const s1 = await mkUser({ name: "Student One", rollNumber: "R1" });
  const s2 = await mkUser({ name: "Student Two", rollNumber: "R2" });
  const s3 = await mkUser({ name: "Student Three", rollNumber: "R3" });
  const c1 = await Course.create({ title: "Maths", code: "MA101", faculty: facA._id, students: [s1._id, s2._id] });
  const c2 = await Course.create({ title: "Physics", code: "PH101", faculty: facB._id, students: [s3._id] });
  await User.findByIdAndUpdate(facA._id, { $addToSet: { teachingCourses: c1._id } });
  await User.findByIdAndUpdate(facB._id, { $addToSet: { teachingCourses: c2._id } });
  await User.updateMany({ _id: { $in: [s1._id, s2._id] } }, { $addToSet: { enrolledCourses: c1._id } });
  await User.findByIdAndUpdate(s3._id, { $addToSet: { enrolledCourses: c2._id } });
  return { admin, facA, facB, facPending, s1, s2, s3, c1, c2 };
}

const hours = (h) => new Date(Date.now() + h * 3600 * 1000);

module.exports = { startServer, seedWorld, mkUser, tokenFor, PASSWORD, hours, mem, models: mongoose.models, jwt };
