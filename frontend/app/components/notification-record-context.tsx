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

const parseContext = (value: unknown) => z.object({ items: z.array(notificationSchema).max(100), hasMore: z.boolean().optional() }).parse(value);
type ContextProps = { resourceType: string; resourceId: string; supportMessageIds?: readonly string[]; targetElementId?: string };

// Mount only inside a successfully authorized source view. Merely loading,
// hovering, scrolling or returning to this record never changes read state.
export function NotificationRecordContext(props: ContextProps) {
  const session = useAccountSession();
  return session ? <DisplayedNotificationContext key={`${session.id}:${session.user.id}:${session.user.role}:${props.resourceType}:${props.resourceId}`} {...props}/> : null;
}
function DisplayedNotificationContext({ resourceType, resourceId, supportMessageIds = [] }: ContextProps) {
  const session = useAccountSession();
  const base = session ? `/${session.user.role === "CUSTOMER" ? "customers" : "staff"}/notifications` : null;
  const query = new URLSearchParams({ resourceType, resourceId });
  if (supportMessageIds.length) query.set("messageIds", [...new Set(supportMessageIds)].slice(0, 50).join(","));
  const context = useResource(base ? `${base}/context?${query}` : null, parseContext);
  const request = useRef<AbortController | null>(null);
  const [acknowledged, setAcknowledged] = useState<{ revision: number | null; ids: readonly string[] }>({ revision: null, ids: [] });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const discard = () => request.current?.abort();
    window.addEventListener(SESSION_CHANGED, discard);
    return () => { discard(); window.removeEventListener(SESSION_CHANGED, discard); };
  }, []);
  const items = context.error || context.loading || context.refreshError ? undefined : context.data?.items;
  const localIds = acknowledged.revision === context.settledRevision ? acknowledged.ids : [];
  const candidates = (items ?? []).filter((n) => n.resourceType?.toUpperCase() === resourceType && n.resourceId === resourceId && (!n.supportMessageId || supportMessageIds.includes(n.supportMessageId)) && !localIds.includes(n.id));
  async function readDisplayed() {
    if (!session || !base || busy || request.current || !candidates.length || context.refreshing) return;
    const controller = new AbortController(); request.current = controller;
    const notificationIds = candidates.map((n) => n.id);
    setBusy(true); setFailed(false);
    try {
      const response = await apiRequest(`${base}/read-context`, { method: "POST", csrf: true, signal: controller.signal, body: { resourceType, resourceId, notificationIds } });
      const result = markAllReadSchema.parse(response.data);
      if (result.updated > notificationIds.length) throw Error("Unexpected read receipt");
      if (controller.signal.aborted) return;
      setAcknowledged({ revision: context.settledRevision, ids: [...new Set([...localIds, ...notificationIds])] });
      announceNotificationChange(session.user.id);
      if (context.data?.hasMore) context.revalidate();
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const first = items?.find((n) => n.resourceType?.toUpperCase() === resourceType && n.resourceId === resourceId);
  if (!first) return null;
  return <section className="notification-record-context" aria-label="Related record updates">
    <strong>{first.title}</strong><p>{first.message}</p>
    <p className="notification-context-state" role="status">{failed ? "The read status could not be saved. Your record is still available." : !candidates.length ? "Displayed updates marked as read. The record’s business status is unchanged." : "Updates stay unread until you choose to mark them read. This does not change the record’s business status."}</p>
    {!!candidates.length && <button className="button secondary" disabled={busy || context.refreshing} onClick={() => void readDisplayed()}>{busy ? "Saving read status…" : failed ? "Retry read update" : "Mark displayed updates as read"}</button>}
    <Link href={session?.user.role === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications"} prefetch={false}>All notifications</Link>
  </section>;
}
