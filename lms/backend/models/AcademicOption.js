const mongoose = require("mongoose");

const OPTION_TYPES = ["department", "academicYear", "studyYear", "section"];

const academicOptionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: OPTION_TYPES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
academicOptionSchema.index({ type: 1, name: 1 }, { unique: true });
academicOptionSchema.statics.TYPES = OPTION_TYPES;

module.exports = mongoose.model("AcademicOption", academicOptionSchema);
