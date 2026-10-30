"use client";
import { NotificationRecordContext } from "./notification-record-context";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffBooking } from "@/lib/api/staff-booking-schemas";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { StaffPicker } from "./staff-picker";
import { StaffWorkOrder } from "./staff-work-order";
import { StaffQuoteRecords } from "./staff-quote-records";
import { MutationReview, type MutationProposal } from "./mutation-review";

type NextStatus = RequestBody<"/staff/bookings/{bookingId}/status", "post">["status"];
const transitions: Record<string, readonly NextStatus[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  AWAITING_DEPOSIT: ["CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};
const textField = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
      "Use a single paragraph without control characters.",
    );
export function StaffBookingDetail({ bookingId }: { bookingId: string }) {
  const session = useAccountSession();
  if (!session || !["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return null;
  return (
    <BookingRecord
      key={`${session.user.id}:${session.user.role}:${bookingId}`}
      bookingId={bookingId}
    />
  );
}
function BookingRecord({ bookingId }: { bookingId: string }) {
  const session = useAccountSession()!;
  const booking = useResource(`/staff/bookings/${bookingId}`, parseStaffBooking);
  const access = useOwnStaffPermissions();
  const [classification, setClassification] = useState<{
    id: string;
    label: string;
    version: number;
  }>();
  const [classificationBlocked, setClassificationBlocked] = useState(true);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const readError =
    booking.error ||
    (booking.data && booking.data.id !== bookingId
      ? "We could not read this booking. Please try again."
      : undefined);
  const current = readError ? undefined : booking.data;
  const stale = !!booking.refreshError || !!access.refreshError;
  const verifiedAccess =
    !access.loading &&
    !access.error &&
    access.data?.id === session.user.id &&
    access.data.role === session.user.role &&
    access.data.status === "ACTIVE";
  const admin = verifiedAccess && ["ADMIN", "SUPER_ADMIN"].includes(session.user.role);
  const ownBranch =
    verifiedAccess &&
    !!current?.branch &&
    !!access.data?.staffProfile &&
    access.data.staffProfile.branchId === current.branch.id;
  const assigned =
    ownBranch && access.data?.staffProfile?.id === current?.assignedStaff?.id;
  const canOperate = !!(admin || assigned);
  const canAssign = !!current?.branch && !!(admin || ownBranch);
  const canConfirm =
    !!(admin || ownBranch) && !!access.data?.capabilities.includes("BOOKING_CONFIRM");
  const disabled =
    booking.loading ||
    booking.refreshing ||
    !!readError ||
    stale ||
    access.loading ||
    access.refreshing ||
    !verifiedAccess ||
    !!proposal;
  const canChangeQuotes = canOperate;
  const choices = current
    ? (transitions[current.status] ?? []).filter((status) =>
        status === "CONFIRMED" ? canConfirm && !!current.service : canOperate,
      )
    : [];
  const assignmentVisible =
    canAssign &&
    !!current &&
    ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"].includes(
      current.status,
    );
  function invalidate(message: string, field: string) {
    setValidation(message);
    setInvalidField(field);
    document.getElementById(field)?.focus();
  }
  function fieldError(field: string) {
    return {
      "aria-invalid": invalidField === field,
      "aria-describedby": invalidField === field ? "booking-validation" : undefined,
    };
  }
  function reviewProposal(next: MutationProposal) {
    if (disabled) return;
    setProposal({ ...next, retryAfterRejection: false });
  }
  function review(
    kind: "assignment" | "status" | "disruption" | "alternative",
    form: FormData,
  ) {
    setValidation(undefined);
    setInvalidField(undefined);
    setMessage(undefined);
    if (!current || disabled) return;
    const facts = [
      { label: "Booking", value: current.id },
      { label: "Service", value: current.service?.name ?? "Vehicle concern" },
    ];
    const submit = (suffix: string, method: "POST" | "PATCH", body: unknown) => () =>
      apiRequest(`/staff/bookings/${current.id}/${suffix}`, { method, csrf: true, body });
    if (kind === "assignment") {
      if (!canAssign) return;
      const assignedStaffId = z.string().uuid().safeParse(form.get("staffId"));
      if (!assignedStaffId.success) {
        invalidate("Choose an available staff profile.", "booking-staff");
        return;
      }
      if (
        !current.service &&
        (classificationBlocked ||
          !classification?.id ||
          classification.version !== current.version)
      ) {
        invalidate(
          "Choose an available service with a configured duration.",
          "booking-classification",
        );
        return;
      }
      const body: RequestBody<"/staff/bookings/{bookingId}/assignment", "patch"> = {
        assignedStaffId: assignedStaffId.data,
        ...(!current.service ? { serviceId: classification!.id } : {}),
        expectedVersion: current.version,
      };
      const select = document.getElementById("booking-staff") as HTMLSelectElement | null;
      reviewProposal({
        title: current.service
          ? "Assign this booking?"
          : "Classify and assign this concern?",
        description:
          "The server checks branch permissions, current service details and schedule conflicts. This does not confirm the appointment or charge the customer.",
        facts: [
          ...facts,
          ...(!current.service
            ? [{ label: "Proposed service", value: classification!.label }]
            : []),
          {
            label: "Staff member",
            value: select?.selectedOptions[0]?.textContent ?? "Selected staff member",
          },
        ],
        submit: submit("assignment", "PATCH", body),
      });
      return;
    }
    if (kind === "alternative") {
      if (!canConfirm || !["REQUESTED", "CONFIRMED"].includes(current.status)) return;
      const reason = String(form.get("reason") ?? "").trim();
      const date = new Date(`${String(form.get("preferredAt") ?? "")}:00+01:00`);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        invalidate("Choose a future proposed time in Lagos.", "booking-alternative-time");
        return;
      }
      if (reason.length < 10 || !textField(1000).safeParse(reason).success) {
        invalidate(
          "Explain the proposed change in 10–1,000 characters.",
          "booking-alternative-reason",
        );
        return;
      }
      const body: RequestBody<"/staff/bookings/{bookingId}/alternative", "post"> = {
        preferredAt: date.toISOString(),
        reason,
        expectedVersion: current.version,
      };
      reviewProposal({
        title: "Propose this alternative time?",
        description:
          "The customer must review this suggestion. Their existing appointment stays unchanged until they accept; acceptance still needs staff confirmation. This does not reserve capacity, charge a fee or consume their reschedule allowance.",
        facts: [
          ...facts,
          {
            label: "Proposed time (Lagos)",
            value: formatBusinessDate(date.toISOString()),
          },
          { label: "Reason shown to customer", value: reason },
        ],
        submit: submit("alternative", "POST", body),
      });
      return;
    }
    const reason = String(form.get("reason") ?? "").trim();
    const status = String(form.get("status") ?? "") as NextStatus;
    if (
      (reason || kind === "disruption" || status === "CANCELLED") &&
      !textField(kind === "disruption" ? 1000 : 500).safeParse(reason).success
    ) {
      invalidate(
        `Enter a reason of up to ${kind === "disruption" ? 1000 : 500} characters, in one paragraph.`,
        `booking-${kind}-reason`,
      );
      return;
    }
    if (kind === "disruption") {
      if (!canOperate) return;
      const body: RequestBody<"/staff/bookings/{bookingId}/disruption", "post"> = {
        expectedVersion: current.version,
        reason,
      };
      reviewProposal({
        title: "Report a business disruption?",
        description:
          "This notifies the customer that Allied AutoTech cannot fulfil the appointment. They can request another slot or cancel free. Historical deposits require a reviewed refund; this action does not refund money.",
        facts: [...facts, { label: "Reason", value: reason }],
        submit: submit("disruption", "POST", body),
      });
      return;
    }
    if (!choices.includes(status)) return;
    const resourceReviewNote = String(form.get("resourceReviewNote") ?? "").trim();
    if (
      status === "CONFIRMED" &&
      (resourceReviewNote.length < 10 ||
        !textField(2000).safeParse(resourceReviewNote).success)
    ) {
      invalidate(
        "Describe the available staff and equipment in 10-2,000 characters before confirming.",
        "booking-resource-review",
      );
      return;
    }
    const notes = String(form.get("staffNotes") ?? "").trim();
    if (notes && !textField(4000).safeParse(notes).success) {
      invalidate(
        "Staff notes must be one paragraph of up to 4,000 characters.",
        "booking-staff-notes",
      );
      return;
    }
    const body: RequestBody<"/staff/bookings/{bookingId}/status", "post"> = {
      status,
      expectedVersion: current.version,
      ...(reason ? { reason } : {}),
      staffNotes: notes || null,
      ...(status === "CONFIRMED" ? { resourceReviewNote } : {}),
    };
    reviewProposal({
      title: "Update booking status?",
      description:
        status === "NO_SHOW"
          ? "Confirm that the customer missed this appointment. The customer is notified; no automatic fee or deposit forfeiture is applied."
          : status === "CONFIRMED"
            ? "Confirm you have reviewed staff, equipment and the appointment time. The server checks your permission, the approved branch calendar, capacity and staff availability before confirming."
            : "Confirm that this service milestone has occurred. Recorded payment is managed separately.",
      facts: [
        ...facts,
        { label: "From", value: current.status.replaceAll("_", " ") },
        { label: "To", value: status.replaceAll("_", " ") },
        ...(reason ? [{ label: "Reason", value: reason }] : []),
        ...(status === "CONFIRMED"
          ? [{ label: "People and equipment review", value: resourceReviewNote }]
          : []),
      ],
      submit: submit("status", "POST", body),
    });
  }
  return (
    <div className="work-booking-detail">
      <nav className="booking-detail-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <Link href="/admin/bookings">Workshop bookings</Link>
          </li>
          <li>
            <ChevronRight aria-hidden="true" />
            <span aria-current="page" title={current?.service?.name}>
              {current?.service?.name ?? "Booking details"}
            </span>
          </li>
        </ol>
      </nav>
      <header className="booking-detail-heading">
        <div>
          <h1>Manage workshop booking</h1>
          <p>Review the appointment, coordinate the team and record service progress.</p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={booking.loading || booking.refreshing || !!proposal}
          onClick={() => {
            booking.refresh();
            access.refresh();
          }}
        >
          <RefreshCw aria-hidden="true" />
          Refresh booking
        </button>
      </header>
      <Feedback message={message} tone="success" toast="Booking change recorded." />
      {readError && (
        <section className="booking-detail-state">
          <h2>Booking unavailable</h2>
          <Feedback message={readError} />
          <button
            className="button secondary"
            onClick={() => {
              booking.refresh();
              access.refresh();
            }}
          >
            Retry booking
          </button>
        </section>
      )}
      {booking.loading && !current && (
        <section className="booking-detail-state" role="status">
          <p>Checking booking...</p>
          <div className="booking-detail-skeleton" aria-hidden="true" />
        </section>
      )}
      {booking.loading && current && <p role="status">Checking booking...</p>}
      {current &&
        !booking.loading &&
        !booking.refreshing &&
        !booking.error &&
        !booking.refreshError && (
          <NotificationRecordContext resourceType="BOOKING" resourceId={current.id} />
        )}
      {current && (
        <>
          {stale && (
            <p className="booking-detail-notice" role="status">
              Booking may be out of date. Refresh before making changes.
            </p>
          )}
          {access.error && (
            <div className="booking-detail-notice">
              <p>
                Booking access could not be checked. Refresh to check your available
                actions.
              </p>
              <Feedback message={access.error} />
            </div>
          )}
          <section className="booking-detail-summary" aria-label="Appointment summary">
            <header>
              <div>
                <h2>{current.service?.name ?? "Vehicle concern"}</h2>
                {current.customerConcern && <p>{current.customerConcern}</p>}
                <p>Booking {current.id}</p>
              </div>
              <span className="booking-detail-status" data-status={current.status}>
                {current.status.replaceAll("_", " ")}
              </span>
            </header>
            <WorkflowProgress workflow="booking" status={current.status} />
            <dl className="booking-detail-facts">
              <div>
                <dt>Appointment</dt>
                <dd>{formatBusinessDate(current.scheduledAt)}</dd>
              </div>
              <div>
                <dt>Branch</dt>
                <dd>{current.branch?.name ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Assigned staff</dt>
                <dd>
                  {current.assignedStaff
                    ? `${current.assignedStaff.firstName} ${current.assignedStaff.lastName}`
                    : "Not assigned"}
                </dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>
                  {current.vehicle
                    ? `${current.vehicle.year} ${current.vehicle.make} ${current.vehicle.model}${current.vehicle.registrationNumber ? ` \u00b7 ${current.vehicle.registrationNumber}` : ""}`
                    : "Not linked"}
                </dd>
              </div>
            </dl>
          </section>
          {(current.customerNotes || current.staffNotes) && (
            <dl className="booking-detail-notes">
              {current.customerNotes && (
                <div>
                  <dt>Customer notes</dt>
                  <dd>{current.customerNotes}</dd>
                </div>
              )}
              {current.staffNotes && (
                <div>
                  <dt>Staff notes</dt>
                  <dd>{current.staffNotes}</dd>
                </div>
              )}
            </dl>
          )}
          {(current.depositAmountKobo !== null || current.depositPaidAt) && (
            <details className="booking-detail-history">
              <summary>Historical deposit record</summary>
              <dl className="booking-detail-facts">
                <div>
                  <dt>Deposit requested</dt>
                  <dd>
                    {current.depositAmountKobo === null
                      ? "Not recorded"
                      : formatKobo(current.depositAmountKobo)}
                  </dd>
                </div>
                <div>
                  <dt>Deposit payment</dt>
                  <dd>
                    {current.depositPaidAt
                      ? `Recorded ${formatBusinessDate(current.depositPaidAt)}`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </details>
          )}
          {current.disruptionRequestedAt && (
            <section className="booking-detail-notice">
              <h3>Business disruption recorded</h3>
              <p>{current.disruptionReason}</p>
              <p>
                Resolution:{" "}
                {current.disruptionResolution?.replaceAll("_", " ") ?? "Not recorded"}
              </p>
            </section>
          )}
          <nav className="booking-detail-jumps" aria-label="Booking sections">
            {assignmentVisible && <a href="#booking-assignment">Assignment</a>}
            {choices.length > 0 && <a href="#booking-progress">Service progress</a>}
            <a href="#quotations">Quotations</a>
            <a href="#booking-work-order">Work order</a>
          </nav>
          {access.loading && <p role="status">Checking booking access...</p>}
          {verifiedAccess && !canOperate && (
            <p className="booking-detail-notice">
              Service progress and work-order changes are available to the assigned staff
              member and authorised administrators.
            </p>
          )}
          {validation && (
            <p id="booking-validation" className="field-error" role="alert">
              {validation}
            </p>
          )}
          <div className="booking-detail-operations">
            {canConfirm && ["REQUESTED", "CONFIRMED"].includes(current.status) && (
              <section
                className="detail-section"
                aria-labelledby="booking-alternative-title"
              >
                <h2 id="booking-alternative-title">Propose another time</h2>
                <p>
                  Suggest a Lagos time within the current booking window. The customer
                  must accept; this does not change or confirm their appointment.
                </p>
                {current.alternativeStartsAt &&
                  current.alternativeVersion === current.version && (
                    <p>
                      Current proposal: {formatBusinessDate(current.alternativeStartsAt)}.
                      Saving another proposal replaces it.
                    </p>
                  )}
                <form
                  key={`alternative-${current.version}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("alternative", new FormData(event.currentTarget));
                  }}
                >
                  <div className="field">
                    <label htmlFor="booking-alternative-time">
                      Proposed time (Lagos)
                    </label>
                    <input
                      id="booking-alternative-time"
                      name="preferredAt"
                      type="datetime-local"
                      required
                      {...fieldError("booking-alternative-time")}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="booking-alternative-reason">
                      Reason shown to customer
                    </label>
                    <textarea
                      id="booking-alternative-reason"
                      name="reason"
                      required
                      minLength={10}
                      maxLength={1000}
                      {...fieldError("booking-alternative-reason")}
                    />
                  </div>
                  <button className="button secondary" disabled={disabled}>
                    Review alternative time
                  </button>
                </form>
              </section>
            )}
            {assignmentVisible && current.branch && (
              <section className="detail-section" id="booking-assignment">
                <h2>Staff assignment</h2>
                <form
                  data-draft-key={JSON.stringify(["staff-booking-detail:1", bookingId])}
                  key={`assignment-${current.version}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("assignment", new FormData(event.currentTarget));
                  }}
                >
                  {!current.service && (
                    <div className="field">
                      <label htmlFor="booking-classification">
                        Service for this concern
                      </label>
                      <p>
                        Review the customer’s concern and choose the appropriate service.
                        A quotation remains subject to the normal customer review; this
                        step does not confirm a visit.
                      </p>
                      <SlotCatalogPicker
                        kind="service"
                        serviceMode="concern"
                        id="booking-classification"
                        key={current.version}
                        value={
                          classification?.version === current.version
                            ? classification.id
                            : ""
                        }
                        onChange={(id, label) =>
                          setClassification({ id, label, version: current.version })
                        }
                        onAvailabilityChange={setClassificationBlocked}
                        error={
                          invalidField === "booking-classification"
                            ? validation
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="booking-staff">Assigned staff member</label>
                    <StaffPicker
                      branchId={current.branch.id}
                      id="booking-staff"
                      initialId={
                        session.user.role === "STAFF"
                          ? access.data?.staffProfile?.id
                          : current.assignedStaff?.id
                      }
                      error={invalidField === "booking-staff" ? validation : undefined}
                    />
                  </div>
                  <button className="button" disabled={disabled}>
                    Review assignment
                  </button>
                </form>
              </section>
            )}
            {choices.length > 0 && (
              <section className="detail-section" id="booking-progress">
                <h2>Service progress</h2>
                <form
                  data-draft-key={JSON.stringify(["staff-booking-detail:2", bookingId])}
                  key={`status-${current.version}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("status", new FormData(event.currentTarget));
                  }}
                >
                  <div className="field">
                    <label htmlFor="booking-status">Next status</label>
                    <select id="booking-status" name="status" required>
                      <option value="">Choose next status</option>
                      {choices.map((status) => (
                        <option value={status} key={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {choices.includes("CONFIRMED") && (
                    <div className="field">
                      <label htmlFor="booking-resource-review">
                        People and equipment review (required for confirmation)
                      </label>
                      <textarea
                        id="booking-resource-review"
                        {...fieldError("booking-resource-review")}
                        name="resourceReviewNote"
                        maxLength={2000}
                        aria-describedby={
                          invalidField === "booking-resource-review"
                            ? "booking-resource-hint booking-validation"
                            : "booking-resource-hint"
                        }
                      />
                      <span className="field-hint" id="booking-resource-hint">
                        Check that the assigned staff member and required workshop
                        equipment are available for this appointment.
                      </span>
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="booking-status-reason">
                      Reason (required for cancellation)
                    </label>
                    <input
                      id="booking-status-reason"
                      {...fieldError("booking-status-reason")}
                      name="reason"
                      maxLength={500}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="booking-staff-notes">Internal staff notes</label>
                    <input
                      id="booking-staff-notes"
                      {...fieldError("booking-staff-notes")}
                      name="staffNotes"
                      defaultValue={current.staffNotes ?? ""}
                      maxLength={4000}
                    />
                  </div>
                  <button className="button" disabled={disabled}>
                    Review status change
                  </button>
                </form>
              </section>
            )}
          </div>
          {current.status === "REQUESTED" && !current.service && (
            <p className="notice">
              Classify the concern and assign a staff member before confirming this
              request.
            </p>
          )}
          {current.status === "REQUESTED" &&
            current.service &&
            verifiedAccess &&
            !choices.includes("CONFIRMED") && (
              <p className="notice">
                Confirmation requires an active booking-confirmation permission. Ask the
                Super Admin to review your access, then refresh this booking.
              </p>
            )}
          {current.status === "AWAITING_DEPOSIT" && current.bookingSlotId && (
            <p>Deposit-backed bookings are confirmed by verified payment.</p>
          )}
          {canOperate &&
            current.status === "CONFIRMED" &&
            current.bookingSlotId &&
            current.disruptionResolution !== "PENDING" && (
              <details className="detail-section booking-detail-disruption">
                <summary>
                  <h2>Business-caused disruption</h2>
                </summary>
                <p>
                  If Allied AutoTech cannot fulfil this appointment, record the reason so
                  the customer can request another slot or cancel free. Any historical
                  deposit requires a reviewed refund.
                </p>
                <form
                  data-draft-key={JSON.stringify(["staff-booking-detail:3", bookingId])}
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("disruption", new FormData(event.currentTarget));
                  }}
                >
                  <div className="field">
                    <label htmlFor="booking-disruption-reason">Disruption reason</label>
                    <input
                      id="booking-disruption-reason"
                      {...fieldError("booking-disruption-reason")}
                      name="reason"
                      required
                      maxLength={1000}
                    />
                  </div>
                  <button className="button secondary" disabled={disabled}>
                    Review disruption
                  </button>
                </form>
              </details>
            )}
          <StaffQuoteRecords
            booking={current}
            disabled={disabled || access.loading}
            canChange={canChangeQuotes}
            canAuthor={canChangeQuotes && !!access.data?.staffProfile}
            checkingAccess={access.loading}
            onReview={reviewProposal}
          />
          <StaffWorkOrder
            booking={current}
            disabled={disabled}
            canChange={canOperate}
            onReview={reviewProposal}
          />
        </>
      )}
      {proposal && current && verifiedAccess && !stale && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            booking.refresh();
          }}
          onSuccess={() =>
            setMessage("Booking change recorded. Review the refreshed record.")
          }
        />
      )}
    </div>
  );
}
