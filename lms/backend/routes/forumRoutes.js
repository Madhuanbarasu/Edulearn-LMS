const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validate");
const {
  createPost,
  getPostsForCourse,
  addComment,
  deletePost,
  deleteComment,
} = require("../controllers/forumController");

router.param("id", validateIdParam);
router.param("courseId", validateIdParam);
router.param("commentId", validateIdParam);

router.use(protect);
router.post("/", createPost);
router.get("/course/:courseId", getPostsForCourse);
router.delete("/:id", deletePost);
router.post("/:id/comments", addComment);
router.delete("/:id/comments/:commentId", deleteComment);

module.exports = router;
