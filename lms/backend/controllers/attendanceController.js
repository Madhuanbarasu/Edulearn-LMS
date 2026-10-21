const Attendance = require("../models/Attendance");
const { loadCourseFor, sameId, canManageCourse, isEnrolled } = require("../utils/access");
const { isObjectId } = require("../utils/validators");
const policies = require("../services/policies");
const Course = require("../models/Course");

const percentage = (present, total) => (total > 0 ? ((present / total) * 100).toFixed(2) : "0.00");

exports.markAttendance = async (req, res) => {
  try {
    const { course, date, records } = req.body || {};
    if (!isObjectId(course) || !date || !records) return res.status(400).json({ message: "Course, date, and records are required" });
    const courseDoc = await loadCourseFor(req, res, course, "manage", "Only the allocated faculty can mark attendance");
    if (!courseDoc) return;

    const checked = policies.validateAttendanceInput({ date, records }, courseDoc.students);
    if (checked.error) return res.status(400).json({ message: checked.error });

    // One document per course per day (unique index). Re-saving the same day by the allocated faculty/admin updates it.
    const attendance = await Attendance.findOneAndUpdate(
      { course: courseDoc._id, date: checked.date },
      { course: courseDoc._id, date: checked.date, markedBy: req.user._id, records: checked.records },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(attendance);
  } catch (err) {
    res.status(500).json({ message: "Failed to mark attendance" });
  }
};

exports.getAttendanceForCourse = async (req, res) => {
  try {
    const course = await loadCourseFor(req, res, req.params.courseId, "member");
    if (!course) return;
    const sessions = await Attendance.find({ course: course._id }).populate("records.student", "name rollNumber").sort({ date: -1 });
    if (req.user.role !== "student") return res.json(sessions);

    // Students only ever receive their own entry in each session (same response shape).
    const mine = sessions
      .map((s) => {
        const o = s.toObject();
        o.records = o.records.filter((r) => sameId(r.student?._id || r.student, req.user._id));
        return o;
      })
      .filter((s) => s.records.length > 0);
    res.json(mine);
  } catch (err) {
    res.status(500).json({ message: "Failed to load attendance" });
  }
};

exports.getStudentAttendanceSummary = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role === "student") {
      if (!sameId(req.user._id, studentId)) return res.status(403).json({ message: "Not authorized to view other students' attendance" });
      if (!isEnrolled(req.user, course)) return res.status(403).json({ message: "You are not enrolled in this course" });
    } else if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ message: "You do not have access to this course" });
    }

    const sessions = await Attendance.find({ course: course._id });
    let present = 0, total = 0;
    sessions.forEach((s) => {
      const rec = s.records.find((r) => sameId(r.student, studentId));
      if (rec) { total += 1; if (rec.status === "present" || rec.status === "late") present += 1; }
    });
    res.json({ present, total, percentage: percentage(present, total) });
  } catch (err) {
    res.status(500).json({ message: "Failed to load attendance summary" });
  }
};
