import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Alert, ConfirmDialog, Spinner, StatusBadge, btnPrimary, inputClass } from "../../components/ui";
import { errMsg } from "./shared";

const TYPES = [
  { key: "department", label: "Departments" },
  { key: "academicYear", label: "Academic years", hint: "e.g. 2026-27" },
  { key: "studyYear", label: "Study years", hint: "e.g. Year 1" },
  { key: "section", label: "Sections", hint: "e.g. A" },
];

function Group({ type, items, reload, setMsg }) {
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try { await api.post("/admin/options", { type: type.key, name: name.trim() }); setName(""); await reload(); }
    catch (er) { setMsg({ kind: "error", text: errMsg(er) }); } finally { setBusy(false); }
  };
  const toggle = async (o) => {
    try { await api.patch(`/admin/options/${o._id}`, { active: !o.active }); await reload(); }
    catch (er) { setMsg({ kind: "error", text: errMsg(er) }); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/admin/options/${confirm._id}`); setConfirm(null); await reload(); }
    catch (er) { setMsg({ kind: "error", text: errMsg(er) }); setConfirm(null); } finally { setBusy(false); }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5" aria-label={type.label}>
      <h2 className="text-sm font-bold text-slate-900 mb-3">{type.label}</h2>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input aria-label={`New ${type.label.toLowerCase()} name`} className={inputClass} placeholder={type.hint || "Name"} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <button className={btnPrimary} disabled={busy || !name.trim()}>Add</button>
      </form>
      {items.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
        <ul className="divide-y divide-slate-100">
          {items.map((o) => (
            <li key={o._id} className="py-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900 truncate">{o.name}</span>
              <span className="flex items-center gap-3 flex-shrink-0">
                <StatusBadge status={o.active ? "active" : "disabled"}>{o.active ? "Active" : "Inactive"}</StatusBadge>
                <button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => toggle(o)}>{o.active ? "Deactivate" : "Activate"}</button>
                <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setConfirm(o)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!confirm} busy={busy} danger title="Delete this option?" message={`"${confirm?.name}" will be removed. Options already used by users or courses cannot be deleted; deactivate them instead.`} confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirm(null)} />
    </section>
  );
}

export default function Academics() {
  const [options, setOptions] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => api.get("/admin/options").then((r) => setOptions(r.data)).catch((e) => setMsg({ kind: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);
  if (!options) return msg ? <Alert kind="error">{msg.text}</Alert> : <Spinner />;
  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <p className="text-sm text-slate-500">These lists feed the registration form and course placement. Inactive options are hidden from new registrations but kept on existing records.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {TYPES.map((t) => (<Group key={t.key} type={t} items={options.filter((o) => o.type === t.key)} reload={load} setMsg={setMsg} />))}
      </div>
    </div>
  );
}
