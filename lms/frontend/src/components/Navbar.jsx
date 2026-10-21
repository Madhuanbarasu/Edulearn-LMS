import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    setOpen(false);
    // Navigate to the landing page first so PrivateRoute never gets a chance to
    // redirect /dashboard to /login once the session is cleared.
    navigate("/", { replace: true });
    logout();
  };

  const links = user
    ? [
        { to: "/dashboard", label: "Dashboard" },
        ...(user.role === "admin" ? [{ to: "/admin", label: "Admin" }] : [{ to: "/courses", label: "Courses" }]),
        { to: "/profile", label: "Profile" },
      ]
    : [];

  const cls = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;

  const ThemeButton = (
    <button
      onClick={toggleTheme}
      className="pill-btn"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Toggle light / dark theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );

  return (
    <nav className="nav-shell" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={user ? "/dashboard" : "/"} className="wordmark" aria-label="EduLearn home">
            EduLearn
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {user ? (
              <>
                {links.map((l) => (<NavLink key={l.to} to={l.to} className={cls}>{l.label}</NavLink>))}
                <span className="h-4 w-px" style={{ background: "var(--line)" }} />
                <div className="text-right leading-tight">
                  <div className="text-xs font-medium" style={{ color: "var(--ink)" }}>{user.name}</div>
                  <div className="text-[10px] capitalize" style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}>
                    {user.role}{user.rollNumber ? ` · ${user.rollNumber}` : ""}
                  </div>
                </div>
                {ThemeButton}
                <button onClick={handleLogout} className="pill-btn">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Sign in</Link>
                {ThemeButton}
                <Link to="/register" className="pill-btn solid">Register</Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            {ThemeButton}
            <button
              onClick={() => setOpen(!open)}
              className="pill-btn min-w-[44px] min-h-[40px]"
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="md:hidden px-5 pt-2 pb-5 space-y-1" style={{ borderTop: "1px solid var(--line)" }}>
          {user ? (
            <>
              <div className="py-3" style={{ borderBottom: "1px solid var(--line)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{user.name}</p>
                <p className="text-xs capitalize" style={{ color: "var(--ink-3)" }}>{user.role}{user.rollNumber ? ` (${user.rollNumber})` : ""}</p>
              </div>
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link block py-3 ${isActive ? "active" : ""}`}>{l.label}</NavLink>
              ))}
              <button onClick={handleLogout} className="pill-btn mt-2">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="nav-link block py-3">Sign in</Link>
              <Link to="/register" onClick={() => setOpen(false)} className="nav-link block py-3">Create account</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}