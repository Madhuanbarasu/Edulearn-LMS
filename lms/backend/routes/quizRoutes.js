const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validate");
const {
  createQuiz,
  getQuizzesForCourse,
  getQuizFull,
  getQuizForAttempt,
  submitQuizAttempt,
  getQuizResults,
  getMyAttempt,
  deleteQuiz,
} = require("../controllers/quizController");

router.param("id", validateIdParam);
router.param("courseId", validateIdParam);

router.use(protect);
router.post("/", authorize("faculty", "admin"), createQuiz);
router.get("/course/:courseId", getQuizzesForCourse);
router.delete("/:id", authorize("faculty", "admin"), deleteQuiz);
router.get("/:id/full", authorize("faculty", "admin"), getQuizFull);
router.get("/:id/attempt", authorize("student"), getQuizForAttempt);
router.post("/:id/attempt", authorize("student"), submitQuizAttempt);
router.get("/:id/results", authorize("faculty", "admin"), getQuizResults);
router.get("/:id/my-attempt", authorize("student"), getMyAttempt);

module.exports = router;
