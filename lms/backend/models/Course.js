const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    // additive academic placement (optional)
    department: { type: String, trim: true },
    academicYear: { type: String, trim: true },
    studyYear: { type: String, trim: true },
    section: { type: String, trim: true },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    materials: [
      {
        title: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", courseSchema);
