import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import { Alert, ConfirmDialog, Spinner, StatusBadge, btnPrimary, btnSecondary, inputClass, fmtDate } from "../../components/ui";
import { Table, Td, Pager, errMsg } from "./shared";
import { useAuth } from "../../context/AuthContext";

export default function Users() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState({ q: "", role: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = { page, limit: 15, ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) };
    return api.get("/admin/users", { params }).then((r) => setData(r.data)).catch((e) => setMsg({ kind: "error", text: errMsg(e) }));
  }, [applied, page]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async () => {
    const next = confirm.user.status === "disabled" ? "active" : "disabled";
    setBusy(true);
    try {
      await api.patch(`/admin/users/${confirm.user._id}/status`, { status: next });
      setMsg({ kind: "success", text: `${confirm.user.name} is now ${next}.` });
      setConfirm(null); await load();
    } catch (e) { setMsg({ kind: "error", text: errMsg(e) }); setConfirm(null); } finally { setBusy(false); }
  };

  const saveEdit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { _id, name, department, academicYear, studyYear, section, rollNumber } = edit;
      await api.patch(`/admin/users/${_id}`, { name, department: department || "", academicYear: academicYear || "", studyYear: studyYear || "", section: section || "", rollNumber: rollNumber || "" });
      setMsg({ kind: "success", text: "User updated." }); setEdit(null); await load();
    } catch (er) { setMsg({ kind: "error", text: errMsg(er) }); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <form className="grid grid-cols-1 sm:grid-cols-4 gap-3" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }}>
        <input aria-label="Search users" className={`${inputClass} sm:col-span-2`} placeholder="Search name, email or roll number" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select aria-label="Filter by role" className={inputClass} value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          <option value="">All roles</option><option value="student">Students</option><option value="faculty">Faculty</option><option value="admin">Admins</option>
        </select>
        <div className="flex gap-2">
          <select aria-label="Filter by status" className={inputClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Any status</option><option value="active">Active</option><option value="pending">Pending</option><option value="disabled">Disabled</option><option value="rejected">Rejected</option>
          </select>
          <button type="submit" className={btnPrimary}>Filter</button>
        </div>
      </form>

      {!data ? <Spinner /> : (
        <>
          <Table head={["Name", "Role", "Status", "Department", "Joined", "Actions"]} empty={data.users.length === 0 ? "No users match these filters." : null}>
            {data.users.map((u) => (
              <tr key={u._id}>
                <Td><p className="font-semibold text-slate-900">{u.name}</p><p className="text-xs text-slate-500">{u.email}{u.rollNumber ? ` · ${u.rollNumber}` : ""}</p></Td>
                <Td className="capitalize">{u.role}</Td>
                <Td><StatusBadge status={u.status || "active"} /></Td>
                <Td>{u.department || "—"}</Td>
                <Td>{fmtDate(u.createdAt)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setEdit({ ...u })}>Edit</button>
                    {u._id !== me._id && (u.status === "active" || u.status === "disabled" || !u.status) && (
                      <button className={`text-xs font-semibold hover:underline ${u.status === "disabled" ? "text-emerald-600" : "text-rose-600"}`} onClick={() => setConfirm({ user: u })}>
                        {u.status === "disabled" ? "Enable" : "Disable"}
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!confirm} busy={busy} danger={confirm?.user.status !== "disabled"}
        title={confirm?.user.status === "disabled" ? "Enable this account?" : "Disable this account?"}
        message={confirm ? (confirm.user.status === "disabled" ? `${confirm.user.name} will be able to sign in again.` : `${confirm.user.name} will be signed out immediately and unable to use EduLearn until re-enabled. No records are deleted.`) : ""}
        confirmLabel={confirm?.user.status === "disabled" ? "Enable" : "Disable"} onConfirm={setStatus} onCancel={() => setConfirm(null)}
      />

      {edit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setEdit(null)}>
          <form onSubmit={saveEdit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit user" className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 space-y-3">
            <h3 className="text-base font-bold text-slate-900">Edit {edit.email}</h3>
            <p className="text-xs text-slate-500">Role, email and password cannot be changed here.</p>
            {[["name", "Name"], ["department", "Department"], ["rollNumber", "Roll number"], ["academicYear", "Academic year"], ["studyYear", "Study year"], ["section", "Section"]].map(([k, label]) => (
              <label key={k} className="block text-xs font-semibold text-slate-700">{label}
                <input className={`${inputClass} mt-1 font-normal`} value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} maxLength={100} />
              </label>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnSecondary} onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
