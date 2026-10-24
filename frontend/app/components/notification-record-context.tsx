"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { markAllReadSchema, notificationSchema } from "@/lib/api/notification-schemas";
import { announceNotificationChange } from "@/lib/notifications/use-notification-summary";
import { useAccountSession } from "./dashboard-shell";
import "./notification-record-context.css";

const parseContext = (value: unknown) =>
  z
    .object({
      items: z.array(notificationSchema).max(100),
      hasMore: z.boolean().optional(),
    })
    .parse(value);

// Mount inside the successful record view, never in a shell, list or loading state.
// Conversation notifications additionally require the actual message to be visible.
type ContextProps = {
  resourceType: string;
  resourceId: string;
  supportMessageIds?: readonly string[];
  targetElementId?: string;
};
export function NotificationRecordContext(props: ContextProps) {
  const session = useAccountSession();
  return session ? (
    <DisplayedNotificationContext
      key={`${session.id}:${session.user.id}:${session.user.role}:${props.resourceType}:${props.resourceId}`}
      {...props}
    />
  ) : null;
}
function DisplayedNotificationContext({
  resourceType,
  resourceId,
  supportMessageIds = [],
  targetElementId,
}: {
  resourceType: string;
  resourceId: string;
  supportMessageIds?: readonly string[];
  targetElementId?: string;
}) {
  const session = useAccountSession();
  const base = session
    ? `/${session.user.role === "CUSTOMER" ? "customers" : "staff"}/notifications`
    : null;
  const query = new URLSearchParams({ resourceType, resourceId });
  if (supportMessageIds.length)
    query.set("messageIds", [...new Set(supportMessageIds)].slice(0, 50).join(","));
  const context = useResource(base ? `${base}/context?${query}` : null, parseContext);
  const refreshContext = context.refresh;
  const hasMoreContext = context.data?.hasMore;
  const container = useRef<HTMLElement>(null);
  const focused = useRef(false);
  const [readIds, setReadIds] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const items =
    context.error || context.loading || context.refreshError
      ? undefined
      : context.data?.items;
  const ids = JSON.stringify(
    (items ?? [])
      .filter(
        (n) =>
          n.resourceType?.toUpperCase() === resourceType &&
          n.resourceId === resourceId &&
          (!n.supportMessageId || supportMessageIds.includes(n.supportMessageId)) &&
          !readIds.includes(n.id),
      )
      .map((n) => ({ id: n.id, message: n.supportMessageId ?? null })),
  );
  useEffect(() => {
    if (!items?.length || focused.current || !container.current) return;
    focused.current = true;
    if (!window.location.hash.startsWith("#support-entry-")) {
      const target = targetElementId
        ? document.getElementById(targetElementId)
        : container.current;
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
      target?.focus({ preventScroll: true });
    }
  }, [items, targetElementId]);
  useEffect(() => {
    const candidates = JSON.parse(ids) as { id: string; message: string | null }[];
    if (!session || !base || !candidates.length) return;
    let active = true;
    const controller = new AbortController();
    const visible = new Set<string>();
    let frame = 0,
      busy = false;
    const completed = new Set<string>();
    const observe = new Map<Element, string[]>();
    for (const candidate of candidates) {
      const element = candidate.message
        ? document.getElementById(`support-entry-${candidate.message}`)
        : targetElementId
          ? document.getElementById(targetElementId)
          : container.current;
      if (element) observe.set(element, [...(observe.get(element) ?? []), candidate.id]);
    }
    async function acknowledge() {
      if (!active || busy || document.visibilityState !== "visible") return;
      const notificationIds = [...visible].filter((id) => !completed.has(id));
      if (!notificationIds.length) return;
      busy = true;
      try {
        const response = await apiRequest(`${base}/read-context`, {
          method: "POST",
          csrf: true,
          signal: controller.signal,
          body: { resourceType, resourceId, notificationIds },
        });
        const result = markAllReadSchema.parse(response.data);
        if (result.updated > notificationIds.length)
          throw Error("Unexpected read receipt");
        if (!active || controller.signal.aborted) return;
        notificationIds.forEach((id) => completed.add(id));
        setReadIds((previous) => [...new Set([...previous, ...notificationIds])]);
        setFailed(false);
        announceNotificationChange(session!.user.id);
        if (hasMoreContext) refreshContext();
      } catch {
        if (active && !controller.signal.aborted) setFailed(true);
      } finally {
        busy = false;
      }
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => void acknowledge());
      });
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          for (const id of observe.get(entry.target) ?? []) {
            if (entry.isIntersecting) visible.add(id);
            else visible.delete(id);
          }
        schedule();
      },
      { threshold: 0.01 },
    );
    observe.forEach((_, element) => observer.observe(element));
    const discard = () => {
      active = false;
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      discard();
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [
    ids,
    session,
    base,
    resourceType,
    resourceId,
    attempt,
    hasMoreContext,
    refreshContext,
    targetElementId,
  ]);
  if (!items?.length) return null;
  const inbox =
    session?.user.role === "CUSTOMER"
      ? "/dashboard/notifications"
      : "/admin/notifications";
  const first = items.find(
    (item) =>
      item.resourceType?.toUpperCase() === resourceType && item.resourceId === resourceId,
  );
  if (!first) return null;
  return (
    <section
      ref={container}
      tabIndex={-1}
      className="notification-record-context"
      aria-label="Related record updates"
    >
      <strong>{first.title}</strong>
      <p>{first.message}</p>
      <p className="notification-context-state" role="status">
        {failed
          ? "The read status could not be saved. Your record is still available."
          : readIds.length
            ? "Displayed updates marked as read. The record’s business status is unchanged."
            : "Related updates are marked as read when their information is displayed."}
      </p>
      {failed && (
        <button
          className="button secondary"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        >
          Retry read update
        </button>
      )}
      <Link href={inbox} prefetch={false}>
        All notifications
      </Link>
    </section>
  );
}
