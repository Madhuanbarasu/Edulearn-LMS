const ForumPost = require("../models/ForumPost");
const Course = require("../models/Course");
const { isCourseMember, canManageCourse } = require("../utils/access");
const { isString, isObjectId } = require("../utils/validators");

exports.createPost = async (req, res) => {
  try {
    const { course, title, body } = req.body || {};
    if (!isObjectId(course) || !isString(title) || !title.trim() || !isString(body) || !body.trim()) {
      return res.status(400).json({ message: "Course, title, and body are required" });
    }
    if (title.length > 200 || body.length > 10000) return res.status(400).json({ message: "Title or body is too long" });

    const courseDoc = await Course.findById(course);
    if (!courseDoc) return res.status(404).json({ message: "Course not found" });
    if (!isCourseMember(req.user, courseDoc)) {
      return res.status(403).json({ message: "You must be enrolled in or teaching this course to post" });
    }

    const post = await ForumPost.create({ course: courseDoc._id, title: title.trim(), body: body.trim(), author: req.user._id });
    const populated = await post.populate("author", "name role");
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to create post" });
  }
};

exports.getPostsForCourse = async (req, res) => {
  try {
    const courseDoc = await Course.findById(req.params.courseId);
    if (!courseDoc) return res.status(404).json({ message: "Course not found" });
    if (!isCourseMember(req.user, courseDoc)) {
      return res.status(403).json({ message: "You must be enrolled in or teaching this course to view discussions" });
    }
    const posts = await ForumPost.find({ course: req.params.courseId })
      .populate("author", "name role")
      .populate("comments.author", "name role")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Failed to load posts" });
  }
};

exports.addComment = async (req, res) => {
  try {
    const text = req.body && req.body.text;
    if (!isString(text) || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }
    if (text.length > 5000) return res.status(400).json({ message: "Comment is too long" });
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const courseDoc = await Course.findById(post.course);
    if (!courseDoc) return res.status(404).json({ message: "Course not found" });

    if (!isCourseMember(req.user, courseDoc)) {
      return res.status(403).json({ message: "You must be enrolled in or teaching this course to comment" });
    }

    post.comments.push({ author: req.user._id, text: text.trim() });
    await post.save();
    const populated = await post.populate([
      { path: "author", select: "name role" },
      { path: "comments.author", select: "name role" },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment" });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const courseDoc = await Course.findById(post.course);
    const isModerator = courseDoc && canManageCourse(req.user, courseDoc);
    const isAuthor = String(post.author) === String(req.user._id);

    if (!isAuthor && !isModerator) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }
    await ForumPost.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete post" });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const post = await ForumPost.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const courseDoc = await Course.findById(post.course);
    const isModerator = courseDoc && canManageCourse(req.user, courseDoc);
    const isAuthor = String(comment.author) === String(req.user._id);

    if (!isAuthor && !isModerator) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    post.comments.pull(commentId);
    await post.save();
    const populated = await post.populate([
      { path: "author", select: "name role" },
      { path: "comments.author", select: "name role" },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: "Failed to delete comment" });
  }
};
