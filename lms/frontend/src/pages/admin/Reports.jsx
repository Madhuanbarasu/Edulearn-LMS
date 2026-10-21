import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Alert, Spinner, StatusBadge, inputClass, btnPrimary } from "../../components/ui";
import { Table, Td, Stat, errMsg } from "./shared";

const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [att, setAtt] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [threshold, setThreshold] = useState(75);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.get("/admin/reports/summary"), api.get("/admin/reports/courses"), api.get("/admin/reports/assignments")])
      .then(([s, c, a]) => { setSummary(s.data); setCourses(c.data); setAssignments(a.data); })
      .catch((e) => setError(errMsg(e, "Failed to load reports.")));
  }, []);
  const loadAtt = (e) => {
    e?.preventDefault();
    api.get("/admin/reports/attendance", { params: { courseId: courseId || undefined, threshold } }).then((r) => setAtt(r.data)).catch((er) => setError(errMsg(er)));
  };
  useEffect(() => { loadAtt(); /* eslint-disable-next-line */ }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!summary || !courses || !assignments) return <Spinner />;
  return (
    <div className="space-y-8">
      <section aria-label="Institution summary" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Courses" value={summary.courses} />
        <Stat label="Enrollments" value={summary.totalEnrollments} />
        <Stat label="Submissions" value={summary.submissions} />
        <Stat label="Overall attendance" value={pct(summary.attendance.percentage)} />
      </section>

      <section aria-label="Course summary" className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">Course summary</h2>
        <Table head={["Course", "Faculty", "Students", "Assignments", "Quizzes", "Sessions", "Attendance"]} empty={courses.length === 0 ? "No courses yet." : null}>
          {courses.map((c) => (
            <tr key={c._id}><Td><span className="font-semibold text-slate-900">{c.code}</span> <span className="text-xs text-slate-500">{c.title}</span></Td><Td>{c.faculty || "—"}</Td><Td>{c.students}</Td><Td>{c.assignments}</Td><Td>{c.quizzes}</Td><Td>{c.attendanceSessions}</Td><Td>{pct(c.attendancePercentage)}</Td></tr>
          ))}
        </Table>
      </section>

      <section aria-label="Assignment report" className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">Assignments and grading</h2>
        <Table head={["Course", "Assignments", "Submissions", "Late", "Graded", "Awaiting grading", "Avg score"]} empty={assignments.length === 0 ? "No data." : null}>
          {assignments.map((r) => (
            <tr key={r.course._id}><Td className="font-semibold text-slate-900">{r.course.code}</Td><Td>{r.assignments}</Td><Td>{r.submissions}</Td><Td>{r.late}</Td><Td>{r.graded}</Td><Td>{r.awaitingGrading}</Td><Td>{pct(r.avgPercentage)}</Td></tr>
          ))}
        </Table>
      </section>

      <section aria-label="Attendance report" className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Attendance</h2>
        <form onSubmit={loadAtt} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select aria-label="Course" className={`${inputClass} sm:col-span-2`} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (<option key={c._id} value={c._id}>{c.code} · {c.title}</option>))}
          </select>
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">Alert below
            <input type="number" min="0" max="100" className={`${inputClass} w-20`} value={threshold} onChange={(e) => setThreshold(e.target.value)} />%
          </label>
          <button className={btnPrimary}>Apply</button>
        </form>
        {att && (
          <>
            <Table head={["Course", "Sessions", "Present", "Late", "Absent", "Attendance"]} empty={att.courses.length === 0 ? "No data." : null}>
              {att.courses.map((r) => (
                <tr key={r.course._id}><Td className="font-semibold text-slate-900">{r.course.code}</Td><Td>{r.sessions}</Td><Td>{r.present}</Td><Td>{r.late}</Td><Td>{r.absent}</Td><Td>{pct(r.percentage)}</Td></tr>
              ))}
            </Table>
            {att.belowThreshold && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Students below {att.threshold}%</h3>
                <Table head={["Student", "Attended", "Percentage"]} empty={att.belowThreshold.length === 0 ? "No students below the threshold." : null}>
                  {att.belowThreshold.map((s) => (
                    <tr key={s.student._id}><Td>{s.student.name} <span className="text-xs text-slate-500">{s.student.rollNumber}</span></Td><Td>{s.present} / {s.total}</Td><Td><StatusBadge status="absent">{pct(s.percentage)}</StatusBadge></Td></tr>
                  ))}
                </Table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
