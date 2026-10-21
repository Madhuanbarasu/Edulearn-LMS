const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validate");
const a = require("../controllers/attendanceController");

router.param("courseId", validateIdParam);
router.param("studentId", validateIdParam);

router.use(protect);
router.post("/", authorize("faculty", "admin"), a.markAttendance);
router.get("/course/:courseId", a.getAttendanceForCourse);
router.get("/course/:courseId/student/:studentId", a.getStudentAttendanceSummary);

module.exports = router;
