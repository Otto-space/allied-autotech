"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { newIdempotencyKey } from "@/lib/api/client";
import { paymentNote } from "@/lib/forms/payment-review";
import { positiveNaira } from "@/lib/forms/vehicle-record";
import { nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  paymentSnapshot,
  type PaymentChange,
  type WorkPayment,
  type WorkAttempt,
} from "@/lib/admin/work-payments";
import type { MutationProposal } from "./mutation-review";
type Props = {
  payment: WorkPayment;
  attempt: WorkAttempt;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  recoveryKey?: string;
};
const manualSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewerNote: paymentNote,
});
const refundSchema = z.object({ amount: positiveNaira, reason: paymentNote });
function facts(payment: WorkPayment, attempt: WorkAttempt) {
  return [
    { label: "Payment", value: payment.paymentNumber },
    { label: "Payment reference", value: payment.id },
    { label: "Attempt reference", value: attempt.id },
    { label: "Attempt number", value: String(attempt.attemptNumber) },
    { label: "Provider", value: attempt.provider },
    {
      label: "Payment method",
      value: attempt.method?.replaceAll("_", " ") ?? "Not recorded",
    },
    { label: "Attempt amount", value: formatKobo(attempt.amountKobo) },
    ...[
      { label: "Order reference", value: payment.orderId },
      { label: "Invoice reference", value: payment.invoiceId },
      { label: "Booking reference", value: payment.bookingId },
      { label: "Vehicle purchase reference", value: payment.vehicleTransactionId },
    ].flatMap((f) => (f.value ? [{ label: f.label, value: f.value }] : [])),
    ...(attempt.manualReview
      ? [
          { label: "Payer", value: attempt.manualReview.payerName ?? "Not recorded" },
          {
            label: "Bank reference",
            value: attempt.manualReview.bankReference ?? "Not recorded",
          },
          {
            label: "Reported transfer",
            value: formatStockInstant(attempt.manualReview.transferredAt),
          },
          {
            label: "Evidence submitted",
            value: formatStockInstant(attempt.manualReview.submittedAt),
          },
        ]
      : []),
  ];
}
export function ManualDecisionForm({ payment, attempt, disabled, onReview }: Props) {
  const [snapshot, setSnapshot] = useState(() => paymentSnapshot(payment)),
    changed = snapshot !== paymentSnapshot(payment),
    form = useForm<z.infer<typeof manualSchema>>({
      resolver: zodResolver(manualSchema),
      defaultValues: { decision: "REJECTED", reviewerNote: "" },
    }),
    prefix = `manual-${attempt.id}`;
  if (!attempt.manualReview?.canReview || attempt.manualReview.status !== "PENDING")
    return null;
  return (
    <form
      data-draft-key={JSON.stringify(["staff-payment-manual:1", attempt.id])}
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || changed) return;
        const change: PaymentChange = {
          operation: "manual",
          payment,
          attemptId: attempt.id,
          body: values,
        };
        onReview({
          paymentChange: change,
          title: `${values.decision === "APPROVED" ? "Approve" : "Reject"} this manual payment?`,
          description:
            values.decision === "APPROVED"
              ? "Approve only after independently matching the payment against bank, POS or cash records. This records your decision and may settle the linked purchase. The reviewer must be a different operator from the person who submitted the evidence. It does not charge or transfer money."
              : "This rejects the submitted evidence and does not return funds. Reconcile any money received before asking the customer to pay again. The reviewer must be a different operator from the person who submitted the evidence.",
          facts: [
            ...facts(payment, attempt),
            { label: "Decision", value: values.decision },
            { label: "Reviewer note", value: values.reviewerNote },
          ],
          submit: async () => {},
          onConfirmed: () => form.reset(),
        });
      })}
    >
      <h3>Manual payment decision</h3>
      <p className="wp-help">
        Independently check the payment evidence. You cannot decide your own submission.
      </p>
      {changed && (
        <div className="notice" role="status">
          <p>
            Payment facts changed. Your note is retained; load current fields before
            reviewing another decision.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => setSnapshot(paymentSnapshot(payment))}
          >
            Load current decision fields
          </button>
        </div>
      )}
      <fieldset className="wp-fields" disabled={disabled || changed}>
        <div className="field">
          <label htmlFor={`${prefix}-decision`}>Manual payment decision</label>
          <select id={`${prefix}-decision`} {...form.register("decision")}>
            <option value="REJECTED">Reject evidence</option>
            <option value="APPROVED">Approve verified payment</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-note`}>Manual payment reviewer note</label>
          <textarea
            id={`${prefix}-note`}
            {...form.register("reviewerNote")}
            rows={4}
            maxLength={1000}
            aria-invalid={!!form.formState.errors.reviewerNote}
            aria-describedby={`${prefix}-hint${form.formState.errors.reviewerNote ? ` ${prefix}-error` : ""}`}
          />
          <p id={`${prefix}-hint`} className="field-hint">
            Required. Use one paragraph without line breaks; long notes wrap in this box.
            Avoid unrelated private information.
          </p>
          {form.formState.errors.reviewerNote && (
            <p id={`${prefix}-error`} className="field-error" role="alert">
              {form.formState.errors.reviewerNote.message}
            </p>
          )}
        </div>
        <button className="button">Review manual payment decision</button>
      </fieldset>
    </form>
  );
}
export function PaymentRefundForm({
  payment,
  attempt,
  disabled,
  onReview,
  recoveryKey,
}: Props) {
  const [snapshot, setSnapshot] = useState(() => paymentSnapshot(payment)),
    changed = snapshot !== paymentSnapshot(payment),
    form = useForm<z.infer<typeof refundSchema>>({
      resolver: zodResolver(refundSchema),
      defaultValues: { amount: "", reason: "" },
    }),
    prefix = `refund-${attempt.id}`;
  if (attempt.status !== "SUCCESSFUL" || attempt.verificationStatus !== "VERIFIED")
    return null;
  return (
    <form
      data-draft-key={JSON.stringify(["staff-payment-refund:1", attempt.id])}
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || changed) return;
        const amountKobo = nairaToKobo(values.amount);
        if (BigInt(amountKobo) > BigInt(attempt.amountKobo)) {
          form.setError(
            "amount",
            { message: "The request cannot exceed this attempt’s captured amount." },
            { shouldFocus: true },
          );
          return;
        }
        const change: PaymentChange = {
          operation: "refund",
          payment,
          attemptId: attempt.id,
          requestKey: recoveryKey ?? newIdempotencyKey(),
          body: { paymentAttemptId: attempt.id, amountKobo, reason: values.reason },
        };
        onReview({
          paymentChange: change,
          title: "Request this refund?",
          description:
            "This creates a refund request. A different administrator must decide it; no money is returned by this request. The server checks disputes, approved policy and existing refund commitments. The captured amount is not a remaining refundable balance.",
          facts: [
            ...facts(payment, attempt),
            { label: "Requested amount", value: formatKobo(amountKobo) },
            { label: "Reason", value: values.reason },
          ],
          submit: async () => {},
          onConfirmed: () => form.reset(),
        });
      })}
    >
      <h3>Request a refund</h3>
      {recoveryKey && (
        <p className="wp-help" role="status">
          Original request recovery only. Restore its exact amount and reason; a changed
          body cannot be sent with the retained reference. This does not prepare a
          separate refund.
        </p>
      )}
      <p className="wp-help">
        Captured on this attempt: {formatKobo(attempt.amountKobo)}. Existing commitments
        are checked when you submit; this is not the remaining refundable balance.
      </p>
      {changed && (
        <div className="notice" role="status">
          <p>
            Payment facts changed. Your fields are retained; load current fields before
            another review.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => setSnapshot(paymentSnapshot(payment))}
          >
            Load current refund fields
          </button>
        </div>
      )}
      <fieldset className="wp-fields" disabled={disabled || changed}>
        <div className="field">
          <label htmlFor={`${prefix}-amount`}>Refund amount (NGN)</label>
          <input
            id={`${prefix}-amount`}
            {...form.register("amount")}
            inputMode="decimal"
            maxLength={17}
            aria-invalid={!!form.formState.errors.amount}
            aria-describedby={
              form.formState.errors.amount ? `${prefix}-amount-error` : undefined
            }
          />
          {form.formState.errors.amount && (
            <p id={`${prefix}-amount-error`} className="field-error" role="alert">
              {form.formState.errors.amount.message}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-reason`}>Refund reason</label>
          <textarea
            id={`${prefix}-reason`}
            {...form.register("reason")}
            rows={4}
            maxLength={1000}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={
              form.formState.errors.reason ? `${prefix}-reason-error` : undefined
            }
          />
          {form.formState.errors.reason && (
            <p id={`${prefix}-reason-error`} className="field-error" role="alert">
              {form.formState.errors.reason.message}
            </p>
          )}
        </div>
        <button className="button">
          {recoveryKey ? "Review original refund request" : "Review refund request"}
        </button>
      </fieldset>
    </form>
  );
}
