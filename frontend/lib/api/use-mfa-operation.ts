"use client";
import { useEffect, useRef, useState } from "react";
import { WebAuthnAbortService } from "@simplewebauthn/browser";
import { ApiError } from "./client";
export function useMfaOperation() {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const retryAt = useRef(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const waiting = waitSeconds > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(
      () => setWaitSeconds(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [waiting]);
  useEffect(
    () => () => {
      pending.current?.abort();
      WebAuthnAbortService.cancelCeremony();
    },
    [],
  );
  async function run(
    task: (signal: AbortSignal, submitted: () => void) => Promise<void>,
  ) {
    if (pending.current || uncertain || requiresMfa || Date.now() < retryAt.current)
      return false;
    const controller = new AbortController();
    pending.current = controller;
    let submitted = false;
    setBusy(true);
    setError(undefined);
    try {
      await task(controller.signal, () => {
        submitted = true;
      });
      return !controller.signal.aborted;
    } catch (value) {
      if (controller.signal.aborted) return false;
      setRequiresMfa(
        value instanceof ApiError &&
          value.status === 403 &&
          value.code === "MFA_REQUIRED",
      );
      if (value instanceof ApiError && value.status === 429) {
        const seconds = value.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setWaitSeconds(seconds);
      }
      const unknown =
        submitted &&
        !(value instanceof ApiError && value.status >= 400 && value.status < 500);
      setUncertain(unknown);
      setError(
        unknown
          ? "The result could not be confirmed. Do not resend this verification. Check your session before continuing; a code may already have been used or a factor activated."
          : value instanceof ApiError
            ? value.status === 400 && value.code === "TOKEN_INVALID"
              ? "This code or challenge is invalid, expired or already used. Enter a fresh code or prepare a new security-key challenge."
              : value.message
            : value instanceof Error &&
                ["NotAllowedError", "AbortError"].includes(value.name)
              ? "The security step could not be completed. If you cancelled the browser prompt, prepare a new challenge when ready."
              : "The security response could not be validated. Prepare this step again when connected.",
      );
      return false;
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }
  return {
    busy,
    error,
    uncertain,
    requiresMfa,
    waiting,
    waitSeconds,
    run,
    clearError: () => setError(undefined),
  };
}
