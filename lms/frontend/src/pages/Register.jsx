import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Alert, Field, inputClass, btnPrimary } from "../components/ui";
import PasswordChecklist from "../components/PasswordChecklist";
import Aurora from "../components/Aurora";
import { EMAIL_REGEX, passwordProblems } from "../utils/validation";

const EMPTY = { name: "", email: "", password: "", confirmPassword: "", role: "student", rollNumber: "", department: "", academicYear: "", studyYear: "", section: "" };

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(null);
  const [options, setOptions] = useState({ department: [], academicYear: [], studyYear: [], section: [] });
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/auth/options").then((r) => setOptions(r.data)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!EMAIL_REGEX.test(form.email.trim())) e.email = "Please provide a valid email address.";
    const pw = passwordProblems(form.password);
    if (pw.length) e.password = `Password needs: ${pw.join(", ").toLowerCase()}.`;
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const isStudent = form.role === "student";
      const data = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role, // only "student" or "faculty" is ever offered; the server enforces this too
        rollNumber: isStudent ? form.rollNumber.trim() || undefined : undefined,
        department: form.department.trim() || undefined,
        academicYear: isStudent ? form.academicYear || undefined : undefined,
        studyYear: isStudent ? form.studyYear || undefined : undefined,
        section: isStudent ? form.section || undefined : undefined,
      });
      if (data.status === "pending") setPending(data);
      else navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || (err.response ? "Registration failed. Please try again." : "Cannot reach the server. Check your connection.");
      if (err.response?.status === 409) setErrors({ email: msg });
      else setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (pending) {
    return (
      <div className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
        <Aurora style={{ left: "50%", top: "50%", width: "min(90vw, 520px)", transform: "translate(-50%, -50%)" }} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center text-xl font-bold" aria-hidden="true">⏳</div>
          <h1 className="text-2xl font-bold text-slate-900">Registration pending approval</h1>
          <p className="text-sm text-slate-600">
            Thanks, {pending.name}. Faculty accounts are reviewed by an administrator. You will be able to sign in with{" "}
            <strong>{pending.email}</strong> once your account is approved.
          </p>
          <Link to="/login" className={`${btnPrimary} inline-block`}>Back to sign in</Link>
        </div>
      </div>
    );
  }

  const isStudent = form.role === "student";
  const select = (name, list, placeholder) => (
    <select id={`reg-${name}`} name={name} value={form[name]} onChange={handleChange} className={inputClass}>
      <option value="">{placeholder}</option>
      {list.map((o) => (<option key={o} value={o}>{o}</option>))}
    </select>
  );

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center justify-center p-4 py-8">
      <Aurora style={{ left: "50%", top: "50%", width: "min(95vw, 620px)", transform: "translate(-50%, -50%)" }} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-xl font-bold mb-3 shadow-inner" aria-hidden="true">✨</div>
          <h1 className="text-2xl font-bold text-slate-900">Create an Account</h1>
          <p className="text-sm text-slate-500 mt-1">Join EduLearn LMS as a student or faculty member</p>
        </div>

        {formError && <div className="mb-5"><Alert kind="error">{formError}</Alert></div>}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Field label="Full Name" htmlFor="reg-name" required error={errors.name}>
            <input id="reg-name" name="name" autoComplete="name" placeholder="e.g. Jane Doe" value={form.name} onChange={handleChange} className={inputClass} />
          </Field>

          <Field label="Email Address" htmlFor="reg-email" required error={errors.email}>
            <input id="reg-email" name="email" type="email" autoComplete="email" placeholder="name@university.edu" value={form.email} onChange={handleChange} className={inputClass} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Password" htmlFor="reg-password" required error={errors.password}>
              <input id="reg-password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={handleChange} className={inputClass} />
            </Field>
            <Field label="Confirm Password" htmlFor="reg-confirm" required error={errors.confirmPassword}>
              <input id="reg-confirm" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} className={inputClass} />
            </Field>
          </div>
          <PasswordChecklist password={form.password} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Role" htmlFor="reg-role" required hint={form.role === "faculty" ? "Faculty accounts need administrator approval." : undefined}>
              <select id="reg-role" name="role" value={form.role} onChange={handleChange} className={inputClass}>
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </Field>
            <Field label="Department" htmlFor="reg-department">
              <input id="reg-department" name="department" list="dept-options" placeholder="e.g. Computer Science" value={form.department} onChange={handleChange} className={inputClass} />
              <datalist id="dept-options">{options.department.map((d) => (<option key={d} value={d} />))}</datalist>
            </Field>
          </div>

          {isStudent && (
            <>
              <Field label="Roll / Student ID Number" htmlFor="reg-roll">
                <input id="reg-roll" name="rollNumber" placeholder="e.g. CS-2026-042" value={form.rollNumber} onChange={handleChange} className={inputClass} />
              </Field>
              {(options.academicYear.length > 0 || options.studyYear.length > 0 || options.section.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {options.academicYear.length > 0 && <Field label="Academic Year" htmlFor="reg-academicYear">{select("academicYear", options.academicYear, "Select")}</Field>}
                  {options.studyYear.length > 0 && <Field label="Study Year" htmlFor="reg-studyYear">{select("studyYear", options.studyYear, "Select")}</Field>}
                  {options.section.length > 0 && <Field label="Section" htmlFor="reg-section">{select("section", options.section, "Select")}</Field>}
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full mt-2 py-3`}>
            {submitting ? "Creating Account..." : "Complete Registration"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700 underline">Sign in here</Link>
        </div>
      </div>
    </div>
  );
}