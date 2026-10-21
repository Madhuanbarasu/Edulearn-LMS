const User = require("../models/User");
const Course = require("../models/Course");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const Attendance = require("../models/Attendance");
const AcademicOption = require("../models/AcademicOption");
const AuditLog = require("../models/AuditLog");
const { audit } = require("../utils/audit");
const { paging } = require("../middleware/validate");
const { isObjectId, isString, clean } = require("../utils/validators");
const { sameId } = require("../utils/access");
const reports = require("../services/reports");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fail = (res, code, message) => res.status(code).json({ message });
const serverError = (res, message) => (err) => { console.error(message); return res.status(500).json({ message }); };

// ---------------------------------------------------------------- overview
exports.overview = async (req, res) => {
  try {
    const [totalUsers, students, faculty, admins, pendingFaculty, disabled, courses, assignments, quizzes] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: "student" }), User.countDocuments({ role: "faculty" }), User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "faculty", status: "pending" }), User.countDocuments({ status: "disabled" }),
      Course.countDocuments(), Assignment.countDocuments(), Quiz.countDocuments(),
    ]);
    const pending = await User.find({ role: "faculty", status: "pending" }).sort({ createdAt: 1 }).limit(5);
    const recentActivity = await AuditLog.find().sort({ createdAt: -1 }).limit(8);
    res.json({
      counts: { totalUsers, students, faculty, admins, pendingFaculty, disabledUsers: disabled, courses, assignments, quizzes },
      pendingFaculty: pending, recentActivity,
    });
  } catch (e) { serverError(res, "Failed to load overview")(e); }
};

// ---------------------------------------------------------------- users
exports.listUsers = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const filter = {};
    if (isString(req.query.role) && ["student", "faculty", "admin"].includes(req.query.role)) filter.role = req.query.role;
    if (isString(req.query.status) && User.STATUSES.includes(req.query.status)) filter.status = req.query.status;
    if (isString(req.query.department) && req.query.department) filter.department = req.query.department;
    if (isString(req.query.q) && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), "i");
      filter.$or = [{ name: rx }, { email: rx }, { rollNumber: rx }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) { serverError(res, "Failed to load users")(e); }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "User not found");
    res.json(user);
  } catch (e) { serverError(res, "Failed to load user")(e); }
};

// Role and email are deliberately NOT editable here (no role escalation through the API).
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "User not found");
    const b = req.body || {};
    const changed = {};
    for (const f of ["name", "department", "academicYear", "studyYear", "section", "rollNumber"]) {
      if (b[f] === undefined) continue;
      if (!isString(b[f]) || (f === "name" && !b[f].trim())) return fail(res, 400, `Invalid ${f}`);
      const v = clean(b[f], f === "name" ? 100 : 100);
      if (user[f] !== v) { changed[f] = v; user[f] = v; }
    }
    await user.save();
    await audit(req, "user.update", { targetType: "user", targetId: user._id, summary: `Updated profile fields for ${user.email}`, meta: { fields: Object.keys(changed) } });
    res.json(user);
  } catch (e) { serverError(res, "Failed to update user")(e); }
};

exports.setUserStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "disabled"].includes(status)) return fail(res, 400, "Status must be 'active' or 'disabled'");
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "User not found");
    if (sameId(user._id, req.user._id)) return fail(res, 400, "You cannot change your own account status");
    if (user.role === "faculty" && user.status === "pending" && status === "active") return fail(res, 400, "Use the faculty approval action for pending faculty");
    const before = user.status || "active";
    user.status = status;
    await user.save();
    await audit(req, status === "disabled" ? "user.disable" : "user.enable", { targetType: "user", targetId: user._id, summary: `${before} -> ${status} for ${user.email}` });
    res.json(user);
  } catch (e) { serverError(res, "Failed to update status")(e); }
};

// ---------------------------------------------------------------- faculty approval
exports.listPendingFaculty = async (req, res) => {
  try { res.json(await User.find({ role: "faculty", status: "pending" }).sort({ createdAt: 1 })); }
  catch (e) { serverError(res, "Failed to load pending faculty")(e); }
};

