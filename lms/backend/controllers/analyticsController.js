const Submission = require("../models/Submission");
const QuizAttempt = require("../models/QuizAttempt");
const Attendance = require("../models/Attendance");
const Course = require("../models/Course");
const Assignment = require("../models/Assignment");
const Quiz = require("../models/Quiz");
const User = require("../models/User");
const { sameId, canManageCourse, isEnrolled } = require("../utils/access");
const policies = require("../services/policies");

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(2) : null);

function attendanceFor(sessions, studentId) {
  let present = 0, total = 0;
  sessions.forEach((s) => {
    const rec = s.records.find((r) => sameId(r.student, studentId));
    if (rec) { total += 1; if (rec.status === "present" || rec.status === "late") present += 1; }
  });
  return { present, total, percentage: pct(present, total) };
}

// Performance analytics for one student within a course
exports.getStudentPerformance = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role === "student") {
      if (!sameId(req.user._id, studentId)) return res.status(403).json({ message: "Not authorized to view another student's performance" });
      if (!isEnrolled(req.user, course)) return res.status(403).json({ message: "You are not enrolled in this course" });
    } else if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ message: "You do not have access to this course" });
    } else if (!(course.students || []).some((s) => sameId(s, studentId))) {
      return res.status(404).json({ message: "Student is not enrolled in this course" });
    }

    const assignments = await Assignment.find({ course: courseId });
    const submissions = await Submission.find({ student: studentId, assignment: { $in: assignments.map((a) => a._id) } });
    const graded = submissions.filter((s) => s.marksObtained != null);
    const avgAssignmentScore = graded.length ? (graded.reduce((n, s) => n + s.marksObtained, 0) / graded.length).toFixed(2) : null;
    const maxById = Object.fromEntries(assignments.map((a) => [String(a._id), a.maxMarks || 100]));
    const avgAssignmentPercentage = graded.length
      ? (graded.reduce((n, s) => n + (s.marksObtained / (maxById[String(s.assignment)] || 100)) * 100, 0) / graded.length).toFixed(2)
      : null;

    const quizzes = await Quiz.find({ course: courseId });
    const attempts = await QuizAttempt.find({ student: studentId, quiz: { $in: quizzes.map((q) => q._id) } });
    const avgQuizPercentage = attempts.length
      ? (attempts.reduce((n, a) => n + (a.score / (a.totalMarks || 1)) * 100, 0) / attempts.length).toFixed(2)
      : null;

    const att = attendanceFor(await Attendance.find({ course: courseId }), studentId);

    res.json({
      assignmentsSubmitted: submissions.length,
      totalAssignments: assignments.length,
      avgAssignmentScore,
      avgAssignmentPercentage,
      quizzesAttempted: attempts.length,
      totalQuizzes: quizzes.length,
      avgQuizPercentage,
      attendancePercentage: att.percentage,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load performance data" });
  }
};

// Course-wide analytics: allocated faculty / admin only (contains other students' data)
exports.getCourseAnalytics = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).populate("students", "name rollNumber");
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!canManageCourse(req.user, course)) return res.status(403).json({ message: "You do not have access to this course's analytics" });

    const assignments = await Assignment.find({ course: course._id });
    const maxById = Object.fromEntries(assignments.map((a) => [String(a._id), a.maxMarks || 100]));
    const [sessions, allSubs] = await Promise.all([
      Attendance.find({ course: course._id }),
      Submission.find({ assignment: { $in: assignments.map((a) => a._id) } }),
    ]);

    const results = course.students.map((student) => {
      const submissions = allSubs.filter((s) => sameId(s.student, student._id));
      const graded = submissions.filter((s) => s.marksObtained != null);
      const avgScore = graded.length ? (graded.reduce((n, s) => n + s.marksObtained, 0) / graded.length).toFixed(2) : null;
      const avgPercentage = graded.length
        ? (graded.reduce((n, s) => n + (s.marksObtained / (maxById[String(s.assignment)] || 100)) * 100, 0) / graded.length).toFixed(2)
        : null;
      return {
        student: { _id: student._id, name: student.name, rollNumber: student.rollNumber },
        submissionsCount: submissions.length,
        lateSubmissions: submissions.filter((s) => s.isLate === true || s.status === "late").length,
        avgScore,
        avgPercentage,
        attendancePercentage: attendanceFor(sessions, student._id).percentage,
      };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Failed to load analytics" });
  }
};

const brief = (c) => ({ _id: c._id, title: c.title, code: c.code });

