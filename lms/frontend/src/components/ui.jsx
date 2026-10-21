import React, { useEffect, useRef } from "react";

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500" role="status" aria-live="polite">
      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

const ALERT_STYLES = {
  error: "bg-rose-50 border-rose-200 text-rose-700",
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  info: "bg-indigo-50 border-indigo-200 text-indigo-800",
  warning: "bg-amber-50 border-amber-200 text-amber-800",
};
const ALERT_ICON = { error: "!", success: "✓", info: "i", warning: "!" };

export function Alert({ kind = "info", children, onClose }) {
  if (!children) return null;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`p-3.5 rounded-xl border text-sm flex items-start gap-2 ${ALERT_STYLES[kind]}`}>
      <span className="font-bold w-4 text-center" aria-hidden="true">{ALERT_ICON[kind]}</span>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-xs font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss message">✕</button>
      )}
    </div>
  );
}

// Status is shown as text plus colour (never colour alone).
const BADGES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disabled: "bg-slate-100 text-slate-600 border-slate-300",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  absent: "bg-rose-50 text-rose-700 border-rose-200",
  late: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  overdue: "bg-rose-50 text-rose-700 border-rose-200",
  graded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  upcoming: "bg-indigo-50 text-indigo-700 border-indigo-200",
  closed: "bg-slate-100 text-slate-600 border-slate-300",
};
export function StatusBadge({ status, children }) {
  const key = String(status || "").toLowerCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${BADGES[key] || BADGES.closed}`}>
      {children || status}
    </span>
  );
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="text-center py-10 px-4 bg-white border border-dashed border-slate-300 rounded-2xl">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
        {label}{required && <span className="text-rose-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-rose-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
export const btnPrimary =
  "px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition";
export const btnSecondary =
  "px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60 transition";
export const btnDanger =
  "px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-60 transition";

/** Accessible confirmation dialog for sensitive actions (Esc cancels, focus moves to the dialog). */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onCancel, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div
        ref={ref}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-2">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnSecondary} onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={danger ? btnDanger : btnPrimary} onClick={onConfirm} disabled={busy}>{busy ? "Working..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/** "in 3 days", "2 hours overdue" style label for deadlines. */
export function relativeDue(dueDate, now = new Date()) {
  const diff = new Date(dueDate).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 60 ? `${mins} min` : mins < 60 * 48 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
  return diff < 0 ? `${text} overdue` : `due in ${text}`;
}