const decide = (decision) => async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "faculty") return fail(res, 404, "Faculty registration not found");
    if (user.status !== "pending") return fail(res, 409, `This registration is already ${user.status || "active"}`);
    user.status = decision === "approve" ? "active" : "rejected";
    await user.save();
    await audit(req, `faculty.${decision}`, { targetType: "user", targetId: user._id, summary: `${decision === "approve" ? "Approved" : "Rejected"} faculty ${user.email}` });
    res.json(user);
  } catch (e) { serverError(res, "Failed to update registration")(e); }
};
exports.approveFaculty = decide("approve");
exports.rejectFaculty = decide("reject");

// ---------------------------------------------------------------- academic options
exports.listOptions = async (req, res) => {
  try {
    const filter = {};
    if (isString(req.query.type)) { if (!AcademicOption.TYPES.includes(req.query.type)) return fail(res, 400, "Invalid option type"); filter.type = req.query.type; }
    res.json(await AcademicOption.find(filter).sort({ type: 1, name: 1 }));
  } catch (e) { serverError(res, "Failed to load options")(e); }
};

exports.createOption = async (req, res) => {
  try {
    const { type, name } = req.body || {};
    if (!AcademicOption.TYPES.includes(type)) return fail(res, 400, "Invalid option type");
    if (!isString(name) || !name.trim() || name.trim().length > 100) return fail(res, 400, "A name (max 100 characters) is required");
    const opt = await AcademicOption.create({ type, name: name.trim() });
    await audit(req, "option.create", { targetType: "option", targetId: opt._id, summary: `Added ${type}: ${opt.name}` });
    res.status(201).json(opt);
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "That option already exists");
    serverError(res, "Failed to create option")(e);
  }
};

exports.updateOption = async (req, res) => {
  try {
    const opt = await AcademicOption.findById(req.params.id);
    if (!opt) return fail(res, 404, "Option not found");
    const { name, active } = req.body || {};
    if (name !== undefined) {
      if (!isString(name) || !name.trim() || name.trim().length > 100) return fail(res, 400, "Invalid name");
      // Renaming would orphan existing references, so it is only allowed while unused.
      if (name.trim() !== opt.name && (await optionInUse(opt)) > 0) return fail(res, 409, "This option is in use and cannot be renamed. Deactivate it and add a new one instead.");
      opt.name = name.trim();
    }
    if (active !== undefined) { if (typeof active !== "boolean") return fail(res, 400, "active must be true or false"); opt.active = active; }
    await opt.save();
    await audit(req, "option.update", { targetType: "option", targetId: opt._id, summary: `Updated ${opt.type}: ${opt.name} (active=${opt.active})` });
    res.json(opt);
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "That option already exists");
    serverError(res, "Failed to update option")(e);
  }
};

async function optionInUse(opt) {
  const q = { [opt.type]: opt.name };
  const [u, c] = await Promise.all([User.countDocuments(q), Course.countDocuments(q)]);
  return u + c;
}

exports.deleteOption = async (req, res) => {
  try {
    const opt = await AcademicOption.findById(req.params.id);
    if (!opt) return fail(res, 404, "Option not found");
    if ((await optionInUse(opt)) > 0) return fail(res, 409, "This option is in use by users or courses. Deactivate it instead of deleting.");
    await AcademicOption.findByIdAndDelete(opt._id);
    await audit(req, "option.delete", { targetType: "option", targetId: opt._id, summary: `Deleted unused ${opt.type}: ${opt.name}` });
    res.json({ message: "Option deleted" });
  } catch (e) { serverError(res, "Failed to delete option")(e); }
};

// ---------------------------------------------------------------- courses: allocation + enrollment
exports.listCourses = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query);
    const filter = {};
    for (const f of ["department", "academicYear", "studyYear", "section"]) if (isString(req.query[f]) && req.query[f]) filter[f] = req.query[f];
    if (isObjectId(req.query.faculty)) filter.faculty = req.query.faculty;
    if (isString(req.query.q) && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), "i");
      filter.$or = [{ title: rx }, { code: rx }];
    }
    const [courses, total] = await Promise.all([
      Course.find(filter).select("-materials").populate("faculty", "name email department").sort({ code: 1 }).skip(skip).limit(limit),
      Course.countDocuments(filter),
    ]);
    res.json({ courses: courses.map((c) => ({ ...c.toObject(), studentCount: c.students.length })), total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) { serverError(res, "Failed to load courses")(e); }
};

