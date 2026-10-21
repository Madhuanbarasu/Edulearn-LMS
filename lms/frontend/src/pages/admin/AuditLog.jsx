import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Alert, Spinner, fmtDateTime, inputClass } from "../../components/ui";
import { Table, Td, Pager, errMsg } from "./shared";

const ACTIONS = ["", "faculty.approve", "faculty.reject", "user.disable", "user.enable", "user.update", "option.create", "option.update", "option.delete", "course.create", "course.allocate", "course.delete", "enrollment.add", "enrollment.remove", "admin.bootstrap"];

export default function AuditLog() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    api.get("/admin/audit-logs", { params: { action: action || undefined, page, limit: 25 } }).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, [action, page]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">A read-only record of sensitive administrative actions. Entries cannot be edited or deleted.</p>
      <select aria-label="Filter by action" className={`${inputClass} max-w-xs`} value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}>
        {ACTIONS.map((a) => (<option key={a} value={a}>{a || "All actions"}</option>))}
      </select>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? (error ? null : <Spinner />) : (
        <>
          <Table head={["When", "Actor", "Action", "Details"]} empty={data.logs.length === 0 ? "No audit entries yet." : null}>
            {data.logs.map((l) => (
              <tr key={l._id}><Td className="whitespace-nowrap text-slate-600">{fmtDateTime(l.createdAt)}</Td><Td>{l.actorName}</Td><Td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{l.action}</code></Td><Td className="text-slate-600">{l.summary}</Td></tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
