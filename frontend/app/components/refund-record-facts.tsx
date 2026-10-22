import { WorkflowProgress } from "./status-progress";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  refundStatusLabels,
  type WorkRefund,
  type CurrentRefund,
} from "@/lib/admin/work-refunds";
export function RefundBadge({ status }: { status: WorkRefund["status"] }) {
  return (
    <span data-status={status} className={`wr-status wr-status-${status.toLowerCase()}`}>
      {refundStatusLabels[status]}
    </span>
  );
}
export function RefundFacts({
  row,
  expanded = false,
  onOpenChange,
}: {
  row: WorkRefund | CurrentRefund;
  expanded?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const instant = (v: string | null) => (v ? formatStockInstant(v) : "Not recorded");
  return (
    <details
      className="wr-facts"
      open={expanded || undefined}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary>Full lifecycle and references</summary>
      <WorkflowProgress workflow="refund" status={row.status} />
      <dl>
        {[
          ["Refund reference", row.id],
          ["Payment attempt reference", row.paymentAttemptId],
          ["Requested", instant(row.requestedAt)],
          ["Updated", instant(row.updatedAt)],
          ["Approved", instant(row.approvedAt)],
          ["Transfer recorded", instant(row.transferRecordedAt)],
          ["Bank transfer time", instant(row.bankTransferAt)],
          ["Independently checked", instant(row.checkedAt)],
          ["Processed", instant(row.processedAt)],
          ["Failed", instant(row.failedAt)],
          ...("cancelledAt" in row ? [["Cancelled", instant(row.cancelledAt)]] : []),
          ["Refund amount", `${formatKobo(row.amountKobo)} · NGN`],
          [
            "Method",
            row.paymentAttempt.provider === "MANUAL"
              ? "Bank transfer"
              : row.paymentAttempt.provider,
          ],
          [
            "Authorization",
            row.authorizationKind === "HUMAN"
              ? "Human-reviewed refund"
              : "Automatic policy-authorized reversal",
          ],
          ["Refund deadline", row.dueAt ? instant(row.dueAt) : "Not recorded"],
          ["Clock status", row.clockStatus.replaceAll("_", " ")],
          ["Provider status", row.providerStatus?.replaceAll("_", " ") ?? "Not recorded"],
          ["Provider refund reference", row.providerRefundId ?? "Not recorded"],
          ["Failure code", row.failureCode ?? "Not recorded"],
          ["Policy version reference", row.policyVersionId ?? "Not recorded"],
          ["Requester reference", row.requestedByUserId ?? "System-authorized"],
          ["Approver reference", row.approvedByUserId ?? "Not recorded"],
          ["Transfer operator reference", row.transferredByUserId ?? "Not recorded"],
          ["Checker reference", row.checkedByUserId ?? "Not recorded"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {"cancellationNote" in row && row.status === "CANCELLED" && (
        <div className="wr-cancellation">
          <h3>Recorded cancellation note</h3>
          <p>
            {row.cancellationNote ??
              "A cancellation note is not available in this safe record. Earlier cancellations may not include a verified note."}
          </p>
        </div>
      )}
    </details>
  );
}
