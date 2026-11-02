const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AcademicOption = require("../models/AcademicOption");
const { effectiveStatus, STATUS_MESSAGES } = require("../middleware/auth");
const { validateEmail, passwordMessage, isString, clean } = require("../utils/validators");

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d", algorithm: "HS256" });

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const publicUser = (u) => ({
  _id: u._id, name: u.name, email: u.email, role: u.role, status: effectiveStatus(u),
  rollNumber: u.rollNumber, department: u.department, academicYear: u.academicYear, studyYear: u.studyYear, section: u.section,
});

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department, academicYear, studyYear, section } = req.body || {};
    if (!isString(name) || !name.trim() || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (name.trim().length > 100) return res.status(400).json({ message: "Name is too long" });
    const emailErr = validateEmail(email);
    if (emailErr) return res.status(400).json({ message: emailErr });
    const pwErr = passwordMessage(password);
    if (pwErr) return res.status(400).json({ message: pwErr });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Self-registration can only ever create student or faculty. Anything else (incl. "admin") becomes student.
    const safeRole = role === "faculty" ? "faculty" : "student";
    const status = safeRole === "faculty" ? "pending" : "active";

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: safeRole,
      status,
      rollNumber: safeRole === "student" ? clean(rollNumber, 50) || undefined : undefined,
      department: clean(department, 100) || undefined,
      academicYear: clean(academicYear, 50) || undefined,
      studyYear: clean(studyYear, 50) || undefined,
      section: clean(section, 50) || undefined,
    });

    if (status === "pending") {
      // No token: pending faculty cannot enter the app until an admin approves them.
      return res.status(201).json({
        _id: user._id, name: user.name, email: user.email, role: user.role, status,
        message: "Registration received. An administrator must approve your faculty account before you can sign in.",
      });
    }
    return res.status(201).json({ ...publicUser(user), token: genToken(user._id) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Email already registered" });
    return res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isString(email) || !isString(password) || !email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
    const ok = user ? await user.comparePassword(password) : (await bcrypt.compare(password, DUMMY_HASH), false);
    if (!user || !ok) return res.status(401).json({ message: "Invalid email or password" });

    const status = effectiveStatus(user);
    if (status !== "active") {
      return res.status(403).json({ message: STATUS_MESSAGES[status] || "Account not active", code: `ACCOUNT_${status.toUpperCase()}`, status });
    }
    return res.json({ ...publicUser(user), token: genToken(user._id) });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Login failed. Please try again." });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};

// Only these fields are editable. role / status / email are never taken from the client here.
exports.updateProfile = async (req, res) => {
  try {
    const { name, department, rollNumber, academicYear, studyYear, section } = req.body || {};
    const user = await User.findById(req.user._id);
    if (name !== undefined) {
      if (!isString(name) || !name.trim() || name.trim().length > 100) return res.status(400).json({ message: "A valid name is required" });
      user.name = name.trim();
    }
    if (department !== undefined) { if (!isString(department)) return res.status(400).json({ message: "Invalid department" }); user.department = clean(department, 100); }
    if (user.role === "student") {
      if (rollNumber !== undefined) { if (!isString(rollNumber)) return res.status(400).json({ message: "Invalid roll number" }); user.rollNumber = clean(rollNumber, 50); }
      for (const [k, v] of Object.entries({ academicYear, studyYear, section })) {
        if (v !== undefined) { if (!isString(v)) return res.status(400).json({ message: `Invalid ${k}` }); user[k] = clean(v, 50); }
      }
    }
    await user.save();
    res.json(user.toObject({ transform: (d, ret) => { delete ret.password; return ret; } }));
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!isString(currentPassword) || !isString(newPassword) || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    const pwErr = passwordMessage(newPassword);
    if (pwErr) return res.status(400).json({ message: pwErr });
    if (currentPassword === newPassword) return res.status(400).json({ message: "New password must be different from the current password" });
    user.password = newPassword; // hashed by pre-save hook; also bumps passwordChangedAt
    await user.save();
    // Fresh token so this session continues; older tokens are invalidated.
    res.json({ message: "Password updated", token: genToken(user._id) });
  } catch (err) {
    res.status(500).json({ message: "Failed to change password" });
  }
};

// Public, read-only: active academic options for the registration form.
exports.getPublicOptions = async (req, res) => {
  try {
    const opts = await AcademicOption.find({ active: true }).sort({ name: 1 });
    const grouped = { department: [], academicYear: [], studyYear: [], section: [] };
    opts.forEach((o) => grouped[o.type].push(o.name));
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: "Failed to load options" });
  }
};
