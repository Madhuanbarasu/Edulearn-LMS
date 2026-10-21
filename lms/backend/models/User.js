const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// status is additive. Legacy documents without it are treated as "active" (see middleware/auth.js).
const USER_STATUSES = ["pending", "active", "disabled", "rejected"];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ["student", "faculty", "admin"], default: "student" },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    rollNumber: { type: String, trim: true, maxlength: 50 }, // students
    department: { type: String, trim: true, maxlength: 100 },
    academicYear: { type: String, trim: true, maxlength: 50 },
    studyYear: { type: String, trim: true, maxlength: 50 },
    section: { type: String, trim: true, maxlength: 50 },
    avatar: { type: String, default: "" },
    passwordChangedAt: { type: Date },
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    teachingCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.statics.STATUSES = USER_STATUSES;

module.exports = mongoose.model("User", userSchema);
