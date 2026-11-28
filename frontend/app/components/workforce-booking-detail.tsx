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
import { showWorkforceBookingRecord } from "@/lib/admin/workforce-booking-visibility";
import { formatBusinessDate } from "@/lib/format/date";
import { NotificationRecordContext } from "./notification-record-context";
import { Feedback } from "./feedback";
import { WorkforceBookingReschedule } from "./workforce-booking-reschedule";
import { BookingRescheduleHistory } from "./booking-reschedule-history";
import { WorkforceBookingAlternative } from "./workforce-booking-alternative";
import { WorkforceBookingConfirmation } from "./workforce-booking-confirmation";
import { WorkforceBookingQuotations } from "./workforce-booking-quotations";
import {
  ArrowLeft,
  CalendarClock,
  CarFront,
  Clock3,
  MapPin,
  RefreshCw,
  UserRound,
  Wrench,
} from "lucide-react";
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
  const scopeChanged = !!record.data && !sameWorkforceScope(access, record.data.access);
  const error = scopeChanged
    ? "Your responsibilities changed. Refresh to check current access."
    : record.error;
  const temporarilyUnavailable = record.refreshing || !!record.refreshError;
  const row = showWorkforceBookingRecord({
    loading: record.loading || !!record.error,
    scopeChanged,
    version: record.data?.row.version,
    minimumVersion,
  })
    ? record.data?.row
    : undefined;

  return (
    <div className="workforce-bookings workforce-booking-detail">
      <header className="wfb-detail-header">
        <nav className="wfb-breadcrumb" aria-label="Breadcrumb">
          <Link href="/admin/workforce/bookings">
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Bookings</span>
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Details</span>
        </nav>
        <div className="wfb-detail-title-row">
          <div className="wfb-detail-title">
            <span className="wfb-eyebrow">WORKSHOP OPERATIONS</span>
            <h1>Booking details</h1>
            <p>
              Review the appointment, coordinate workshop activity and manage its
              quotation.
            </p>
          </div>
          <div className="wfb-detail-toolbar">
            <button
              className="button secondary wfb-refresh-button"
              disabled={record.loading || record.refreshing}
              onClick={() => {
                refreshAccess();
                record.refresh();
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh booking
            </button>
          </div>
        </div>
      </header>

      <Feedback message={error || record.refreshError} />
      <Feedback message={message} tone="success" />
      {(record.loading || temporarilyUnavailable) && (
        <p className="wfb-refresh-status" role="status" aria-live="polite">
          {record.refreshError
            ? "Booking verification failed. Your last verified record remains visible; refresh before making changes."
            : record.loading
              ? "Checking permitted booking…"
              : "Updating booking details. Your record stays visible."}
        </p>
      )}

      {!row && !record.loading && !!(error || record.refreshError) && (
        <section
          className="card wfb-unavailable-state"
          role="alert"
          aria-labelledby="wfb-unavailable-title"
        >
          <div>
            <span className="wfb-eyebrow">BOOKING VERIFICATION</span>
            <h2 id="wfb-unavailable-title">Booking unavailable</h2>
            <p>
              {record.refreshError ||
                error ||
                "This booking could not be verified. Please try again."}
            </p>
            <p>
              Booking details and operational actions remain unavailable until
              verification succeeds.
            </p>
          </div>

          <button
            className="button secondary"
            type="button"
            disabled={record.loading || record.refreshing}
            onClick={() => {
              refreshAccess();
              record.refresh();
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        </section>
      )}

      {row && (
        <div
          className="workforce-booking-detail-content"
          aria-busy={record.refreshing}
          inert={temporarilyUnavailable || !!error || undefined}
        >
          <NotificationRecordContext resourceType="BOOKING" resourceId={row.id} />

          <section className="wfb-appointment-summary" aria-label="Booking appointment">
            <div className="wfb-appointment-summary-top">
              <div className="wfb-appointment-service">
                <span className="wfb-eyebrow">APPOINTMENT</span>
                <h2>{row.service?.name ?? "Vehicle concern"}</h2>
                {row.requestedServiceCategoryName && (
                  <p>Requested service group: {row.requestedServiceCategoryName}</p>
                )}
                {row.customerConcern && (
                  <p className="wfb-customer-concern">{row.customerConcern}</p>
                )}
              </div>
              <span className="wfb-booking-status" data-status={row.status}>
                {bookingStatusLabels[row.status]}
              </span>
            </div>
            <div className="wfb-appointment-timing">
              <CalendarClock size={19} aria-hidden="true" />
              <AppointmentTiming status={row.status} scheduledAt={row.scheduledAt} />
            </div>
            <dl className="wfb-booking-facts">
              <div>
                <dt>
                  <UserRound size={15} aria-hidden="true" /> Customer
                </dt>
                <dd>
                  {row.customer.firstName} {row.customer.lastName}
                </dd>
                <dd className="wfb-fact-secondary">{row.customer.phone}</dd>
              </div>
              <div>
                <dt>
                  <CarFront size={15} aria-hidden="true" /> Vehicle
                </dt>
                <dd>
                  {row.vehicle
                    ? [row.vehicle.make, row.vehicle.model, row.vehicle.year]
                        .filter(Boolean)
                        .join(" ")
                    : "Not recorded"}
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" /> Branch
                </dt>
                <dd>{row.branch?.name ?? "Unassigned"}</dd>
              </div>
              {row.assignedStaff !== undefined && (
                <div>
                  <dt>
                    <Wrench size={15} aria-hidden="true" /> Assigned staff
                  </dt>
                  <dd>
                    {row.assignedStaff
                      ? `${row.assignedStaff.firstName} ${row.assignedStaff.lastName}`
                      : "Not assigned"}
                  </dd>
                </div>
              )}
              {row.service?.durationMinutes !== undefined && (
                <div>
                  <dt>
                    <Clock3 size={15} aria-hidden="true" /> Service duration
                  </dt>
                  <dd>
                    {row.service.durationMinutes === null
                      ? "Not recorded"
                      : `${row.service.durationMinutes} minutes`}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <div className="wfb-detail-grid">
            <div className="wfb-detail-column wfb-detail-primary">
              {row.alternativeStartsAt && row.alternativeReason && (
                <section
                  className="card wfb-detail-panel"
                  aria-label="Proposed appointment"
                >
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
                  blocked={!!error || record.refreshing || !!record.refreshError}
                  onUpdated={(notice) => {
                    setMessage(notice);
                    record.refresh();
                    refreshAccess();
                  }}
                />
              ) : (
                <BookingAttendanceHistory events={row.attendanceEvents} />
              )}
              <WorkforceBookingQuotations
                bookingId={row.id}
                assignedStaffId={row.assignedStaff?.id ?? null}
                access={access}
              />
            </div>

            <div className="wfb-detail-column wfb-detail-secondary">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
