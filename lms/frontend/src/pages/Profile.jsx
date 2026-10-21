import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import api from "../api/axios";
import { Alert, Field, PageHeader, StatusBadge, inputClass, btnPrimary, btnSecondary } from "../components/ui";
import PasswordChecklist from "../components/PasswordChecklist";
import { passwordProblems } from "../utils/validation";

export default function Profile() {
  const { user, updateUser, replaceToken } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm] = useState({
    name: user?.name || "",
    department: user?.department || "",
    rollNumber: user?.rollNumber || "",
    academicYear: user?.academicYear || "",
    studyYear: user?.studyYear || "",
    section: user?.section || "",
  });
  const [profileMsg, setProfileMsg] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [pwMsg, setPwMsg] = useState(null);
  const [savingPw, setSavingPw] = useState(false);

  const isStudent = user?.role === "student";

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!form.name.trim()) { setProfileMsg({ kind: "error", text: "Name cannot be empty." }); return; }
    setSavingProfile(true);
    try {
      const payload = { name: form.name.trim(), department: form.department.trim() };
      if (isStudent) Object.assign(payload, { rollNumber: form.rollNumber.trim(), academicYear: form.academicYear.trim(), studyYear: form.studyYear.trim(), section: form.section.trim() });
      const res = await api.put("/auth/profile", payload);
      updateUser({ name: res.data.name, department: res.data.department, rollNumber: res.data.rollNumber, academicYear: res.data.academicYear, studyYear: res.data.studyYear, section: res.data.section });
      setProfileMsg({ kind: "success", text: "Profile updated." });
    } catch (err) {
      setProfileMsg({ kind: "error", text: err.response?.data?.message || "Could not update profile." });
    } finally { setSavingProfile(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    const errs = {};
    if (!pw.currentPassword) errs.currentPassword = "Enter your current password.";
    const problems = passwordProblems(pw.newPassword);
    if (problems.length) errs.newPassword = `Password needs: ${problems.join(", ").toLowerCase()}.`;
    if (pw.newPassword !== pw.confirm) errs.confirm = "Passwords do not match.";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPw(true);
    try {
      const res = await api.put("/auth/password", { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      if (res.data.token) replaceToken(res.data.token); // other sessions are signed out by the server
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
      setPwMsg({ kind: "success", text: "Password changed. Other devices have been signed out." });
    } catch (err) {
      const message = err.response?.data?.message || "Could not change password.";
      if (/current password/i.test(message)) setPwErrors({ currentPassword: message });
      else setPwMsg({ kind: "error", text: message });
    } finally { setSavingPw(false); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <PageHeader title="Profile & Settings" subtitle="Manage your details, security and appearance." />

      <section className="bg-white rounded-2xl border border-slate-200 p-6" aria-labelledby="profile-h">
        <div className="flex items-center justify-between mb-4">
          <h2 id="profile-h" className="text-base font-bold text-slate-900">Profile details</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 capitalize">{user?.role}</span>
            <StatusBadge status={user?.status || "active"} />
          </div>
        </div>
        {profileMsg && <div className="mb-4"><Alert kind={profileMsg.kind}>{profileMsg.text}</Alert></div>}
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Email" htmlFor="p-email" hint="Your email is your sign-in and cannot be changed here.">
            <input id="p-email" value={user?.email || ""} disabled className={`${inputClass} opacity-70`} />
          </Field>
          <Field label="Full name" htmlFor="p-name" required>
            <input id="p-name" value={form.name} onChange={set("name")} className={inputClass} maxLength={100} />
          </Field>
          <Field label="Department" htmlFor="p-dept">
            <input id="p-dept" value={form.department} onChange={set("department")} className={inputClass} maxLength={100} />
          </Field>
          {isStudent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Roll number" htmlFor="p-roll"><input id="p-roll" value={form.rollNumber} onChange={set("rollNumber")} className={inputClass} maxLength={50} /></Field>
              <Field label="Academic year" htmlFor="p-ay"><input id="p-ay" value={form.academicYear} onChange={set("academicYear")} className={inputClass} maxLength={50} /></Field>
              <Field label="Study year" htmlFor="p-sy"><input id="p-sy" value={form.studyYear} onChange={set("studyYear")} className={inputClass} maxLength={50} /></Field>
              <Field label="Section" htmlFor="p-sec"><input id="p-sec" value={form.section} onChange={set("section")} className={inputClass} maxLength={50} /></Field>
            </div>
          )}
          <button type="submit" className={btnPrimary} disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6" aria-labelledby="security-h">
        <h2 id="security-h" className="text-base font-bold text-slate-900 mb-4">Security</h2>
        {pwMsg && <div className="mb-4"><Alert kind={pwMsg.kind}>{pwMsg.text}</Alert></div>}
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          <Field label="Current password" htmlFor="pw-cur" required error={pwErrors.currentPassword}>
            <input id="pw-cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className={inputClass} />
          </Field>
          <Field label="New password" htmlFor="pw-new" required error={pwErrors.newPassword}>
            <input id="pw-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className={inputClass} />
          </Field>
          <PasswordChecklist password={pw.newPassword} />
          <Field label="Confirm new password" htmlFor="pw-conf" required error={pwErrors.confirm}>
            <input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className={inputClass} />
          </Field>
          <button type="submit" className={btnPrimary} disabled={savingPw}>{savingPw ? "Updating..." : "Change password"}</button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6" aria-labelledby="theme-h">
        <h2 id="theme-h" className="text-base font-bold text-slate-900 mb-1">Appearance</h2>
        <p className="text-sm text-slate-500 mb-4">Your choice is remembered on this device.</p>
        <button type="button" onClick={toggleTheme} className={btnSecondary} aria-pressed={theme === "dark"}>
          Theme: {theme === "dark" ? "Dark" : "Light"} (click to switch)
        </button>
      </section>
    </div>
  );
}
