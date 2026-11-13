import type { Prisma } from "../../generated/prisma/client.js";
import { paymentConflict } from "./payments.errors.js";

/** Private read shape, never a customer response. A financial resolution needs
 * actual independently checked/provider-verified money AND its canonical debit. */
export const refundSettlementSelect = {
  id: true,
  paymentAttemptId: true,
  supplyRemedyChoiceId: true,
  amountKobo: true,
  currency: true,
  status: true,
  authorizationKind: true,
  requestedByUserId: true,
  approvedByUserId: true,
  requestedAt: true,
  approvedAt: true,
  processedAt: true,
  policyVersionId: true,
  policySnapshot: true,
  providerRefundId: true,
  providerStatus: true,
  transferredByUserId: true,
  transferRecordedAt: true,
  bankTransferAt: true,
  bankReference: true,
  evidenceObjectKey: true,
  evidenceSha256: true,
  beneficiaryEncrypted: true,
  checkedByUserId: true,
  checkedAt: true,
  anomalies: { select: { status: true } },
  ledgerEntries: {
    select: {
      id: true,
      refundId: true,
      paymentAttemptId: true,
      disputeId: true,
      sourceKey: true,
      type: true,
      direction: true,
      amountKobo: true,
      currency: true,
      occurredAt: true,
    },
  },
  paymentAttempt: {
    select: {
      id: true,
      paymentId: true,
      provider: true,
      status: true,
      verificationStatus: true,
      amountKobo: true,
      currency: true,
      verifiedAmountKobo: true,
      verifiedCurrency: true,
      paidAt: true,
      verifiedAt: true,
      anomalies: { select: { status: true } },
      disputes: { select: { status: true } },
      payment: {
        select: {
          id: true,
          orderId: true,
          amountKobo: true,
          currency: true,
          anomalies: { select: { status: true } },
        },
      },
    },
  },
} satisfies Prisma.RefundSelect;
export type RefundSettlementEvidence = Prisma.RefundGetPayload<{
  select: typeof refundSettlementSelect;
}>;
function unresolved(): never {
  throw paymentConflict(
    "Verified refund settlement and matching ledger evidence are required. Approval, transfer recording or a processing status is not money returned.",
  );
}
const open = (rows: readonly { status: string }[]) =>
  rows.some((row) => ["OPEN", "INVESTIGATING"].includes(row.status));
function actual(at: Date | null, now: Date): at is Date {
  return !!at && Number.isFinite(at.getTime()) && at <= now;
}

/** Does not authorise a refund, deduct a fee, clear original gross coverage or
 * record physical handover. Callers must still verify current scope and holds. */
