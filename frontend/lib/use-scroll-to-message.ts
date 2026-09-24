"use client";
import { useEffect, useRef } from "react";

export function useScrollToMessage(message?: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const header = document.querySelector(".site-header")?.getBoundingClientRect();
      const dialog = element.closest("dialog")?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top =
        Math.max(viewport?.offsetTop ?? 0, dialog?.top ?? header?.bottom ?? 0) + 16;
      const bottom =
        Math.min(
          (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight),
          dialog?.bottom ?? Infinity,
        ) - 16;
      if (rect.top < top || rect.bottom > bottom) {
        element.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "center",
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [message]);
  return ref;
}
