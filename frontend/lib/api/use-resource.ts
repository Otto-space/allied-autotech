"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "./client";

type ResourceState<T> = {
  path: string;
  data?: T;
  error?: string;
  refreshError?: string;
  status: "loading" | "refreshing" | "ready" | "error";
  revision: number;
  denied?: boolean;
};
export function useResource<T>(
  path: string | null,
  parse: (value: unknown) => T,
  initialData?: T,
  options?: { initialError?: string; revalidateOnMount?: boolean; refreshKey?: number },
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
  const backgroundRefresh = useRef(false);
  const refresh = useCallback(() => {
    backgroundRefresh.current = false;
    setRevision((value) => value + 1);
  }, []);
  const revalidate = useCallback(() => {
    backgroundRefresh.current = true;
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    const shouldFetch = !skipInitialFetch.current;
    const background = backgroundRefresh.current;
    backgroundRefresh.current = false;
    skipInitialFetch.current = false;
    if (shouldFetch) {
      queueMicrotask(() => {
        if (active)
          setState((previous) => ({
            path,
            data: previous?.path === path ? previous.data : undefined,
            status:
              background && previous?.path === path && previous.data !== undefined
                ? "refreshing"
                : "loading",
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
            setState((previous) => {
              const message =
                error instanceof ApiError
                  ? error.message
                  : "We could not read this information. Please try again.";
              const denied =
                error instanceof ApiError &&
                (error.status === 401 || error.status === 403 || error.status === 404);
              // A temporary background failure must not replace a mounted form.
              if (
                background &&
                !denied &&
                previous?.path === path &&
                previous.data !== undefined
              )
                return {
                  path,
                  data: previous.data,
                  status: "ready",
                  revision,
                  refreshError: message,
                };
              return {
                path,
                data: !denied && previous?.path === path ? previous.data : undefined,
                denied,
                status: "error",
                revision,
                error: message,
              };
            });
        });
    }
    function discard() {
      active = false;
      controller.abort();
      setState(null);
      if (path?.startsWith("/public/")) refresh();
    }
    function visible() {
      if (document.visibilityState === "visible") revalidate();
    }
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [path, parse, revision, refresh, revalidate, options?.refreshKey]);
  const current = state?.path === path ? state : null;
  return {
    denied: current?.denied ?? false,
    data: current?.data,
    error: current?.error,
    refreshError: current?.refreshError,
    refreshing: current?.status === "refreshing",
    loading: !!path && (!current || current.status === "loading"),
    refresh,
    revalidate,
    settledRevision:
      current &&
      !current.refreshError &&
      (current.status === "ready" || current.status === "error")
        ? current.revision
        : null,
  };
}
