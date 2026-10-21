const path = require("path");
const fs = require("fs");
const Course = require("../models/Course");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { uploadDir } = require("../middleware/upload");
const { isCourseMember, canManageCourse, sameId } = require("../utils/access");
const { signFileToken, verifyFileToken, TTL_SECONDS } = require("../utils/fileTokens");

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

/** Decide whether `user` may read the stored file. Returns true/false, or null if no record references it. */
async function userMayReadFile(user, filename) {
  const url = `/uploads/${filename}`;

  const courseWithMaterial = await Course.findOne({ "materials.fileUrl": url });
  if (courseWithMaterial) return isCourseMember(user, courseWithMaterial);

  const assignment = await Assignment.findOne({ attachmentUrl: url });
  if (assignment) {
    const course = await Course.findById(assignment.course);
    return !!course && isCourseMember(user, course);
  }

  const submission = await Submission.findOne({ fileUrl: url });
  if (submission) {
    if (sameId(submission.student, user._id)) return true;
    const a = await Assignment.findById(submission.assignment);
    const course = a && (await Course.findById(a.course));
    return !!course && canManageCourse(user, course);
  }
  return null;
}

// Step 1 (authenticated): ask for access to a file; receive a short-lived link.
exports.requestAccess = async (req, res) => {
  try {
    const raw = typeof req.query.name === "string" ? req.query.name : "";
    const filename = path.basename(raw.replace(/^\/?uploads\//, ""));
    if (!SAFE_NAME.test(filename)) return res.status(400).json({ message: "Invalid file name" });
    const allowed = await userMayReadFile(req.user, filename);
    if (allowed === null) return res.status(404).json({ message: "File not found" });
    if (!allowed) return res.status(403).json({ message: "You do not have access to this file" });
    const token = signFileToken(req.user._id, filename);
    res.json({ url: `/api/files/download/${token}`, expiresInSeconds: TTL_SECONDS });
  } catch (err) {
    res.status(500).json({ message: "Failed to prepare file access" });
  }
};

// Step 2: the token itself proves identity + file; it is bound to one file and expires quickly.
exports.download = (req, res) => {
  let claims;
  try { claims = verifyFileToken(req.params.token); } catch (e) { return res.status(401).json({ message: "Link expired or invalid" }); }
  const filename = path.basename(String(claims.f || ""));
  if (!SAFE_NAME.test(filename)) return res.status(400).json({ message: "Invalid file name" });
  const full = path.join(uploadDir, filename);
  if (!fs.existsSync(full)) return res.status(404).json({ message: "File not found" });
  res.setHeader("Cache-Control", "private, no-store");
  res.download(full, filename, { dotfiles: "deny" });
};

// Legacy public path: no longer served statically.
exports.legacyBlocked = (req, res) =>
  res.status(403).json({ message: "Files are protected. Open them from the course page while signed in." });

exports.userMayReadFile = userMayReadFile;
