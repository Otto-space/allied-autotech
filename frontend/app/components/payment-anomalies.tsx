"use client";
import Link from "next/link";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  anomalyStatuses,
  anomalyTypes,
  parseAnomalies,
  parseAnomalyChange,
} from "@/lib/api/operations-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { OperationsQueue } from "./operations-queue";
import { OperationActionForm } from "./operation-action-form";
export function PaymentAnomalies() {
  return (
    <OperationsQueue
      title="Payment exceptions"
      description="Investigate mismatches and unexpected payment events. Closing an exception records an operational decision; it does not change payment or refund status."
      endpoint="/admin/operations/payment-anomalies"
      parse={parseAnomalies}
      filters={[
        { name: "status", label: "Exception status", options: anomalyStatuses },
        { name: "type", label: "Exception type", options: anomalyTypes },
      ]}
      render={(anomaly, actions) => (
        <section
          className="detail-section"
          key={anomaly.id}
          aria-labelledby={`anomaly-${anomaly.id}`}
        >
          <h2 id={`anomaly-${anomaly.id}`}>{anomaly.type.replaceAll("_", " ")}</h2>
          <p className="status">{anomaly.status}</p>
          <p>{anomaly.summary}</p>
          <dl className="totals">
            <dt>Exception reference</dt>
            <dd>{anomaly.id}</dd>
            <dt>Detected</dt>
            <dd>{formatBusinessDate(anomaly.detectedAt)}</dd>
            <dt>Last updated</dt>
            <dd>{formatBusinessDate(anomaly.updatedAt)}</dd>
            {anomaly.paymentId && (
              <>
                <dt>Payment reference</dt>
                <dd>{anomaly.paymentId}</dd>
              </>
            )}
            {anomaly.paymentAttemptId && (
              <>
                <dt>Attempt reference</dt>
                <dd>{anomaly.paymentAttemptId}</dd>
              </>
            )}
            {anomaly.refundId && (
              <>
                <dt>Refund reference</dt>
                <dd>{anomaly.refundId}</dd>
              </>
            )}
            {anomaly.disputeId && (
              <>
                <dt>Dispute reference</dt>
                <dd>{anomaly.disputeId}</dd>
              </>
            )}
            {anomaly.resolutionNote && (
              <>
                <dt>Latest investigation note</dt>
                <dd>{anomaly.resolutionNote}</dd>
              </>
            )}
            {anomaly.resolvedAt && (
              <>
                <dt>Closed</dt>
                <dd>{formatBusinessDate(anomaly.resolvedAt)}</dd>
              </>
            )}
          </dl>
          <div className="actions">
            <Link className="text-link" href="/admin/payments">
              Payment records
            </Link>
            {anomaly.refundId && (
              <Link className="text-link" href="/admin/refunds">
                Refund records
              </Link>
            )}
            {anomaly.disputeId && (
              <Link className="text-link" href="/admin/payment-disputes">
                Dispute records
              </Link>
            )}
          </div>
          {(anomaly.status === "OPEN" || anomaly.status === "INVESTIGATING") && (
            <OperationActionForm
              id={anomaly.id}
              revision={anomaly.status}
              label="Exception update"
              options={
                anomaly.status === "OPEN" ? ["INVESTIGATING"] : ["RESOLVED", "IGNORED"]
              }
              maxLength={2000}
              disabled={actions.disabled}
              uncertain={actions.uncertain(anomaly.id)}
              onReview={(proposal) => actions.review(anomaly.id, proposal)}
              proposal={(values) => {
                if (anomaly.status !== "OPEN" && anomaly.status !== "INVESTIGATING")
                  throw new Error("Exception is already closed.");
                const status =
                  values.status === "INVESTIGATING"
                    ? "INVESTIGATING"
                    : values.status === "RESOLVED"
                      ? "RESOLVED"
                      : "IGNORED";
                const body: RequestBody<
                  "/admin/operations/payment-anomalies/{anomalyId}/status",
                  "post"
                > = {
                  expectedStatus: anomaly.status,
                  status,
                  resolutionNote: values.reason,
                };
                return {
                  title:
                    status === "INVESTIGATING"
                      ? "Start this investigation?"
                      : "Close this payment exception?",
                  description:
                    "This records the exception's investigation state and note. It does not verify a payment, return funds or settle a dispute. Closed exceptions cannot be reopened through this screen.",
                  facts: [
                    { label: "Exception", value: anomaly.id },
                    { label: "Summary", value: anomaly.summary },
                    { label: "Current status", value: anomaly.status },
                    { label: "New status", value: status },
                    { label: "Note", value: values.reason },
                  ],
                  submit: () =>
                    apiRequest(
                      `/admin/operations/payment-anomalies/${anomaly.id}/status`,
                      { method: "POST", csrf: true, body },
                    ).then((result) => parseAnomalyChange(result.data)),
                };
              }}
            />
          )}
        </section>
      )}
    />
  );
}
