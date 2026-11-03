"use client";
import { useEffect, useState } from "react";
import { purchaseRequest } from "./client";

export function usePurchaseResource<T>(path: string, parse: (value: unknown) => T) {
  const [state, setState] = useState<{ data?: T; loading: boolean; failed: boolean }>({
    loading: true,
    failed: false,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted) setState({ loading: true, failed: false });
        return purchaseRequest(path, { signal: controller.signal });
      })
      .then((result) => {
        const data = parse(result.data);
        if (!controller.signal.aborted) setState({ data, loading: false, failed: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ loading: false, failed: true });
      });
    const refresh = () => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    };
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [path, parse, revision]);
  return { ...state, refresh: () => setRevision((v) => v + 1) };
}