export function verifiedOrderRefundSettlement(
  orderId: string,
  expectedKobo: bigint,
  rows: readonly RefundSettlementEvidence[],
  now = new Date(),
) {
  if (
    expectedKobo <= 0n ||
    !Number.isFinite(now.getTime()) ||
    new Set(rows.map((row) => row.id)).size !== rows.length
  )
    unresolved();
  const active = rows.filter((row) => !["FAILED", "CANCELLED"].includes(row.status));
  if (!active.length) unresolved();
  let total = 0n;
  const returnedByAttempt = new Map<string, bigint>();
  const proof = active.map((row) => {
    const attempt = row.paymentAttempt,
      payment = attempt.payment;
    if (
      row.status !== "SUCCEEDED" ||
      row.currency !== "NGN" ||
      row.amountKobo <= 0n ||
      row.amountKobo > attempt.amountKobo ||
      !actual(row.approvedAt, now) ||
      !actual(row.processedAt, now) ||
      row.processedAt < row.approvedAt ||
      attempt.id !== row.paymentAttemptId ||
      payment.id !== attempt.paymentId ||
      payment.orderId !== orderId ||
      attempt.status !== "SUCCESSFUL" ||
      attempt.verificationStatus !== "VERIFIED" ||
      attempt.currency !== "NGN" ||
      attempt.verifiedCurrency !== "NGN" ||
      attempt.verifiedAmountKobo !== attempt.amountKobo ||
      attempt.amountKobo !== payment.amountKobo ||
      payment.currency !== "NGN" ||
      !actual(attempt.paidAt, now) ||
      !actual(attempt.verifiedAt, now) ||
      open(row.anomalies) ||
      open(attempt.anomalies) ||
      open(payment.anomalies) ||
      attempt.disputes.some((dispute) => dispute.status !== "WON")
    )
      unresolved();
    if (row.authorizationKind === "HUMAN") {
      if (
        !row.requestedByUserId ||
        !row.approvedByUserId ||
        row.approvedByUserId === row.requestedByUserId
      )
        unresolved();
    } else if (row.authorizationKind === "SYSTEM_LATE_ORDER") {
      const policy = row.policySnapshot;
      if (
        attempt.provider !== "PAYSTACK" ||
        !row.policyVersionId ||
        !policy ||
        typeof policy !== "object" ||
        Array.isArray(policy) ||
        policy["id"] !== row.policyVersionId ||
        policy["key"] !== "order-payment" ||
        policy["approvalStatus"] !== "APPROVED"
      )
        unresolved();
    } else unresolved();
    if (attempt.provider === "MANUAL") {
      if (
        row.authorizationKind !== "HUMAN" ||
        row.providerStatus !== "BANK_TRANSFER_CHECKED" ||
        !row.transferredByUserId ||
        !row.checkedByUserId ||
        [row.requestedByUserId, row.approvedByUserId].includes(row.transferredByUserId) ||
        [row.requestedByUserId, row.approvedByUserId, row.transferredByUserId].includes(
          row.checkedByUserId,
        ) ||
        !actual(row.bankTransferAt, now) ||
        !actual(row.transferRecordedAt, now) ||
        !actual(row.checkedAt, now) ||
        row.bankTransferAt < row.approvedAt ||
        row.transferRecordedAt < row.bankTransferAt ||
        row.checkedAt < row.transferRecordedAt ||
        row.processedAt < row.checkedAt ||
        !row.bankReference?.trim() ||
        !row.evidenceObjectKey ||
        !row.evidenceSha256?.match(/^[a-f0-9]{64}$/) ||
        !row.beneficiaryEncrypted
      )
        unresolved();
    } else if (!row.providerRefundId?.trim()) unresolved();
    if (row.ledgerEntries.length !== 1) unresolved();
    const ledger = row.ledgerEntries[0]!;
    if (
      ledger.refundId !== row.id ||
      ledger.sourceKey !== `refund:${row.id}` ||
      ledger.type !== "REFUND" ||
      ledger.direction !== "DEBIT" ||
      ledger.amountKobo !== row.amountKobo ||
      ledger.currency !== "NGN" ||
      ledger.disputeId !== null ||
      (ledger.paymentAttemptId !== null && ledger.paymentAttemptId !== attempt.id) ||
      !actual(ledger.occurredAt, now) ||
      ledger.occurredAt < row.approvedAt
    )
      unresolved();
    const cumulative = (returnedByAttempt.get(attempt.id) ?? 0n) + row.amountKobo;
    if (cumulative > attempt.amountKobo) unresolved();
    returnedByAttempt.set(attempt.id, cumulative);
    total += row.amountKobo;
    return {
      refundId: row.id,
      paymentAttemptId: attempt.id,
      ledgerEntryId: ledger.id,
      amountKobo: row.amountKobo.toString(),
      processedAt: row.processedAt.toISOString(),
      source: attempt.provider,
    };
  });
  if (total !== expectedKobo) unresolved();
  return {
    version: "ORDER_REFUND_SETTLEMENT_20261110_V1" as const,
    orderId,
    amountKobo: total.toString(),
    currency: "NGN" as const,
    refunds: proof.sort((a, b) => a.refundId.localeCompare(b.refundId)),
  };
}
