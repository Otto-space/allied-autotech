"use client";
import Link from "next/link";
import { useAccountSession } from "./dashboard-shell";
import {
  disputeCategories,
  disputeStatuses,
  parseDisputes,
} from "@/lib/api/operations-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { OperationsQueue } from "./operations-queue";
export function PaymentDisputes() {
  const session = useAccountSession();
  return (
    <>
      {(session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN") && (
        <p>
          <Link className="text-link" href="/admin/payment-disputes/work">
            Open dispute work queue
          </Link>
        </p>
      )}
      <OperationsQueue
        title="Payment disputes"
        description="Track recorded disputes and response deadlines. Use the dispute work queue to prepare evidence and record handling. Submit evidence through authorized payment-provider tools; a recorded receipt does not confirm provider acceptance."
        endpoint="/admin/operations/payment-disputes"
        parse={parseDisputes}
        filters={[
          { name: "status", label: "Dispute status", options: disputeStatuses },
          { name: "category", label: "Dispute category", options: disputeCategories },
        ]}
        render={(dispute) => (
          <section
            className="detail-section"
            key={dispute.id}
            aria-labelledby={`dispute-${dispute.id}`}
          >
            <h2 id={`dispute-${dispute.id}`}>
              {dispute.provider} · {dispute.providerDisputeId}
            </h2>
            <p className="price">{formatKobo(dispute.amountKobo)}</p>
            <p className="status">{dispute.status.replaceAll("_", " ")}</p>
            <p>Disputed amount, not a confirmed refund or recovered balance.</p>
            <dl className="totals">
              <dt>Category</dt>
              <dd>{dispute.category.replaceAll("_", " ")}</dd>
              <dt>Dispute reference</dt>
              <dd>{dispute.id}</dd>
              <dt>Payment attempt reference</dt>
              <dd>{dispute.paymentAttemptId}</dd>
              <dt>Opened</dt>
              <dd>{formatBusinessDate(dispute.openedAt)}</dd>
              <dt>Response deadline</dt>
              <dd>
                {dispute.responseDueAt
                  ? formatBusinessDate(dispute.responseDueAt)
                  : "Not recorded"}
              </dd>
              <dt>Evidence recorded</dt>
              <dd>{dispute.hasEvidence ? "Yes" : "No"}</dd>
              {dispute.respondedAt && (
                <>
                  <dt>Response recorded</dt>
                  <dd>{formatBusinessDate(dispute.respondedAt)}</dd>
                </>
              )}
              {dispute.resolvedAt && (
                <>
                  <dt>Resolution recorded</dt>
                  <dd>{formatBusinessDate(dispute.resolvedAt)}</dd>
                </>
              )}
              <dt>Last updated</dt>
              <dd>{formatBusinessDate(dispute.updatedAt)}</dd>
            </dl>
          </section>
        )}
      />
    </>
  );
}
