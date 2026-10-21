"use strict";
/**
 * Pure business rules (no DB, no HTTP) so they can be unit-tested directly.
 *
 * Documented policies (see docs/POLICIES.md):
 *  - Late assignment submissions are ACCEPTED and flagged late.
 *  - A student may resubmit until the submission is graded; graded submissions are locked
 *    (faculty may regrade, a student may not replace it).
 *  - Quizzes: one attempt per student; must start inside the window; must finish within
 *    min(duration, window end) plus a small network grace.
 *  - Attendance: course faculty (or admin) may re-save a session; one document per course per day.
 */
const { isFiniteNumber, isObjectId } = require("../utils/validators");

const QUIZ_GRACE_MS = 15 * 1000;
const ATTENDANCE_STATUSES = ["present", "absent", "late"];

const isLate = (dueDate, at = new Date()) => new Date(at).getTime() > new Date(dueDate).getTime();

function validateMarks(marks, maxMarks) {
  if (marks === null || marks === undefined || marks === "") return { error: "Marks are required" };
  if (!isFiniteNumber(marks)) return { error: "Marks must be a number" };
  const n = Number(marks);
  const max = Number.isFinite(Number(maxMarks)) ? Number(maxMarks) : 100;
  if (n < 0) return { error: "Marks cannot be negative" };
  if (n > max) return { error: `Marks cannot exceed the maximum of ${max}` };
  return { value: n };
}

/** canResubmit: only while no grade has been recorded. */
const canReplaceSubmission = (existing) => !existing || existing.status !== "graded";

/** Legacy convention kept for compatibility with existing attendance documents. */
function normalizeAttendanceDate(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.setHours(0, 0, 0, 0));
}

function validateAttendanceInput({ date, records }, enrolledIds, now = new Date()) {
  const normalized = normalizeAttendanceDate(date);
  if (!normalized) return { error: "A valid date is required" };
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (normalized.getTime() > endOfToday.getTime()) return { error: "Attendance cannot be recorded for a future date" };
  if (!Array.isArray(records) || records.length === 0) return { error: "At least one attendance record is required" };
  if (records.length > 1000) return { error: "Too many attendance records" };
  const enrolled = new Set(enrolledIds.map(String));
  const seen = new Set();
  const clean = [];
  for (const r of records) {
    if (!r || typeof r !== "object") return { error: "Invalid attendance record" };
    if (!isObjectId(r.student)) return { error: "Each record needs a valid student id" };
    if (!ATTENDANCE_STATUSES.includes(r.status)) return { error: `Status must be one of: ${ATTENDANCE_STATUSES.join(", ")}` };
    if (!enrolled.has(String(r.student))) return { error: "Attendance can only be recorded for students enrolled in this course" };
    if (seen.has(String(r.student))) return { error: "Duplicate student in attendance records" };
    seen.add(String(r.student));
    clean.push({ student: r.student, status: r.status });
  }
  return { date: normalized, records: clean };
}

/** Where is "now" relative to the quiz window? */
function quizWindowState(quiz, now = new Date()) {
  const t = now.getTime();
  if (t < new Date(quiz.startTime).getTime()) return "upcoming";
  if (t > new Date(quiz.endTime).getTime()) return "closed";
  return "open";
}

/** The moment by which a started attempt must be submitted. */
function quizDeadline(quiz, startedAt) {
  const byDuration = new Date(startedAt).getTime() + Number(quiz.duration) * 60 * 1000;
  return new Date(Math.min(byDuration, new Date(quiz.endTime).getTime()));
}

function validateQuizAnswers(answers, questions) {
  if (!Array.isArray(answers)) return { error: "Answers array is required" };
  if (answers.length !== questions.length) return { error: `Expected ${questions.length} answers` };
  const clean = [];
  for (let i = 0; i < questions.length; i++) {
    const a = answers[i];
    if (a === null || a === undefined || a === -1) { clean.push(-1); continue; }
    if (!Number.isInteger(a) || a < 0 || a >= questions[i].options.length) {
      return { error: `Answer ${i + 1} is not a valid option` };
    }
    clean.push(a);
  }
  return { answers: clean };
}

function scoreQuiz(questions, answers) {
  let score = 0, totalMarks = 0;
  questions.forEach((q, i) => {
    const m = Number.isFinite(q.marks) ? q.marks : 1;
    totalMarks += m;
    if (answers[i] === q.correctOptionIndex) score += m;
  });
  return { score, totalMarks };
}

function validateQuizDefinition(body) {
  const { title, duration, startTime, endTime, questions } = body;
  if (typeof title !== "string" || !title.trim() || title.length > 200) return { error: "A quiz title (max 200 chars) is required" };
  const dur = Number(duration);
  if (!Number.isInteger(dur) || dur < 1 || dur > 600) return { error: "Duration must be a whole number of minutes between 1 and 600" };
  const s = new Date(startTime), e = new Date(endTime);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { error: "Valid start and end times are required" };
  if (e <= s) return { error: "End time must be after start time" };
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 200) return { error: "A quiz needs between 1 and 200 questions" };
  const qs = [];
  for (const q of questions) {
    if (!q || typeof q.questionText !== "string" || !q.questionText.trim()) return { error: "Each question needs text" };
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10 || q.options.some((o) => typeof o !== "string" || !o.trim())) {
      return { error: "Each question needs between 2 and 10 non-empty options" };
    }
    if (!Number.isInteger(q.correctOptionIndex) || q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
      return { error: "Each question needs a valid correct option index" };
    }
    const marks = q.marks === undefined ? 1 : Number(q.marks);
    if (!Number.isFinite(marks) || marks <= 0 || marks > 100) return { error: "Question marks must be between 0 and 100" };
    qs.push({ questionText: q.questionText.trim(), options: q.options.map((o) => o.trim()), correctOptionIndex: q.correctOptionIndex, marks });
  }
  return { value: { title: title.trim(), duration: dur, startTime: s, endTime: e, questions: qs } };
}

module.exports = {
  QUIZ_GRACE_MS, ATTENDANCE_STATUSES, isLate, validateMarks, canReplaceSubmission, normalizeAttendanceDate,
  validateAttendanceInput, quizWindowState, quizDeadline, validateQuizAnswers, scoreQuiz, validateQuizDefinition,
};
