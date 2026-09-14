"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffBooking } from "@/lib/api/staff-booking-schemas";
import type { MutationProposal } from "./mutation-review";
import { ServiceLineTable } from "./service-line-table";
import { ServiceLineEntry } from "./service-line-entry";
type Status = RequestBody<
  "/staff/bookings/{bookingId}/work-orders/{workOrderId}/status",
  "post"
>["status"];
const transitions: Record<string, readonly Status[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_PARTS", "QUALITY_CHECK", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_CHECK: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
};
const note = z
  .string()
  .trim()
  .max(8000, "Use at most 8,000 characters.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Use one paragraph without control characters.",
  );
const notesSchema = z.object({ diagnosis: note, internalNotes: note });
type Props = {
  booking: StaffBooking;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
};
export function StaffWorkOrder({ booking, disabled, onReview }: Props) {
  const [addingItems, setAddingItems] = useState(false);
  const work = booking.workOrder;
  const editable = work
    ? !["COMPLETED", "CANCELLED"].includes(work.status)
    : booking.status === "CONFIRMED";
  function reviewStatus(status: Status) {
    if (!work || disabled || !(transitions[work.status] ?? []).includes(status)) return;
    const body: RequestBody<
      "/staff/bookings/{bookingId}/work-orders/{workOrderId}/status",
      "post"
    > = { expectedVersion: work.version, status };
    onReview({
      title: "Update work-order status?",
      description:
        status === "COMPLETED"
          ? "Confirm that quality checks are complete. The server also completes an in-progress booking."
          : status === "CANCELLED"
            ? "This cancels the work order. Booking cancellation and any payment resolution are separate actions."
            : "Confirm that this workshop milestone has occurred. Starting work also updates a confirmed booking to in progress.",
      facts: [
        { label: "Work order", value: work.workOrderNumber },
        { label: "From", value: work.status.replaceAll("_", " ") },
        { label: "To", value: status.replaceAll("_", " ") },
      ],
      submit: () =>
        apiRequest(`/staff/bookings/${booking.id}/work-orders/${work.id}/status`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <section className="detail-section">
      <h2>Work order</h2>
      {work ? (
        <>
          <h3>{work.workOrderNumber}</h3>
          <p>{work.status.replaceAll("_", " ")}</p>
          {work.diagnosis && <p>Diagnosis: {work.diagnosis}</p>}
          {work.internalNotes && <p>Internal notes: {work.internalNotes}</p>}
          <ServiceLineTable
            items={work.items}
            label={`${work.workOrderNumber} line items`}
          />
          <div className="actions">
            {(transitions[work.status] ?? [])
              .filter((status) => status !== "APPROVED" || booking.status === "CONFIRMED")
              .map((status) => (
                <button
                  key={status}
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => reviewStatus(status)}
                >
                  Mark {status.toLowerCase().replaceAll("_", " ")}
                </button>
              ))}
          </div>
        </>
      ) : (
        <p>No work order recorded.</p>
      )}
      {editable && (
        <WorkOrderNotes
          key={`notes-${work?.id ?? "new"}-${work?.version ?? booking.version}`}
          booking={booking}
          disabled={disabled}
          onReview={onReview}
        />
      )}
      {editable &&
        work &&
        (addingItems ? (
          <ServiceLineEntry
            key={`items-${work.id}-${work.version}`}
            booking={booking}
            mode="work-items"
            disabled={disabled}
            onReview={onReview}
            onSaved={() => setAddingItems(false)}
            onCancel={() => setAddingItems(false)}
          />
        ) : (
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => setAddingItems(true)}
          >
            Add work-order items
          </button>
        ))}
    </section>
  );
}
function WorkOrderNotes({ booking, disabled, onReview }: Props) {
  const work = booking.workOrder;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof notesSchema>>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      diagnosis: work?.diagnosis ?? "",
      internalNotes: work?.internalNotes ?? "",
    },
  });
  function review(values: z.infer<typeof notesSchema>) {
    if (disabled) return;
    const notes = {
      diagnosis: values.diagnosis || null,
      internalNotes: values.internalNotes || null,
    };
    const body:
      | RequestBody<"/staff/bookings/{bookingId}/work-orders", "post">
      | RequestBody<"/staff/bookings/{bookingId}/work-orders/{workOrderId}", "put"> = work
      ? { ...notes, expectedVersion: work.version }
      : { ...notes, expectedBookingVersion: booking.version, items: [] };
    onReview({
      title: work ? "Save work-order notes?" : "Open a draft work order?",
      description:
        "Diagnosis is visible to the customer. Internal notes are restricted to staff. Review both before saving.",
      facts: [
        { label: "Booking", value: booking.id },
        { label: "Diagnosis", value: notes.diagnosis ?? "None" },
        { label: "Internal notes", value: notes.internalNotes ?? "None" },
      ],
      submit: () =>
        apiRequest(
          `/staff/bookings/${booking.id}/work-orders${work ? `/${work.id}` : ""}`,
          { method: work ? "PUT" : "POST", csrf: true, body },
        ),
    });
  }
  return (
    <form onSubmit={handleSubmit(review)} noValidate>
      <h3>{work ? "Edit notes" : "Open work order"}</h3>
      <p className="field-hint">Use one paragraph per field.</p>
      <div className="field">
        <label htmlFor="work-diagnosis">Diagnosis (customer-visible)</label>
        <input
          id="work-diagnosis"
          {...register("diagnosis")}
          maxLength={8000}
          aria-invalid={!!errors.diagnosis}
          aria-describedby={errors.diagnosis ? "work-diagnosis-error" : undefined}
        />
        {errors.diagnosis && (
          <p id="work-diagnosis-error" className="field-error" role="alert">
            {errors.diagnosis.message}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="work-notes">Internal work-order notes</label>
        <input
          id="work-notes"
          {...register("internalNotes")}
          maxLength={8000}
          aria-invalid={!!errors.internalNotes}
          aria-describedby={errors.internalNotes ? "work-notes-error" : undefined}
        />
        {errors.internalNotes && (
          <p id="work-notes-error" className="field-error" role="alert">
            {errors.internalNotes.message}
          </p>
        )}
      </div>
      <button className="button" disabled={disabled}>
        {work ? "Review notes" : "Review draft work order"}
      </button>
    </form>
  );
}
