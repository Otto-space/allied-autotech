"use client";
import { BookingAttendance, BookingAttendanceHistory } from "./booking-attendance";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import { BookingWorkReview } from "./booking-work-review";
import { BookingWorkEstimate } from "./booking-work-estimate";
import { BookingTimingReview } from "./booking-timing-review";
import Link from "next/link";
import { workforceAccessKey } from "@/lib/workforce-registry";
import { AppointmentTiming } from "./appointment-timing";
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
import { WorkforceBookingReschedule } from "./workforce-booking-reschedule";
import { BookingRescheduleHistory } from "./booking-reschedule-history";
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
            {row.requestedServiceCategoryName && (
              <p>Requested service group: {row.requestedServiceCategoryName}</p>
            )}
            {row.customerConcern && <p>{row.customerConcern}</p>}
            <AppointmentTiming status={row.status} scheduledAt={row.scheduledAt} />
            <dl className="totals">
              <dt>Booking status</dt>
              <dd>{bookingStatusLabels[row.status]}</dd>
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
          <BookingRescheduleHistory requests={row.rescheduleRequests} />
          {workforceAllows(access, workforceActionPredicates.bookingConfirm, {
            branchId: row.branchId,
          }) ||
          workforceAllows(access, workforceActionPredicates.jobWork, {
            branchId: row.branchId,
            assignedStaffId: row.assignedStaff?.id ?? null,
          }) ? (
            <BookingAttendance
              bookingId={row.id}
              managed
              showInlineNotice={false}
              blocked={!!error || record.refreshing}
              onUpdated={(notice) => {
                setMessage(notice);
                record.refresh();
                refreshAccess();
              }}
            />
          ) : (
            <BookingAttendanceHistory events={row.attendanceEvents} />
          )}

          <BookingWorkEstimate estimate={row.workEstimate} status={row.status} />
          <BookingWorkReview
            key={
              "work:" +
              access.userId +
              ":" +
              row.id +
              ":" +
              row.version +
              ":" +
              workforceAccessKey(access)
            }
            booking={row}
            owner={access.userId}
            access={access}
            onSaved={(version) => {
              if (version !== undefined) {
                setMinimumVersion(version);
                setMessage(
                  "Remaining work estimate reviewed. The original visit and recorded start are unchanged.",
                );
              }
              record.refresh();
              refreshAccess();
            }}
          />
          <BookingTimingReview
            key={`timing:${access.userId}:${row.id}:${row.version}:${workforceAccessKey(access)}`}
            booking={row}
            owner={access.userId}
            access={access}
            onSaved={(version) => {
              if (version !== undefined) {
                setMinimumVersion(version);
                setMessage(
                  "Appointment estimate updated. The start time and status are unchanged.",
                );
              }
              record.refresh();
              refreshAccess();
            }}
          />
          <WorkforceBookingReschedule
            key={`reschedule:${access.userId}:${row.id}:${row.version}:${workforceAccessKey(access)}`}
            row={row}
            access={access}
            onRefresh={() => {
              record.refresh();
              refreshAccess();
            }}
            onSaved={(version) => {
              setMinimumVersion(version);
              setMessage(
                "Reschedule decision recorded. Review the confirmed appointment and history.",
              );
              record.refresh();
            }}
          />
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
