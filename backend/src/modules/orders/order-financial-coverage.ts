import type { Prisma } from "../../generated/prisma/client.js";
import { confirmedReceipt, receiptPaymentSelect } from "../billing/documents.service.js";
import { orderConflict } from "./orders.errors.js";

export type ResolvedOrderRefund = {
  refundId: string;
  paymentAttemptId: string;
  amountKobo: string;
};

/** Caller holds the actual Order lock and has revalidated every supplied refund.
 * Gross receipts remain the original contract amount; only exact settled refunds
 * are removed from net coverage. Unknown money, busy proof and disputes stay held. */
export async function orderFinancialCoverage(
  tx: Prisma.TransactionClient,
  order: { id: string; currency: string; totalKobo: bigint },
  resolved: readonly ResolvedOrderRefund[] = [],
) {
  function reject(): never {
    throw orderConflict(
      "Reconcile verified original receipts, resolved refunds and pending financial evidence before fulfilment.",
    );
  }
  if (order.currency !== "NGN" || order.totalKobo <= 0n) reject();
  const approved = new Map(resolved.map((refund) => [refund.refundId, refund]));
  if (approved.size !== resolved.length) reject();
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId"
    WHERE p."orderId"=${order.id}::uuid ORDER BY a."id" FOR SHARE OF a,p SKIP LOCKED`;
  const lockedIds = new Set(locked.map((row) => row.id));
  const payments = await tx.payment.findMany({
    where: { orderId: order.id },
    orderBy: { id: "asc" },
    select: {
      ...receiptPaymentSelect,
      anomalies: { select: { status: true } },
      attempts: {
        select: {
          id: true,
          status: true,
          anomalies: { select: { status: true } },
          disputes: { select: { status: true } },
          refunds: {
            select: {
              id: true,
              status: true,
              amountKobo: true,
              anomalies: { select: { status: true } },
            },
          },
        },
      },
      settledAttempt: {
        select: {
          ...receiptPaymentSelect.settledAttempt.select,
          id: true,
          refunds: {
            select: {
              id: true,
              status: true,
              amountKobo: true,
              anomalies: { select: { status: true } },
            },
          },
        },
      },
    },
  });
  const open = (rows: readonly { status: string }[]) =>
    rows.some((row) => ["OPEN", "INVESTIGATING"].includes(row.status));
  const seen = new Set<string>();
  for (const payment of payments) {
    if (
      ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"].includes(payment.status) ||
      open(payment.anomalies)
    )
      reject();
    for (const attempt of payment.attempts) {
      if (
        !lockedIds.has(attempt.id) ||
        open(attempt.anomalies) ||
        attempt.disputes.some((row) => row.status !== "WON") ||
        (attempt.status === "SUCCESSFUL"
          ? attempt.id !== payment.settledAttempt?.id
          : !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status))
      )
        reject();
      for (const refund of attempt.refunds) {
        if (open(refund.anomalies)) reject();
        if (["FAILED", "CANCELLED"].includes(refund.status)) continue;
        const proof = approved.get(refund.id);
        if (
          refund.status !== "SUCCEEDED" ||
          !proof ||
          proof.paymentAttemptId !== attempt.id ||
          proof.amountKobo !== refund.amountKobo.toString() ||
          attempt.id !== payment.settledAttempt?.id
        )
          reject();
        seen.add(refund.id);
      }
    }
  }
  if (seen.size !== approved.size) reject();
  const cleared = payments.filter((payment) => payment.status === "SUCCEEDED");
  if (!cleared.length) reject();
  let gross = 0n,
    returned = 0n;
  const proof = cleared.map((payment) => {
    const receipt = confirmedReceipt({
      ...payment,
      settledAttempt: payment.settledAttempt && {
        ...payment.settledAttempt,
        refunds: payment.settledAttempt.refunds.filter(
          (row) => row.status === "SUCCEEDED",
        ),
      },
    });
    if (
      !receipt ||
      payment.invoiceId ||
      payment.bookingId ||
      payment.vehicleTransactionId
    )
      reject();
    gross += payment.amountKobo;
    returned += BigInt(receipt.refundedKobo);
    return {
      id: payment.id,
      settledAttemptId: payment.settledAttempt!.id,
      amountKobo: payment.amountKobo.toString(),
      refundedKobo: receipt.refundedKobo,
      confirmedAt: receipt.confirmedAt,
    };
  });
  const expectedRefund = resolved.reduce((sum, row) => sum + BigInt(row.amountKobo), 0n);
  if (gross !== order.totalKobo || returned !== expectedRefund || returned > gross)
    reject();
  return {
    originalKobo: gross.toString(),
    refundedKobo: returned.toString(),
    // Net retained original receipt coverage, including goods already collected.
    // This is never a new balance due or a replacement-order payment credit.
    remainingKobo: (gross - returned).toString(),
    payments: proof,
  };
}
