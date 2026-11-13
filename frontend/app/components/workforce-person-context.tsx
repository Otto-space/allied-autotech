"use client";

import { useLayoutEffect, useRef } from "react";
import type { WorkforceAccount } from "@/lib/api/workforce-schemas";
import "./workforce-person-context.css";

/** Keep the reviewed target in sight without assuming a fixed shell height. */
export function WorkforcePersonContext({ account }: { account?: WorkforceAccount }) {
  const context = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const bar = context.current;
    const panel = bar?.closest<HTMLElement>(".workforce-panel");
    if (!bar || !panel) return;
    const chrome = document.querySelector<HTMLElement>(".dashboard-top");
    let focusFrame: number | undefined;
    const keepFocusClear = () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const target = document.activeElement;
        if (
          !(target instanceof HTMLElement) ||
          !panel.contains(target) ||
          bar.contains(target) ||
          !target.matches("input, textarea, select, button")
        )
          return;
        const box = target.getBoundingClientRect();
        const top = Math.max(
          chrome?.getBoundingClientRect().bottom ?? 0,
          bar.getBoundingClientRect().bottom,
        );
        const bottom =
          innerHeight - (parseFloat(getComputedStyle(target).scrollMarginBlockEnd) || 0);
        if (box.top < top + 8 || box.bottom > bottom)
          target.scrollIntoView({
            block: "start",
            inline: "nearest",
            behavior: "instant",
          });
      });
    };
    const update = () => {
      if (chrome)
        panel.style.setProperty(
          "--wf-person-sticky-top",
          `${Math.max(0, chrome.getBoundingClientRect().bottom)}px`,
        );
      panel.style.setProperty(
        "--wf-person-sticky-height",
        `${bar.getBoundingClientRect().height}px`,
      );
      keepFocusClear();
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(bar);
    if (chrome) observer?.observe(chrome);
    window.addEventListener("resize", update);
    panel.addEventListener("focusin", keepFocusClear);
    return () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      observer?.disconnect();
      window.removeEventListener("resize", update);
      panel.removeEventListener("focusin", keepFocusClear);
      panel.style.removeProperty("--wf-person-sticky-top");
      panel.style.removeProperty("--wf-person-sticky-height");
    };
  }, []);
  return (
    <aside className="wf-person-context" aria-label="Selected person" ref={context}>
      <p>
        <span>Selected person</span>
        <strong>{account?.accountLabel ?? "Current identity unavailable"}</strong>
      </p>
      <a href="#workforce-person-overview" className="text-link">
        Overview
      </a>
    </aside>
  );
}
