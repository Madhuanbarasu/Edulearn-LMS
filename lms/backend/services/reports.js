"use strict";
/** Pure roll-up helpers for admin reports (no DB access). Inputs are plain/lean objects. */
const sid = (v) => String(v && v._id ? v._id : v);
const pct = (n, d) => (d > 0 ? Number(((n / d) * 100).toFixed(2)) : null);

function attendanceRollup(sessions) {
  const t = { sessions: sessions.length, present: 0, late: 0, absent: 0, marks: 0 };
  sessions.forEach((s) => (s.records || []).forEach((r) => { t.marks += 1; if (t[r.status] !== undefined) t[r.status] += 1; }));
  return { ...t, percentage: pct(t.present + t.late, t.marks) }; // late counts as attended
}

function lowAttendance(sessions, threshold = 75) {
  const per = {};
  sessions.forEach((s) => (s.records || []).forEach((r) => {
    const k = sid(r.student);
    per[k] = per[k] || { student: r.student, present: 0, total: 0 };
    per[k].total += 1;
    if (r.status === "present" || r.status === "late") per[k].present += 1;
  }));
  return Object.values(per)
    .map((p) => ({ student: p.student, present: p.present, total: p.total, percentage: pct(p.present, p.total) }))
    .filter((p) => p.percentage !== null && p.percentage < threshold)
    .sort((a, b) => a.percentage - b.percentage);
}

function assignmentRollup(assignments, submissions) {
  const maxBy = Object.fromEntries(assignments.map((a) => [sid(a), a.maxMarks || 100]));
  const graded = submissions.filter((s) => s.marksObtained != null);
  return {
    assignments: assignments.length,
    submissions: submissions.length,
    late: submissions.filter((s) => s.isLate === true || s.status === "late").length,
    graded: graded.length,
    awaitingGrading: submissions.filter((s) => s.status !== "graded").length,
    avgPercentage: graded.length
      ? Number((graded.reduce((n, s) => n + (s.marksObtained / (maxBy[sid(s.assignment)] || 100)) * 100, 0) / graded.length).toFixed(2))
      : null,
  };
}

const countBy = (items, keyFn) => items.reduce((m, i) => { const k = keyFn(i); m[k] = (m[k] || 0) + 1; return m; }, {});

module.exports = { attendanceRollup, lowAttendance, assignmentRollup, countBy, pct };
