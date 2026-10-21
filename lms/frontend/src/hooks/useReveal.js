import { useEffect } from "react";

/** Adds the "in" class to every .reveal element once it scrolls into view. Content stays visible if unsupported. */
export default function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef?.current || document;
    const els = Array.from(root.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.18 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}