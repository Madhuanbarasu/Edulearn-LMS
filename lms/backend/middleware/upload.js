const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".zip", ".png", ".jpg", ".jpeg", ".webp"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Server-generated name: original filename is never used on disk.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const uploadError = (msg) => Object.assign(new Error(msg), { isUploadError: true });

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);
  cb(uploadError(`File type ${ext || "unknown"} is not allowed. Allowed types: PDF, Word, PowerPoint, TXT, ZIP, Images.`), false);
};

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024, files: 1 }, fileFilter });

// Magic-number signatures keyed by extension. OOXML (docx/pptx) are ZIP containers; legacy doc/ppt are OLE2.
const SIG = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]],
  ".zip": [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06]],
  ".docx": [[0x50, 0x4b, 0x03, 0x04]],
  ".pptx": [[0x50, 0x4b, 0x03, 0x04]],
  ".doc": [[0xd0, 0xcf, 0x11, 0xe0]],
  ".ppt": [[0xd0, 0xcf, 0x11, 0xe0]],
};

function contentMatchesExtension(filePath, ext) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    if (ext === ".txt") {
      const sample = Buffer.alloc(4096);
      const m = fs.readSync(fd, sample, 0, 4096, 0);
      return !sample.subarray(0, m).includes(0); // plain text must not contain NUL bytes
    }
    const sigs = SIG[ext];
    if (!sigs) return false;
    return sigs.some((sig) => n >= sig.length && sig.every((b, i) => buf[i] === b));
  } finally {
    fs.closeSync(fd);
  }
}

/** Run after multer: rejects (and deletes) files whose content does not match their extension. */
const verifyUpload = (req, res, next) => {
  if (!req.file) return next();
  const ext = path.extname(req.file.filename).toLowerCase();
  let ok = false;
  try { ok = contentMatchesExtension(req.file.path, ext); } catch (e) { ok = false; }
  if (!ok) {
    fs.unlink(req.file.path, () => {});
    req.file = undefined;
    return res.status(400).json({ message: "File content does not match its type" });
  }
  next();
};

/** Remove an uploaded file when the request is later rejected, so no orphans pile up. */
const discardUpload = (req) => { if (req.file) fs.unlink(req.file.path, () => {}); };

module.exports = upload;
module.exports.verifyUpload = verifyUpload;
module.exports.discardUpload = discardUpload;
module.exports.uploadDir = uploadDir;
module.exports.contentMatchesExtension = contentMatchesExtension;
