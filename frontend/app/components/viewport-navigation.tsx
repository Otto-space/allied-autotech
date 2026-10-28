"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function headerOffset() {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>(".site-header, .dashboard-top").forEach((el) => {
    if (["fixed", "sticky"].includes(getComputedStyle(el).position))
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
  });
  return Math.max(0, bottom) + 16;
}

function visible(element: HTMLElement) {
  return (
    element.isConnected &&
    element.getClientRects().length > 0 &&
    !element.closest("[hidden], [inert]")
  );
}

function reveal(element: HTMLElement, focus: boolean, nearest = false) {
  if (!visible(element)) return;
  if (focus && !element.closest("dialog")) {
    if (!element.matches("a[href], button, input, select, textarea, [tabindex]")) {
      element.setAttribute("tabindex", "-1");
      element.addEventListener("blur", () => element.removeAttribute("tabindex"), {
        once: true,
      });
    }
    if (!element.matches("a[href], button, input, select, textarea"))
      element.setAttribute("data-reading-focus", "");
    element.focus({ preventScroll: true });
  }
  if (element.closest("dialog[open]")) {
    element.scrollIntoView({ block: "nearest", behavior: "instant" });
    return;
  }
  const box = element.getBoundingClientRect();
  const top = headerOffset();
  const dock = document.querySelector<HTMLElement>(".support-controls");
  const bottom =
    dock && getComputedStyle(dock).position === "fixed"
      ? Math.min(innerHeight - 16, dock.getBoundingClientRect().top - 12)
      : innerHeight - 16;
  // Large revealed sections need their beginning visible, not their entire height.
  if (nearest && box.top >= top && Math.min(box.bottom, box.top + 48) <= bottom) return;
  window.scrollTo({ top: Math.max(0, scrollY + box.top - top), behavior: "instant" });
}

