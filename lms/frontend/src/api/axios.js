import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
/** Origin of the API server (API_BASE without the trailing /api). */
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Session problems (expired token, account disabled while signed in) send the user back to sign in.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    const url = err.config?.url || "";
    const isAuthAttempt = url.includes("/auth/login") || url.includes("/auth/register");
    if (!isAuthAttempt && localStorage.getItem("token") && (status === 401 || (status === 403 && String(code || "").startsWith("ACCOUNT_")))) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.setItem("authNotice", err.response?.data?.message || "Your session has ended. Please sign in again.");
      if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

export default api;
