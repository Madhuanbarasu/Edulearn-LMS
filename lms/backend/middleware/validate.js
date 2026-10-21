const { isObjectId } = require("../utils/validators");

/** Use with router.param('id', validateIdParam) to reject malformed ObjectIds with 400 (not 500). */
const validateIdParam = (req, res, next, value, name) => {
  if (!isObjectId(String(value))) return res.status(400).json({ message: `Invalid ${name || "id"}` });
  next();
};

/** Reject Mongo operator injection ($-prefixed or dotted keys) anywhere in body/query/params. */
function hasUnsafeKeys(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 12) return false;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) return true;
    if (hasUnsafeKeys(obj[key], depth + 1)) return true;
  }
  return false;
}
const sanitizeRequest = (req, res, next) => {
  if (hasUnsafeKeys(req.body) || hasUnsafeKeys(req.query) || hasUnsafeKeys(req.params)) {
    return res.status(400).json({ message: "Invalid characters in request" });
  }
  next();
};

/** Parse ?page & ?limit safely. */
function paging(query, defLimit = 25, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { validateIdParam, sanitizeRequest, hasUnsafeKeys, paging };
