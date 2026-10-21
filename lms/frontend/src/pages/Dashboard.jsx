import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Alert, EmptyState, Spinner, StatusBadge, fmtDateTime, relativeDue } from "../components/ui";

const Card = ({ title, children, action }) => (
  <section className="bg-white rounded-2xl border border-slate-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const Metric = ({ label, value, sub }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200">
    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
    <div className="text-3xl font-extrabold text-slate-900">{value}</div>
    {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
  </div>
);

const Row = ({ to, title, meta, right }) => (
  <li>
    <Link to={to} className="flex items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{meta}</p>
      </div>
      <div className="flex-shrink-0 text-right">{right}</div>
    </Link>
  </li>
);

function StudentView({ s }) {
  const none = !s.enrolledCourses;
  return (
    <div className="space-y-6">
      {none && (
        <EmptyState
          title="You are not enrolled in any course yet"
          hint="Browse the course catalogue and enrol to see assignments, quizzes and attendance here."
          action={<Link to="/courses" className="text-sm font-semibold text-indigo-600">Browse courses →</Link>}
        />
      )}

      {(s.overdueAssignments.length > 0 || s.upcomingAssignments.length > 0 || s.upcomingQuizzes.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={`Overdue work (${s.overdueAssignments.length})`}>
            {s.overdueAssignments.length === 0 ? <p className="text-sm text-slate-500">Nothing overdue. Well done.</p> : (
              <ul className="divide-y divide-slate-100">
                {s.overdueAssignments.map((a) => (
                  <Row key={a._id} to={`/courses/${a.course._id}`} title={a.title} meta={`${a.course.code || ""} · was due ${fmtDateTime(a.dueDate)}`}
                    right={<StatusBadge status="overdue">{relativeDue(a.dueDate)}</StatusBadge>} />
                ))}
              </ul>
            )}
          </Card>
          <Card title="Upcoming deadlines and tests">
            {s.upcomingAssignments.length + s.upcomingQuizzes.length === 0 ? <p className="text-sm text-slate-500">No upcoming deadlines.</p> : (
              <ul className="divide-y divide-slate-100">
                {s.upcomingQuizzes.map((q) => (
                  <Row key={q._id} to={`/courses/${q.course._id}`} title={`Quiz: ${q.title}`} meta={`${q.course.code || ""} · ${q.duration} min · ${q.windowState === "open" ? `closes ${fmtDateTime(q.endTime)}` : `opens ${fmtDateTime(q.startTime)}`}`}
                    right={<StatusBadge status={q.windowState}>{q.windowState === "open" ? "Open now" : "Upcoming"}</StatusBadge>} />
                ))}
                {s.upcomingAssignments.map((a) => (
                  <Row key={a._id} to={`/courses/${a.course._id}`} title={a.title} meta={`${a.course.code || ""} · due ${fmtDateTime(a.dueDate)}`}
                    right={<span className="text-xs font-semibold text-slate-600">{relativeDue(a.dueDate)}</span>} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Enrolled courses" value={s.enrolledCourses ?? 0} />
        <Metric label="Assignments" value={`${s.submittedAssignments ?? 0} / ${s.totalAssignments ?? 0}`} sub={s.pendingAssignments > 0 ? `${s.pendingAssignments} not submitted` : "All submitted"} />
        <Metric label="Quizzes attempted" value={`${s.attemptedQuizzes ?? 0} / ${s.totalQuizzes ?? 0}`} />
        <Metric label="Attendance" value={s.attendancePercentage !== "N/A" ? `${s.attendancePercentage}%` : "N/A"} sub="Across all courses" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="My courses" action={<Link to="/courses" className="text-xs font-semibold text-indigo-600">All courses →</Link>}>
          {s.recentCourses.length === 0 ? <p className="text-sm text-slate-500">No courses yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {s.recentCourses.map((c) => (<Row key={c._id} to={`/courses/${c._id}`} title={c.title} meta={c.code} right={<span className="text-xs text-indigo-600 font-semibold">Open</span>} />))}
            </ul>
          )}
        </Card>
        <Card title="Released grades">
          {s.recentGrades.length === 0 ? <p className="text-sm text-slate-500">No graded work yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {s.recentGrades.map((g) => (
                <Row key={g._id} to={`/courses/${g.course._id || ""}`} title={g.assignmentTitle} meta={`${g.course.code || ""}${g.hasFeedback ? " · feedback available" : ""}`}
                  right={<span className="text-sm font-bold text-slate-900">{g.marksObtained} / {g.maxMarks}</span>} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {s.attendanceByCourse.length > 0 && (
        <Card title="Attendance by course">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-2 pr-4">Course</th><th className="py-2 pr-4">Attended</th><th className="py-2">Percentage</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.attendanceByCourse.map((a) => (
                  <tr key={a.course._id}>
                    <td className="py-2 pr-4 font-medium text-slate-900">{a.course.code} <span className="text-slate-500 font-normal">{a.course.title}</span></td>
                    <td className="py-2 pr-4 text-slate-600">{a.present} / {a.total}</td>
                    <td className="py-2">{a.percentage === null ? <span className="text-slate-500">No sessions</span> : (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{a.percentage}%</span>
                        {Number(a.percentage) < 75 && <StatusBadge status="late">Below 75%</StatusBadge>}
                      </span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FacultyView({ s }) {
  return (
    <div className="space-y-6">
      {s.teachingCourses === 0 && (
        <EmptyState title="No courses are allocated to you yet" hint="Create a course, or ask an administrator to allocate one to you." action={<Link to="/courses" className="text-sm font-semibold text-indigo-600">Go to courses →</Link>} />
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Courses" value={s.teachingCourses ?? 0} />
        <Metric label="Students" value={s.totalStudents ?? 0} sub="Across your courses" />
        <Metric label="Awaiting grading" value={s.pendingGrading ?? 0} sub={s.pendingGrading ? "Submissions to review" : "All graded"} />
        <Metric label="Assignments / quizzes" value={`${s.totalAssignments ?? 0} / ${s.totalQuizzes ?? 0}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Submissions awaiting grading (${s.pendingGrading ?? 0})`}>
          {s.awaitingGrading.length === 0 ? <p className="text-sm text-slate-500">Nothing to grade right now.</p> : (
            <ul className="divide-y divide-slate-100">
              {s.awaitingGrading.map((x) => (
                <Row key={x._id} to={`/courses/${x.course._id}`} title={`${x.student.name || "Student"} — ${x.assignmentTitle}`} meta={`${x.course.code || ""} · submitted ${fmtDateTime(x.submittedAt)}`}
                  right={x.isLate ? <StatusBadge status="late">Late</StatusBadge> : <StatusBadge status="submitted">Submitted</StatusBadge>} />
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming deadlines and quizzes">
          {s.upcomingDeadlines.length + s.upcomingQuizzes.length === 0 ? <p className="text-sm text-slate-500">No upcoming deadlines.</p> : (
            <ul className="divide-y divide-slate-100">
              {s.upcomingDeadlines.map((a) => (<Row key={a._id} to={`/courses/${a.course._id}`} title={a.title} meta={`${a.course.code || ""} · due ${fmtDateTime(a.dueDate)}`} right={<span className="text-xs font-semibold text-slate-600">{relativeDue(a.dueDate)}</span>} />))}
              {s.upcomingQuizzes.map((q) => (<Row key={q._id} to={`/courses/${q.course._id}`} title={`Quiz: ${q.title}`} meta={`${q.course.code || ""} · ${fmtDateTime(q.startTime)}`} right={<StatusBadge status="upcoming">Quiz</StatusBadge>} />))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="My courses" action={<Link to="/courses" className="text-xs font-semibold text-indigo-600">Manage →</Link>}>
        {s.coursesSummary.length === 0 ? <p className="text-sm text-slate-500">No courses allocated.</p> : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="py-2 pr-4">Course</th><th className="py-2 pr-4">Students</th><th className="py-2 pr-4">Assignments</th><th className="py-2">Awaiting grading</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.coursesSummary.map((c) => (
                  <tr key={c._id}>
                    <td className="py-2 pr-4"><Link to={`/courses/${c._id}`} className="font-semibold text-indigo-600 hover:underline">{c.code}</Link> <span className="text-slate-500">{c.title}</span></td>
                    <td className="py-2 pr-4 text-slate-700">{c.studentCount}</td>
                    <td className="py-2 pr-4 text-slate-700">{c.assignmentCount}</td>
                    <td className="py-2">{c.awaitingGrading > 0 ? <StatusBadge status="pending">{c.awaitingGrading} to grade</StatusBadge> : <span className="text-slate-500">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/analytics/dashboard");
      setStats(res.data);
    } catch (err) {
      setError("Unable to load your dashboard right now.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (user?.role !== "admin") fetchStats(); }, [user?.role]);

  if (user?.role === "admin") return <Navigate to="/admin" replace />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 capitalize">
          {user?.role} dashboard{user?.department ? ` · ${user.department}` : ""}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">Welcome back, {user?.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.role === "faculty" ? "Your teaching overview: what needs grading and what is due next." : "Your priorities first: overdue work, upcoming deadlines and tests."}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3"><div className="flex-1"><Alert kind="error">{error}</Alert></div>
          <button onClick={fetchStats} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700">Retry</button></div>
      )}
      {loading ? <Spinner label="Loading your dashboard..." /> : stats && (user?.role === "faculty" ? <FacultyView s={stats} /> : <StudentView s={stats} />)}
    </div>
  );
}
