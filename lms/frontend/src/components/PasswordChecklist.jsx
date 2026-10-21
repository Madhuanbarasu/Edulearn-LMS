import React from "react";
import { PASSWORD_RULES } from "../utils/validation";

export default function PasswordChecklist({ password }) {
  return (
    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password || "");
        return (
          <li key={r.id} className={`text-xs flex items-center gap-1.5 ${ok ? "text-emerald-600" : "text-slate-500"}`}>
            <span aria-hidden="true">{ok ? "✓" : "○"}</span>
            <span>{r.label}</span>
            <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
