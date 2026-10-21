import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

// Only trust the cached user if a token also exists; otherwise there is no real session.
const readStoredUser = () => {
  try {
    if (!localStorage.getItem("token")) return null;
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(true);

  // Restore an existing session (if a token is present) by verifying it with the server.
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");
    if (token) {
      api
        .get("/auth/me")
        .then((res) => {
          if (cancelled || !localStorage.getItem("token")) return;
          setUser(res.data);
          localStorage.setItem("user", JSON.stringify(res.data));
        })
        .catch(() => {
          if (cancelled) return;
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      localStorage.removeItem("user");
      setUser(null);
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // If the token is removed in another tab (logout there), sign out here too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || (e.key === "token" && !e.newValue)) setUser(null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const startSession = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    startSession(res.data);
    return res.data;
  };

  // Faculty registrations are pending approval and receive no token: the caller shows the pending message.
  const register = async (payload) => {
    const res = await api.post("/auth/register", payload);
    if (res.data.token) startSession(res.data);
    return res.data;
  };

  const updateUser = (patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  const replaceToken = (token) => localStorage.setItem("token", token);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, updateUser, replaceToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);