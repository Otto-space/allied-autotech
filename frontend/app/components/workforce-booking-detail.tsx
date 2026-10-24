"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import {
  parseScopedWorkforceBookings,
  bookingStatusLabels,
} from "@/lib/admin/workforce-bookings";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { formatBusinessDate } from "@/lib/format/date";
import { NotificationRecordContext } from "./notification-record-context";
import { Feedback } from "./feedback";
import "./workforce-bookings.css";

export function WorkforceBookingDetail({
  id,
  access,
  refreshAccess,
}: {
  id: string;
  access: WorkforceAccess;
  refreshAccess: () => void;
}) {
  const parse = useCallback(
    (value: unknown) => {
      if (!value || typeof value !== "object") throw Error("Invalid booking");
      const envelope = value as Record<string, unknown>;
      const page = parseScopedWorkforceBookings({
        items: [value],
        access: envelope.access,
        generatedAt: envelope.generatedAt,
      });
      if (page.items[0].id !== id) throw Error("Mismatched booking");
      return { row: page.items[0], access: page.access };
    },
    [id],
  );
  const record = useResource(`/staff/workforce/bookings/${id}`, parse);
  const error =
    record.error ||
    record.refreshError ||
    (record.data && !sameWorkforceScope(access, record.data.access)
      ? "Your responsibilities changed. Refresh to check current access."
      : undefined);
  const row =
    !record.loading && !record.refreshing && !error ? record.data?.row : undefined;
  return (
    <div className="workforce-bookings">
      <Link className="button secondary" href="/admin/workforce/bookings">
        All permitted bookings
      </Link>
      <h1>Booking details</h1>
      <button
        className="button secondary"
        disabled={record.loading || record.refreshing}
        onClick={() => {
          refreshAccess();
          record.refresh();
        }}
      >
        Refresh booking
      </button>
      <Feedback message={error} />
      {(record.loading || record.refreshing) && (
        <p role="status">Checking permitted booking…</p>
      )}
      {row && (
        <>
          <NotificationRecordContext resourceType="BOOKING" resourceId={row.id} />
          <section className="card" aria-label="Booking appointment">
            <h2>{row.service.name}</h2>
            <dl className="totals">
              <dt>Booking status</dt>
              <dd>{bookingStatusLabels[row.status]}</dd>
              <dt>Scheduled</dt>
              <dd>
                <time dateTime={row.scheduledAt}>
                  {formatBusinessDate(row.scheduledAt)}
                </time>
              </dd>
              <dt>Customer</dt>
              <dd>
                {row.customer.firstName} {row.customer.lastName}
              </dd>
              <dt>Phone</dt>
              <dd>{row.customer.phone}</dd>
              <dt>Branch</dt>
              <dd>{row.branch?.name ?? "Unassigned"}</dd>
              <dt>Vehicle</dt>
              <dd>
                {row.vehicle
                  ? [row.vehicle.make, row.vehicle.model, row.vehicle.year]
                      .filter(Boolean)
                      .join(" ")
                  : "Not recorded"}
              </dd>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
