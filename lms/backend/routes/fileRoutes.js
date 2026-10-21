const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const f = require("../controllers/fileController");

router.get("/access", protect, f.requestAccess);
router.get("/download/:token", f.download);

module.exports = router;
