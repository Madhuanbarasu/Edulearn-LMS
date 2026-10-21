// Mirrors the backend rules (backend/utils/validators.js). The server remains the source of truth.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "lower", label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "A number", test: (p) => /[0-9]/.test(p) },
];

export const passwordProblems = (p) => PASSWORD_RULES.filter((r) => !r.test(p || "")).map((r) => r.label);
