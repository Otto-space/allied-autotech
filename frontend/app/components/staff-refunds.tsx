"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { refundMessages, refundStatuses } from "@/lib/api/staff-payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { RefundDecisionForm } from "./refund-decision-form";
import { parseProcessingRefunds } from "@/lib/api/refund-processing";
import { RefundTransferForm } from "./refund-transfer-form";
import { RefundEvidenceCheck } from "./refund-evidence-check";
import { MutationReview, type MutationProposal } from "./mutation-review";
export function StaffRefunds() {
  const session = useAccountSession();
  const administrator =
    session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const permission = useOwnStaffPermissions();
  const verified =
    !permission.loading &&
    !permission.error &&
    permission.data?.id === session?.user.id &&
    permission.data?.role === session?.user.role &&
    permission.data?.status === "ACTIVE";
  const grants = verified ? permission.data!.capabilities : [];
  const canApprove = grants.includes("REFUND_APPROVE"),
    canTransfer = grants.includes("REFUND_TRANSFER"),
    canCheck = grants.includes("REFUND_CHECK");
  const allowed = administrator || canApprove || canTransfer || canCheck;
  const [status, setStatus] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const attempted = useRef(false);
  const [selected, setSelected] = useState<string>();
  const refunds = useResource(
    allowed
      ? `/${administrator ? "admin/operations/payment-refunds" : "staff/refunds"}?limit=25${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`
      : null,
    parseProcessingRefunds,
  );
  const disabled = refunds.loading || !!refunds.error || !!proposal;
  if (!allowed)
    return (
      <>
        <h1>Refund requests</h1>
        {permission.loading ? (
          <p role="status">Checking refund permissions...</p>
        ) : (
          <Feedback
            message={
              permission.error ??
              "An active refund approval, transfer or checking permission is required."
            }
          />
        )}
        <button
          className="button secondary"
          onClick={permission.refresh}
          disabled={permission.loading}
        >
          Refresh refund permissions
        </button>
      </>
    );
  function review(next: MutationProposal) {
    if (disabled || !verified) return;
    setMessage(undefined);
    setProposal({
      ...next,
      submit: async () => {
        attempted.current = true;
        return next.submit();
      },
    });
  }
  return (
    <>
      <h1>Refund requests</h1>
      <p className="lead">
        Review requested refunds and follow their recorded processing state. Approval and
        completed refunds are separate states.
      </p>
      {administrator && (
        <Link className="text-link" href="/admin/payments">
          View payment records
        </Link>
      )}
      <Feedback message={permission.error} />
      <button
        className="button secondary"
        onClick={permission.refresh}
        disabled={permission.loading || !!proposal}
      >
        Refresh refund permissions
      </button>
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
      <Feedback
        message={message}
        tone="info"
        toast="Refund update recorded. Review the details."
      />
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
      {!refunds.error &&
        refunds.data?.items.map((refund) => (
          <section
            className="detail-section aftercare-record"
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
            <p>
              Method:{" "}
              {refund.paymentAttempt.provider === "MANUAL"
                ? "Bank transfer"
                : refund.paymentAttempt.provider}
              .{" "}
              {refund.authorizationKind === "HUMAN"
                ? "Human-reviewed refund."
                : "Automatic policy-authorized reversal."}
            </p>
            <p>
              {refund.dueAt
                ? `Recorded refund deadline: ${formatBusinessDate(refund.dueAt)}`
                : "No refund deadline is recorded."}
            </p>
            {uncertain[refund.id] && (
              <Feedback
                tone="warning"
                message="The outcome of a refund change is uncertain. Refresh and reconcile the record before reloading to make another change."
              />
            )}
            {(canApprove || canTransfer || canCheck) && (
              <button
                className="button secondary"
                disabled={disabled}
                aria-expanded={selected === refund.id}
                onClick={() =>
                  setSelected(selected === refund.id ? undefined : refund.id)
                }
              >
                Review refund actions
              </button>
            )}
            {selected === refund.id && verified && (
              <div key={`${refund.id}:${refund.status}:${refund.updatedAt}`}>
                {refund.status === "REQUESTED" &&
                  (canApprove && refund.requestedByUserId !== session?.user.id ? (
                    <RefundDecisionForm
                      refund={refund}
                      actorId={session!.user.id}
                      disabled={disabled}
                      uncertain={!!uncertain[refund.id]}
                      onUncertain={() =>
                        setUncertain((current) => ({ ...current, [refund.id]: true }))
                      }
                      onReview={review}
                    />
                  ) : (
                    <p>
                      An authorized operator other than the requester must approve or
                      cancel this refund.
                    </p>
                  ))}
                {refund.paymentAttempt.provider === "MANUAL" &&
                  refund.authorizationKind === "HUMAN" &&
                  !!refund.approvedAt &&
                  !refund.transferredByUserId &&
                  ["APPROVED", "NEEDS_ATTENTION"].includes(refund.status) &&
                  (canTransfer &&
                  ![refund.requestedByUserId, refund.approvedByUserId].includes(
                    session!.user.id,
                  ) ? (
                    <RefundTransferForm
                      refund={refund}
                      actorId={session!.user.id}
                      disabled={disabled || !!uncertain[refund.id]}
                      onUncertain={() =>
                        setUncertain((current) => ({ ...current, [refund.id]: true }))
                      }
                      onReview={review}
                    />
                  ) : (
                    <p>
                      An authorized transfer operator other than the requester and
                      approver must record the bank transfer.
                    </p>
                  ))}
                {refund.transferredByUserId &&
                  ["PROCESSING", "NEEDS_ATTENTION"].includes(refund.status) &&
                  (canCheck &&
                  ![
                    refund.requestedByUserId,
                    refund.approvedByUserId,
                    refund.transferredByUserId,
                  ].includes(session!.user.id) ? (
                    <RefundEvidenceCheck
                      refund={refund}
                      actorId={session!.user.id}
                      disabled={disabled || !!uncertain[refund.id]}
                      onUncertain={() =>
                        setUncertain((current) => ({ ...current, [refund.id]: true }))
                      }
                      onReview={review}
                    />
                  ) : (
                    <p>An independent authorized checker must verify this transfer.</p>
                  ))}
                {["SUCCEEDED", "CANCELLED", "FAILED"].includes(refund.status) && (
                  <p>No further action is available for this refund here.</p>
                )}
              </div>
            )}
          </section>
        ))}
      <CursorPagination
        pagination={pagination}
        nextCursor={refunds.data?.nextCursor}
        disabled={disabled}
        label="Refund requests"
      />
      {proposal && verified && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            if (attempted.current) refunds.refresh();
            attempted.current = false;
          }}
          onSuccess={() =>
            setMessage(
              "Refund action recorded. Review the refreshed status; approval or a transfer record alone does not confirm completion.",
            )
          }
        />
      )}
    </>
  );
}
