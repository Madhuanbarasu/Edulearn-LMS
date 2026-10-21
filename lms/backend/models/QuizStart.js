const mongoose = require("mongoose");

// Records when a student opened a quiz so the duration limit can be enforced server-side.
const quizStartSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
quizStartSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("QuizStart", quizStartSchema);
