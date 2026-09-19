"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "./client";

type ResourceState<T> = {
  path: string;
  data?: T;
  error?: string;
  status: "loading" | "ready" | "error";
  revision: number;
};
export function useResource<T>(
  path: string | null,
  parse: (value: unknown) => T,
  initialData?: T,
  options?: { initialError?: string; revalidateOnMount?: boolean },
) {
  const skipInitialFetch = useRef(
    options?.revalidateOnMount === false && initialData !== undefined,
  );
  const [state, setState] = useState<ResourceState<T> | null>(() =>
    path && initialData !== undefined
      ? { path, data: initialData, status: "ready", revision: 0 }
      : path && options?.initialError
        ? { path, error: options.initialError, status: "error", revision: 0 }
        : null,
  );
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    const shouldFetch = !skipInitialFetch.current;
    skipInitialFetch.current = false;
    if (shouldFetch) {
      queueMicrotask(() => {
        if (active)
          setState((previous) => ({
            path,
            data: previous?.path === path ? previous.data : undefined,
            status: "loading",
            revision,
          }));
      });
      void apiRequest<unknown>(path, { signal: controller.signal })
        .then((response) => {
          const data = parse(response.data);
          if (active) setState({ path, data, status: "ready", revision });
        })
        .catch((error: unknown) => {
          if (active && !controller.signal.aborted)
            setState((previous) => ({
              path,
              data: previous?.path === path ? previous.data : undefined,
              status: "error",
              revision,
              error:
                error instanceof ApiError
                  ? error.message
                  : "We could not read this information. Please try again.",
            }));
        });
    }
    function discard() {
      active = false;
      controller.abort();
      setState(null);
      if (path?.startsWith("/public/")) refresh();
    }
    function visible() {
      if (document.visibilityState === "visible") refresh();
    }
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [path, parse, revision, refresh]);
  const current = state?.path === path ? state : null;
  return {
    data: current?.data,
    error: current?.error,
    loading: !!path && (!current || current.status === "loading"),
    refresh,
    settledRevision: current && current.status !== "loading" ? current.revision : null,
  };
}
