const Quiz = require("../models/Quiz");
const QuizAttempt = require("../models/QuizAttempt");
const QuizStart = require("../models/QuizStart");
const Course = require("../models/Course");
const { loadCourseFor, canManageCourse, isEnrolled } = require("../utils/access");
const { isObjectId } = require("../utils/validators");
const policies = require("../services/policies");

exports.createQuiz = async (req, res) => {
  try {
    const { course } = req.body || {};
    if (!isObjectId(course)) return res.status(400).json({ message: "A valid course is required" });
    const courseDoc = await loadCourseFor(req, res, course, "manage", "Only the allocated faculty can create quizzes");
    if (!courseDoc) return;
    const checked = policies.validateQuizDefinition(req.body);
    if (checked.error) return res.status(400).json({ message: checked.error });
    const quiz = await Quiz.create({ course: courseDoc._id, ...checked.value, createdBy: req.user._id });
    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: "Failed to create quiz" });
  }
};

exports.getQuizzesForCourse = async (req, res) => {
  try {
    const course = await loadCourseFor(req, res, req.params.courseId, "member");
    if (!course) return;
    const quizzes = await Quiz.find({ course: course._id }).select("-questions.correctOptionIndex");
    const now = new Date();
    const out = quizzes.map((q) => {
      const o = q.toObject();
      o.windowState = policies.quizWindowState(q, now);
      // Students must not see question content before they start the quiz: only a count-bearing stub is sent.
      if (req.user.role === "student") o.questions = o.questions.map((x) => ({ _id: x._id, marks: x.marks }));
      return o;
    });
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: "Failed to load quizzes" });
  }
};

// Full quiz (with correct answers) for faculty who manage it
exports.getQuizFull = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) return res.status(403).json({ message: "Not authorized to view quiz details" });
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: "Failed to load quiz" });
  }
};

// Opening a quiz starts the clock. Answers are never sent.
exports.getQuizForAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select("-questions.correctOptionIndex");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !isEnrolled(req.user, courseDoc)) {
      return res.status(403).json({ message: "You must be enrolled in the course to attempt this quiz" });
    }
    const now = new Date();
    const existing = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
    if (existing) return res.json(quiz); // already finished: the UI shows the result alongside the questions

    const state = policies.quizWindowState(quiz, now);
    if (state === "upcoming") return res.status(403).json({ message: "This quiz has not opened yet" });
    if (state === "closed") return res.status(403).json({ message: "This quiz is closed" });

    const start = await QuizStart.findOneAndUpdate(
      { quiz: quiz._id, student: req.user._id },
      { $setOnInsert: { quiz: quiz._id, student: req.user._id, startedAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const deadline = policies.quizDeadline(quiz, start.startedAt);
    const out = quiz.toObject();
    out.startedAt = start.startedAt;
    out.deadline = deadline;
    out.serverTime = now;
    out.remainingSeconds = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: "Failed to load quiz" });
  }
};

exports.submitQuizAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !isEnrolled(req.user, courseDoc)) {
      return res.status(403).json({ message: "You must be enrolled in the course to take this quiz" });
    }
    if (await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id })) {
      return res.status(400).json({ message: "You have already attempted this quiz" });
    }

    const now = new Date();
    const start = await QuizStart.findOne({ quiz: quiz._id, student: req.user._id });
    if (!start) return res.status(400).json({ message: "Open the quiz before submitting your answers" });
    const deadline = policies.quizDeadline(quiz, start.startedAt);
    if (now.getTime() > deadline.getTime() + policies.QUIZ_GRACE_MS) {
      return res.status(400).json({ message: "Time is up: this attempt was submitted after the allowed duration" });
    }

    const checked = policies.validateQuizAnswers(req.body && req.body.answers, quiz.questions);
    if (checked.error) return res.status(400).json({ message: checked.error });
    const { score, totalMarks } = policies.scoreQuiz(quiz.questions, checked.answers);

    const attempt = await QuizAttempt.create({
      quiz: quiz._id, student: req.user._id, answers: checked.answers, score, totalMarks, submittedAt: now,
    });
    res.status(201).json(attempt);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "You have already attempted this quiz" });
    res.status(500).json({ message: "Failed to submit quiz" });
  }
};

exports.getQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) return res.status(403).json({ message: "Not authorized to view quiz results" });
    const attempts = await QuizAttempt.find({ quiz: quiz._id }).populate("student", "name email rollNumber");
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: "Failed to load results" });
  }
};

exports.getMyAttempt = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select("course");
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !isEnrolled(req.user, courseDoc)) return res.status(403).json({ message: "You are not enrolled in this course" });
    const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
    res.json(attempt || null);
  } catch (err) {
    res.status(500).json({ message: "Failed to load attempt" });
  }
};

// Policy: a quiz that has attempts cannot be deleted (no cascading deletes).
exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const courseDoc = await Course.findById(quiz.course);
    if (!courseDoc || !canManageCourse(req.user, courseDoc)) return res.status(403).json({ message: "Only the allocated faculty can delete this quiz" });
    if ((await QuizAttempt.countDocuments({ quiz: quiz._id })) > 0) {
      return res.status(409).json({ message: "This quiz already has student attempts and cannot be deleted." });
    }
    await QuizStart.deleteMany({ quiz: quiz._id }); // transient timing markers only, never results
    await Quiz.findByIdAndDelete(quiz._id);
    res.json({ message: "Quiz deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete quiz" });
  }
};