function hashTarget(hash: string) {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

export function ViewportNavigation() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const restoring = useRef<string | null>(null);

  useEffect(() => {
    const restore = () => {
      restoring.current = location.pathname;
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const initial = previousPath.current === pathname;
    previousPath.current = pathname;
    const historyRestore = restoring.current === pathname;
    restoring.current = null;
    // Hydration must never reset an already scrolling/restored document. The browser
    // owns initial positioning; only an explicit fragment needs an entry adjustment.
    if (historyRestore || (initial && (!location.hash || scrollY > 0))) return;
    let frame = 0;
    let cancelled = false;
    let observer: MutationObserver | undefined;
    const cancelEntry = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
    const enter = () => {
      if (cancelled) return true;
      const main = document.querySelector<HTMLElement>("main");
      const target =
        hashTarget(location.hash) ??
        main?.querySelector<HTMLElement>(
          'nav[aria-label="Breadcrumb"], nav[aria-label="Breadcrumbs"], .breadcrumbs',
        ) ??
        main;
      if (!target || !visible(target)) return false;
      // The optional walkthrough owns focus when opened by its reserved hash.
      reveal(target, !location.hash.startsWith("#learn="));
      return true;
    };
    // Wait for the destination DOM and its layout, including streamed route content.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!enter()) {
          observer = new MutationObserver(() => {
            if (enter()) observer?.disconnect();
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    });
    const timeout = window.setTimeout(() => observer?.disconnect(), 3000);
    // A visitor's new interaction takes priority over a pending entry adjustment.
    document.addEventListener("pointerdown", cancelEntry, { capture: true, once: true });
    document.addEventListener("keydown", cancelEntry, { capture: true, once: true });
    window.addEventListener("wheel", cancelEntry, { passive: true, once: true });
    window.addEventListener("touchstart", cancelEntry, { passive: true, once: true });
    return () => {
      cancelEntry();
      document.removeEventListener("pointerdown", cancelEntry, true);
      document.removeEventListener("keydown", cancelEntry, true);
      window.removeEventListener("wheel", cancelEntry);
      window.removeEventListener("touchstart", cancelEntry);
      clearTimeout(timeout);
    };
  }, [pathname]);

  useEffect(() => {
    const frames = new Set<number>();
    let pointerHeld = false;
    let pointerMoved = false;
    let viewportHeight = window.visualViewport?.height ?? innerHeight;
    let interaction = 0;
    const afterRender = (action: () => void) => {
      const generation = interaction;
      const first = requestAnimationFrame(() => {
        frames.delete(first);
        const second = requestAnimationFrame(() => {
          frames.delete(second);
          if (generation === interaction) action();
        });
        frames.add(second);
      });
      frames.add(first);
    };
    const updateInsets = () => {
      const dock = document.querySelector<HTMLElement>(".support-controls");
      const space =
        dock && getComputedStyle(dock).position === "fixed"
          ? Math.max(0, innerHeight - dock.getBoundingClientRect().top + 12)
          : 0;
      document.documentElement.style.setProperty(
        "--viewport-header-offset",
        `${headerOffset()}px`,
      );
      document.documentElement.style.setProperty(
        "--viewport-support-offset",
        `${space}px`,
      );
    };
    const resize = new ResizeObserver(updateInsets);
    const observeInsets = () => {
      resize.disconnect();
      document
        .querySelectorAll(".site-header, .dashboard-top, .support-controls")
        .forEach((el) => resize.observe(el));
      updateInsets();
    };
    const structure = new MutationObserver(observeInsets);
    structure.observe(document.body, { childList: true, subtree: true });
    observeInsets();

    function controlledTarget(control: HTMLElement) {
      // Text entry can describe a result without navigating to it on blur.
      if (control.hasAttribute("data-scroll-on-submit")) return null;
      if (
        control instanceof HTMLInputElement &&
        ["checkbox", "radio"].includes(control.type) &&
        !control.checked
      )
        return null;
      const ids =
        control.getAttribute("data-scroll-target") ??
        control.getAttribute("aria-controls");
      return ids
        ?.split(/\s+/)
        .map((id) => document.getElementById(id))
        .find(
          (el): el is HTMLElement =>
            !!el && visible(el) && !el.matches('[role="listbox"], [role="menu"]'),
        );
    }
    function selection(control: HTMLElement) {
      afterRender(() => {
        if (pointerHeld) return;
        const target = controlledTarget(control);
        if (target) reveal(target, false, true);
        // Validation and dialogs may deliberately move focus after activation.
        // Keep their destination in view rather than scrolling back to the opener.
        else if (
          visible(control) &&
          (document.activeElement === control || control.contains(document.activeElement))
        )
          reveal(control, false, true);
      });
    }
    function click(event: MouseEvent) {
      pointerHeld = false;
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const source = event.target instanceof Element ? event.target : null;
      const anchor = source?.closest<HTMLAnchorElement>("a[href]");
      if (
        anchor &&
        !event.defaultPrevented &&
        !anchor.download &&
        (!anchor.target || anchor.target === "_self")
      ) {
        const url = new URL(anchor.href, location.href);
        if (
          url.origin === location.origin &&
          url.pathname === location.pathname &&
          url.search === location.search &&
          url.hash
        ) {
          const target = hashTarget(url.hash);
          if (target) {
            event.preventDefault();
            if (location.hash !== url.hash) history.pushState(null, "", url.hash);
            afterRender(() => reveal(target, true));
            return;
          }
        }
      }
      const control = source?.closest<HTMLElement>(
        'button, [role="tab"], [role="option"]',
      );
      if (control?.closest("main, dialog[open]")) selection(control);
    }
    function change(event: Event) {
      pointerHeld = false;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("main, dialog[open]")
      )
        selection(event.target);
    }
    function focus() {
      if (pointerHeld) return;
      const element = document.activeElement;
      if (
        element instanceof HTMLElement &&
        element.matches('[role="tab"][aria-selected="true"]')
      ) {
        selection(element);
        return;
      }
      // Never move a pointer-pressed action before pointerup can activate it.
      if (
        element instanceof HTMLElement &&
        element.closest("main, dialog[open]") &&
        element.matches(
          "input, select, textarea, [contenteditable='true'], a[href]:focus-visible, button:focus-visible, [role='tab']:focus-visible",
        )
      )
        afterRender(() => {
          if (!pointerHeld && document.activeElement === element)
            reveal(element, false, true);
        });
    }
    function hash() {
      const target = hashTarget(location.hash);
      if (target) afterRender(() => reveal(target, true));
    }
    function pointerDown() {
      interaction++;
      pointerMoved = false;
      pointerHeld = true;
    }
    function pointerUp(event: PointerEvent) {
      pointerHeld = false;
      // A scrolling touch must not re-reveal the last focused page/link.
      if (
        !pointerMoved &&
        event.type !== "pointercancel" &&
        document.activeElement?.matches(
          "input, select, textarea, [contenteditable='true']",
        )
      )
        focus();
    }
    function scrolling() {
      pointerMoved = true;
      interaction++;
    }
    function keyboardResize() {
      const height = window.visualViewport?.height ?? innerHeight;
      if (height < viewportHeight - 80) focus();
      viewportHeight = height;
    }
    function keyboard() {
      pointerHeld = false;
    }
    window.addEventListener("touchmove", scrolling, { passive: true });
    window.addEventListener("wheel", scrolling, { passive: true });
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointercancel", pointerUp, true);
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("click", click);
    document.addEventListener("change", change);
    document.addEventListener("focusin", focus);
    window.addEventListener("hashchange", hash);
    window.addEventListener("resize", updateInsets, { passive: true });
    window.visualViewport?.addEventListener("resize", keyboardResize);
    return () => {
      frames.forEach(cancelAnimationFrame);
      structure.disconnect();
      resize.disconnect();
      window.removeEventListener("touchmove", scrolling);
      window.removeEventListener("wheel", scrolling);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointercancel", pointerUp, true);
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("click", click);
      document.removeEventListener("change", change);
      document.removeEventListener("focusin", focus);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("resize", updateInsets);
      window.visualViewport?.removeEventListener("resize", keyboardResize);
      document.documentElement.style.removeProperty("--viewport-header-offset");
      document.documentElement.style.removeProperty("--viewport-support-offset");
    };
  }, []);
  return null;
}
