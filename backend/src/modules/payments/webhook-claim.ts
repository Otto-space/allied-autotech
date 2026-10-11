import type { Prisma } from "../../generated/prisma/client.js";

export interface WebhookClaim {
  id: string;
  processingAttempts: number;
  status: "RECEIVED" | "PROCESSING";
}

export class LostWebhookClaim extends Error {
  constructor() {
    super("Webhook processing was superseded");
  }
}

// Financial callers must use their transaction: losing the queue claim then
// rolls back its payment, refund, dispute, ledger and audit writes together.
export async function writeWebhookResult(
  database: Pick<Prisma.TransactionClient, "paymentWebhookEvent">,
  claim: WebhookClaim,
  data: Prisma.PaymentWebhookEventUncheckedUpdateManyInput,
): Promise<void> {
  const processed = data.status === "PROCESSED";
  const terminal = data.status === "FAILED" && claim.processingAttempts >= 8;
  const changed = await database.paymentWebhookEvent.updateMany({
    where: claim,
    data: {
      ...data,
      lockedAt: null,
      ...(processed
        ? {
            nextAttemptAt: null,
            failedAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            // Ingress has not claimed an attempt; the retry worker already has.
            ...(claim.status === "RECEIVED"
              ? { processingAttempts: { increment: 1 } }
              : {}),
          }
        : {}),
      ...(data.status === "FAILED" ? { failedAt: data.failedAt ?? new Date() } : {}),
      ...(terminal ? { status: "DEAD_LETTER", nextAttemptAt: null } : {}),
    },
  });
  if (changed.count !== 1) throw new LostWebhookClaim();
}
