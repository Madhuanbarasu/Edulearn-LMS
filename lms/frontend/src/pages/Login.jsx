import React, { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Alert, Field, inputClass, btnPrimary } from "../components/ui";
import Aurora from "../components/Aurora";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice] = useState(() => {
    const n = sessionStorage.getItem("authNotice");
    if (n) sessionStorage.removeItem("authNotice");
    return n || "";
  });
  const [kind, setKind] = useState("error");
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Browser autofill does not always trigger onChange, so fall back to the real input values.
    const emailValue = (email || emailRef.current?.value || "").trim();
    const passwordValue = password || passwordRef.current?.value || "";
    if (!emailValue || !passwordValue) {
      setKind("error");
      setError("Please fill in both email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(emailValue, passwordValue);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      // Pending faculty get a clear approval message instead of a generic failure.
      setKind(data?.code === "ACCOUNT_PENDING" ? "warning" : "error");
      setError(data?.message || (err.response ? "Invalid credentials. Please try again." : "Cannot reach the server. Check your connection."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <Aurora style={{ left: "50%", top: "50%", width: "min(90vw, 520px)", transform: "translate(-50%, -50%)" }} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-xl font-bold mb-3 shadow-inner" aria-hidden="true">🎓</div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to access your courses and dashboard</p>
        </div>

        <div className="space-y-3 mb-5">
          {notice && <Alert kind="info">{notice}</Alert>}
          {error && <Alert kind={kind}>{error}</Alert>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate autoComplete="on">
          <Field label="Email Address" htmlFor="login-email">
            <input
              ref={emailRef}
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@domain.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Password" htmlFor="login-password">
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          New to EduLearn?{" "}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">Create an account</Link>
        </p>
      </div>
    </div>
  );
}