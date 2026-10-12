"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, apiRequest, invalidateSession } from "@/lib/api/client";
import {
  preferenceWriteBodySchema,
  preferenceWriteResultSchema,
} from "@/lib/api/notification-schemas";
import {
  clearPreferenceRecovery,
  readPreferenceRecovery,
  preferenceIntentActive,
  savePreferenceRecovery,
  type PreferenceIntent,
} from "./preference-recovery";

async function sendOriginal(intent: PreferenceIntent, signal: AbortSignal) {
  const response = await apiRequest(
    `/${intent.role === "CUSTOMER" ? "customers" : "staff"}/notifications/preferences/current`,
    {
      method: "PUT",
      csrf: true,
      idempotencyKey: intent.key,
      body: intent.body,
      signal,
    },
  );
  const saved = preferenceWriteResultSchema.parse(response.data);
  if (
    saved.appliedVersion !== intent.body.expectedVersion + 1 ||
    saved.preference.version < saved.appliedVersion ||
    saved.preference.category !== intent.body.category ||
    saved.preference.channel !== intent.body.channel ||
    (saved.preference.version === saved.appliedVersion &&
      (saved.preference.enabled !== intent.body.enabled ||
        (intent.body.category === "MARKETING" &&
          intent.body.enabled &&
          !saved.preference.consentedAt)))
  )
    throw new Error("Unconfirmed preference");
  return saved;
}

type ReadState = {
  loading: boolean;
  refreshing: boolean;
  error?: string;
  refreshError?: string;
  data?: unknown;
  settledRevision: number | null;
  refresh: () => void;
};

/** Retains the exact original request in account-scoped session storage for explicit recovery. */
export function usePreferenceWrite(
  userId: string,
  role: PreferenceIntent["role"],
  records: ReadState,
) {
  const marker = `aat:notification-write:v1:${userId}:preferences`;
  const [recovery, setRecovery] = useState<{
    pending: boolean;
    manual: boolean;
    after: number;
    intent?: PreferenceIntent;
  }>();
  const [storageError, setStorageError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const retryAt = useRef(0);
  const request = useRef<AbortController | null>(null);
  const stale = !!(records.error || records.refreshError);
  const unavailable = records.loading || records.refreshing || stale || !records.data;
  const latestUnavailable = useRef(unavailable);
  useEffect(() => {
    latestUnavailable.current = unavailable;
  }, [unavailable]);
  useEffect(() => {
    if (!records.error && !records.refreshError) return;
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
  }, [records.error, records.refreshError]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const stored = readPreferenceRecovery(userId);
      setRecovery({
        pending: !!stored,
        manual: false,
        after: -1,
        ...(stored?.kind === "pending" && stored.intent.role === role
          ? { intent: stored.intent }
          : {}),
      });
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [marker, userId, role]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  function clearMarker() {
    try {
      clearPreferenceRecovery(userId);
      setStorageError(undefined);
      setRecovery({ pending: false, manual: false, after: -1 });
      return true;
    } catch {
      setStorageError(
        "Your browser could not clear the recovery marker. Allow session storage, then refresh and check the saved result.",
      );
      setRecovery({ pending: true, manual: false, after: -1 });
      return false;
    }
  }

  async function run(body: unknown) {
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
    let intent: PreferenceIntent | undefined;
    try {
      const session = z
        .object({ user: z.object({ id: z.string(), role: z.string() }) })
        .parse((await apiRequest("/auth/session", { signal: controller.signal })).data);
      if (session.user.id !== userId || session.user.role !== role) {
        invalidateSession();
        throw new ApiError(403, { error: { code: "FORBIDDEN" } });
      }
      if (controller.signal.aborted || latestUnavailable.current)
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      try {
        if (readPreferenceRecovery(userId))
          throw new Error("A preference is already pending");
        intent = {
          owner: userId,
          role,
          key: `preference-v1.${Date.now()}.${crypto.randomUUID()}`,
          body: preferenceWriteBodySchema.parse(body),
        };
        savePreferenceRecovery(intent);
      } catch {
        setStorageError(
          "Your browser could not save the recovery marker. Allow session storage before submitting a preference.",
        );
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      }
      sent = true;
      const result = await sendOriginal(intent!, controller.signal);
      if (!controller.signal.aborted) {
        clearMarker();
      }
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw error;
      const rejected =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (sent && rejected) {
        clearMarker();
        records.refresh();
      }
      if (sent && !rejected)
        setRecovery({
          pending: true,
          manual: false,
          after: records.settledRevision ?? -1,
          intent,
        });
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setRemaining(seconds);
      }
      // A failed preflight cannot have submitted a preference.
      if (!sent && !rejected) throw new ApiError(409, { error: { code: "CONFLICT" } });
      throw error;
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  async function recover() {
    if (request.current || !recovery?.pending || Date.now() < retryAt.current)
      throw new ApiError(409, { error: { code: "CONFLICT" } });
    const stored = readPreferenceRecovery(userId);
    if (
      stored?.kind !== "pending" ||
      stored.intent.role !== role ||
      !recovery.intent ||
      JSON.stringify(stored.intent) !== JSON.stringify(recovery.intent)
    ) {
      setRecovery({ pending: true, manual: false, after: -1 });
      throw new ApiError(409, { error: { code: "IDEMPOTENCY_EXPIRED" } });
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const session = z
        .object({ user: z.object({ id: z.string(), role: z.string() }) })
        .parse((await apiRequest("/auth/session", { signal: controller.signal })).data);
      if (session.user.id !== userId || session.user.role !== role) {
        invalidateSession();
        throw new ApiError(403, { error: { code: "FORBIDDEN" } });
      }
      const saved = await sendOriginal(stored.intent, controller.signal);
      if (!controller.signal.aborted) {
        clearMarker();
      }
      return saved;
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["IDEMPOTENCY_EXPIRED", "IDEMPOTENCY_CONFLICT", "CONFLICT"].includes(error.code)
      ) {
        try {
          sessionStorage.setItem(marker, "pending");
        } catch {
          /* Keep the original receipt if storage fails. */
        }
        setRecovery({ pending: true, manual: false, after: -1 });
      }
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setRemaining(seconds);
      }
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
        ...recovery,
        pending: true,
        manual: true,
        after: records.settledRevision ?? -1,
      });
    records.refresh();
  }
  const canAcknowledge =
    !!recovery?.pending &&
    (!recovery.intent || !preferenceIntentActive(recovery.intent)) &&
    recovery.manual &&
    !unavailable &&
    records.settledRevision !== null &&
    records.settledRevision > recovery.after;
  return {
    run,
    recover,
    intent:
      recovery?.intent && preferenceIntentActive(recovery.intent)
        ? recovery.intent
        : undefined,
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
