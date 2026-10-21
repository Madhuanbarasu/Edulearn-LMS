const AuditLog = require("../models/AuditLog");

/** Best-effort audit write: a logging failure must never break the admin action itself. */
async function audit(req, action, { targetType, targetId, summary, meta } = {}) {
  try {
    await AuditLog.create({
      actor: req.user._id,
      actorName: req.user.name,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      summary,
      meta,
      ip: req.ip,
    });
  } catch (err) {
    console.error("Audit log write failed");
  }
}
module.exports = { audit };
