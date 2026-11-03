"use client";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { rescheduleRequestSchema } from "@/lib/api/booking-schemas";
import { parseStaffBooking } from "@/lib/api/staff-booking-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { StaffPicker } from "./staff-picker";
import styles from "./booking-reschedule-review.module.css";
type Request = z.infer<typeof rescheduleRequestSchema>;
import type { RescheduleDecision } from "@/lib/api/booking-schemas";
export type RescheduleStaffControl = {
  value?: string;
  onSelect: (id: string, label: string) => void;
  onAvailabilityChange: (blocked: boolean) => void;
};

export function BookingRescheduleReview({
  booking,
  canReview,
  disabled,
  onSaved,
  performDecision,
  renderStaff,
}: {
  booking: {
    id: string;
    version: number;
    status: string;
    scheduledAt: string | null;
    assignedStaff?: { id: string; firstName?: string; lastName?: string } | null;
    rescheduleRequests?: Request[];
  };
  canReview: boolean;
  disabled: boolean;
  onSaved: () => void;
  performDecision?: (input: RescheduleDecision) => Promise<void>;
  renderStaff?: (control: RescheduleStaffControl) => ReactNode;
}) {
  const pending = booking.rescheduleRequests?.find(
    (request) => request.status === "PENDING",
  );
  const initialStaff = pending?.proposedStaff ?? booking.assignedStaff;
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [decision, setDecision] = useState<"APPROVE" | "DECLINE">("APPROVE");
  const [staffBlocked, setStaffBlocked] = useState(true);
  const [staff, setStaff] = useState({
    id: initialStaff?.id,
    label:
      [initialStaff?.firstName, initialStaff?.lastName].filter(Boolean).join(" ") ||
      "Current assigned staff member",
  });

  if (!pending) return null;
  function review(form: FormData) {
    if (!pending || disabled || proposal || uncertain || !canReview) return;
    const reason = String(form.get("reason") ?? "").trim();
    const resourceReviewNote = String(form.get("resources") ?? "").trim();
    if (
      !reason ||
      reason.length > 500 ||
      /[\u0000-\u001f\u007f]/.test(reason) ||
      (decision === "APPROVE" &&
        (resourceReviewNote.length < 10 ||
          resourceReviewNote.length > 2000 ||
          /[\u0000-\u001f\u007f]/.test(resourceReviewNote)))
    ) {
      setError(
        "Record a decision reason and, for approval, the actual people and equipment review (at least 10 characters).",
      );
      return;
    }
    setError(undefined);
    setProposal({
      title:
        decision === "APPROVE"
          ? "Approve the replacement appointment?"
          : "Decline this requested change?",
      description:
        decision === "APPROVE"
          ? "The server rechecks the original appointment, current access, staff, slot and capacity. Only a successful approval switches the appointment and reminders; a conflict preserves the original."
          : "The request will close. The original appointment and reminders remain unchanged.",
      facts: [
        { label: "Original appointment", value: formatBusinessDate(booking.scheduledAt) },
        { label: "Requested time", value: formatBusinessDate(pending.startsAt) },
        { label: "Customer reason", value: pending.reason },
        { label: "Decision reason", value: reason },
        ...(decision === "APPROVE"
          ? [
              { label: "Assigned staff", value: staff.label },
              { label: "Resource review", value: resourceReviewNote },
            ]
          : []),
      ],
      retryAfterRejection: false,
      onUncertain: () => setUncertain(true),
      submit: async () => {
        if (performDecision) {
          await performDecision({
            requestId: pending.id,
            expectedVersion: booking.version,
            decision,
            reason,
            ...(decision === "APPROVE"
              ? { resourceReviewNote, ...(staff.id ? { assignedStaffId: staff.id } : {}) }
              : {}),
          });
          return;
        }
        const saved = parseStaffBooking(
          (
            await apiRequest(`/staff/bookings/${booking.id}/reschedule-decision`, {
              method: "POST",
              csrf: true,
              body: {
                requestId: pending.id,
                expectedVersion: booking.version,
                decision,
                reason,
                ...(decision === "APPROVE"
                  ? {
                      resourceReviewNote,
                      ...(staff.id ? { assignedStaffId: staff.id } : {}),
                    }
                  : {}),
              },
            })
          ).data,
        );
        if (
          saved.id !== booking.id ||
          saved.version !== booking.version + (decision === "APPROVE" ? 2 : 1) ||
          !saved.rescheduleRequests?.some(
            (request) =>
              request.id === pending.id &&
              request.status === (decision === "APPROVE" ? "APPROVED" : "DECLINED"),
          ) ||
          (decision === "APPROVE"
            ? saved.status !== "CONFIRMED" || saved.scheduledAt !== pending.startsAt
            : saved.status !== booking.status ||
              saved.scheduledAt !== booking.scheduledAt)
        )
          throw new Error("Unconfirmed reschedule decision response");
      },
    });
  }
  return (
    <section className="booking-detail-surface" aria-labelledby="staff-reschedule-title">
      <h2 id="staff-reschedule-title">Reschedule awaiting approval</h2>
      <p>Requested time: {formatBusinessDate(pending.startsAt)}</p>
      <p>Reason: {pending.reason}</p>
      <p>
        The original appointment stays {booking.status.toLowerCase()} at{" "}
        {formatBusinessDate(booking.scheduledAt)} until approval. This request does not
        reserve the replacement.
      </p>
      <Feedback message={error} />
      {uncertain ? (
        <>
          <p role="alert">
            The save outcome is uncertain. Refresh the booking before another decision.
          </p>
          <button className="button secondary" onClick={onSaved}>
            Refresh booking
          </button>
        </>
      ) : (
        canReview && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              review(new FormData(event.currentTarget));
            }}
          >
            <fieldset disabled={disabled || !!proposal}>
              <legend>Review the requested change</legend>
              <label htmlFor="reschedule-decision">Decision</label>
              <select
                id="reschedule-decision"
                value={decision}
                onChange={(event) =>
                  setDecision(event.target.value as "APPROVE" | "DECLINE")
                }
              >
                <option value="APPROVE">Approve replacement</option>
                <option value="DECLINE">Decline request</option>
              </select>
              {decision === "APPROVE" && (
                <>
                  <label htmlFor="reschedule-staff">
                    Staff at the replacement branch
                  </label>
                  {renderStaff ? (
                    renderStaff({
                      value: staff.id,
                      onSelect: (id, label) => setStaff({ id, label }),
                      onAvailabilityChange: setStaffBlocked,
                    })
                  ) : (
                    <StaffPicker
                      branchId={pending.branchId}
                      id="reschedule-staff"
                      initialId={initialStaff?.id}
                      onAvailabilityChange={setStaffBlocked}
                      onSelect={(id, label) => setStaff({ id, label })}
                    />
                  )}
                  <label htmlFor="reschedule-resources">
                    People and equipment review
                  </label>
                  <textarea
                    id="reschedule-resources"
                    name="resources"
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                </>
              )}
              <label htmlFor="reschedule-decision-reason">
                Decision reason (visible to customer)
              </label>
              <textarea
                id="reschedule-decision-reason"
                name="reason"
                required
                maxLength={500}
              />
              <button
                className="button"
                type="submit"
                disabled={decision === "APPROVE" && (staffBlocked || !staff.id)}
              >
                Review reschedule decision
              </button>
            </fieldset>
          </form>
        )
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm reschedule decision"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setProposal(null);
            onSaved();
          }}
        />
      )}
    </section>
  );
}
