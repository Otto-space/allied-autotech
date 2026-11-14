"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

function headerOffset(target?: HTMLElement) {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>(".site-header, .dashboard-top").forEach((el) => {
    if (["fixed", "sticky"].includes(getComputedStyle(el).position))
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
  });
  const context = target
    ?.closest(".workforce-panel[data-person-page='true']")
    ?.querySelector<HTMLElement>(".wf-person-context");
  // Page-local and shared focus reveal must use the same sticky identity edge.
  // Otherwise their scheduled adjustments can place the control behind each other.
  if (
    target &&
    context &&
    !context.contains(target) &&
    context.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING &&
    ["fixed", "sticky"].includes(getComputedStyle(context).position)
  )
    bottom = Math.max(bottom, context.getBoundingClientRect().bottom);
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
  // The person workspace measures the label, sticky identity and support dock
  // together. A later generic reveal must not move its focused field again.
  if (
    nearest &&
    !focus &&
    document.activeElement === element &&
    element.matches("input, textarea, select, button") &&
    !element.closest(".wf-person-context") &&
    element.closest('[data-person-focus-managed="true"]')
  )
    return;
  // Custom radios/checkboxes can hide the input behind a visible label. Keep
  // the painted control and its focus ring visible, rather than its 1px input.
  const label =
    element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)
      ? element.closest("label")
      : null;
  const box = (label ?? element).getBoundingClientRect();
  const top = headerOffset(element);
  const dock = document.querySelector<HTMLElement>(".support-controls");
  const dockBox =
    dock && getComputedStyle(dock).position === "fixed"
      ? dock.getBoundingClientRect()
      : null;
  // The compact public dock occupies a side rail. Controls alongside it do not
  // need to jump above its row; only overlapping controls need that clearance.
  const overlapsDock =
    dockBox && box.right > dockBox.left - 8 && box.left < dockBox.right + 8;
  const bottom = overlapsDock
    ? Math.min(innerHeight - 16, dockBox.top - 12)
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

function useCatalogueReturnPosition() {
  useEffect(() => {
    const positions = new Map<string, { y: number; href: string }>();
    const cards =
      ".shop-product-card a[href], .vehicle-card a[href], .services-row a[href]";
    let cancelRestore = () => {};
    const remember = (event: MouseEvent) => {
      cancelRestore();
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!["/parts", "/vehicles", "/services"].includes(location.pathname)) return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>(cards)
          : null;
      if (!link || link.origin !== location.origin) return;
      const key = location.pathname + location.search;
      positions.delete(key);
      positions.set(key, { y: scrollY, href: link.href });
      if (positions.size > 20) positions.delete(positions.keys().next().value!);
    };
    const restore = () => {
      cancelRestore();
      if (location.hash) return;
      const key = location.pathname + location.search;
      const saved = positions.get(key);
      if (!saved) return;
      let frame = 0;
      let stopped = false;
      const stop = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        clearTimeout(timeout);
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchstart", stop);
        window.removeEventListener("keydown", stop);
      };
      const check = () => {
        if (stopped || location.pathname + location.search !== key) return;
        const target = Array.from(
          document.querySelectorAll<HTMLAnchorElement>(cards),
        ).find((link) => link.href === saved.href);
        // Browser restoration can run while the async results are still a short
        // loading state. Wait for the original result and sufficient page height.
        if (!target || document.documentElement.scrollHeight < saved.y + innerHeight - 2)
          return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (stopped || location.pathname + location.search !== key) return;
            window.scrollTo({ top: saved.y, behavior: "instant" });
            stop();
          });
        });
      };
      const observer = new MutationObserver(check);
      const timeout = window.setTimeout(stop, 5000);
      cancelRestore = stop;
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      window.addEventListener("wheel", stop, { passive: true });
      window.addEventListener("touchstart", stop, { passive: true });
      window.addEventListener("keydown", stop);
      check();
    };
    document.addEventListener("click", remember, true);
    window.addEventListener("popstate", restore);
    return () => {
      cancelRestore();
      document.removeEventListener("click", remember, true);
      window.removeEventListener("popstate", restore);
    };
  }, []);
}
export function ViewportNavigation() {
  useCatalogueReturnPosition();
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
    const historyEntry =
      initial &&
      performance
        .getEntriesByType("navigation")
        .some((entry) => (entry as PerformanceNavigationTiming).type === "back_forward");
    // Preserve native history and ordinary refresh positions. A refreshed fragment
    // may need one correction after fonts/load if its heading sits behind the header.
    if (historyRestore || historyEntry || (initial && !location.hash)) return;
    let frame = 0;
    let cancelled = false;
    let observer: MutationObserver | undefined;
    let layoutObserver: ResizeObserver | undefined;
    let layoutTimeout: number | undefined;
    const cancelEntry = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      layoutObserver?.disconnect();
      clearTimeout(layoutTimeout);
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
      // Reload can restore an absolute offset from before the form/font layout
      // settled, leaving the fragment far above the viewport. Keep a visible
      // destination; otherwise correct it unless a new interaction cancelled entry.
      if (initial && scrollY > 0) {
        const box = target.getBoundingClientRect();
        if (box.top >= headerOffset() && box.bottom <= innerHeight) return true;
      }
      // The optional walkthrough owns focus when opened by its reserved hash.
      reveal(target, !location.hash.startsWith("#learn="));
      return true;
    };
    // Native reload restoration and font metrics can settle after hydration. Wait
    // for those only on initial fragment entry; explicit navigation stays immediate.
    const schedule = () => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
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
    };
    const loaded = () => {
      // Suspended forms can expand after load and font settlement. Keep the
      // fragment visible through that short entry window; any new interaction
      // immediately releases ownership so a visitor's scroll is never undone.
      if (!cancelled && location.hash) {
        layoutObserver = new ResizeObserver(schedule);
        layoutObserver.observe(document.querySelector("main") ?? document.body);
        layoutTimeout = window.setTimeout(() => layoutObserver?.disconnect(), 10000);
      }
      void document.fonts.ready.then(schedule);
    };
    if (initial) {
      if (document.readyState === "complete") loaded();
      else window.addEventListener("load", loaded, { once: true });
    } else schedule();
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
      window.removeEventListener("load", loaded);
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
      // Carousel buttons update their own frame. Re-revealing them after a tap
      // can move the entire page past the hero, despite the button being visible.
      // Keyboard focus still uses the normal visibility handling below.
      if (control.closest("[data-carousel-controls]")) return;
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
