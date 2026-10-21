const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { verifyUpload } = require("../middleware/upload");
const { validateIdParam } = require("../middleware/validate");
const a = require("../controllers/assignmentController");

router.param("id", validateIdParam);
router.param("courseId", validateIdParam);

router.use(protect);
router.post("/", authorize("faculty", "admin"), upload.single("file"), verifyUpload, a.createAssignment);
router.get("/course/:courseId", a.getAssignmentsForCourse);
router.put("/submissions/:id/grade", authorize("faculty", "admin"), a.gradeSubmission);
router.delete("/:id", authorize("faculty", "admin"), a.deleteAssignment);
router.post("/:id/submit", authorize("student"), upload.single("file"), verifyUpload, a.submitAssignment);
router.get("/:id/submissions", authorize("faculty", "admin"), a.getSubmissionsForAssignment);
router.get("/:id/my-submission", authorize("student"), a.getMySubmission);

module.exports = router;
