"use client";
import { useState } from "react";
import type { ProcessingRefund } from "@/lib/api/refund-processing";
import { prepareRefundEvidence, refundActionSchema } from "@/lib/api/refund-processing";
import { validatePaymentEvidence } from "@/lib/api/payment-evidence";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { lagosDateTime } from "@/lib/forms/vehicle-condition";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { FileUpload, type AssetSelection } from "./file-upload";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function RefundTransferForm({
  refund,
  actorId,
  disabled,
  onReview,
  onUncertain,
}: {
  refund: ProcessingRefund;
  actorId: string;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
  onUncertain: () => void;
}) {
  const [evidence, setEvidence] = useState<AssetSelection>(null);
  const [error, setError] = useState<string>();
  const prefix = `transfer-${refund.id}`;
  function review(form: FormData, now: number) {
    if (disabled) return;
    setError(undefined);
    const value = String(form.get("at") ?? "");
    const at = Date.parse(`${value}:00+01:00`);
    if (
      !lagosDateTime.safeParse(value).success ||
      at > now ||
      !refund.approvedAt ||
      at < Date.parse(refund.approvedAt)
    ) {
      setError(
        "Enter the actual transfer time in Lagos, after approval and not in the future.",
      );
      document.getElementById(`${prefix}-at`)?.focus();
      return;
    }
    if (!evidence?.prepared || evidence.prepared.expiresAt <= now) {
      setError("Upload valid transfer evidence before reviewing this record.");
      return;
    }
    const bankReference = String(form.get("reference") ?? "").trim();
    const beneficiary = {
      bankName: String(form.get("bank") ?? "").trim(),
      accountName: String(form.get("name") ?? "").trim(),
      accountNumber: String(form.get("account") ?? "").trim(),
    };
    if (
      bankReference.length < 3 ||
      bankReference.length > 160 ||
      beneficiary.bankName.length < 2 ||
      beneficiary.bankName.length > 120 ||
      beneficiary.accountName.length < 2 ||
      beneficiary.accountName.length > 160 ||
      !/^\d{10}$/.test(beneficiary.accountNumber)
    ) {
      setError(
        "Check the bank reference, bank name, recipient name and 10-digit account number.",
      );
      return;
    }
    const body: RequestBody<"/staff/refunds/{refundId}/transfer", "post"> = {
      bankReference,
      beneficiary,
      transferredAt: new Date(at).toISOString(),
      evidenceToken: evidence.prepared.token,
    };
    onReview({
      title: "Record this completed bank transfer?",
      description:
        "This records a transfer you have already made outside this application. It does not send money. A separate authorized checker must verify the evidence before the refund is recorded as completed.",
      facts: [
        { label: "Refund", value: refund.refundNumber },
        { label: "Amount", value: formatKobo(refund.amountKobo) },
        { label: "Bank", value: beneficiary.bankName },
        { label: "Recipient", value: beneficiary.accountName },
        { label: "Account number", value: beneficiary.accountNumber },
        { label: "Bank reference", value: bankReference },
        { label: "Transferred", value: formatBusinessDate(body.transferredAt) },
        { label: "Evidence", value: evidence.name },
      ],
      onUncertain,
      retryAfterRejection: false,
      submit: async () => {
        const saved = refundActionSchema.parse(
          (
            await apiRequest(`/staff/refunds/${refund.id}/transfer`, {
              method: "POST",
              csrf: true,
              body,
            })
          ).data,
        );
        if (
          saved.id !== refund.id ||
          saved.amountKobo !== refund.amountKobo ||
          saved.status !== "PROCESSING" ||
          saved.bankReference !== bankReference ||
          saved.transferredByUserId !== actorId ||
          !saved.transferredAt ||
          Date.parse(saved.transferredAt) !== at
        )
          throw new Error("Unexpected refund transfer record");
      },
    });
  }
  return (
    <section className="detail-section aftercare-record">
      <h3>Record a completed bank transfer</h3>
      <p>
        Use the approved amount and actual recipient details. Recording a transfer here
        does not move money.
      </p>
      <Feedback message={error} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(new FormData(event.currentTarget), new Date().getTime());
        }}
      >
        <fieldset disabled={disabled}>
          <legend>Transfer and recipient details</legend>
          <div className="field">
            <label htmlFor={`${prefix}-reference`}>Bank transfer reference</label>
            <input
              className="input"
              id={`${prefix}-reference`}
              name="reference"
              required
              minLength={3}
              maxLength={160}
            />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-at`}>Transfer time (Lagos time)</label>
            <input
              className="input"
              id={`${prefix}-at`}
              name="at"
              type="datetime-local"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-bank`}>Recipient bank</label>
            <input
              className="input"
              id={`${prefix}-bank`}
              name="bank"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-name`}>Recipient account name</label>
            <input
              className="input"
              id={`${prefix}-name`}
              name="name"
              required
              minLength={2}
              maxLength={160}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-account`}>Recipient account number</label>
            <input
              className="input"
              id={`${prefix}-account`}
              name="account"
              required
              inputMode="numeric"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              autoComplete="off"
            />
          </div>
          <FileUpload
            uploadId={`${prefix}-evidence`}
            label="Bank transfer evidence"
            hint="PDF, JPEG or PNG, up to 10 MiB. This document is private."
            accept="application/pdf,image/jpeg,image/png"
            disabled={disabled}
            onChange={setEvidence}
            validate={validatePaymentEvidence}
            prepare={(options) =>
              prepareRefundEvidence({ ...options, refundId: refund.id })
            }
          />
          <button className="button secondary">Review transfer record</button>
        </fieldset>
      </form>
    </section>
  );
}
