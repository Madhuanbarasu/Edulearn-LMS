import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function AnalyticsTab({ course, user }) {
  const [courseStats, setCourseStats] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isFaculty = user?.role === "faculty" || user?.role === "admin";

  useEffect(() => {
    setLoading(true);
    setError("");

    if (isFaculty) {
      api
        .get(`/analytics/course/${course._id}`)
        .then((res) => setCourseStats(res.data))
        .catch(() => setError("Failed to compute class performance analytics."))
        .finally(() => setLoading(false));
    } else {
      api
        .get(`/analytics/course/${course._id}/student/${user._id}`)
        .then((res) => setMyStats(res.data))
        .catch(() => setError("Failed to compute student analytics."))
        .finally(() => setLoading(false));
    }
  }, [course._id, user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Performance Analytics</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isFaculty
            ? "Inspect student grades, assignment completion ratios, and lecture attendance."
            : "Monitor your grades, quiz results, and participation standing in this course."}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Calculating analytics from live records...</p>
        </div>
      ) : !isFaculty ? (
        /* Student KPI Cards */
        myStats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Assignment Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Assignments</span>
                  <span className="text-lg">📝</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {myStats.assignmentsSubmitted} <span className="text-sm font-normal text-slate-400">/ {myStats.totalAssignments}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Avg Assignment Score:</span>
                  <span className="font-bold text-indigo-700">
                    {myStats.avgAssignmentScore != null ? `${myStats.avgAssignmentScore} pts` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Quiz Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Quizzes</span>
                  <span className="text-lg">🎯</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {myStats.quizzesAttempted} <span className="text-sm font-normal text-slate-400">/ {myStats.totalQuizzes}</span>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Avg Quiz Percentage:</span>
                  <span className="font-bold text-indigo-700">
                    {myStats.avgQuizPercentage != null ? `${myStats.avgQuizPercentage}%` : "N/A"}
                  </span>
                </div>
              </div>

              {/* Attendance Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
                  <span className="text-lg">📅</span>
                </div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {myStats.attendancePercentage != null ? `${myStats.attendancePercentage}%` : "N/A"}
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Status:</span>
                  {myStats.attendancePercentage != null && Number(myStats.attendancePercentage) >= 75 ? (
                    <span className="font-semibold text-emerald-600">Good Standing</span>
                  ) : myStats.attendancePercentage != null ? (
                    <span className="font-semibold text-rose-600">Attendance Warning</span>
                  ) : (
                    <span className="text-slate-400">No sessions yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            No analytics data recorded yet for this course.
          </div>
        )
      ) : (
        /* Faculty Student Cohort Table */
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Enrolled Students Roster &amp; Scores ({courseStats.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Roll / Student ID</th>
                    <th className="p-3.5">Submissions</th>
                    <th className="p-3.5">Avg Assignment Score</th>
                    <th className="p-3.5">Attendance %</th>
                    <th className="p-3.5">Overall Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courseStats.map((r) => {
                    const hasGoodAttendance =
                      r.attendancePercentage != null && Number(r.attendancePercentage) >= 75;

                    return (
                      <tr key={r.student._id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 font-bold text-slate-900">{r.student.name}</td>
                        <td className="p-3.5 text-slate-500 font-mono">
                          {r.student.rollNumber || "N/A"}
                        </td>
                        <td className="p-3.5 font-medium text-slate-700">
                          {r.submissionsCount} submitted
                        </td>
                        <td className="p-3.5 font-bold text-indigo-700">
                          {r.avgScore != null ? `${r.avgScore} pts` : "N/A"}
                        </td>
                        <td className="p-3.5">
                          {r.attendancePercentage != null ? (
                            <span
                              className={`px-2 py-0.5 rounded-full font-semibold ${
                                hasGoodAttendance
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {r.attendancePercentage}%
                            </span>
                          ) : (
                            <span className="text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {r.submissionsCount > 0 || r.attendancePercentage != null ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              Pending Activity
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {courseStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No students are enrolled in this course yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
