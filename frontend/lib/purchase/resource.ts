"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { purchaseRequest, subscribePurchaseAccess } from "./client";

export function usePurchaseResource<T>(
  path: string,
  parse: (value: unknown) => T,
  options?: { revalidateOnFocus?: boolean },
) {
  const [state, setState] = useState<{
    path: string;
    parse: typeof parse;
    data?: T;
    loading: boolean;
    refreshing: boolean;
    failed: boolean;
  }>({
    path,
    parse,
    loading: true,
    refreshing: false,
    failed: false,
  });
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
    const controller = new AbortController();
    const background = backgroundRefresh.current;
    backgroundRefresh.current = false;
    const unsubscribe = subscribePurchaseAccess(() => {
      controller.abort();
      setState({ path, parse, loading: false, refreshing: false, failed: true });
    });
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted)
          setState((previous) => {
            const retain =
              background &&
              previous.path === path &&
              previous.parse === parse &&
              previous.data !== undefined;
            return {
              path,
              parse,
              ...(retain && previous.data !== undefined ? { data: previous.data } : {}),
              loading: !retain,
              refreshing: retain,
              failed: false,
            };
          });
        return purchaseRequest(path, { signal: controller.signal });
      })
      .then((result) => {
        const data = parse(result.data);
        if (!controller.signal.aborted)
          setState({
            path,
            parse,
            data,
            loading: false,
            refreshing: false,
            failed: false,
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ path, parse, loading: false, refreshing: false, failed: true });
      });
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        if (options?.revalidateOnFocus) revalidate();
        else refresh();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [path, parse, revision, refresh, revalidate, options?.revalidateOnFocus]);
  const current = state.path === path && state.parse === parse;
  return {
    data: current ? state.data : undefined,
    loading: !current || state.loading,
    refreshing: current && state.refreshing,
    failed: current && state.failed,
    refresh,
    revalidate,
  };
}