exports.allocateFaculty = async (req, res) => {
  try {
    const { facultyId } = req.body || {};
    if (!isObjectId(facultyId)) return fail(res, 400, "A valid faculty id is required");
    const [course, fac] = await Promise.all([Course.findById(req.params.id), User.findById(facultyId)]);
    if (!course) return fail(res, 404, "Course not found");
    if (!fac || fac.role !== "faculty") return fail(res, 400, "Selected user is not a faculty member");
    if ((fac.status || "active") !== "active") return fail(res, 400, "Faculty account is not active");
    const previous = course.faculty;
    if (sameId(previous, fac._id)) return res.json(course);
    course.faculty = fac._id;
    await course.save();
    // Keep the denormalised teachingCourses lists consistent on both sides.
    await User.findByIdAndUpdate(previous, { $pull: { teachingCourses: course._id } });
    await User.findByIdAndUpdate(fac._id, { $addToSet: { teachingCourses: course._id } });
    await audit(req, "course.allocate", { targetType: "course", targetId: course._id, summary: `Allocated ${course.code} to ${fac.email}`, meta: { previousFaculty: String(previous) } });
    res.json(course);
  } catch (e) { serverError(res, "Failed to allocate faculty")(e); }
};

exports.getRoster = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).select("-materials").populate("faculty", "name email").populate("students", "name email rollNumber department academicYear studyYear section");
    if (!course) return fail(res, 404, "Course not found");
    res.json(course);
  } catch (e) { serverError(res, "Failed to load roster")(e); }
};

exports.enrollStudents = async (req, res) => {
  try {
    const { studentIds } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > 200 || !studentIds.every(isObjectId)) {
      return fail(res, 400, "Provide between 1 and 200 valid student ids");
    }
    const course = await Course.findById(req.params.id);
    if (!course) return fail(res, 404, "Course not found");
    const students = await User.find({ _id: { $in: studentIds }, role: "student" });
    const eligible = students.filter((s) => (s.status || "active") === "active");
    const ids = eligible.map((s) => s._id);
    if (ids.length) {
      await Course.findByIdAndUpdate(course._id, { $addToSet: { students: { $each: ids } } });
      await User.updateMany({ _id: { $in: ids } }, { $addToSet: { enrolledCourses: course._id } });
      await audit(req, "enrollment.add", { targetType: "course", targetId: course._id, summary: `Enrolled ${ids.length} student(s) in ${course.code}`, meta: { studentIds: ids.map(String) } });
    }
    res.json({ enrolled: ids.length, skipped: studentIds.length - ids.length });
  } catch (e) { serverError(res, "Failed to enroll students")(e); }
};

exports.unenrollStudent = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return fail(res, 404, "Course not found");
    await Course.findByIdAndUpdate(course._id, { $pull: { students: req.params.studentId } });
    await User.findByIdAndUpdate(req.params.studentId, { $pull: { enrolledCourses: course._id } });
    await audit(req, "enrollment.remove", { targetType: "course", targetId: course._id, summary: `Removed student ${req.params.studentId} from ${course.code}` });
    res.json({ message: "Student removed from course" });
  } catch (e) { serverError(res, "Failed to remove student")(e); }
};

// ---------------------------------------------------------------- reports
exports.reportSummary = async (req, res) => {
  try {
    const users = await User.find().select("role status").lean();
    const [courses, assignments, submissions, quizzes, attempts, sessions] = await Promise.all([
      Course.find().select("students").lean(), Assignment.countDocuments(), Submission.countDocuments(), Quiz.countDocuments(), QuizAttempt.countDocuments(),
      Attendance.find().select("records.status").lean(),
    ]);
    res.json({
      usersByRole: reports.countBy(users, (u) => u.role),
      usersByStatus: reports.countBy(users, (u) => u.status || "active"),
      courses: courses.length,
      totalEnrollments: courses.reduce((n, c) => n + (c.students || []).length, 0),
      assignments, submissions, quizzes, quizAttempts: attempts,
      attendance: reports.attendanceRollup(sessions),
    });
  } catch (e) { serverError(res, "Failed to build report")(e); }
};

