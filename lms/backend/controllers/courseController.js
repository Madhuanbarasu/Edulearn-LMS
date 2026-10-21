const Course = require("../models/Course");
const User = require("../models/User");
const Assignment = require("../models/Assignment");
const Quiz = require("../models/Quiz");
const Attendance = require("../models/Attendance");
const ForumPost = require("../models/ForumPost");
const { discardUpload } = require("../middleware/upload");
const { canManageCourse, isCourseMember, isEnrolled, sameId } = require("../utils/access");
const { isObjectId, isString, clean } = require("../utils/validators");
const { audit } = require("../utils/audit");

const PLACEMENT_FIELDS = ["department", "academicYear", "studyYear", "section"];

/** Shape a course for the requesting user. Students never receive the roster. */
function shapeCourse(course, user) {
  const obj = course.toObject ? course.toObject() : { ...course };
  const count = (obj.students || []).length;
  obj.studentCount = count;
  if (user.role === "student") {
    obj.students = (obj.students || []).filter((s) => sameId(s._id || s, user._id)).map((s) => s._id || s);
  }
  return obj;
}

exports.createCourse = async (req, res) => {
  try {
    const { title, code, description } = req.body || {};
    if (!isString(title) || !title.trim() || !isString(code) || !code.trim()) {
      return res.status(400).json({ message: "Title and course code are required" });
    }
    if (title.length > 200 || code.length > 30 || (description !== undefined && (!isString(description) || description.length > 5000))) {
      return res.status(400).json({ message: "Title, code or description is too long" });
    }
    let facultyId = req.user._id;
    if (req.user.role === "admin") {
      // Admin creating a course must allocate it to an active faculty member.
      const fid = req.body.faculty;
      if (!isObjectId(fid)) return res.status(400).json({ message: "A faculty member must be allocated to the course" });
      const fac = await User.findById(fid);
      if (!fac || fac.role !== "faculty" || (fac.status || "active") !== "active") {
        return res.status(400).json({ message: "Selected faculty member is not available" });
      }
      facultyId = fac._id;
    }
    const placement = {};
    for (const f of PLACEMENT_FIELDS) if (isString(req.body[f]) && req.body[f].trim()) placement[f] = clean(req.body[f], 100);

    const course = await Course.create({ title: title.trim(), code: code.trim(), description, ...placement, faculty: facultyId });
    await User.findByIdAndUpdate(facultyId, { $addToSet: { teachingCourses: course._id } });
    if (req.user.role === "admin") await audit(req, "course.create", { targetType: "course", targetId: course._id, summary: `Created course ${course.code} allocated to faculty ${facultyId}` });
    res.status(201).json(course);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Course code already exists" });
    res.status(500).json({ message: "Failed to create course" });
  }
};

exports.getCourses = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "faculty") filter = { faculty: req.user._id };
    if (req.user.role === "student") filter = { students: req.user._id };
    const courses = await Course.find(filter).populate("faculty", "name email");
    res.json(courses.map((c) => shapeCourse(c, req.user)));
  } catch (err) {
    res.status(500).json({ message: "Failed to load courses" });
  }
};

// Catalogue used by students to find courses to enrol in: no materials, no roster.
exports.getAllCoursesPublic = async (req, res) => {
  try {
    const courses = await Course.find().select("-materials").populate("faculty", "name");
    res.json(courses.map((c) => shapeCourse(c, req.user)));
  } catch (err) {
    res.status(500).json({ message: "Failed to load courses" });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate("faculty", "name email");
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!isCourseMember(req.user, course)) {
      return res.status(403).json({ message: "You do not have access to this course" });
    }
    if (req.user.role !== "student") {
      await course.populate("students", "name email rollNumber department section");
    }
    res.json(shapeCourse(course, req.user));
  } catch (err) {
    res.status(500).json({ message: "Failed to load course" });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ message: "Only the allocated faculty can update this course" });
    }
    const { title, code, description } = req.body || {};
    if (title !== undefined) { if (!isString(title) || !title.trim() || title.length > 200) return res.status(400).json({ message: "Invalid title" }); course.title = title.trim(); }
    if (code !== undefined) { if (!isString(code) || !code.trim() || code.length > 30) return res.status(400).json({ message: "Invalid course code" }); course.code = code.trim(); }
    if (description !== undefined) { if (!isString(description) || description.length > 5000) return res.status(400).json({ message: "Invalid description" }); course.description = description; }
    for (const f of PLACEMENT_FIELDS) if (req.body && isString(req.body[f])) course[f] = clean(req.body[f], 100);
    await course.save();
    res.json(course);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Course code already exists" });
    res.status(500).json({ message: "Failed to update course" });
  }
};

// Policy: a course that already has academic records cannot be deleted (no cascading deletes).
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ message: "Only the allocated faculty can delete this course" });
    }
    const [a, q, att, f] = await Promise.all([
      Assignment.countDocuments({ course: course._id }),
      Quiz.countDocuments({ course: course._id }),
      Attendance.countDocuments({ course: course._id }),
      ForumPost.countDocuments({ course: course._id }),
    ]);
    if (a + q + att + f > 0) {
      return res.status(409).json({
        message: "This course has assignments, quizzes, attendance or discussion records and cannot be deleted. Remove or archive its content first.",
      });
    }
    await User.updateMany({ enrolledCourses: course._id }, { $pull: { enrolledCourses: course._id } });
    await User.findByIdAndUpdate(course.faculty, { $pull: { teachingCourses: course._id } });
    await Course.findByIdAndDelete(course._id);
    if (req.user.role === "admin") await audit(req, "course.delete", { targetType: "course", targetId: course._id, summary: `Deleted empty course ${course.code}` });
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete course" });
  }
};

exports.enrollStudent = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (isEnrolled(req.user, course)) return res.status(400).json({ message: "Already enrolled in this course" });
    await Course.findByIdAndUpdate(req.params.id, { $addToSet: { students: req.user._id } });
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { enrolledCourses: course._id } });
    res.json({ message: "Enrolled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to enroll" });
  }
};

exports.unenrollStudent = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await Course.findByIdAndUpdate(req.params.id, { $pull: { students: req.user._id } });
    await User.findByIdAndUpdate(req.user._id, { $pull: { enrolledCourses: course._id } });
    res.json({ message: "Unenrolled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to unenroll" });
  }
};

exports.addMaterial = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) { discardUpload(req); return res.status(404).json({ message: "Course not found" }); }
    if (!canManageCourse(req.user, course)) {
      discardUpload(req);
      return res.status(403).json({ message: "Only the allocated faculty can add materials" });
    }
    const title = req.body && req.body.title;
    if (!isString(title) || !title.trim() || title.length > 200) { discardUpload(req); return res.status(400).json({ message: "Material title is required" }); }
    // Only a server-stored upload is accepted; a client-supplied URL is never trusted.
    if (!req.file) return res.status(400).json({ message: "A file is required" });
    course.materials.push({ title: title.trim(), fileUrl: `/uploads/${req.file.filename}` });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    discardUpload(req);
    res.status(500).json({ message: "Failed to upload material" });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (!canManageCourse(req.user, course)) {
      return res.status(403).json({ message: "Only the allocated faculty can delete materials" });
    }
    if (!isObjectId(req.params.materialId)) return res.status(400).json({ message: "Invalid material id" });
    course.materials = course.materials.filter((m) => String(m._id) !== String(req.params.materialId));
    await course.save();
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: "Failed to delete material" });
  }
};
