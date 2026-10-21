const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    date: { type: Date, required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    records: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["present", "absent", "late"], default: "present" },
      },
    ],
  },
  { timestamps: true }
);

attendanceSchema.index({ course: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
