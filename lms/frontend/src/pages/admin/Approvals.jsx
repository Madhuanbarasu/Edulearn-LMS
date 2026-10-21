import React, { useEffect, useState } from "react";
import api from "../../api/axios";
import { Alert, ConfirmDialog, EmptyState, Spinner, btnPrimary, btnSecondary, fmtDate } from "../../components/ui";
import { errMsg } from "./shared";

export default function Approvals() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState(null); // { user, action }
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/faculty/pending").then((r) => setList(r.data)).catch((e) => setMsg({ kind: "error", text: errMsg(e) }));
  useEffect(() => { load(); }, []);

  const decide = async () => {
    setBusy(true);
    try {
      await api.post(`/admin/faculty/${confirm.user._id}/${confirm.action}`);
      setMsg({ kind: "success", text: `${confirm.user.name} was ${confirm.action === "approve" ? "approved" : "rejected"}.` });
      setConfirm(null);
      await load();
    } catch (e) { setMsg({ kind: "error", text: errMsg(e) }); setConfirm(null); } finally { setBusy(false); }
  };

  if (!list) return <Spinner />;
  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      {list.length === 0 ? <EmptyState title="No pending faculty registrations" hint="New faculty sign-ups will appear here for review." /> : (
        <ul className="space-y-3">
          {list.map((u) => (
            <li key={u._id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{u.name}</p>
                <p className="text-sm text-slate-600">{u.email}</p>
                <p className="text-xs text-slate-500 mt-0.5">{u.department || "No department given"} · registered {fmtDate(u.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={() => setConfirm({ user: u, action: "reject" })}>Reject</button>
                <button className={btnPrimary} onClick={() => setConfirm({ user: u, action: "approve" })}>Approve</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirm} busy={busy} danger={confirm?.action === "reject"}
        title={confirm?.action === "approve" ? "Approve faculty account?" : "Reject registration?"}
        message={confirm ? (confirm.action === "approve" ? `${confirm.user.name} will be able to sign in and manage courses allocated to them.` : `${confirm.user.name} will not be able to sign in. The record is kept and can be reviewed in the audit log.`) : ""}
        confirmLabel={confirm?.action === "approve" ? "Approve" : "Reject"}
        onConfirm={decide} onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
