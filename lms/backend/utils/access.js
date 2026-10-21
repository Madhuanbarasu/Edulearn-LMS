const Course = require("../models/Course");

// Works for raw ObjectIds, strings, and populated documents (which expose _id).
const idOf = (v) => (v && v._id ? v._id : v);
const sameId = (a, b) => String(idOf(a)) === String(idOf(b));

const isCourseFaculty = (user, course) => !!course && sameId(course.faculty, user._id);
const isEnrolled = (user, course) => !!course && (course.students || []).some((s) => sameId(s._id || s, user._id));

/** Admin, or the faculty member the course is allocated to. */
const canManageCourse = (user, course) => user.role === "admin" || (user.role === "faculty" && isCourseFaculty(user, course));
/** Anyone who legitimately belongs to the course: admin, allocated faculty, enrolled student. */
const isCourseMember = (user, course) => user.role === "admin" || isCourseFaculty(user, course) || (user.role === "student" && isEnrolled(user, course));

/**
 * Loads a course and applies a check. Sends the error response itself and returns null on failure.
 * mode: "manage" | "member" | "enrolled"
 */
async function loadCourseFor(req, res, courseId, mode = "member", deniedMessage) {
  const course = await Course.findById(courseId);
  if (!course) { res.status(404).json({ message: "Course not found" }); return null; }
  const ok = mode === "manage" ? canManageCourse(req.user, course)
    : mode === "enrolled" ? (req.user.role === "student" && isEnrolled(req.user, course))
    : isCourseMember(req.user, course);
  if (!ok) { res.status(403).json({ message: deniedMessage || "You do not have access to this course" }); return null; }
  return course;
}

module.exports = { sameId, isCourseFaculty, isEnrolled, canManageCourse, isCourseMember, loadCourseFor };
