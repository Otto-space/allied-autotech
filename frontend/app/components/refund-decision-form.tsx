"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  refundProcessingSchema,
  type ProcessingRefund,
} from "@/lib/api/refund-processing";
import { paymentNote } from "@/lib/forms/payment-review";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
const schema = z
  .object({ decision: z.enum(["APPROVED", "CANCELLED"]), note: z.string() })
  .superRefine((values, context) => {
    if (values.decision !== "CANCELLED" || !values.note.trim()) return;
    const result = paymentNote.safeParse(values.note);
    if (!result.success)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: result.error.issues[0].message,
      });
  });
export function RefundDecisionForm({
  refund,
  disabled,
  uncertain,
  onUncertain,
  onReview,
  actorId,
}: {
  refund: ProcessingRefund;
  actorId: string;
  disabled: boolean;
  uncertain: boolean;
  onUncertain: () => void;
  onReview: (proposal: MutationProposal) => void;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { decision: "CANCELLED", note: "" },
  });
  const decision = useWatch({ control: form.control, name: "decision" });
  const prefix = `refund-decision-${refund.id}`;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || uncertain || refund.status !== "REQUESTED") return;
        const body: RequestBody<"/staff/refunds/{refundId}/decision", "post"> = {
          decision: values.decision,
          ...(values.decision === "CANCELLED" && values.note.trim()
            ? { note: values.note.trim() }
            : {}),
        };
        onReview({
          title:
            values.decision === "APPROVED"
              ? "Approve this refund?"
              : "Cancel this refund request?",
          description:
            values.decision === "APPROVED"
              ? "Approval may submit the refund to the payment provider. It does not confirm that funds were returned. Manual payments or uncertain provider submissions require operational follow-up. Review the resulting status before taking further action."
              : "This cancels the refund request without returning money. Only a different authorized operator from the requester can make this decision.",
          facts: [
            { label: "Refund", value: refund.refundNumber },
            { label: "Amount", value: formatKobo(refund.amountKobo) },
            { label: "Original reason", value: refund.reason },
            { label: "Decision", value: values.decision },
            ...(body.note ? [{ label: "Cancellation note", value: body.note }] : []),
          ],
          onUncertain,
          retryAfterRejection: false,
          submit: async () => {
            const saved = refundProcessingSchema.parse(
              (
                await apiRequest(`/staff/refunds/${refund.id}/decision`, {
                  method: "POST",
                  csrf: true,
                  body,
                })
              ).data,
            );
            if (
              saved.id !== refund.id ||
              saved.amountKobo !== refund.amountKobo ||
              saved.paymentAttemptId !== refund.paymentAttemptId ||
              (body.decision === "CANCELLED"
                ? saved.status !== "CANCELLED"
                : saved.approvedByUserId !== actorId ||
                  !saved.approvedAt ||
                  ["REQUESTED", "CANCELLED"].includes(saved.status))
            )
              throw new Error("Unexpected refund decision");
          },
        });
      })}
    >
      {uncertain && (
        <p role="status" className="notice">
          The refund decision is unconfirmed. Refresh this queue to reconcile its state.
          This form will not resend the decision.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled || uncertain}>
        <div className="field">
          <label htmlFor={`${prefix}-decision`}>Refund decision</label>
          <select id={`${prefix}-decision`} {...form.register("decision")}>
            <option value="CANCELLED">Cancel request</option>
            <option value="APPROVED">Approve refund</option>
          </select>
        </div>
        {decision === "CANCELLED" && (
          <div className="field">
            <label htmlFor={`${prefix}-note`}>Refund cancellation note (optional)</label>
            <input
              className="input"
              id={`${prefix}-note`}
              {...form.register("note")}
              maxLength={1000}
              aria-invalid={!!form.formState.errors.note}
              aria-describedby={
                form.formState.errors.note ? `${prefix}-error` : undefined
              }
            />
            {form.formState.errors.note && (
              <p className="field-error" id={`${prefix}-error`} role="alert">
                {form.formState.errors.note.message}
              </p>
            )}
          </div>
        )}
        <button className="button secondary">Review refund decision</button>
      </fieldset>
    </form>
  );
}
