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
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(bar);
    if (chrome) observer?.observe(chrome);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
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
