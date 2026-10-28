"use client";
import { useEffect } from "react";

// Explicit in-app task controls also ask before discarding their editor.
export function useEditorLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !link ||
        link.href === window.location.href ||
        link.getAttribute("href")?.startsWith("#")
      )
        return;
      if (
        window.confirm(
          "Leave this editor? Unsaved changes have not been saved to the record.",
        )
      )
        return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [active]);
}