exports.reportCourses = async (req, res) => {
  try {
    const courses = await Course.find().select("-materials").populate("faculty", "name").sort({ code: 1 }).lean();
    const ids = courses.map((c) => c._id);
    const [assignments, quizzes, sessions] = await Promise.all([
      Assignment.find({ course: { $in: ids } }).select("course").lean(),
      Quiz.find({ course: { $in: ids } }).select("course").lean(),
      Attendance.find({ course: { $in: ids } }).select("course records.status").lean(),
    ]);
    const rows = courses.map((c) => {
      const mine = sessions.filter((s) => sameId(s.course, c._id));
      return {
        _id: c._id, code: c.code, title: c.title, faculty: c.faculty?.name || null,
        department: c.department, academicYear: c.academicYear, studyYear: c.studyYear, section: c.section,
        students: (c.students || []).length,
        assignments: assignments.filter((a) => sameId(a.course, c._id)).length,
        quizzes: quizzes.filter((q) => sameId(q.course, c._id)).length,
        attendanceSessions: mine.length, attendancePercentage: reports.attendanceRollup(mine).percentage,
      };
    });
    res.json(rows);
  } catch (e) { serverError(res, "Failed to build report")(e); }
};

exports.reportAttendance = async (req, res) => {
  try {
    const filter = {};
    if (req.query.courseId !== undefined) { if (!isObjectId(req.query.courseId)) return fail(res, 400, "Invalid course id"); filter.course = req.query.courseId; }
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return fail(res, 400, "Invalid date range");
    if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const threshold = Math.min(100, Math.max(0, Number(req.query.threshold) || 75));

    const sessions = await Attendance.find(filter).lean();
    const courses = await Course.find(filter.course ? { _id: filter.course } : {}).select("code title").sort({ code: 1 }).lean();
    const byCourse = courses.map((c) => ({ course: { _id: c._id, code: c.code, title: c.title }, ...reports.attendanceRollup(sessions.filter((s) => sameId(s.course, c._id))) }));
    const out = { threshold, courses: byCourse };
    if (filter.course) {
      const low = reports.lowAttendance(sessions, threshold);
      const users = await User.find({ _id: { $in: low.map((l) => l.student) } }).select("name rollNumber").lean();
      const byId = Object.fromEntries(users.map((u) => [String(u._id), u]));
      out.belowThreshold = low.map((l) => ({ ...l, student: byId[String(l.student)] || { _id: l.student } }));
    }
    res.json(out);
  } catch (e) { serverError(res, "Failed to build report")(e); }
};

exports.reportAssignments = async (req, res) => {
  try {
    const courses = await Course.find().select("code title").sort({ code: 1 }).lean();
    const assignments = await Assignment.find().select("course maxMarks").lean();
    const submissions = await Submission.find().select("assignment status isLate marksObtained").lean();
    const aCourse = Object.fromEntries(assignments.map((a) => [String(a._id), String(a.course)]));
    const rows = courses.map((c) => {
      const as = assignments.filter((a) => sameId(a.course, c._id));
      const subs = submissions.filter((s) => aCourse[String(s.assignment)] === String(c._id));
      return { course: { _id: c._id, code: c.code, title: c.title }, ...reports.assignmentRollup(as, subs) };
    });
    res.json(rows);
  } catch (e) { serverError(res, "Failed to build report")(e); }
};

// ---------------------------------------------------------------- audit log
exports.listAuditLogs = async (req, res) => {
  try {
    const { page, limit, skip } = paging(req.query, 50, 200);
    const filter = {};
    if (isString(req.query.action) && /^[a-z]+(\.[a-z]+)?$/.test(req.query.action)) filter.action = req.query.action;
    if (isObjectId(req.query.actor)) filter.actor = req.query.actor;
    const [logs, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), AuditLog.countDocuments(filter)]);
    res.json({ logs, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (e) { serverError(res, "Failed to load audit logs")(e); }
};
