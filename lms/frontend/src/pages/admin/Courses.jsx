import React, { useEffect, useState, useCallback } from "react";
import api from "../../api/axios";
import { Alert, ConfirmDialog, Spinner, btnPrimary, btnSecondary, inputClass } from "../../components/ui";
import { Table, Td, Pager, errMsg } from "./shared";

function Manage({ course, onClose, onChanged, setMsg }) {
  const [roster, setRoster] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [facultyId, setFacultyId] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const loadRoster = useCallback(() => api.get(`/admin/courses/${course._id}/roster`).then((r) => { setRoster(r.data); setFacultyId(r.data.faculty?._id || ""); }), [course._id]);
  useEffect(() => {
    loadRoster().catch((e) => setMsg({ kind: "error", text: errMsg(e) }));
    api.get("/admin/users", { params: { role: "faculty", status: "active", limit: 100 } }).then((r) => setFaculty(r.data.users)).catch(() => {});
  }, [loadRoster, setMsg]);

  const allocate = async () => {
    setBusy(true);
    try { await api.post(`/admin/courses/${course._id}/allocate`, { facultyId }); setMsg({ kind: "success", text: "Faculty allocation updated." }); await loadRoster(); onChanged(); }
    catch (e) { setMsg({ kind: "error", text: errMsg(e) }); } finally { setBusy(false); }
  };
  const search = async (e) => {
    e.preventDefault();
    try { const r = await api.get("/admin/users", { params: { role: "student", status: "active", q, limit: 20 } }); setFound(r.data.users); setSelected([]); }
    catch (er) { setMsg({ kind: "error", text: errMsg(er) }); }
  };
  const enroll = async () => {
    setBusy(true);
    try { const r = await api.post(`/admin/courses/${course._id}/students`, { studentIds: selected }); setMsg({ kind: "success", text: `Enrolled ${r.data.enrolled} student(s).` }); setSelected([]); await loadRoster(); onChanged(); }
    catch (e) { setMsg({ kind: "error", text: errMsg(e) }); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.delete(`/admin/courses/${course._id}/students/${removing._id}`); setRemoving(null); await loadRoster(); onChanged(); }
    catch (e) { setMsg({ kind: "error", text: errMsg(e) }); setRemoving(null); } finally { setBusy(false); }
  };

  const enrolledIds = new Set((roster?.students || []).map((s) => s._id));
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Manage ${course.code}`} className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="text-lg font-bold text-slate-900">{course.code} · {course.title}</h3><p className="text-xs text-slate-500">Allocation and enrollment</p></div>
          <button className={btnSecondary} onClick={onClose}>Close</button>
        </div>
        {!roster ? <Spinner /> : (
          <>
            <section aria-label="Faculty allocation" className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Allocated faculty</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <select aria-label="Faculty" className={inputClass} value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                  {faculty.map((f) => (<option key={f._id} value={f._id}>{f.name} ({f.email})</option>))}
                </select>
                <button className={btnPrimary} disabled={busy || !facultyId || facultyId === roster.faculty?._id} onClick={allocate}>Allocate</button>
              </div>
              <p className="text-xs text-slate-500">Only active faculty are listed. The previously allocated faculty immediately loses access to this course.</p>
            </section>

            <section aria-label="Enrolled students" className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Enrolled students ({roster.students.length})</h4>
              {roster.students.length === 0 ? <p className="text-sm text-slate-500">No students enrolled.</p> : (
                <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto border border-slate-200 rounded-xl px-3">
                  {roster.students.map((s) => (
                    <li key={s._id} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-900 truncate">{s.name} <span className="text-xs text-slate-500">{s.rollNumber || s.email}</span></span>
                      <button className="text-xs font-semibold text-rose-600 hover:underline" onClick={() => setRemoving(s)}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Add students" className="space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Add students</h4>
              <form onSubmit={search} className="flex gap-2">
                <input aria-label="Search students" className={inputClass} placeholder="Search by name, email or roll number" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className={btnSecondary}>Search</button>
              </form>
              {found.length > 0 && (
                <>
                  <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-xl px-3">
                    {found.map((s) => (
                      <li key={s._id} className="py-2">
                        <label className="flex items-center gap-2 text-sm text-slate-900">
                          <input type="checkbox" disabled={enrolledIds.has(s._id)} checked={selected.includes(s._id) || enrolledIds.has(s._id)}
                            onChange={(e) => setSelected(e.target.checked ? [...selected, s._id] : selected.filter((x) => x !== s._id))} />
                          <span>{s.name} <span className="text-xs text-slate-500">{s.rollNumber || s.email}{enrolledIds.has(s._id) ? " · already enrolled" : ""}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button className={btnPrimary} disabled={busy || selected.length === 0} onClick={enroll}>Enroll {selected.length || ""} selected</button>
                </>
              )}
            </section>
          </>
        )}
        <ConfirmDialog open={!!removing} busy={busy} danger title="Remove student from course?" message={`${removing?.name} will lose access to this course. Their past submissions, attempts and attendance are kept.`} confirmLabel="Remove" onConfirm={remove} onCancel={() => setRemoving(null)} />
      </div>
    </div>
  );
}

export default function AdminCourses() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [active, setActive] = useState(null);

  const load = useCallback(() => api.get("/admin/courses", { params: { q: applied || undefined, page, limit: 15 } }).then((r) => setData(r.data)).catch((e) => setMsg({ kind: "error", text: errMsg(e) })), [applied, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(q); }}>
        <input aria-label="Search courses" className={inputClass} placeholder="Search by code or title" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btnPrimary}>Search</button>
      </form>
      {!data ? <Spinner /> : (
        <>
          <Table head={["Course", "Faculty", "Placement", "Students", ""]} empty={data.courses.length === 0 ? "No courses found." : null}>
            {data.courses.map((c) => (
              <tr key={c._id}>
                <Td><p className="font-semibold text-slate-900">{c.code}</p><p className="text-xs text-slate-500">{c.title}</p></Td>
                <Td>{c.faculty?.name || "—"}</Td>
                <Td className="text-xs text-slate-600">{[c.department, c.academicYear, c.studyYear, c.section].filter(Boolean).join(" · ") || "—"}</Td>
                <Td>{c.studentCount}</Td>
                <Td><button className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => setActive(c)}>Manage</button></Td>
              </tr>
            ))}
          </Table>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
      {active && <Manage course={active} onClose={() => setActive(null)} onChanged={load} setMsg={setMsg} />}
    </div>
  );
}
