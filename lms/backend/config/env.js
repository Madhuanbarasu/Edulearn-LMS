"use strict";
/**
 * Central environment validation. Never logs secret values.
 */
const isProd = () => process.env.NODE_ENV === "production";

function allowedOrigins() {
  const raw = process.env.CLIENT_URL || (isProd() ? "" : "http://localhost:5173");
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .filter((o) => o !== "*");
}

function validateEnv() {
  const problems = [];
  if (!process.env.MONGO_URI) problems.push("MONGO_URI is not set");
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32) problems.push("JWT_SECRET must be set and at least 32 characters long");
  if (/change_this|replace_with|secret$/i.test(secret)) problems.push("JWT_SECRET still looks like a placeholder");
  if (allowedOrigins().length === 0) problems.push("CLIENT_URL must list at least one explicit origin (no wildcard)");
  if (process.env.CLIENT_URL && process.env.CLIENT_URL.trim() === "*") problems.push("CLIENT_URL must not be '*'");
  return problems;
}

module.exports = { validateEnv, allowedOrigins, isProd };
