"use client";

import type { ReactNode } from "react";

export function ContactAnchor({
  target,
  children,
  className,
}: {
  target: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={`#${target}`}
      onClick={(event) => {
        const destination = document.getElementById(target);
        if (!destination) return;
        event.preventDefault();
        history.pushState(null, "", `#${target}`);
        destination.focus({ preventScroll: true });
        destination.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      }}
    >
      {children}
    </a>
  );
}
