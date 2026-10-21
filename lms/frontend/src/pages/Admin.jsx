import React, { useState } from "react";
import { PageHeader } from "../components/ui";
import Overview from "./admin/Overview";
import Approvals from "./admin/Approvals";
import Users from "./admin/Users";
import Academics from "./admin/Academics";
import AdminCourses from "./admin/Courses";
import Reports from "./admin/Reports";
import AuditLog from "./admin/AuditLog";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "approvals", label: "Faculty approvals" },
  { id: "users", label: "Users" },
  { id: "academics", label: "Academic options" },
  { id: "courses", label: "Courses & enrollment" },
  { id: "reports", label: "Reports" },
  { id: "audit", label: "Audit log" },
];

export default function Admin() {
  const [tab, setTab] = useState("overview");
  const go = (id) => setTab(id);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader title="Administration" subtitle="Accounts, academic structure, allocation, enrollment, reports and audit." />
      <div role="tablist" aria-label="Administration sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}
            onClick={() => go(t.id)}
            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <Overview goTo={go} />}
        {tab === "approvals" && <Approvals />}
        {tab === "users" && <Users />}
        {tab === "academics" && <Academics />}
        {tab === "courses" && <AdminCourses />}
        {tab === "reports" && <Reports />}
        {tab === "audit" && <AuditLog />}
      </div>
    </div>
  );
}
