"use client";
import { useEffect, useRef } from "react";
import { useResource } from "./use-resource";
import { parseOverview } from "./overview-schemas";

export function useOverview(path: string | null) {
  const resource = useResource(path, parseOverview);
  const failures = useRef({ path, count: 0 });
  const { loading, error, refresh, settledRevision } = resource;
  useEffect(() => {
    if (!path || loading) return;
    const previous = failures.current.path === path ? failures.current.count : 0;
    failures.current = { path, count: error ? Math.min(previous + 1, 3) : 0 };
    const timer = window.setTimeout(
      () => {
        if (document.visibilityState === "visible" && navigator.onLine) refresh();
      },
      Math.min(60_000 * 2 ** failures.current.count, 300_000),
    );
    return () => window.clearTimeout(timer);
  }, [path, loading, error, refresh, settledRevision]);
  return resource;
}
