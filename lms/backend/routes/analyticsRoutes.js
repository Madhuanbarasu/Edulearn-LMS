const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validate");
const { getStudentPerformance, getCourseAnalytics, getDashboardStats } = require("../controllers/analyticsController");

router.param("courseId", validateIdParam);
router.param("studentId", validateIdParam);

router.use(protect);
router.get("/dashboard", getDashboardStats);
router.get("/course/:courseId/student/:studentId", getStudentPerformance);
router.get("/course/:courseId", getCourseAnalytics);

module.exports = router;
