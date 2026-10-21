const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fileUrl: { type: String },
    textAnswer: { type: String },
    submittedAt: { type: Date, default: Date.now },
    marksObtained: { type: Number, default: null },
    feedback: { type: String },
    isLate: { type: Boolean }, // additive; legacy docs derive it from submittedAt vs dueDate
    gradedAt: { type: Date },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["submitted", "late", "graded"], default: "submitted" },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Submission", submissionSchema);
