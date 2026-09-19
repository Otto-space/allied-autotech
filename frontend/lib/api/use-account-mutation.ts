"use client";
import { useEffect, useRef, useState } from "react";
import { SESSION_CHANGED } from "./client";

// Cancellation discards this browser's result; it cannot undo a server mutation.
export function useAccountMutation(reset: () => void) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);
  useEffect(() => {
    const discard = () => {
      pending.current?.abort();
      pending.current = null;
      setBusy(false);
      setSessionChanged(true);
      reset();
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      window.removeEventListener(SESSION_CHANGED, discard);
      pending.current?.abort();
      pending.current = null;
    };
  }, [reset]);

  function begin() {
    if (pending.current) return null;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setSessionChanged(false);
    return controller;
  }
  function finish(controller: AbortController) {
    if (pending.current !== controller) return;
    pending.current = null;
    if (!controller.signal.aborted) setBusy(false);
  }
  return { busy, sessionChanged, begin, finish };
}
