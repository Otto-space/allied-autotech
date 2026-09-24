"use client";
import { useEffect, useRef, useState } from "react";
import type { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  refundActionSchema,
  refundEvidenceSchema,
  type ProcessingRefund,
} from "@/lib/api/refund-processing";
import { trustedAssetUrl } from "@/lib/assets";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAssetStorageHosts } from "./asset-storage-context";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
export function RefundEvidenceCheck({
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
  const [evidence, setEvidence] = useState<z.infer<typeof refundEvidenceSchema>>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const hosts = useAssetStorageHosts();
  useEffect(() => () => pending.current?.abort(), []);
  const prefix = `check-${refund.id}`;
  async function access() {
    if (disabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setEvidence(undefined);
    try {
      const saved = refundEvidenceSchema.parse(
        (
          await apiRequest(`/staff/refunds/${refund.id}/evidence-access`, {
            method: "POST",
            csrf: true,
            body: {},
            signal: controller.signal,
          })
        ).data,
      );
      if (
        saved.id !== refund.id ||
        saved.amountKobo !== refund.amountKobo ||
        Date.parse(saved.transferredAt) !== Date.parse(refund.bankTransferAt ?? "")
      )
        throw new Error("Unexpected refund evidence");
      const url = trustedAssetUrl(saved.url, hosts, window.location.origin);
      if (!controller.signal.aborted) setEvidence({ ...saved, url });
    } catch (value) {
      if (!controller.signal.aborted)
        setError(
          value instanceof ApiError
            ? value.message
            : "The private refund evidence could not be verified. Refresh the record before checking it.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function review(form: FormData) {
    if (disabled || busy || !evidence) return;
    const decision = String(form.get("decision") ?? ""),
      note = String(form.get("note") ?? "").trim();
    if (
      !["ACCEPT", "DISPUTE"].includes(decision) ||
      form.get("checked") !== "on" ||
      note.length < 10 ||
      note.length > 1000
    ) {
      setError(
        "Choose an outcome, confirm your evidence review and explain it in 10-1,000 characters.",
      );
      return;
    }
    const body: RequestBody<"/staff/refunds/{refundId}/check", "post"> = {
      accepted: decision === "ACCEPT",
      evidenceChecked: true,
      note,
    };
    setError(undefined);
    onReview({
      title: body.accepted
        ? "Confirm this refund was completed?"
        : "Dispute this transfer evidence?",
      description: body.accepted
        ? "Your independent check will record the refund as completed and create its accounting entry. Verify the amount, recipient, bank reference and private evidence first."
        : "The refund will require attention. This does not authorize another transfer or replace the original evidence.",
      facts: [
        { label: "Refund", value: refund.refundNumber },
        { label: "Amount", value: formatKobo(refund.amountKobo) },
        { label: "Recipient", value: evidence.beneficiary.accountName },
        { label: "Account", value: evidence.beneficiary.accountNumber },
        { label: "Bank reference", value: evidence.bankReference },
        {
          label: "Outcome",
          value: body.accepted ? "Completed transfer verified" : "Evidence disputed",
        },
        { label: "Check note", value: note },
      ],
      onUncertain,
      retryAfterRejection: false,
      submit: async () => {
        const saved = refundActionSchema.parse(
          (
            await apiRequest(`/staff/refunds/${refund.id}/check`, {
              method: "POST",
              csrf: true,
              body,
            })
          ).data,
        );
        if (
          saved.id !== refund.id ||
          saved.amountKobo !== refund.amountKobo ||
          saved.status !== (body.accepted ? "SUCCEEDED" : "NEEDS_ATTENTION") ||
          saved.checkedByUserId !== actorId ||
          !saved.checkedAt ||
          saved.bankReference !== evidence.bankReference ||
          saved.transferredByUserId !== refund.transferredByUserId ||
          !saved.transferredAt ||
          Date.parse(saved.transferredAt) !== Date.parse(evidence.transferredAt)
        )
          throw new Error("Unexpected refund check result");
      },
    });
  }
  return (
    <section className="detail-section aftercare-record">
      <h3>Independent transfer check</h3>
      <p>
        Compare the private evidence with the recorded recipient and approved amount. You
        must be a different person from the requester, approver and transfer operator.
      </p>
      <Feedback message={error} />
      <button
        className="button secondary"
        disabled={disabled || busy}
        onClick={() => void access()}
      >
        {busy ? "Checking evidence..." : "Load private transfer evidence"}
      </button>
      {evidence && (
        <>
          <dl className="totals">
            <dt>Recipient bank</dt>
            <dd>{evidence.beneficiary.bankName}</dd>
            <dt>Recipient</dt>
            <dd>{evidence.beneficiary.accountName}</dd>
            <dt>Account number</dt>
            <dd>{evidence.beneficiary.accountNumber}</dd>
            <dt>Amount</dt>
            <dd>{formatKobo(evidence.amountKobo)}</dd>
            <dt>Bank reference</dt>
            <dd>{evidence.bankReference}</dd>
            <dt>Transferred</dt>
            <dd>{formatBusinessDate(evidence.transferredAt)}</dd>
          </dl>
          <p>
            <a
              className="text-link"
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Open private evidence in a new tab
            </a>
          </p>
          <p className="field-hint">
            The document link is temporary. Load the evidence again if it expires.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              review(new FormData(event.currentTarget));
            }}
          >
            <fieldset disabled={disabled || busy}>
              <legend>Independent check result</legend>
              <label className="check-label" htmlFor={`${prefix}-checked`}>
                <input id={`${prefix}-checked`} type="checkbox" name="checked" required />
                I reviewed the evidence, recipient, amount and bank reference.
              </label>
              <div className="field">
                <label htmlFor={`${prefix}-decision`}>Check outcome</label>
                <select
                  id={`${prefix}-decision`}
                  name="decision"
                  required
                  defaultValue=""
                >
                  <option value="">Choose outcome</option>
                  <option value="ACCEPT">Transfer completed and verified</option>
                  <option value="DISPUTE">Evidence needs further investigation</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${prefix}-note`}>Independent check note</label>
                <textarea
                  id={`${prefix}-note`}
                  name="note"
                  required
                  minLength={10}
                  maxLength={1000}
                />
              </div>
              <button className="button secondary">Review independent check</button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}
