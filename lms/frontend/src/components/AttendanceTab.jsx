import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function AttendanceTab({ course, user }) {
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [date, setDate] = useState(localToday);
  const [statusMap, setStatusMap] = useState({});
  const [history, setHistory] = useState([]);
  const [mySummary, setMySummary] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isFaculty = user?.role === "faculty" || user?.role === "admin";

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const histRes = await api.get(`/attendance/course/${course._id}`);
      setHistory(histRes.data);

      if (user?.role === "student") {
        const sumRes = await api.get(`/attendance/course/${course._id}/student/${user._id}`);
        setMySummary(sumRes.data);
      }
    } catch (err) {
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [course._id]);

  const toggleStatus = (studentId, status) => {
    setStatusMap((m) => ({ ...m, [studentId]: status }));
  };

  const markAll = (status) => {
    const next = {};
    (course.students || []).forEach((s) => {
      next[s._id] = status;
    });
    setStatusMap(next);
  };

  const handleSave = async () => {
    if (!course.students || course.students.length === 0) {
      setError("Cannot record attendance: No students enrolled in this course yet.");
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    const records = (course.students || []).map((s) => ({
      student: s._id,
      status: statusMap[s._id] || "present",
    }));

    try {
      await api.post("/attendance", { course: course._id, date, records });
      setSuccess(`Attendance recorded for ${new Date(date).toLocaleDateString()}!`);
      loadAttendance();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Attendance Tracker</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isFaculty
            ? "Record daily lecture attendance and review historical participation."
            : "Review your attendance percentage and verify session participation records."}
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-500 font-bold">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-500 font-bold">&times;</button>
        </div>
      )}

      {/* Student View */}
      {user?.role === "student" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
              Your Attendance Standing
            </h3>

            {loading ? (
              <p className="text-xs text-slate-400">Computing attendance records...</p>
            ) : mySummary ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      {mySummary.percentage}%
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Attended {mySummary.present} out of {mySummary.total} recorded sessions
                    </p>
                  </div>

                  <div>
                    {Number(mySummary.percentage) >= 75 ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        &check; Good Standing (&ge; 75%)
                      </span>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                        &excl; Attendance Warning (&lt; 75%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        Number(mySummary.percentage) >= 75 ? "bg-emerald-600" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(Number(mySummary.percentage), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No attendance records found.</p>
            )}
          </div>

          {/* Session History for Student */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4">
              Past Session Logs
            </h3>
            {history.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {history.map((h) => {
                  const rec = h.records.find((r) => String(r.student?._id || r.student) === String(user._id));
                  const status = rec ? rec.status : "unrecorded";
                  return (
                    <div key={h._id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">
                          {new Date(h.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div>
                        <span
                          className={`px-2.5 py-1 rounded-full font-semibold capitalize ${
                            status === "present"
                              ? "bg-emerald-50 text-emerald-700"
                              : status === "late"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No session logs available yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Faculty Marking Panel */}
      {isFaculty && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Mark Class Attendance</h3>
                <p className="text-xs text-slate-500">
                  Select a session date and toggle attendance status for each enrolled student.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  max={localToday()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500 font-medium">Quick Mark:</span>
              <button
                type="button"
                onClick={() => markAll("present")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                All Present
              </button>
              <button
                type="button"
                onClick={() => markAll("absent")}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100"
              >
                All Absent
              </button>
            </div>

            {/* Students Attendance Sheet */}
            <div className="space-y-2 pt-2">
              {(course.students || []).map((s) => {
                const currentStatus = statusMap[s._id] || "present";
                return (
                  <div
                    key={s._id}
                    className="p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50"
                  >
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{s.name}</span>
                      <span className="text-xs text-slate-400 ml-2 font-mono">
                        ({s.rollNumber || s.email})
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {[
                        { id: "present", label: "Present", color: "bg-emerald-600 text-white" },
                        { id: "late", label: "Late", color: "bg-amber-600 text-white" },
                        { id: "absent", label: "Absent", color: "bg-rose-600 text-white" },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => toggleStatus(s._id, btn.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            currentStatus === btn.id
                              ? btn.color
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {(!course.students || course.students.length === 0) && (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No students are enrolled in this course yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={handleSave}
                disabled={saving || !course.students?.length}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
              >
                {saving ? "Saving Record..." : "Save Attendance"}
              </button>
            </div>
          </div>

          {/* Historical Sessions Log */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Past Recorded Sessions</h3>

            {history.length > 0 ? (
              <div className="space-y-2">
                {history.map((h) => {
                  const isExpanded = expandedDate === h._id;
                  const presentCount = h.records.filter((r) => r.status !== "absent").length;
                  return (
                    <div key={h._id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div
                        onClick={() => setExpandedDate(isExpanded ? null : h._id)}
                        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition text-xs"
                      >
                        <div>
                          <strong className="text-slate-800">
                            {new Date(h.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </strong>
                          <span className="text-slate-500 ml-3">
                            {presentCount} / {h.records.length} present (
                            {h.records.length > 0 ? ((presentCount / h.records.length) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                        <span className="text-indigo-600 font-semibold">
                          {isExpanded ? "Hide Details" : "View Breakdown"}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50 p-4 border-t border-slate-200 divide-y divide-slate-100">
                          {h.records.map((r, rIdx) => (
                            <div key={rIdx} className="py-2 flex items-center justify-between text-xs">
                              <span className="text-slate-800">
                                {r.student?.name || "Student"} ({r.student?.rollNumber || "ID"})
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded font-semibold capitalize ${
                                  r.status === "present"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.status === "late"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No attendance sessions recorded yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
