import type { Prisma, Refund } from "../../generated/prisma/client.js";
import type { VerifiedRefund } from "../../providers/payments/payment-provider.port.js";

type RefundIdentity = Pick<
  Refund,
  "id" | "paymentAttemptId" | "providerRefundId" | "amountKobo" | "currency" | "status"
>;

export function refundObservationMatches(
  refund: RefundIdentity,
  result: VerifiedRefund,
): boolean {
  return (
    result.providerRefundId === refund.providerRefundId &&
    result.amountKobo === refund.amountKobo &&
    result.currency === refund.currency
  );
}

/** Caller holds the refund row lock. Keep conflicting facts without rewriting settled money. */
export async function recordRefundObservationConflict(
  tx: Prisma.TransactionClient,
  refund: RefundIdentity,
  result: VerifiedRefund,
  source: "PAYSTACK_WEBHOOK" | "MONNIFY_WEBHOOK" | "RECONCILIATION",
): Promise<void> {
  await tx.paymentAnomaly.create({
    data: {
      refundId: refund.id,
      paymentAttemptId: refund.paymentAttemptId,
      type: "REFUND_MISMATCH",
      summary: "Provider refund observation conflicts with the recorded refund",
      details: {
        source,
        recordedStatus: refund.status,
        observedStatus: result.status,
        expectedAmountKobo: refund.amountKobo.toString(),
        observedAmountKobo: result.amountKobo?.toString() ?? null,
        expectedCurrency: refund.currency,
        observedCurrency: result.currency,
        providerIdentityMatched: result.providerRefundId === refund.providerRefundId,
      },
    },
  });
}
