const express = require("express");
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, getPublicOptions } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/security");

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/options", getPublicOptions);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, authLimiter, changePassword);

module.exports = router;
