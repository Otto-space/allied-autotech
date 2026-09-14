"use client";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffBooking } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
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
  const booking = useResource(`/staff/bookings/${bookingId}`, parseStaffBooking);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [validation, setValidation] = useState<string>();
  const [message, setMessage] = useState<string>();
  const current = booking.data;
  const disabled = booking.loading || !!booking.error || !!proposal;
  const choices = current
    ? (transitions[current.status] ?? []).filter(
        (status) =>
          !current.bookingSlotId || !["CONFIRMED", "CANCELLED"].includes(status),
      )
    : [];
  function review(kind: "assignment" | "status" | "disruption", form: FormData) {
    setValidation(undefined);
    setMessage(undefined);
    if (!current || disabled) return;
    const facts = [
      { label: "Booking", value: current.id },
      { label: "Service", value: current.service.name },
    ];
    const submit = (suffix: string, method: "POST" | "PATCH", body: unknown) => () =>
      apiRequest(`/staff/bookings/${current.id}/${suffix}`, { method, csrf: true, body });
    if (kind === "assignment") {
      const assignedStaffId = z.string().uuid().safeParse(form.get("staffId"));
      if (!assignedStaffId.success) {
        setValidation("Choose an available staff profile.");
        document.getElementById("booking-staff")?.focus();
        return;
      }
      const body: RequestBody<"/staff/bookings/{bookingId}/assignment", "patch"> = {
        assignedStaffId: assignedStaffId.data,
        expectedVersion: current.version,
      };
      const select = document.getElementById("booking-staff") as HTMLSelectElement | null;
      setProposal({
        title: "Assign this booking?",
        description:
          "The server will check branch permissions and schedule conflicts before saving.",
        facts: [
          ...facts,
          {
            label: "Staff member",
            value: select?.selectedOptions[0]?.textContent ?? "Selected staff member",
          },
        ],
        submit: submit("assignment", "PATCH", body),
      });
      return;
    }
    const reason = String(form.get("reason") ?? "").trim();
    const status = String(form.get("status") ?? "") as NextStatus;
    if (
      (reason || kind === "disruption" || status === "CANCELLED") &&
      !textField(kind === "disruption" ? 1000 : 500).safeParse(reason).success
    ) {
      setValidation(
        `Enter a reason of up to ${kind === "disruption" ? 1000 : 500} characters, in one paragraph.`,
      );
      document.getElementById(`booking-${kind}-reason`)?.focus();
      return;
    }
    if (kind === "disruption") {
      const body: RequestBody<"/staff/bookings/{bookingId}/disruption", "post"> = {
        expectedVersion: current.version,
        reason,
      };
      setProposal({
        title: "Report a business disruption?",
        description:
          "This records that Allied AutoTech cannot fulfil the appointment and notifies the customer to choose a transfer or request a deposit refund. It does not itself refund money.",
        facts: [...facts, { label: "Reason", value: reason }],
        submit: submit("disruption", "POST", body),
      });
      return;
    }
    if (!choices.includes(status)) return;
    const notes = String(form.get("staffNotes") ?? "").trim();
    if (notes && !textField(4000).safeParse(notes).success) {
      setValidation("Staff notes must be one paragraph of up to 4,000 characters.");
      document.getElementById("booking-staff-notes")?.focus();
      return;
    }
    const body: RequestBody<"/staff/bookings/{bookingId}/status", "post"> = {
      status,
      expectedVersion: current.version,
      ...(reason ? { reason } : {}),
      staffNotes: notes || null,
    };
    setProposal({
      title: "Update booking status?",
      description:
        status === "NO_SHOW"
          ? "Confirm that the customer missed this appointment. This records any paid deposit as forfeited and notifies the customer."
          : "Confirm that this service milestone has occurred. Recorded payment is managed separately.",
      facts: [
        ...facts,
        { label: "From", value: current.status.replaceAll("_", " ") },
        { label: "To", value: status.replaceAll("_", " ") },
        ...(reason ? [{ label: "Reason", value: reason }] : []),
      ],
      submit: submit("status", "POST", body),
    });
  }
  return (
    <>
      <Link className="text-link" href="/admin/bookings">
        Back to workshop bookings
      </Link>
      <h1>Manage workshop booking</h1>
      <Feedback message={booking.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={booking.loading || !!proposal}
        onClick={booking.refresh}
      >
        Refresh booking
      </button>
      {booking.loading && <p role="status">Checking booking…</p>}
      {current && (
        <>
          <section className="detail-section">
            <h2>{current.service.name}</h2>
            <p className="muted">Booking {current.id}</p>
            <span className="status">{current.status.replaceAll("_", " ")}</span>
            <dl className="totals">
              <dt>Appointment</dt>
              <dd>{formatBusinessDate(current.scheduledAt)}</dd>
              <dt>Branch</dt>
              <dd>{current.branch?.name ?? "Not assigned"}</dd>
              <dt>Assigned staff</dt>
              <dd>
                {current.assignedStaff
                  ? `${current.assignedStaff.firstName} ${current.assignedStaff.lastName}`
                  : "Not assigned"}
              </dd>
              <dt>Vehicle</dt>
              <dd>
                {current.vehicle
                  ? `${current.vehicle.year} ${current.vehicle.make} ${current.vehicle.model}${current.vehicle.registrationNumber ? ` · ${current.vehicle.registrationNumber}` : ""}`
                  : "Not linked"}
              </dd>
              <dt>Deposit requested</dt>
              <dd>
                {current.depositAmountKobo === null
                  ? "Not recorded"
                  : formatKobo(current.depositAmountKobo)}
              </dd>
              <dt>Deposit payment</dt>
              <dd>
                {current.depositPaidAt
                  ? `Recorded ${formatBusinessDate(current.depositPaidAt)}`
                  : "Not recorded"}
              </dd>
            </dl>
            {current.customerNotes && <p>Customer notes: {current.customerNotes}</p>}
            {current.staffNotes && <p>Staff notes: {current.staffNotes}</p>}
            {current.disruptionRequestedAt && (
              <div className="empty">
                <h3>Business disruption recorded</h3>
                <p>{current.disruptionReason}</p>
                <p>
                  Resolution:{" "}
                  {current.disruptionResolution?.replaceAll("_", " ") ?? "Not recorded"}
                </p>
              </div>
            )}
          </section>
          {current.branch &&
            ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"].includes(
              current.status,
            ) && (
              <section className="detail-section">
                <h2>Staff assignment</h2>
                <form
                  key={`assignment-${current.version}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("assignment", new FormData(event.currentTarget));
                  }}
                >
                  <div className="field">
                    <label htmlFor="booking-staff">Assigned staff member</label>
                    <StaffPicker
                      branchId={current.branch.id}
                      id="booking-staff"
                      initialId={current.assignedStaff?.id}
                    />
                  </div>
                  <button className="button" disabled={disabled}>
                    Review assignment
                  </button>
                </form>
              </section>
            )}
          {choices.length > 0 && (
            <section className="detail-section">
              <h2>Service progress</h2>
              <form
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
                <div className="field">
                  <label htmlFor="booking-status-reason">
                    Reason (required for cancellation)
                  </label>
                  <input id="booking-status-reason" name="reason" maxLength={500} />
                </div>
                <div className="field">
                  <label htmlFor="booking-staff-notes">Internal staff notes</label>
                  <input
                    id="booking-staff-notes"
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
          {current.status === "AWAITING_DEPOSIT" && current.bookingSlotId && (
            <p>Deposit-backed bookings are confirmed by verified payment.</p>
          )}
          {current.status === "CONFIRMED" &&
            current.bookingSlotId &&
            current.depositPaidAt &&
            !current.disruptionRequestedAt && (
              <section className="detail-section">
                <h2>Business-caused disruption</h2>
                <p>
                  If Allied AutoTech cannot fulfil this appointment, record the reason so
                  the customer can choose a transfer or request a refund.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    review("disruption", new FormData(event.currentTarget));
                  }}
                >
                  <div className="field">
                    <label htmlFor="booking-disruption-reason">Disruption reason</label>
                    <input
                      id="booking-disruption-reason"
                      name="reason"
                      required
                      maxLength={1000}
                    />
                  </div>
                  <button className="button secondary" disabled={disabled}>
                    Review disruption
                  </button>
                </form>
              </section>
            )}
          <StaffQuoteRecords
            booking={current}
            disabled={disabled}
            onReview={setProposal}
          />
          <StaffWorkOrder booking={current} disabled={disabled} onReview={setProposal} />
        </>
      )}
      {proposal && (
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
    </>
  );
}
