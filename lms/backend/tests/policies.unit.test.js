const test = require("node:test");
const assert = require("node:assert/strict");
const p = require("../services/policies");
const v = require("../utils/validators");
const reports = require("../services/reports");

test("password strength rules", () => {
  assert.ok(v.passwordMessage("short1A"));
  assert.ok(v.passwordMessage("alllowercase1"));
  assert.ok(v.passwordMessage("ALLUPPERCASE1"));
  assert.ok(v.passwordMessage("NoDigitsHere"));
  assert.equal(v.passwordMessage("GoodPass123"), null);
  assert.ok(v.passwordMessage(12345678));
});

test("email validation", () => {
  assert.ok(v.validateEmail("nope"));
  assert.ok(v.validateEmail("a@b"));
  assert.ok(v.validateEmail({ $ne: null }));
  assert.equal(v.validateEmail("a@b.co"), null);
});

test("objectId validation rejects operators and malformed values", () => {
  assert.equal(v.isObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(v.isObjectId("507f1f77bcf86cd79943901"), false);
  assert.equal(v.isObjectId({ $gt: "" }), false);
  assert.equal(v.isObjectId(undefined), false);
});

test("late detection", () => {
  const due = new Date("2026-01-10T10:00:00Z");
  assert.equal(p.isLate(due, new Date("2026-01-10T09:59:59Z")), false);
  assert.equal(p.isLate(due, new Date("2026-01-10T10:00:01Z")), true);
});

test("marks validation", () => {
  assert.equal(p.validateMarks(50, 100).value, 50);
  assert.equal(p.validateMarks("42.5", 100).value, 42.5);
  assert.equal(p.validateMarks(100, 100).value, 100);
  assert.equal(p.validateMarks(0, 100).value, 0);
  assert.ok(p.validateMarks(101, 100).error);
  assert.ok(p.validateMarks(-1, 100).error);
  assert.ok(p.validateMarks("abc", 100).error);
  assert.ok(p.validateMarks(NaN, 100).error);
  assert.ok(p.validateMarks(Infinity, 100).error);
  assert.ok(p.validateMarks(null, 100).error);
  assert.ok(p.validateMarks(30, 25).error);
});

test("graded submissions cannot be replaced", () => {
  assert.equal(p.canReplaceSubmission(null), true);
  assert.equal(p.canReplaceSubmission({ status: "submitted" }), true);
  assert.equal(p.canReplaceSubmission({ status: "late" }), true);
  assert.equal(p.canReplaceSubmission({ status: "graded" }), false);
});

const S1 = "507f1f77bcf86cd799439011", S2 = "507f1f77bcf86cd799439012", OUT = "507f1f77bcf86cd799439013";
test("attendance input validation", () => {
  const now = new Date("2026-03-10T12:00:00");
  const ok = p.validateAttendanceInput({ date: "2026-03-10", records: [{ student: S1, status: "present" }, { student: S2, status: "late" }] }, [S1, S2], now);
  assert.equal(ok.error, undefined);
  assert.equal(ok.records.length, 2);
  assert.ok(p.validateAttendanceInput({ date: "garbage", records: [{ student: S1, status: "present" }] }, [S1], now).error);
  assert.ok(p.validateAttendanceInput({ date: "2026-03-20", records: [{ student: S1, status: "present" }] }, [S1], now).error, "future date");
  assert.ok(p.validateAttendanceInput({ date: "2026-03-10", records: [] }, [S1], now).error);
  assert.ok(p.validateAttendanceInput({ date: "2026-03-10", records: [{ student: S1, status: "excused" }] }, [S1], now).error);
  assert.ok(p.validateAttendanceInput({ date: "2026-03-10", records: [{ student: OUT, status: "present" }] }, [S1], now).error, "not enrolled");
  assert.ok(p.validateAttendanceInput({ date: "2026-03-10", records: [{ student: S1, status: "present" }, { student: S1, status: "absent" }] }, [S1], now).error, "duplicate");
  assert.ok(p.validateAttendanceInput({ date: "2026-03-10", records: [{ student: { $ne: 1 }, status: "present" }] }, [S1], now).error);
});

test("attendance dates normalise to the same instant for the same day", () => {
  const a = p.normalizeAttendanceDate("2026-03-10T08:00:00"), b = p.normalizeAttendanceDate("2026-03-10T21:30:00");
  assert.equal(a.getTime(), b.getTime());
});

const quiz = { startTime: new Date("2026-01-01T10:00:00Z"), endTime: new Date("2026-01-01T12:00:00Z"), duration: 30 };
test("quiz window state", () => {
  assert.equal(p.quizWindowState(quiz, new Date("2026-01-01T09:59:00Z")), "upcoming");
  assert.equal(p.quizWindowState(quiz, new Date("2026-01-01T10:00:00Z")), "open");
  assert.equal(p.quizWindowState(quiz, new Date("2026-01-01T12:00:01Z")), "closed");
});
test("quiz deadline is the earlier of duration and window end", () => {
  assert.equal(p.quizDeadline(quiz, new Date("2026-01-01T10:10:00Z")).toISOString(), "2026-01-01T10:40:00.000Z");
  assert.equal(p.quizDeadline(quiz, new Date("2026-01-01T11:50:00Z")).toISOString(), "2026-01-01T12:00:00.000Z");
});
const qs = [{ options: ["a", "b", "c"], correctOptionIndex: 1, marks: 2 }, { options: ["x", "y"], correctOptionIndex: 0, marks: 3 }];
test("quiz answer validation + scoring", () => {
  assert.deepEqual(p.validateQuizAnswers([1, 0], qs).answers, [1, 0]);
  assert.deepEqual(p.validateQuizAnswers([null, -1], qs).answers, [-1, -1]);
  assert.ok(p.validateQuizAnswers([1], qs).error, "wrong length");
  assert.ok(p.validateQuizAnswers([1, 2], qs).error, "out of range");
  assert.ok(p.validateQuizAnswers([1.5, 0], qs).error, "non-integer");
  assert.ok(p.validateQuizAnswers("1,0", qs).error, "not array");
  assert.deepEqual(p.scoreQuiz(qs, [1, 0]), { score: 5, totalMarks: 5 });
  assert.deepEqual(p.scoreQuiz(qs, [0, 0]), { score: 3, totalMarks: 5 });
  assert.deepEqual(p.scoreQuiz(qs, [-1, -1]), { score: 0, totalMarks: 5 });
});
test("quiz definition validation", () => {
  const good = { title: "T", duration: 10, startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z", questions: [{ questionText: "q", options: ["a", "b"], correctOptionIndex: 0 }] };
  assert.ok(p.validateQuizDefinition(good).value);
  assert.ok(p.validateQuizDefinition({ ...good, duration: 0 }).error);
  assert.ok(p.validateQuizDefinition({ ...good, duration: 1.5 }).error);
  assert.ok(p.validateQuizDefinition({ ...good, endTime: good.startTime }).error);
  assert.ok(p.validateQuizDefinition({ ...good, questions: [] }).error);
  assert.ok(p.validateQuizDefinition({ ...good, questions: [{ questionText: "q", options: ["a"], correctOptionIndex: 0 }] }).error);
  assert.ok(p.validateQuizDefinition({ ...good, questions: [{ questionText: "q", options: ["a", "b"], correctOptionIndex: 2 }] }).error);
});

test("report roll-ups", () => {
  const sessions = [
    { records: [{ student: S1, status: "present" }, { student: S2, status: "absent" }] },
    { records: [{ student: S1, status: "late" }, { student: S2, status: "absent" }] },
  ];
  const r = reports.attendanceRollup(sessions);
  assert.equal(r.sessions, 2); assert.equal(r.percentage, 50);
  const low = reports.lowAttendance(sessions, 75);
  assert.equal(low.length, 1); assert.equal(String(low[0].student), S2); assert.equal(low[0].percentage, 0);
  const a = reports.assignmentRollup([{ _id: "A", maxMarks: 50 }], [{ assignment: "A", marksObtained: 25, status: "graded", isLate: true }, { assignment: "A", status: "submitted" }]);
  assert.deepEqual({ g: a.graded, l: a.late, w: a.awaitingGrading, p: a.avgPercentage }, { g: 1, l: 1, w: 1, p: 50 });
});
