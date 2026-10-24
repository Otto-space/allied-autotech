"use client";

import Link from "next/link";
import "./notification-record-context.css";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseNotifications } from "@/lib/api/notification-schemas";
import { formatBusinessDate } from "@/lib/format/date";

const sections = new Set([
  "/dashboard/bookings",
  "/dashboard/orders",
  "/dashboard/payments",
  "/dashboard/invoices",
  "/dashboard/vehicle-transactions",
  "/dashboard/support",
  "/dashboard/reviews",
  "/admin/bookings",
  "/admin/orders",
  "/admin/payments",
  "/admin/invoices",
  "/admin/vehicle-sales",
  "/admin/support",
  "/admin/refunds",
  "/admin/payment-disputes",
  "/admin/payment-disputes/work",
  "/admin/workforce/jobs",
  "/admin/workforce/bookings",
  "/admin/workforce/orders",
  "/admin/workforce/enquiries",
  "/admin/workforce/complaints",
  "/admin/workforce/finance",
]);
export function NotificationAttentionQueue({ role }: { role: string }) {
  const params = useSearchParams();
  const section = params.get("attention");
  if (!section) return null;
  if (
    !sections.has(section) ||
    (role === "CUSTOMER") !== section.startsWith("/dashboard/")
  )
    return <p role="alert">This attention queue is unavailable. Your inbox is below.</p>;
  return <AttentionQueue key={`${role}:${section}`} role={role} section={section} />;
}
function AttentionQueue({ role, section }: { role: string; section: string }) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const query = new URLSearchParams({ section, limit: "25" });
  const cursor = cursors.at(-1);
  if (cursor) query.set("cursor", cursor);
  const records = useResource(
    `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/attention?${query}`,
    parseNotifications,
  );
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!records.loading) title.current?.focus();
  }, [records.loading]);
  return (
    <section className="cn-attention" aria-labelledby="notification-attention-title">
      <h2 id="notification-attention-title" ref={title} tabIndex={-1}>
        Needs attention
      </h2>
      <p>
        Open each update to review its record. Reading an update does not complete the
        work.
      </p>
      <p>
        <Link href={section} prefetch={false}>
          Open the full page
        </Link>
      </p>
      {records.loading && <p role="status">Checking your current access and updates…</p>}
      {records.error && (
        <p role="alert">
          These updates could not be loaded. Refresh the queue to check current records.
        </p>
      )}
      {!records.loading && !records.error && !records.data?.items.length && (
        <p>No unread actionable updates remain in this queue.</p>
      )}
      {!records.loading &&
        !records.error &&
        records.data?.items.map(
          (item) =>
            item.destination && (
              <article key={item.id} className="cn-item">
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <time dateTime={item.createdAt}>
                  {formatBusinessDate(item.createdAt)}
                </time>{" "}
                <Link
                  className="button secondary"
                  href={item.destination.href}
                  prefetch={false}
                  aria-label={`View update: ${item.title}`}
                >
                  View record
                </Link>
              </article>
            ),
        )}
      <div className="actions">
        <button
          className="button secondary"
          disabled={records.loading}
          onClick={() => {
            setCursors([undefined]);
            records.refresh();
          }}
        >
          Refresh queue
        </button>
        {cursors.length > 1 && (
          <button
            className="button secondary"
            disabled={records.loading}
            onClick={() => setCursors((value) => value.slice(0, -1))}
          >
            Previous updates
          </button>
        )}
        {records.data?.nextCursor && !records.error && (
          <button
            className="button secondary"
            disabled={records.loading}
            onClick={() => setCursors((value) => [...value, records.data!.nextCursor])}
          >
            Next updates
          </button>
        )}
      </div>
    </section>
  );
}
