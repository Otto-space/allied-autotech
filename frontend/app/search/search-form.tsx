"use client";
import { type ReactNode, useEffect, useState } from "react";
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
  const ready = useHydrated();
  function close() {
    if (window.history.length > 1) window.history.back();
    else router.push("/");
  }
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <>
      <form
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
