const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Legacy users have no `status`; treat that as active so existing accounts keep working.
const effectiveStatus = (u) => u.status || "active";

const STATUS_MESSAGES = {
  pending: "Your account is pending administrator approval.",
  rejected: "Your registration was not approved. Please contact an administrator.",
  disabled: "Your account has been disabled. Please contact an administrator.",
};

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+\S+$/.test(authHeader)) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
  try {
    const token = authHeader.split(/\s+/)[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (decoded.purpose) return res.status(401).json({ message: "Not authorized, token failed" });
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    // Tokens issued before a password change are rejected.
    if (user.passwordChangedAt && decoded.iat && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return res.status(401).json({ message: "Session expired, please sign in again" });
    }
    const status = effectiveStatus(user);
    if (status !== "active") {
      return res.status(403).json({ message: STATUS_MESSAGES[status] || "Account not active", code: `ACCOUNT_${status.toUpperCase()}`, status });
    }
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to perform this action" });
  }
  next();
};

module.exports = { protect, authorize, effectiveStatus, STATUS_MESSAGES };
