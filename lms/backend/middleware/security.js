const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { allowedOrigins } = require("../config/env");

const corsMiddleware = () => {
  const origins = allowedOrigins();
  return cors({
    origin(origin, cb) {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
};

// API only serves JSON/files, so a strict CSP is safe here.
const helmetMiddleware = () =>
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
  });

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
    skip: () => process.env.RATE_LIMIT_DISABLED === "true",
  });

const authLimiter = make(15 * 60 * 1000, Number(process.env.AUTH_RATE_LIMIT_MAX) || 20, "Too many attempts. Please try again in a few minutes.");
const apiLimiter = make(60 * 1000, Number(process.env.API_RATE_LIMIT_MAX) || 300, "Too many requests. Please slow down.");

module.exports = { corsMiddleware, helmetMiddleware, authLimiter, apiLimiter };
