"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, apiRequest, invalidateSession } from "@/lib/api/client";
import { parseSupportRecord, type SupportKind } from "@/lib/api/support-schemas";
import { draftKey, forgetDraft, DRAFT_SAVED } from "@/lib/forms/drafts";
import {
  clearSupportCreationRecovery,
  readSupportCreationRecovery,
  supportCreationIntentActive,
  saveSupportCreationRecovery,
  supportCreationIntentSchema,
  type SupportCreationIntent,
} from "./creation-recovery";

async function sendOriginal(intent: SupportCreationIntent, signal: AbortSignal) {
  const response = await apiRequest(`/customers/support/${intent.kind}`, {
    method: "POST",
    csrf: true,
    idempotencyKey: intent.key,
    body: intent.body,
    signal,
  });
  z.object({ replayed: z.boolean() }).parse(response.data);
  const saved = parseSupportRecord(intent.kind, false, response.data);
  if (
    Object.entries(intent.body).some(
      ([key, value]) =>
        !Object.entries(saved).some(
          ([savedKey, savedValue]) => savedKey === key && savedValue === value,
        ),
    )
  )
    throw new Error("Unconfirmed support creation");
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
export function useSupportCreateWrite(
  userId: string,
  kind: SupportKind,
  records: ReadState,
) {
  const marker = `aat:support-create:v1:${userId}:${kind}`;
  const [recovery, setRecovery] = useState<{
    pending: boolean;
    manual: boolean;
    after: number;
    intent?: SupportCreationIntent;
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
      const stored = readSupportCreationRecovery(userId, kind);
      setRecovery({
        pending: !!stored,
        manual: false,
        after: -1,
        ...(stored?.kind === "pending" ? { intent: stored.intent } : {}),
      });
    });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [marker, userId, kind]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  function clearMarker() {
    try {
      clearSupportCreationRecovery(userId, kind);
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

  function forgetSubmittedDraft() {
    const key = draftKey(
      `${userId}:CUSTOMER`,
      window.location.pathname,
      JSON.stringify(["support-create-form:2", userId, kind]),
    );
    forgetDraft(key);
    window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: key }));
  }

  async function run(body: unknown, prepare: (signal: AbortSignal) => Promise<void>) {
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
    let intent: SupportCreationIntent | undefined;
    try {
      const session = z
        .object({ user: z.object({ id: z.string(), role: z.string() }) })
        .parse((await apiRequest("/auth/session", { signal: controller.signal })).data);
      if (session.user.id !== userId || session.user.role !== "CUSTOMER") {
        invalidateSession();
        throw new ApiError(403, { error: { code: "FORBIDDEN" } });
      }
      await prepare(controller.signal);
      if (controller.signal.aborted || latestUnavailable.current)
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      try {
        if (readSupportCreationRecovery(userId, kind))
          throw new Error("A support request is already pending");
        intent = supportCreationIntentSchema.parse({
          owner: userId,
          kind,
          key: `support-create-v1.${Date.now()}.${crypto.randomUUID()}`,
          body,
        });
        saveSupportCreationRecovery(intent);
      } catch {
        setStorageError(
          "Your browser could not save the recovery marker. Allow session storage before submitting a support request.",
        );
        throw new ApiError(409, { error: { code: "CONFLICT" } });
      }
      sent = true;
      const result = await sendOriginal(intent!, controller.signal);
      if (!controller.signal.aborted) {
        clearMarker();
        forgetSubmittedDraft();
      }
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
          after: records.settledRevision ?? -1,
          intent,
        });
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 0;
        retryAt.current = Date.now() + seconds * 1000;
        setRemaining(seconds);
      }
      // A failed preflight cannot have submitted a support request.
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
    const stored = readSupportCreationRecovery(userId, kind);
    if (
      stored?.kind !== "pending" ||
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
      if (session.user.id !== userId || session.user.role !== "CUSTOMER") {
        invalidateSession();
        throw new ApiError(403, { error: { code: "FORBIDDEN" } });
      }
      const saved = await sendOriginal(stored.intent, controller.signal);
      if (!controller.signal.aborted) {
        clearMarker();
        forgetSubmittedDraft();
      }
      return saved;
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["IDEMPOTENCY_EXPIRED", "IDEMPOTENCY_CONFLICT"].includes(error.code)
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
    (!recovery.intent || !supportCreationIntentActive(recovery.intent)) &&
    recovery.manual &&
    !unavailable &&
    records.settledRevision !== null &&
    records.settledRevision > recovery.after;
  return {
    run,
    recover,
    intent:
      recovery?.intent && supportCreationIntentActive(recovery.intent)
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
