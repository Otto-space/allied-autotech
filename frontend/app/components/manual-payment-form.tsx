"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import {
  newPaymentAttemptUnavailable,
  paymentIdentity,
} from "@/lib/api/payment-checkout";
import type { RequestBody } from "@/lib/api/contracts";
import { parsePayment, type PaymentRecord } from "@/lib/api/payment-schemas";
import {
  preparePaymentEvidence,
  validatePaymentEvidence,
} from "@/lib/api/payment-evidence";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const text = z
  .string()
  .trim()
  .min(1, "Enter the payer's name.")
  .max(160)
  .refine(
    (value) =>
      [...value].every(
        (character) =>
          (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
      ),
    "Use a single line without control characters.",
  );
const schema = z.object({
  method: z.enum(["BANK_TRANSFER", "POS", "CASH"]),
  payerName: text,
  bankReference: z.union([z.literal(""), text]),
  transferredAt: lagosDateTime,
});
const methodLabels = { BANK_TRANSFER: "Bank transfer", POS: "POS", CASH: "Cash" };
export function ManualPaymentForm({
  payment,
  eligible,
  disabled,
  onActivity,
  onRecorded,
  onRefresh,
}: {
  payment: PaymentRecord;
  eligible: boolean;
  disabled: boolean;
  onActivity: (active: boolean) => void;
  onRecorded: () => void;
  onRefresh: () => void;
}) {
  const [selection, setSelection] = useState<AssetSelection>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [recovery, setRecovery] = useState<MutationProposal | null>(null);
  const [locked, setLocked] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState<string>();
  const active = useRef(true);
  const pending = useRef<AbortController | null>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const restoreReviewFocus = useRef(false);
  const current = useRef({ eligible, disabled });
  useEffect(() => {
    current.current = { eligible, disabled };
  }, [eligible, disabled]);
  const change = useCallback((value: AssetSelection) => {
    setSelection(value);
    setError(undefined);
  }, []);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: "BANK_TRANSFER",
      payerName: "",
      bankReference: "",
      transferredAt: "",
    },
  });
  const resetForm = form.reset;
  useEffect(() => {
    active.current = true;
    const discard = () => {
      active.current = false;
      pending.current?.abort();
      formElement.current?.reset();
      resetForm();
      setSelection(null);
      setProposal(null);
      setRecovery(null);
      setError(undefined);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [resetForm]);
  const blocked = disabled || !eligible || locked || receipt || !!proposal;
  useEffect(() => {
    if (!restoreReviewFocus.current || disabled || proposal) return;
    const frame = requestAnimationFrame(() => {
      if (!active.current) return;
      restoreReviewFocus.current = false;
      const target =
        eligible && !locked && !receipt
          ? reviewButton.current
          : formElement.current?.closest(".customer-payment")?.querySelector("h1");
      if (target instanceof HTMLElement) target.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, eligible, locked, proposal, receipt]);
  function review(values: z.infer<typeof schema>, now: number) {
    if (blocked || !active.current || newPaymentAttemptUnavailable(payment, now)) return;
    const prepared = selection?.prepared;
    if (selection && (!prepared || prepared.expiresAt <= now)) {
      setError(
        "Upload the selected evidence before continuing. If it expired, upload it again or remove it.",
      );
      document.getElementById("manual-evidence")?.focus();
      return;
    }
    setError(undefined);
    const body: RequestBody<"/customers/payments/{paymentId}/manual", "post"> = {
      method: values.method,
      payerName: values.payerName,
      transferredAt: `${values.transferredAt}:00+01:00`,
      ...(values.bankReference ? { bankReference: values.bankReference } : {}),
      ...(prepared ? { evidenceToken: prepared.token } : {}),
    };
    const key = newIdempotencyKey();
    let attempted = false;
    const next: MutationProposal = {
      title: "Submit these payment details?",
      description:
        "Submit only a payment you already made directly to Allied AutoTech. This reports payment details for review; it does not transfer money or confirm that funds were received. Do not make another payment while review is pending.",
      facts: [
        { label: "Payment", value: payment.paymentNumber },
        { label: "Requested amount", value: formatKobo(payment.amountKobo) },
        { label: "Method", value: methodLabels[values.method] },
        { label: "Payer", value: values.payerName },
        { label: "Paid at", value: formatBusinessDate(body.transferredAt) },
        ...(values.bankReference
          ? [{ label: "Bank or receipt reference", value: values.bankReference }]
          : []),
        { label: "Evidence", value: selection?.name ?? "No attachment" },
      ],
      retrySafely: true,
      retryAfterRejection: false,
      onUncertain: () => {
        if (!active.current) return;
        setLocked(true);
        onActivity(true);
        setRecovery(next);
      },
      submit: async () => {
        if (!active.current || pending.current) throw new Error("Submission interrupted");
        if (
          !attempted &&
          (!current.current.eligible ||
            current.current.disabled ||
            newPaymentAttemptUnavailable(payment) ||
            (prepared && prepared.expiresAt <= Date.now()))
        ) {
          setError(
            prepared && prepared.expiresAt <= Date.now()
              ? "The evidence authorisation expired before submission. Close this review and upload it again."
              : "The payment is no longer ready for this submission. Close this review and refresh its status.",
          );
          throw new ApiError(409, { error: { code: "CONFLICT" } });
        }
        attempted = true;
        const controller = new AbortController();
        pending.current = controller;
        try {
          const result = await apiRequest(`/customers/payments/${payment.id}/manual`, {
            method: "POST",
            csrf: true,
            body,
            idempotencyKey: key,
            signal: controller.signal,
          });
          if (!active.current || controller.signal.aborted)
            throw new Error("Submission interrupted");
          const saved = parsePayment(result.data);
          if (
            paymentIdentity(saved) !== paymentIdentity(payment) ||
            !saved.attempts.some((attempt) => attempt.provider === "MANUAL")
          )
            throw new Error("Unexpected manual payment receipt");
          formElement.current?.reset();
          form.reset();
          setSelection(null);
          setReceipt(true);
          setRecovery(null);
        } finally {
          if (pending.current === controller) pending.current = null;
        }
      },
    };
    onActivity(true);
    setProposal(next);
  }
  return (
    <section
      className="detail-section manual-payment-section"
      aria-labelledby="manual-payment-heading"
      hidden={!eligible && !locked && !receipt && !proposal}
    >
      <h2 id="manual-payment-heading">Already paid directly?</h2>
      <p>
        Report a bank transfer, POS or cash payment already made to Allied AutoTech.
        Contact customer care for payment instructions.
      </p>
      <p>
        This payment request is for {formatKobo(payment.amountKobo)}. If you paid a
        different amount, contact customer care before submitting.
      </p>
      <Feedback message={error} />
      {receipt ? (
        <p role="status" className="notice">
          Your payment details were recorded. Check the payment status above for the
          review outcome. Submission does not confirm receipt of funds.
        </p>
      ) : (
        locked && (
          <div className="notice" role="status">
            <p>
              Your submission could not be confirmed. Refresh this payment and contact
              customer care if it remains unclear. Do not pay again or submit different
              details while the outcome is unknown.
            </p>
            {recovery ? (
              <button
                type="button"
                className="button secondary"
                disabled={disabled || !!proposal}
                onClick={() => setProposal(recovery)}
              >
                Review the same payment submission
              </button>
            ) : (
              <p>
                This evidence submission will not be resent automatically. Keep your
                original receipt for reconciliation.
              </p>
            )}
          </div>
        )
      )}
      {receipt && eligible && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={() => {
            form.reset();
            setSelection(null);
            setReceipt(false);
            setLocked(false);
            setRecovery(null);
            setError(undefined);
            onActivity(false);
          }}
        >
          Prepare corrected payment details
        </button>
      )}
      {!receipt && (
        <form
          ref={formElement}
          data-draft-key={JSON.stringify(["manual-payment-form:1", payment?.id])}
          noValidate
          onSubmit={(event) =>
            void form.handleSubmit((values) => review(values, Date.now()))(event)
          }
        >
          <fieldset className="handover-fields" disabled={blocked}>
            <div className="field">
              <label htmlFor="manual-method">Payment method</label>
              <select id="manual-method" {...form.register("method")}>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {(
              [
                ["payerName", "Payer name", "text"],
                ["bankReference", "Bank or receipt reference (optional)", "text"],
                ["transferredAt", "Payment date and time (Lagos)", "datetime-local"],
              ] as const
            ).map(([name, label, type]) => (
              <div className="field" key={name}>
                <label htmlFor={`manual-${name}`}>{label}</label>
                <input
                  id={`manual-${name}`}
                  type={type}
                  {...form.register(name)}
                  maxLength={type === "text" ? 160 : undefined}
                  autoComplete={name === "payerName" ? "name" : "off"}
                  aria-invalid={!!form.formState.errors[name]}
                  aria-describedby={
                    form.formState.errors[name] ? `manual-${name}-error` : undefined
                  }
                />
                {form.formState.errors[name] && (
                  <p role="alert" className="field-error" id={`manual-${name}-error`}>
                    {form.formState.errors[name]?.message}
                  </p>
                )}
              </div>
            ))}
            <FileUpload
              uploadId="manual-evidence"
              label="Payment evidence (optional)"
              hint="PDF, JPEG or PNG, up to 10 MiB. Include only information needed to verify this payment; do not include a card number, PIN or password."
              accept="application/pdf,image/jpeg,image/png"
              disabled={blocked}
              onChange={change}
              validate={validatePaymentEvidence}
              prepare={(options) =>
                preparePaymentEvidence({ ...options, paymentId: payment.id })
              }
            />
            <button ref={reviewButton} className="button secondary">
              Review payment details
            </button>
          </fieldset>
        </form>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            restoreReviewFocus.current = true;
            setProposal(null);
            if (!locked) onActivity(false);
            onRefresh();
          }}
          onSuccess={() => {
            onActivity(false);
            onRecorded();
          }}
        />
      )}
    </section>
  );
}
