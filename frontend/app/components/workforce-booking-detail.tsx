"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import {
  parseWorkforceBookingDetail,
  bookingStatusLabels,
} from "@/lib/admin/workforce-bookings";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { formatBusinessDate } from "@/lib/format/date";
import { NotificationRecordContext } from "./notification-record-context";
import { Feedback } from "./feedback";
import { WorkforceBookingAlternative } from "./workforce-booking-alternative";
import { WorkforceBookingConfirmation } from "./workforce-booking-confirmation";
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
    (value: unknown) => parseWorkforceBookingDetail(value, id),
    [id],
  );
  const record = useResource(`/staff/workforce/bookings/${id}`, parse);
  const [minimumVersion, setMinimumVersion] = useState(0);
  const [message, setMessage] = useState<string>();
  const [resourceNote, setResourceNote] = useState("");
  const error =
    record.error ||
    record.refreshError ||
    (record.data && !sameWorkforceScope(access, record.data.access)
      ? "Your responsibilities changed. Refresh to check current access."
      : undefined);
  const row =
    !record.loading &&
    !record.refreshing &&
    !error &&
    (record.data?.row.version ?? -1) >= minimumVersion
      ? record.data?.row
      : undefined;
  return (
    <div className="workforce-bookings workforce-booking-detail">
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
      <Feedback message={message} tone="success" />
      {(record.loading || record.refreshing) && (
        <p role="status">Checking permitted booking…</p>
      )}
      {row && (
        <>
          <NotificationRecordContext resourceType="BOOKING" resourceId={row.id} />
          <section className="card" aria-label="Booking appointment">
            <h2>{row.service?.name ?? "Vehicle concern"}</h2>
            {row.customerConcern && <p>{row.customerConcern}</p>}
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
              {row.assignedStaff !== undefined && (
                <>
                  <dt>Assigned staff</dt>
                  <dd>
                    {row.assignedStaff
                      ? `${row.assignedStaff.firstName} ${row.assignedStaff.lastName}`
                      : "Not assigned"}
                  </dd>
                </>
              )}
              {row.service?.durationMinutes !== undefined && (
                <>
                  <dt>Service duration</dt>
                  <dd>
                    {row.service?.durationMinutes === null
                      ? "Not recorded"
                      : `${row.service?.durationMinutes} minutes`}
                  </dd>
                </>
              )}
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
          {row.alternativeStartsAt && row.alternativeReason && (
            <section className="card" aria-label="Proposed appointment">
              <h2>Proposed appointment</h2>
              <p>
                <time dateTime={row.alternativeStartsAt}>
                  {formatBusinessDate(row.alternativeStartsAt)}
                </time>
              </p>
              <p>{row.alternativeReason}</p>
              <p>
                {row.alternativeVersion === row.version &&
                ["REQUESTED", "CONFIRMED"].includes(row.status)
                  ? "Waiting for the customer to accept or decline. The current appointment has not changed."
                  : "The booking changed after this proposal. Review the current appointment before offering another time."}
              </p>
            </section>
          )}
          <WorkforceBookingAlternative
            key={`${access.userId}:${row.id}:${row.version}`}
            row={row}
            access={access}
            onRefresh={() => {
              record.refresh();
              refreshAccess();
            }}
            onSaved={(version) => {
              setMinimumVersion(version);
              setMessage(
                "Proposed time saved for customer review. The current appointment has not changed.",
              );
              record.refresh();
            }}
          />
          {row.assignedStaff !== undefined &&
            row.service?.durationMinutes !== undefined && (
              <WorkforceBookingConfirmation
                row={row}
                access={access}
                note={resourceNote}
                onNoteChange={setResourceNote}
                onRefresh={() => {
                  record.refresh();
                  refreshAccess();
                }}
                onSaved={(receipt) => {
                  setResourceNote("");
                  setMinimumVersion(receipt.version);
                  setMessage(
                    "Appointment confirmed. The booking status and one-hour reminder schedule were recorded.",
                  );
                  record.refresh();
                }}
              />
            )}
        </>
      )}
    </div>
  );
}
