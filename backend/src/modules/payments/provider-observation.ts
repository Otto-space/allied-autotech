import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import type { VerifiedPayment } from "../../providers/payments/payment-provider.port.js";

export function hasVerificationHold(data: Prisma.JsonValue): boolean {
  return (
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    data["verificationHold"] === true
  );
}

/** Call only while holding the PaymentAttempt row lock in this transaction. */
export async function holdUnallocatableProviderResult(
  tx: Prisma.TransactionClient,
  attempt: { id: string; paymentId: string; redactedGatewayData: Prisma.JsonValue },
  result: VerifiedPayment,
  reason:
    | "REUSED_PROVIDER_TRANSACTION"
    | "UNALLOCATABLE_PROVIDER_RESULT" = "UNALLOCATABLE_PROVIDER_RESULT",
) {
  await recordConflictingProviderFacts(tx, attempt, result, reason);
  if (hasVerificationHold(attempt.redactedGatewayData)) return;
  const metadata =
    attempt.redactedGatewayData !== null &&
    typeof attempt.redactedGatewayData === "object" &&
    !Array.isArray(attempt.redactedGatewayData)
      ? attempt.redactedGatewayData
      : {};
  await tx.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "PROCESSING",
      redactedGatewayData: { ...metadata, verificationHold: true },
    },
  });
  await tx.payment.updateMany({
    where: { id: attempt.paymentId, status: { not: "SUCCEEDED" } },
    data: { status: "REQUIRES_REVIEW", cancelledAt: null, expiredAt: null },
  });
}

export async function recordConflictingProviderFacts(
  tx: Prisma.TransactionClient,
  attempt: { id: string; paymentId: string },
  result: VerifiedPayment,
  reason:
    | "CONFLICTING_PROVIDER_FACTS"
    | "REUSED_PROVIDER_TRANSACTION"
    | "UNALLOCATABLE_PROVIDER_RESULT" = "CONFLICTING_PROVIDER_FACTS",
) {
  const observed = {
    reference: result.reference,
    gatewayTransactionId: result.gatewayTransactionId,
    status: result.status,
    amountKobo: result.amountKobo.toString(),
    currency: result.currency,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ reason, observed }))
    .digest("hex");
  // The attempt row is locked by the caller; concurrent redeliveries cannot
  // create duplicate observations. No immutable capture fact is updated.
  const recorded = await tx.paymentAnomaly.findFirst({
    where: {
      paymentAttemptId: attempt.id,
      type: "OTHER",
      details: { path: ["observationFingerprint"], equals: fingerprint },
    },
    select: { id: true },
  });
  if (!recorded)
    await tx.paymentAnomaly.create({
      data: {
        paymentId: attempt.paymentId,
        paymentAttemptId: attempt.id,
        type: "OTHER",
        summary:
          reason === "REUSED_PROVIDER_TRANSACTION"
            ? "Additional credit blocked: provider transaction identity was already confirmed for another attempt"
            : reason === "CONFLICTING_PROVIDER_FACTS"
              ? "Provider verification conflicts with previously recorded successful payment facts"
              : "Provider verification requires manual reconciliation before funds can be allocated",
        details: { reason, observationFingerprint: fingerprint, observed },
      },
    });
}
