"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "./care-workspace.css";

/** Shared record-table scrolling keeps touch guidance and focused actions together. */
export function CareTableRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hint = useId();
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const region = ref.current;
    if (!region) return;
    const measure = () => setOverflows(region.scrollWidth > region.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    if (region.firstElementChild) observer.observe(region.firstElementChild);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [children]);
  return (
    <div className="care-table-shell">
      {overflows && (
        <p id={hint} className="care-scroll-hint">
          Scroll across for more details and actions.
        </p>
      )}
      <div
        ref={ref}
        className={"care-table-region " + className}
        role="region"
        aria-label={label}
        aria-describedby={overflows ? hint : undefined}
        tabIndex={0}
        onFocusCapture={(event) => {
          const region = event.currentTarget;
          const target = event.target;
          if (target === region || !(target instanceof HTMLElement)) return;
          const bounds = region.getBoundingClientRect();
          const cell = target.closest("th, td");
          const identity = cell?.parentElement?.firstElementChild;
          const pinned =
            identity instanceof HTMLElement &&
            identity !== cell &&
            getComputedStyle(identity).position === "sticky";
          const left = pinned
            ? identity.getBoundingClientRect().right + 8
            : bounds.left + 8;
          const right = bounds.right - 8;
          const focused = target.getBoundingClientRect();
          if (focused.right > right) region.scrollLeft += focused.right - right;
          else if (focused.left < left) region.scrollLeft -= left - focused.left;
        }}
      >
        {children}
      </div>
    </div>
  );
}
