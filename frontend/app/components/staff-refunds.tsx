"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseRefunds,
  refundMessages,
  refundStatuses,
} from "@/lib/api/staff-payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { RefundDecisionForm } from "./refund-decision-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffRefunds() {
  const session = useAccountSession();
  const allowed = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const refunds = useResource(
    allowed
      ? `/admin/operations/payment-refunds?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseRefunds,
  );
  const disabled = refunds.loading || !!refunds.error || !!proposal;
  if (!allowed)
    return (
      <>
        <h1>Refund requests</h1>
        <Feedback message="Administrator access is required to review refund requests." />
      </>
    );
  return (
    <>
      <h1>Refund requests</h1>
      <p className="lead">
        Review requested refunds and follow their recorded processing state. Approval and
        completed refunds are separate states.
      </p>
      <Link className="text-link" href="/admin/payments">
        View payment records
      </Link>
      <div className="field">
        <label htmlFor="refund-status">Refund status filter</label>
        <select
          id="refund-status"
          value={status}
          disabled={!!proposal}
          onChange={(event) => {
            setStatus(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All statuses</option>
          {refundStatuses.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <Feedback message={refunds.error} />
      <Feedback message={message} tone="info" />
      <button
        className="button secondary"
        disabled={refunds.loading || !!proposal}
        onClick={refunds.refresh}
      >
        Refresh refund records
      </button>
      {refunds.loading && <p role="status">Checking refund records…</p>}
      {!refunds.loading && !refunds.error && !refunds.data?.items.length && (
        <div className="empty">
          <h2>
            {status ? "No refunds match this status" : "No refund records on this page"}
          </h2>
          {status && (
            <button
              className="button secondary"
              onClick={() => {
                setStatus("");
                pagination.reset();
              }}
            >
              Clear refund filter
            </button>
          )}
        </div>
      )}
      {refunds.data?.items.map((refund) => (
        <section
          className="detail-section"
          key={refund.id}
          aria-labelledby={`refund-heading-${refund.id}`}
        >
          <h2 id={`refund-heading-${refund.id}`}>{refund.refundNumber}</h2>
          <p className="price">{formatKobo(refund.amountKobo)}</p>
          <p className="status">{refund.status.replaceAll("_", " ")}</p>
          <p className="notice">{refundMessages[refund.status]}</p>
          <dl className="totals">
            <dt>Reason</dt>
            <dd>{refund.reason}</dd>
            <dt>Requested</dt>
            <dd>{formatBusinessDate(refund.requestedAt)}</dd>
            <dt>Payment attempt reference</dt>
            <dd>{refund.paymentAttemptId}</dd>
            {refund.approvedAt && (
              <>
                <dt>Approved</dt>
                <dd>{formatBusinessDate(refund.approvedAt)}</dd>
              </>
            )}
            {refund.processedAt && (
              <>
                <dt>Processed</dt>
                <dd>{formatBusinessDate(refund.processedAt)}</dd>
              </>
            )}
            {refund.failedAt && (
              <>
                <dt>Failed</dt>
                <dd>{formatBusinessDate(refund.failedAt)}</dd>
              </>
            )}
          </dl>
          {refund.status === "REQUESTED" &&
            (refund.requestedByUserId === session?.user.id ? (
              <p className="notice">
                You requested this refund. A different administrator must approve or
                cancel it.
              </p>
            ) : (
              <RefundDecisionForm
                refund={refund}
                disabled={disabled}
                uncertain={!!uncertain[refund.id]}
                onUncertain={() =>
                  setUncertain((current) => ({ ...current, [refund.id]: true }))
                }
                onReview={(next) => {
                  if (!disabled) {
                    setMessage(undefined);
                    setProposal(next);
                  }
                }}
              />
            ))}
        </section>
      ))}
      <CursorPagination
        pagination={pagination}
        nextCursor={refunds.data?.nextCursor}
        disabled={disabled}
        label="Refund requests"
      />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            refunds.refresh();
          }}
          onSuccess={() =>
            setMessage(
              "Refund decision recorded. Review its refreshed processing status; approval alone is not confirmation of returned funds.",
            )
          }
        />
      )}
    </>
  );
}
