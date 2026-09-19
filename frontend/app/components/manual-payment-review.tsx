"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { PaymentAttempt } from "@/lib/api/staff-payment-schemas";
import { paymentNote } from "@/lib/forms/payment-review";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: paymentNote,
});
export function ManualPaymentReview({
  attempt,
  paymentNumber,
  disabled,
  uncertain,
  onUncertain,
  onReview,
}: {
  attempt: PaymentAttempt;
  paymentNumber: string;
  disabled: boolean;
  uncertain: boolean;
  onUncertain: () => void;
  onReview: (proposal: MutationProposal) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { decision: "REJECTED", note: "" },
  });
  if (attempt.manualReview?.status !== "PENDING") return null;
  const prefix = `manual-${attempt.id}`;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || uncertain) return;
        const body: RequestBody<
          "/staff/payments/manual-attempts/{attemptId}/review",
          "post"
        > = { decision: values.decision, reviewerNote: values.note };
        onReview({
          title:
            values.decision === "APPROVED"
              ? "Approve this manual payment?"
              : "Reject this manual payment evidence?",
          description:
            values.decision === "APPROVED"
              ? "Confirm that the funds were independently verified against the business payment records. Approval marks this attempt successful and applies settlement checks to its order, booking, invoice or vehicle purchase. A different operator must review the submission."
              : "This rejects the submitted evidence. It does not return funds. Reconcile any money received before asking the customer to pay again. A different operator must review the submission.",
          facts: [
            { label: "Payment", value: paymentNumber },
            { label: "Attempt", value: String(attempt.attemptNumber) },
            { label: "Amount", value: formatKobo(attempt.amountKobo) },
            { label: "Payer", value: attempt.manualReview?.payerName ?? "Not recorded" },
            { label: "Decision", value: values.decision },
            { label: "Reviewer note", value: values.note },
          ],
          onUncertain,
          submit: () =>
            apiRequest(`/staff/payments/manual-attempts/${attempt.id}/review`, {
              method: "POST",
              csrf: true,
              body,
            }),
        });
      })}
    >
      {uncertain && (
        <p className="notice" role="status">
          This review outcome is unconfirmed. Refresh the payments to check its recorded
          status. This form will not resend the decision.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled || uncertain}>
        <div className="field">
          <label htmlFor={`${prefix}-decision`}>Manual payment decision</label>
          <select id={`${prefix}-decision`} {...form.register("decision")}>
            <option value="REJECTED">Reject evidence</option>
            <option value="APPROVED">Approve verified payment</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-note`}>Manual payment reviewer note</label>
          <input
            id={`${prefix}-note`}
            {...form.register("note")}
            maxLength={1000}
            aria-invalid={!!form.formState.errors.note}
            aria-describedby={form.formState.errors.note ? `${prefix}-error` : undefined}
          />
          {form.formState.errors.note && (
            <p className="field-error" role="alert" id={`${prefix}-error`}>
              {form.formState.errors.note.message}
            </p>
          )}
        </div>
        <button className="button secondary">Review manual payment decision</button>
      </fieldset>
    </form>
  );
}
