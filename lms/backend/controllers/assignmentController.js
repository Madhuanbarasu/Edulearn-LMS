const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const { discardUpload } = require("../middleware/upload");
const { loadCourseFor, canManageCourse, isEnrolled } = require("../utils/access");
const { isString, parseDate, isFiniteNumber } = require("../utils/validators");
const Course = require("../models/Course");
const policies = require("../services/policies");

// Legacy submissions have no isLate; derive it.
const withLate = (sub, assignment) => {
  const o = sub.toObject ? sub.toObject() : { ...sub };
  if (o.isLate === undefined || o.isLate === null) o.isLate = policies.isLate(assignment.dueDate, o.submittedAt);
  return o;
};

exports.createAssignment = async (req, res) => {
  try {
    const { course, title, description, dueDate, maxMarks } = req.body || {};
    const bail = (code, message) => { discardUpload(req); return res.status(code).json({ message }); };
    if (!course || !isString(title) || !title.trim() || !dueDate) return bail(400, "Course, title, and due date are required");
    if (!/^[a-fA-F0-9]{24}$/.test(String(course))) return bail(400, "Invalid course id");
    if (title.length > 200 || (description !== undefined && (!isString(description) || description.length > 10000))) return bail(400, "Title or description is too long");
    const due = parseDate(dueDate);
    if (!due) return bail(400, "A valid due date is required");
    let max = 100;
    if (maxMarks !== undefined && maxMarks !== "" && maxMarks !== null) {
      if (!isFiniteNumber(maxMarks) || Number(maxMarks) <= 0 || Number(maxMarks) > 1000) return bail(400, "Maximum marks must be a number between 1 and 1000");
      max = Number(maxMarks);
    }
    const courseDoc = await Course.findById(course);
    if (!courseDoc) return bail(404, "Course not found");
    if (!canManageCourse(req.user, courseDoc)) return bail(403, "Only the allocated faculty can create assignments");

    const assignment = await Assignment.create({
      course: courseDoc._id, title: title.trim(), description, dueDate: due, maxMarks: max,
      attachmentUrl: req.file ? `/uploads/${req.file.filename}` : undefined, createdBy: req.user._id,
    });
    res.status(201).json(assignment);
  } catch (err) {
    discardUpload(req);
    res.status(500).json({ message: "Failed to create assignment" });
  }
};

exports.getAssignmentsForCourse = async (req, res) => {
  try {
    const course = await loadCourseFor(req, res, req.params.courseId, "member");
    if (!course) return;
    const assignments = await Assignment.find({ course: course._id }).sort({ dueDate: 1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "Failed to load assignments" });
  }
};

// Policy: assignments that already have submissions cannot be deleted (no cascading deletes).
exports.deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const courseDoc = await Course.findById(assignment.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) {
      return res.status(403).json({ message: "Only the allocated faculty can delete assignments" });
    }
    if ((await Submission.countDocuments({ assignment: assignment._id })) > 0) {
      return res.status(409).json({ message: "This assignment already has student submissions and cannot be deleted." });
    }
    await Assignment.findByIdAndDelete(assignment._id);
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete assignment" });
  }
};

exports.submitAssignment = async (req, res) => {
  const bail = (code, message) => { discardUpload(req); return res.status(code).json({ message }); };
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return bail(404, "Assignment not found");

    const courseDoc = await Course.findById(assignment.course);
    if (!courseDoc || !isEnrolled(req.user, courseDoc)) return bail(403, "You must be enrolled in the course to submit assignments");

    const text = req.body && req.body.textAnswer;
    if (text !== undefined && (!isString(text) || text.length > 20000)) return bail(400, "Text answer is invalid or too long");
    const hasText = isString(text) && text.trim().length > 0;
    if (!req.file && !hasText) return bail(400, "Please provide a file or text answer");

    const now = new Date();
    const late = policies.isLate(assignment.dueDate, now);
    const set = { submittedAt: now, status: late ? "late" : "submitted", isLate: late };
    const unset = {};
    if (req.file) set.fileUrl = `/uploads/${req.file.filename}`; else unset.fileUrl = "";
    if (hasText) set.textAnswer = text; else unset.textAnswer = "";
    const update = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;

    try {
      // The `status: { $ne: "graded" }` filter makes the "graded work is locked" rule atomic: if a graded
      // submission exists the filter misses, the upsert hits the unique index and we answer 409.
      const submission = await Submission.findOneAndUpdate(
        { assignment: assignment._id, student: req.user._id, status: { $ne: "graded" } },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.status(201).json(submission);
    } catch (err) {
      if (err.code === 11000) return bail(409, "This submission has already been graded and can no longer be replaced.");
      throw err;
    }
  } catch (err) {
    return bail(500, "Failed to submit assignment");
  }
};

exports.getSubmissionsForAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const courseDoc = await Course.findById(assignment.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) {
      return res.status(403).json({ message: "Not authorized to view these submissions" });
    }
    const submissions = await Submission.find({ assignment: assignment._id }).populate("student", "name email rollNumber");
    res.json(submissions.map((s) => withLate(s, assignment)));
  } catch (err) {
    res.status(500).json({ message: "Failed to load submissions" });
  }
};

exports.gradeSubmission = async (req, res) => {
  try {
    const { marksObtained, feedback } = req.body || {};
    if (feedback !== undefined && (!isString(feedback) || feedback.length > 5000)) {
      return res.status(400).json({ message: "Feedback must be text of at most 5000 characters" });
    }
    const submission = await Submission.findById(req.params.id).populate("assignment");
    if (!submission || !submission.assignment) return res.status(404).json({ message: "Submission not found" });

    const courseDoc = await Course.findById(submission.assignment.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) {
      return res.status(403).json({ message: "Not authorized to grade this submission" });
    }
    const checked = policies.validateMarks(marksObtained, submission.assignment.maxMarks);
    if (checked.error) return res.status(400).json({ message: checked.error });

    // Faculty may regrade; the previous grade is simply replaced.
    submission.marksObtained = checked.value;
    submission.feedback = feedback || "";
    submission.status = "graded";
    submission.gradedAt = new Date();
    submission.gradedBy = req.user._id;
    if (submission.isLate === undefined || submission.isLate === null) {
      submission.isLate = policies.isLate(submission.assignment.dueDate, submission.submittedAt);
    }
    await submission.save();
    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: "Failed to grade submission" });
  }
};

exports.getMySubmission = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ message: "Assignment not found" });
    const courseDoc = await Course.findById(assignment.course);
    if (!courseDoc || !isEnrolled(req.user, courseDoc)) return res.status(403).json({ message: "You are not enrolled in this course" });
    const submission = await Submission.findOne({ assignment: assignment._id, student: req.user._id });
    res.json(submission ? withLate(submission, assignment) : null);
  } catch (err) {
    res.status(500).json({ message: "Failed to load submission" });
  }
};
