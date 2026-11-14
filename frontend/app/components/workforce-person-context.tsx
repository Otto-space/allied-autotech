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
    let manualScroll = false;
    const focusedControl = () => {
      const target = document.activeElement;
      return target instanceof HTMLElement &&
        panel.contains(target) &&
        !bar.contains(target) &&
        !target.closest("dialog[open]") &&
        target.matches("input, textarea, select, button")
        ? target
        : null;
    };
    const focusBounds = (target: HTMLElement) => {
      const boxes = [target.getBoundingClientRect()];
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        for (const label of target.labels ?? []) {
          const box = label.getBoundingClientRect();
          if (box.width > 1 && box.height > 1) boxes.push(box);
        }
      return {
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
      };
    };
    const geometry = (target: HTMLElement | null) => {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? innerHeight);
      const headerBottom = Array.from(
        document.querySelectorAll<HTMLElement>(".site-header, .dashboard-top"),
      ).reduce((bottom, header) => {
        const position = getComputedStyle(header).position;
        return position === "fixed" || position === "sticky"
          ? Math.max(bottom, header.getBoundingClientRect().bottom)
          : bottom;
      }, viewportTop);
      const dock = document.querySelector<HTMLElement>(".support-controls");
      const bottom =
        Math.min(
          viewportBottom,
          dock && getComputedStyle(dock).position === "fixed"
            ? dock.getBoundingClientRect().top
            : viewportBottom,
        ) - 4;
      const bounds = target ? focusBounds(target) : null;
      // Compact only the padding; keep the entire identity and its text size.
      // If even that cannot leave a usable focus band, let the context scroll.
      const required = bounds ? bounds.bottom - bounds.top + 2 : 76;
      bar.removeAttribute("data-compact");
      bar.removeAttribute("data-unpinned");
      let height = bar.getBoundingClientRect().height;
      if (headerBottom + height + required > bottom) {
        bar.setAttribute("data-compact", "true");
        height = bar.getBoundingClientRect().height;
      }
      if (headerBottom + height + required > bottom) {
        bar.setAttribute("data-unpinned", "true");
        height = 0;
      }
      panel.style.setProperty("--wf-person-sticky-top", `${headerBottom}px`);
      panel.style.setProperty("--wf-person-sticky-height", `${height}px`);
      if (target && bounds)
        target.style.setProperty(
          "--wf-person-focus-inset",
          `${Math.max(0, target.getBoundingClientRect().top - bounds.top) + 2}px`,
        );
      return { top: headerBottom + height + 2, bottom };
    };
    const keepFocusClear = () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const target = focusedControl();
        const available = geometry(target);
        if (!target || manualScroll) return;
        const box = focusBounds(target);
        if (box.top < available.top || box.bottom > available.bottom)
          window.scrollBy({ top: box.top - available.top, behavior: "instant" });
      });
    };
    const update = () => {
      geometry(focusedControl());
      keepFocusClear();
    };
    const onFocus = () => {
      manualScroll = false;
      update();
    };
    const onManualScroll = () => {
      manualScroll = true;
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    observer?.observe(bar);
    if (chrome) observer?.observe(chrome);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("wheel", onManualScroll, { passive: true });
    window.addEventListener("touchmove", onManualScroll, { passive: true });
    panel.addEventListener("focusin", onFocus);
    return () => {
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("wheel", onManualScroll);
      window.removeEventListener("touchmove", onManualScroll);
      panel.removeEventListener("focusin", onFocus);
      bar.removeAttribute("data-compact");
      bar.removeAttribute("data-unpinned");
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