// Dashboard summary stats: computed from real DB data. New keys are additive.
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const now = new Date();

    if (role === "student") {
      const enrolledCourses = await Course.find({ students: userId });
      const courseIds = enrolledCourses.map((c) => c._id);
      const courseById = Object.fromEntries(enrolledCourses.map((c) => [String(c._id), c]));
      const assignments = await Assignment.find({ course: { $in: courseIds } }).sort({ dueDate: 1 });
      const submissions = await Submission.find({ student: userId, assignment: { $in: assignments.map((a) => a._id) } });
      const quizzes = await Quiz.find({ course: { $in: courseIds } }).select("-questions");
      const attempts = await QuizAttempt.find({ student: userId, quiz: { $in: quizzes.map((q) => q._id) } });
      const sessions = await Attendance.find({ course: { $in: courseIds } });

      const subByAssignment = Object.fromEntries(submissions.map((s) => [String(s.assignment), s]));
      const open = assignments.filter((a) => !subByAssignment[String(a._id)]);
      const item = (a) => ({
        _id: a._id, title: a.title, dueDate: a.dueDate, maxMarks: a.maxMarks,
        course: brief(courseById[String(a.course)] || { _id: a.course }),
      });
      const overdueAssignments = open.filter((a) => new Date(a.dueDate) < now).map(item).reverse().slice(0, 10);
      const upcomingAssignments = open.filter((a) => new Date(a.dueDate) >= now).map(item).slice(0, 10);

      const attemptedQuiz = new Set(attempts.map((a) => String(a.quiz)));
      const upcomingQuizzes = quizzes
        .filter((q) => !attemptedQuiz.has(String(q._id)) && new Date(q.endTime) >= now)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        .slice(0, 10)
        .map((q) => ({
          _id: q._id, title: q.title, startTime: q.startTime, endTime: q.endTime, duration: q.duration,
          windowState: policies.quizWindowState(q, now), course: brief(courseById[String(q.course)] || { _id: q.course }),
        }));

      const aById = Object.fromEntries(assignments.map((a) => [String(a._id), a]));
      const recentGrades = submissions
        .filter((s) => s.status === "graded" && s.marksObtained != null)
        .sort((a, b) => new Date(b.gradedAt || b.updatedAt) - new Date(a.gradedAt || a.updatedAt))
        .slice(0, 5)
        .map((s) => {
          const a = aById[String(s.assignment)];
          return { _id: s._id, assignmentTitle: a?.title, marksObtained: s.marksObtained, maxMarks: a?.maxMarks || 100, hasFeedback: !!s.feedback, course: brief(courseById[String(a?.course)] || {}) };
        });

      let present = 0, total = 0;
      const attendanceByCourse = enrolledCourses.map((c) => {
        const att = attendanceFor(sessions.filter((s) => sameId(s.course, c._id)), userId);
        present += att.present; total += att.total;
        return { course: brief(c), present: att.present, total: att.total, percentage: att.percentage };
      });

      return res.json({
        enrolledCourses: enrolledCourses.length,
        totalAssignments: assignments.length,
        submittedAssignments: submissions.length,
        pendingAssignments: assignments.length - submissions.length,
        totalQuizzes: quizzes.length,
        attemptedQuizzes: attempts.length,
        attendancePercentage: total > 0 ? ((present / total) * 100).toFixed(2) : "N/A",
        recentCourses: enrolledCourses.slice(0, 5).map(brief),
        overdueAssignments, upcomingAssignments, upcomingQuizzes, recentGrades, attendanceByCourse,
      });
    }

    if (role === "faculty") {
      const teachingCourses = await Course.find({ faculty: userId });
      const courseIds = teachingCourses.map((c) => c._id);
      const courseById = Object.fromEntries(teachingCourses.map((c) => [String(c._id), c]));
      const totalStudents = new Set();
      teachingCourses.forEach((c) => c.students.forEach((s) => totalStudents.add(String(s))));
      const assignments = await Assignment.find({ course: { $in: courseIds } });
      const aIds = assignments.map((a) => a._id);
      const pendingDocs = await Submission.find({ assignment: { $in: aIds }, status: { $in: ["submitted", "late"] } })
        .sort({ submittedAt: 1 }).limit(200).populate("student", "name rollNumber");
      const quizzes = await Quiz.find({ course: { $in: courseIds } }).select("-questions");
      const aById = Object.fromEntries(assignments.map((a) => [String(a._id), a]));

      const awaitingGrading = pendingDocs.slice(0, 10).map((s) => {
        const a = aById[String(s.assignment)];
        return {
          _id: s._id, assignmentId: s.assignment, assignmentTitle: a?.title, student: { name: s.student?.name, rollNumber: s.student?.rollNumber },
          submittedAt: s.submittedAt, isLate: s.isLate === true || s.status === "late", course: brief(courseById[String(a?.course)] || {}),
        };
      });
      const upcomingDeadlines = assignments.filter((a) => new Date(a.dueDate) >= now).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5)
        .map((a) => ({ _id: a._id, title: a.title, dueDate: a.dueDate, course: brief(courseById[String(a.course)] || {}) }));
      const upcomingQuizzes = quizzes.filter((q) => new Date(q.endTime) >= now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).slice(0, 5)
        .map((q) => ({ _id: q._id, title: q.title, startTime: q.startTime, endTime: q.endTime, course: brief(courseById[String(q.course)] || {}) }));
      const pendingByCourse = {};
      pendingDocs.forEach((s) => { const cid = String(aById[String(s.assignment)]?.course); pendingByCourse[cid] = (pendingByCourse[cid] || 0) + 1; });
      const coursesSummary = teachingCourses.map((c) => ({
        ...brief(c), studentCount: c.students.length,
        assignmentCount: assignments.filter((a) => sameId(a.course, c._id)).length,
        awaitingGrading: pendingByCourse[String(c._id)] || 0,
      }));

      return res.json({
        teachingCourses: teachingCourses.length,
        totalStudents: totalStudents.size,
        totalAssignments: assignments.length,
        pendingGrading: await Submission.countDocuments({ assignment: { $in: aIds }, status: { $in: ["submitted", "late"] } }),
        totalQuizzes: quizzes.length,
        recentCourses: teachingCourses.slice(0, 5).map(brief),
        awaitingGrading, upcomingDeadlines, upcomingQuizzes, coursesSummary,
      });
    }

    // admin
    const [totalUsers, totalCourses, totalStudents, totalFaculty, pendingFaculty] = await Promise.all([
      User.countDocuments(), Course.countDocuments(), User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "faculty" }), User.countDocuments({ role: "faculty", status: "pending" }),
    ]);
    res.json({ totalUsers, totalCourses, totalStudents, totalFaculty, pendingFaculty });
  } catch (err) {
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
};
