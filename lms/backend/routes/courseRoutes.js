const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { verifyUpload } = require("../middleware/upload");
const { validateIdParam } = require("../middleware/validate");
const c = require("../controllers/courseController");

router.param("id", validateIdParam);
router.param("materialId", validateIdParam);

router.use(protect);
router.get("/all", authorize("student", "faculty", "admin"), c.getAllCoursesPublic);
router.get("/", c.getCourses);
router.post("/", authorize("faculty", "admin"), c.createCourse);
router.get("/:id", c.getCourseById);
router.put("/:id", authorize("faculty", "admin"), c.updateCourse);
router.delete("/:id", authorize("faculty", "admin"), c.deleteCourse);
router.post("/:id/enroll", authorize("student"), c.enrollStudent);
router.post("/:id/unenroll", authorize("student"), c.unenrollStudent);
router.post("/:id/materials", authorize("faculty", "admin"), upload.single("file"), verifyUpload, c.addMaterial);
router.delete("/:id/materials/:materialId", authorize("faculty", "admin"), c.deleteMaterial);

module.exports = router;
