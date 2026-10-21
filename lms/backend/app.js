const express = require("express");
const { corsMiddleware, helmetMiddleware, apiLimiter } = require("./middleware/security");
const { sanitizeRequest } = require("./middleware/validate");
const { notFound, errorHandler } = require("./middleware/error");
const { legacyBlocked } = require("./controllers/fileController");

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

app.use(helmetMiddleware());
app.use(corsMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(sanitizeRequest);

// Uploaded files are NOT served statically: access goes through authorised, short-lived links.
app.use("/uploads", legacyBlocked);

app.use("/api", apiLimiter);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/courses", require("./routes/courseRoutes"));
app.use("/api/assignments", require("./routes/assignmentRoutes"));
app.use("/api/quizzes", require("./routes/quizRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/forum", require("./routes/forumRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/files", require("./routes/fileRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

app.get("/", (req, res) => res.send("LMS API is running"));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
