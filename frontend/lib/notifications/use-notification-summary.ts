"use client";
import { useEffect, useState } from "react";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import {
  notificationSummarySchema,
  type NotificationSummary,
} from "@/lib/api/notification-schemas";
import type { SessionState } from "@/lib/api/types";

const changed = "aat-notifications-changed";
export function announceNotificationChange(userId: string) {
  window.dispatchEvent(new CustomEvent(changed, { detail: userId }));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(changed);
    channel.postMessage({ userId });
    channel.close();
  }
}
export function useNotificationSummary(session: SessionState | null) {
  const userId = session?.user.id;
  const scope = session ? `${session.id}:${userId}:${session.user.role}` : null;
  const base = session
    ? `/${session.user.role === "CUSTOMER" ? "customers" : "staff"}/notifications/summary`
    : null;
  const [state, setState] = useState<{
    scope: string;
    data?: NotificationSummary;
    unavailable?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!scope || !base) return;
    let active = true;
    let request: AbortController | undefined;
    let lastAttempt = 0;
    async function refresh(force = false) {
      if (!active || document.visibilityState === "hidden" || !navigator.onLine) return;
      if (!force && Date.now() - lastAttempt < 1000) return;
      lastAttempt = Date.now();
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await apiRequest(base!, { signal: controller.signal });
        const data = notificationSummarySchema.parse(response.data);
        if (active && !controller.signal.aborted) setState({ scope: scope!, data });
      } catch {
        if (active && !controller.signal.aborted)
          setState({ scope: scope!, unavailable: true });
      }
    }
    const visible = () => {
      void refresh();
    };
    const updated = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === userId) void refresh(true);
    };
    const discard = () => {
      active = false;
      request?.abort();
      setState(null);
    };
    const channel =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(changed) : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data?.userId === userId) void refresh(true);
      };
    void refresh(true);
    const timer = window.setInterval(visible, 30_000);
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    window.addEventListener(changed, updated);
    window.addEventListener(SESSION_CHANGED, discard);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      request?.abort();
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      window.removeEventListener(changed, updated);
      window.removeEventListener(SESSION_CHANGED, discard);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [scope, base, userId]);
  return state?.scope === scope ? state : null;
}
