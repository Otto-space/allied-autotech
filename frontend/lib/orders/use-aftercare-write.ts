"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";

type ReadState = {
  loading: boolean;
  refreshing: boolean;
  error?: string;
  refreshError?: string;
  data?: unknown;
  settledRevision: number | null;
  refresh: () => void;
};

/** Stores only an account/order pending marker; never automatically repeats intake. */
export function useAftercareWrite(
  userId: string,
  orderId: string,
  order: ReadState,
  history: ReadState,
  validHistory: boolean,
) {
  const marker = `aat:aftercare-create:v1:${userId}:${orderId}`;
  const [recovery, setRecovery] = useState<{
    pending: boolean;
    manual: boolean;
    after: [number, number];
  }>();
  const [storageError, setStorageError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const retryAt = useRef(0);
  const request = useRef<AbortController | null>(null);
  const error = order.error ?? history.error;
  const refreshError = order.refreshError ?? history.refreshError;
  const unavailable =
    !validHistory ||
    [order, history].some(
      (record) =>
        record.loading ||
        record.refreshing ||
        record.error ||
        record.refreshError ||
        !record.data,
    );
  const latestUnavailable = useRef(unavailable);
  useEffect(() => {
    latestUnavailable.current = unavailable;
  }, [unavailable]);
  useEffect(() => {
    if (!error && !refreshError) return;
    let active = true;
    queueMicrotask(() => {
      if (active)
        setRecovery((current) =>
          current?.manual ? { ...current, manual: false } : current,
        );
    });
    return () => {
      active = false;
    };
  }, [error, refreshError]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setRecovery({
          pending: sessionStorage.getItem(marker) !== null,
          manual: false,
          after: [-1, -1],
        });
      } catch {
        setRecovery({ pending: false, manual: false, after: [-1, -1] });
      }
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [marker]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  function clearMarker() {
    try {
      sessionStorage.removeItem(marker);
      setStorageError(undefined);
      setRecovery({ pending: false, manual: false, after: [-1, -1] });
      return true;
    } catch {
      setStorageError(
        "Your browser could not clear the recovery marker. Allow session storage, then refresh and check the saved result.",
      );
      setRecovery({ pending: true, manual: false, after: [-1, -1] });
      return false;
    }
  }

  async function run<T>(
    prepare: (signal: AbortSignal) => Promise<void>,
    write: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (
      request.current ||
      !recovery ||
      recovery.pending ||
      latestUnavailable.current ||
      Date.now() < retryAt.current
    )
      throw new ApiError(409, { error: { code: "CONFLICT" } });
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    let sent = false;
    try {
      const session = z
        .object({ user: z.object({ id: z.string(), role: z.string() }) })
        .parse((await apiRequest("/auth/session", { signal: controller.signal })).data);
      if (session.user.id !== userId || session.user.role !== "CUSTOMER")
        throw new ApiError(403, { error: { code: "FORBIDDEN" } });
      await prepare(controller.signal);
      if (controller.signal.aborted || latestUnavailable.current)
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      try {
        sessionStorage.setItem(marker, "pending");
        if (sessionStorage.getItem(marker) !== "pending")
          throw new Error("Recovery storage unavailable");
      } catch {
        setStorageError(
          "Your browser could not save the recovery marker. Allow session storage before submitting a request.",
        );
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      }
      sent = true;
      const result = await write(controller.signal);
      if (!controller.signal.aborted) clearMarker();
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const rejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (sent && rejected) clearMarker();
      if (sent && !rejected)
        setRecovery({
          pending: true,
          manual: false,
          after: [order.settledRevision ?? -1, history.settledRevision ?? -1],
        });
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setRemaining(seconds);
      }
      // A failed preflight cannot have submitted a request.
      if (!sent && !rejected) throw new ApiError(409, { error: { code: "CONFLICT" } });
      throw error;
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function refresh() {
    if (recovery?.pending)
      setRecovery({
        pending: true,
        manual: true,
        after: [order.settledRevision ?? -1, history.settledRevision ?? -1],
      });
    order.refresh();
    history.refresh();
  }
  const canAcknowledge =
    !!recovery?.pending &&
    recovery.manual &&
    !unavailable &&
    order.settledRevision !== null &&
    history.settledRevision !== null &&
    order.settledRevision > recovery.after[0] &&
    history.settledRevision > recovery.after[1];
  return {
    run,
    refresh,
    busy,
    remaining,
    storageError,
    pending: !!recovery?.pending,
    disabled: !recovery || unavailable || busy || !!recovery.pending || remaining > 0,
    canAcknowledge,
    acknowledge: () => {
      if (canAcknowledge) clearMarker();
    },
  };
}
