import { createHash } from "node:crypto";
import type { Prisma, PaymentProvider } from "../../generated/prisma/client.js";
import type { VerifiedPayment } from "../../providers/payments/payment-provider.port.js";

/** Only the provider-verification path calls this, with the attempt row locked.
 * Keep observations independent of mutable attempt status and immutable captures.
 * Repeated identical observations reuse their evidence; every changed result is
 * appended, including a pending/reversed response after a negative observation. */
export async function recordPaymentAttemptObservation(
  tx: Prisma.TransactionClient,
  attempt: {
    id: string;
    provider: PaymentProvider;
    payment: { orderId: string | null; cancelledAt: Date | null; expiredAt: Date | null };
  },
  result: VerifiedPayment,
) {
  const facts = {
    provider: attempt.provider,
    reference: result.reference,
    gatewayTransactionId: result.gatewayTransactionId,
    status: result.status,
    amountKobo: result.amountKobo.toString(),
    currency: result.currency,
    paidAt: result.paidAt?.toISOString() ?? null,
    providerFeeKobo: result.providerFeeKobo?.toString() ?? null,
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  const latest = await tx.paymentAttemptObservation.findFirst({
    where: { paymentAttemptId: attempt.id },
    orderBy: { sequence: "desc" },
    select: { fingerprint: true, observedAt: true },
  });
  if (latest?.fingerprint === fingerprint) {
    const order =
      attempt.payment.orderId && ["failed", "abandoned"].includes(result.status)
        ? await tx.order.findUnique({
            where: { id: attempt.payment.orderId },
            select: { cancelledAt: true },
          })
        : null;
    const anchor = Math.max(
      order?.cancelledAt?.getTime() ?? 0,
      attempt.payment.cancelledAt?.getTime() ?? 0,
      attempt.payment.expiredAt?.getTime() ?? 0,
    );
    // A fresh query after cancellation is distinct evidence even if its result
    // matches the old pre-cancellation observation.
    if (latest.observedAt.getTime() >= anchor) return;
  }
  await tx.paymentAttemptObservation.create({
    data: {
      ...facts,
      amountKobo: result.amountKobo,
      paidAt: result.paidAt,
      providerFeeKobo: result.providerFeeKobo,
      paymentAttemptId: attempt.id,
      fingerprint,
    },
  });
}
