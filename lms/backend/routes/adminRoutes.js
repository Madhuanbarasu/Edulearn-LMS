const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validate");
const a = require("../controllers/adminController");

router.param("id", validateIdParam);
router.param("studentId", validateIdParam);

// Every admin endpoint requires a valid, active admin session. Enforced here, server-side.
router.use(protect, authorize("admin"));

router.get("/overview", a.overview);

router.get("/users", a.listUsers);
router.get("/users/:id", a.getUser);
router.patch("/users/:id", a.updateUser);
router.patch("/users/:id/status", a.setUserStatus);

router.get("/faculty/pending", a.listPendingFaculty);
router.post("/faculty/:id/approve", a.approveFaculty);
router.post("/faculty/:id/reject", a.rejectFaculty);

router.get("/options", a.listOptions);
router.post("/options", a.createOption);
router.patch("/options/:id", a.updateOption);
router.delete("/options/:id", a.deleteOption);

router.get("/courses", a.listCourses);
router.get("/courses/:id/roster", a.getRoster);
router.post("/courses/:id/allocate", a.allocateFaculty);
router.post("/courses/:id/students", a.enrollStudents);
router.delete("/courses/:id/students/:studentId", a.unenrollStudent);

router.get("/reports/summary", a.reportSummary);
router.get("/reports/courses", a.reportCourses);
router.get("/reports/attendance", a.reportAttendance);
router.get("/reports/assignments", a.reportAssignments);

router.get("/audit-logs", a.listAuditLogs);

module.exports = router;
