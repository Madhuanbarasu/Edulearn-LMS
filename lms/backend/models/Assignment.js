const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    attachmentUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assignment", assignmentSchema);
