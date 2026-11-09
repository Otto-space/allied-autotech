"use client";
import { useEffect, useState } from "react";
import { purchaseRequest } from "./client";

export function usePurchaseResource<T>(
  path: string,
  parse: (value: unknown) => T,
  options?: { retainWhileRefreshing?: boolean },
) {
  const [state, setState] = useState<{
    data?: T;
    path?: string;
    loading: boolean;
    failed: boolean;
  }>({
    loading: true,
    failed: false,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            data:
              options?.retainWhileRefreshing && previous.path === path
                ? previous.data
                : undefined,
            path,
            loading: true,
            failed: false,
          }));
        return purchaseRequest(path, { signal: controller.signal });
      })
      .then((result) => {
        const data = parse(result.data);
        if (!controller.signal.aborted)
          setState({ data, path, loading: false, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ path, loading: false, failed: true });
      });
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    };
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [path, parse, revision, options?.retainWhileRefreshing]);
  return {
    data: state.path === path ? state.data : undefined,
    loading: state.path !== path || state.loading,
    failed: state.path === path && state.failed,
    refresh: () => setRevision((v) => v + 1),
  };
}
