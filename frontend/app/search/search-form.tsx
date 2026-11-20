"use client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated } from "@/lib/use-hydrated";
export function PublicSearchForm({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const ready = useHydrated();
  function close() {
    if (window.history.length > 1) window.history.back();
    else router.push("/");
  }
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let frame = 0;
    const reset = () => {
      setPending(false);
      // Browsers restore persisted form values after pageshow during Back/Forward.
      // Reconcile on the next frame so the editor matches the applied URL/results.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => form.current?.reset());
    };
    // Initial loading must not clear a search the visitor has already typed.
    // Only a document restored from the back/forward cache needs reconciliation.
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", restored);
    window.addEventListener("popstate", reset);
    // A history traversal may reload instead of restoring a cached document.
    // In that case pageshow can precede hydration, so reconcile after mounting.
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (navigation?.type === "back_forward") reset();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("popstate", reset);
    };
  }, []);
  return (
    <>
      <form
        ref={form}
        action="/search"
        method="get"
        role="search"
        aria-label="Search the catalogues"
        className={className}
        aria-busy={pending}
        onSubmit={(event) => {
          if (pending) event.preventDefault();
          else setPending(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || event.defaultPrevented) return;
          event.preventDefault();
          close();
        }}
      >
        {children}
        <p role="status">{pending ? "Searching public information…" : ""}</p>
      </form>
      <button
        type="button"
        className="button secondary"
        disabled={!ready}
        onClick={close}
      >
        Close search
      </button>
    </>
  );
}
