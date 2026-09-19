"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  refundSchema,
  refundMessages,
  type PaymentAttempt,
  type RefundRecord,
} from "@/lib/api/staff-payment-schemas";
import { positiveNaira } from "@/lib/forms/vehicle-record";
import { paymentNote } from "@/lib/forms/payment-review";
import { nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import type { MutationProposal } from "./mutation-review";
const schema = z.object({ amount: positiveNaira, reason: paymentNote });
export function RefundRequestForm({
  attempt,
  paymentNumber,
  disabled,
  onReview,
}: {
  attempt: PaymentAttempt;
  paymentNumber: string;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const [receipt, setReceipt] = useState<RefundRecord>();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", reason: "" },
  });
  if (attempt.status !== "SUCCESSFUL" || attempt.verificationStatus !== "VERIFIED")
    return null;
  const prefix = `refund-request-${attempt.id}`;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (disabled || receipt) return;
        const amountKobo = nairaToKobo(values.amount);
        if (BigInt(amountKobo) > BigInt(attempt.amountKobo)) {
          form.setError(
            "amount",
            { message: "The request cannot exceed this attempt’s captured amount." },
            { shouldFocus: true },
          );
          return;
        }
        const body: RequestBody<"/staff/payments/refunds", "post"> = {
          paymentAttemptId: attempt.id,
          amountKobo,
          reason: values.reason,
        };
        const key = newIdempotencyKey();
        onReview({
          title: "Request this refund?",
          description:
            "This creates a refund request. A different administrator must decide it; no money is returned by this request. The server checks the captured amount and existing refunds. The captured amount shown here is not a remaining refundable balance.",
          facts: [
            { label: "Payment", value: paymentNumber },
            { label: "Attempt", value: String(attempt.attemptNumber) },
            { label: "Requested amount", value: formatKobo(amountKobo) },
            { label: "Reason", value: values.reason },
          ],
          retrySafely: true,
          submit: async () => {
            const result = await apiRequest("/staff/payments/refunds", {
              method: "POST",
              csrf: true,
              idempotencyKey: key,
              body,
            });
            setReceipt(z.object({ refund: refundSchema }).parse(result.data).refund);
          },
        });
      })}
    >
      {receipt && (
        <div className="notice" role="status">
          <p>
            Refund {receipt.refundNumber}: {formatKobo(receipt.amountKobo)}
          </p>
          <p>{refundMessages[receipt.status]}</p>
          <p>
            Keep this reference for the reviewing administrator. Staff do not have access
            to the administrator refund queue.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset();
              setReceipt(undefined);
            }}
          >
            Prepare a separate refund request
          </button>
        </div>
      )}
      <fieldset className="handover-fields" disabled={disabled || !!receipt}>
        <p>
          Captured on this attempt: {formatKobo(attempt.amountKobo)}. Existing refund
          commitments are checked when you submit.
        </p>
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
            <p className="field-error" role="alert" id={`${prefix}-amount-error`}>
              {form.formState.errors.amount.message}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-reason`}>Refund reason</label>
          <input
            id={`${prefix}-reason`}
            {...form.register("reason")}
            maxLength={1000}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={
              form.formState.errors.reason ? `${prefix}-reason-error` : undefined
            }
          />
          {form.formState.errors.reason && (
            <p className="field-error" role="alert" id={`${prefix}-reason-error`}>
              {form.formState.errors.reason.message}
            </p>
          )}
        </div>
        <button className="button secondary">Review refund request</button>
      </fieldset>
    </form>
  );
}
