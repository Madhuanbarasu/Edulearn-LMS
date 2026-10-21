import React from "react";

export const errMsg = (err, fallback = "Something went wrong.") => err.response?.data?.message || (err.response ? fallback : "Cannot reach the server.");

export const Table = ({ head, children, empty }) => (
  <div className="table-scroll bg-white border border-slate-200 rounded-2xl">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
          {head.map((h) => (<th key={h} scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">{h}</th>))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
    {empty && <p className="text-sm text-slate-500 text-center py-8">{empty}</p>}
  </div>
);
export const Td = ({ children, className = "" }) => <td className={`py-3 px-4 align-middle ${className}`}>{children}</td>;

export const Pager = ({ page, pages, onPage }) => (
  pages > 1 ? (
    <div className="flex items-center justify-between mt-3 text-sm text-slate-600">
      <button className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  ) : null
);

export const Stat = ({ label, value, tone }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-200">
    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-2xl font-extrabold mt-1 ${tone === "warn" && value > 0 ? "text-amber-600" : "text-slate-900"}`}>{value}</div>
  </div>
);
