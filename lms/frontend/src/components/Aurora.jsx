import React from "react";

/** Decorative gradient shape. Purely visual (aria-hidden). `style` positions and sizes it. */
const Aurora = React.forwardRef(function Aurora({ className = "", style, hue = 0 }, ref) {
  return (
    <div ref={ref} className={`aurora ${className}`} style={style} aria-hidden="true">
      <div className="aurora-blob" style={hue ? { filter: `blur(1.5px) hue-rotate(${hue}deg)` } : undefined} />
    </div>
  );
});
export default Aurora;