import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Alert, Spinner, StatusBadge, fmtDateTime } from "../../components/ui";
import { Stat, errMsg } from "./shared";

export default function Overview({ goTo }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/admin/overview").then((r) => setData(r.data)).catch((e) => setError(errMsg(e, "Failed to load overview."))); }, []);
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Spinner />;
  const c = data.counts;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Students" value={c.students} />
        <Stat label="Faculty" value={c.faculty} />
        <Stat label="Courses" value={c.courses} />
        <Stat label="Pending approvals" value={c.pendingFaculty} tone="warn" />
        <Stat label="Admins" value={c.admins} />
        <Stat label="Disabled accounts" value={c.disabledUsers} />
        <Stat label="Assignments" value={c.assignments} />
        <Stat label="Quizzes" value={c.quizzes} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Pending faculty approvals</h2>
            <button onClick={() => goTo("approvals")} className="text-xs font-semibold text-indigo-600">Review →</button>
          </div>
          {data.pendingFaculty.length === 0 ? <p className="text-sm text-slate-500">No registrations waiting.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.pendingFaculty.map((u) => (
                <li key={u._id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p><p className="text-xs text-slate-500 truncate">{u.email}</p></div>
                  <StatusBadge status="pending" />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent administrative activity</h2>
            <button onClick={() => goTo("audit")} className="text-xs font-semibold text-indigo-600">Full log →</button>
          </div>
          {data.recentActivity.length === 0 ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((l) => (
                <li key={l._id} className="py-2"><p className="text-sm text-slate-900">{l.summary || l.action}</p><p className="text-xs text-slate-500">{l.actorName} · {fmtDateTime(l.createdAt)}</p></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
