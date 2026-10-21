import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Aurora from "../components/Aurora";
import useReveal from "../hooks/useReveal";

const SECTIONS = [
  { id: "top", label: "Welcome" },
  { id: "courses", label: "Courses" },
  { id: "work", label: "Assignments and quizzes" },
  { id: "progress", label: "Attendance and progress" },
  { id: "roles", label: "Who it is for" },
  { id: "start", label: "Get started" },
];

const ROLES = [
  { name: "Students", lines: ["Overdue and upcoming work first", "Your own attendance and grades", "Timed quizzes with a clear countdown"] },
  { name: "Faculty", lines: ["Only the courses allocated to you", "Grade with feedback, late work flagged", "Attendance and course analytics"] },
  { name: "Administrators", lines: ["Approve faculty, manage accounts", "Departments, years, sections, allocation", "Reports and an audit trail"] },
];

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Section({ id, eyebrow, title, children, align = "center", blob }) {
  return (
    <section id={id} data-section className="relative overflow-hidden flex items-center" style={{ minHeight: "calc(100vh - 64px)" }}>
      {blob}
      <div className={`relative max-w-5xl mx-auto px-6 sm:px-8 py-20 w-full ${align === "center" ? "text-center" : ""}`}>
        <div className="eyebrow reveal">{eyebrow}</div>
        <h2 className="hero-title reveal d1 mt-3" style={{ fontSize: "clamp(2.2rem, 5.2vw, 4rem)" }}>{title}</h2>
        <div className="title-rule reveal d1" />
        <div className="reveal d2">{children}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const rootRef = useRef(null);
  const heroBlob = useRef(null);
  const [active, setActive] = useState(0);
  useReveal(rootRef);

  // Hero shape eases toward the cursor (skipped for reduced-motion users).
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let tx = 0, ty = 0, x = 0, y = 0, raf;
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 70;
      ty = (e.clientY / window.innerHeight - 0.5) * 50;
    };
    const tick = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      if (heroBlob.current) heroBlob.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  // Which section is on screen (drives the ticks on the right edge).
  useEffect(() => {
    const els = Array.from(rootRef.current.querySelectorAll("[data-section]"));
    if (!("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(els.indexOf(e.target)); }),
      { threshold: 0.55 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  const spot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div ref={rootRef}>
      <nav className="ticks" aria-label="Page sections">
        {SECTIONS.map((s, i) => (
          <button key={s.id} className={`tick ${active === i ? "on" : ""}`} aria-label={`Go to ${s.label}`} aria-current={active === i} onClick={() => goTo(s.id)} />
        ))}
      </nav>

      {/* Hero */}
      <section id="top" data-section className="relative overflow-hidden flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <Aurora ref={heroBlob} style={{ left: "50%", top: "50%", width: "min(62vw, 560px)", transform: "translate(-50%, -50%)" }} />
        <div className="relative z-10 text-center px-6 py-20">
          <div className="eyebrow reveal">Learning management</div>
          <h1 className="hero-title reveal d1 mt-4" style={{ fontSize: "clamp(3rem, 9vw, 6.5rem)" }}>Learn, together</h1>
          <div className="title-rule reveal d1" />
          <p className="lede reveal d2">Courses, assignments, quizzes and attendance in one calm place, for students, faculty and administrators.</p>
          <div className="reveal d3 mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link to="/dashboard" className="pill-btn solid" style={{ padding: "0.8rem 2rem" }}>Go to your dashboard</Link>
            ) : (
              <>
                <Link to="/register" className="pill-btn solid" style={{ padding: "0.8rem 2rem" }}>Get started</Link>
                <Link to="/login" className="pill-btn" style={{ padding: "0.8rem 2rem" }}>Sign in</Link>
              </>
            )}
          </div>
        </div>
        <button onClick={() => goTo("courses")} className="scroll-hint absolute bottom-6 left-1/2 -translate-x-1/2 eyebrow" style={{ letterSpacing: "0.3em", background: "none", border: 0, cursor: "pointer" }} aria-label="Scroll to the next section">Scroll</button>
      </section>

      <Section
        id="courses" eyebrow="Courses and materials" title="Everything a course needs"
        blob={<Aurora style={{ right: "-8%", top: "12%", width: "min(38vw, 380px)", animation: "floaty 9s ease-in-out infinite" }} hue={-25} />}
      >
        <p className="lede">Lecture notes, files, announcements and discussions live inside each course. Files are private: only enrolled students and the course faculty can open them.</p>
      </Section>

      <Section
        id="work" eyebrow="Assignments and quizzes" title="Deadlines you can't miss"
        blob={<Aurora style={{ left: "-8%", bottom: "6%", width: "min(36vw, 360px)", animation: "floaty 11s ease-in-out infinite" }} hue={70} />}
      >
        <p className="lede">Overdue work is shown first, late submissions are accepted and clearly flagged, and quizzes run on a server-side clock so everyone gets a fair, timed attempt.</p>
      </Section>

      <Section
        id="progress" eyebrow="Attendance and progress" title="Know where you stand"
        blob={<Aurora style={{ right: "-6%", bottom: "8%", width: "min(40vw, 400px)", animation: "floaty 10s ease-in-out infinite" }} hue={140} />}
      >
        <p className="lede">Students see their own attendance, grades and feedback. Faculty see how their classes are doing. Nobody sees data they shouldn't.</p>
      </Section>

      <Section id="roles" eyebrow="Who it is for" title="One system, three roles">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left mt-2">
          {ROLES.map((r, i) => (
            <div key={r.name} className={`spot reveal d${i + 1}`} onMouseMove={spot}>
              <h3 className="hero-title" style={{ fontSize: "1.7rem" }}>{r.name}</h3>
              <div className="my-3" style={{ height: 1, background: "var(--line)" }} />
              <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
                {r.lines.map((l) => (<li key={l} className="flex gap-2"><span style={{ color: "var(--accent-ink)" }} aria-hidden="true">—</span>{l}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <section id="start" data-section className="relative overflow-hidden flex items-center justify-center" style={{ minHeight: "calc(80vh - 64px)" }}>
        <Aurora style={{ left: "50%", top: "50%", width: "min(50vw, 440px)", transform: "translate(-50%, -50%)" }} hue={-60} />
        <div className="relative text-center px-6 py-20">
          <div className="eyebrow reveal">Get started</div>
          <h2 className="hero-title reveal d1 mt-3" style={{ fontSize: "clamp(2.4rem, 6vw, 4.5rem)" }}>Ready when you are</h2>
          <div className="title-rule reveal d1" />
          <div className="reveal d2 mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link to="/dashboard" className="pill-btn solid" style={{ padding: "0.8rem 2rem" }}>Open dashboard</Link>
            ) : (
              <>
                <Link to="/register" className="pill-btn solid" style={{ padding: "0.8rem 2rem" }}>Create an account</Link>
                <Link to="/login" className="pill-btn" style={{ padding: "0.8rem 2rem" }}>Sign in</Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}