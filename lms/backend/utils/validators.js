"use strict";
const mongoose = require("mongoose");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isObjectId = (v) => typeof v === "string" && /^[a-fA-F0-9]{24}$/.test(v) && mongoose.isValidObjectId(v);
const isString = (v) => typeof v === "string";
const clean = (v, max = 200) => (isString(v) ? v.trim().slice(0, max) : "");

function validateEmail(email) {
  if (!isString(email)) return "Email is required";
  const e = email.trim();
  if (e.length > 254 || !EMAIL_RE.test(e)) return "Please provide a valid email address";
  return null;
}

/** Returns an array of unmet-rule messages (empty array = strong enough). */
function passwordProblems(pw) {
  const p = [];
  if (!isString(pw)) return ["Password is required"];
  if (pw.length < 8) p.push("at least 8 characters");
  if (pw.length > 128) p.push("at most 128 characters");
  if (!/[a-z]/.test(pw)) p.push("a lowercase letter");
  if (!/[A-Z]/.test(pw)) p.push("an uppercase letter");
  if (!/[0-9]/.test(pw)) p.push("a number");
  return p;
}
const passwordMessage = (pw) => {
  const p = passwordProblems(pw);
  return p.length ? `Password needs: ${p.join(", ")}` : null;
};

function isFiniteNumber(v) {
  return typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
}

function parseDate(v) {
  if (v === undefined || v === null || v === "") return null;
  if (!(isString(v) || typeof v === "number" || v instanceof Date)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = {
  EMAIL_RE, isObjectId, isString, clean, validateEmail, passwordProblems, passwordMessage, isFiniteNumber, parseDate,
};
