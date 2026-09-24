import { prisma } from "../config/database.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import {
  paymentProviders,
  PaymentProviderRegistry,
  type OnlinePaymentProvider,
} from "../providers/payments/payment-provider.registry.js";

/** Claim commits before submission. A lost response is reconciled, never re-submitted. */
export class RefundWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly providers: PaymentProviderRegistry = paymentProviders,
  ) {}

  async runOnce(batchSize = 25, refundId?: string) {
    const limit = Math.max(1, Math.min(batchSize, 100));
    // A dispute arriving after refund approval must be reconciled before dispatch.
    await this.database.refund.updateMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: "APPROVED",
        submissionStartedAt: null,
        paymentAttempt: { disputes: { some: { status: { not: "WON" } } } },
      },
      data: {
        status: "NEEDS_ATTENTION",
        providerStatus: "DISPUTE_REVIEW_REQUIRED",
        failureMessage:
          "Reconcile the dispute and any chargeback before issuing this refund",
      },
    });
    const claimed = await this.database.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      WITH candidates AS (
        SELECT r."id" FROM "Refund" r JOIN "PaymentAttempt" a ON a."id" = r."paymentAttemptId"
        WHERE r."status" = 'APPROVED' AND r."submissionStartedAt" IS NULL AND a."provider" <> 'MANUAL'
          AND (${refundId ?? null}::uuid IS NULL OR r."id" = ${refundId ?? null}::uuid)
          AND NOT EXISTS (SELECT 1 FROM "PaymentDispute" d WHERE d."paymentAttemptId" = a."id" AND d."status" <> 'WON')
        ORDER BY r."createdAt", r."id" FOR UPDATE OF r SKIP LOCKED LIMIT ${limit}
      ) UPDATE "Refund" r SET "submissionStartedAt" = CURRENT_TIMESTAMP,
          "status" = 'PROCESSING', "providerStatus" = 'SUBMISSION_STARTED', "updatedAt" = CURRENT_TIMESTAMP,
          "nextReconcileAt" = CURRENT_TIMESTAMP + INTERVAL '10 minutes'
        FROM candidates c WHERE r."id" = c."id" RETURNING r."id"
    `);
    for (const { id } of claimed) {
      const refund = await this.database.refund.findUniqueOrThrow({
        where: { id },
        include: { paymentAttempt: true },
      });
      try {
        if (!refund.paymentAttempt.gatewayTransactionId)
          throw new Error("Missing captured transaction identity");
        const result = await this.providers
          .get(refund.paymentAttempt.provider as OnlinePaymentProvider)
          .refund({
            gatewayTransactionId: refund.paymentAttempt.gatewayTransactionId,
            amountKobo: refund.amountKobo,
            currency: "NGN",
            refundReference: refund.refundNumber,
            reason: refund.reason,
            customerNote: "Allied AutoTech refund",
          });
        await this.database.refund.updateMany({
          where: { id, status: "PROCESSING", providerRefundId: null },
          data: {
            status: "PENDING",
            providerRefundId: result.providerRefundId,
            providerStatus: result.status,
            nextReconcileAt: new Date(Date.now() + 60_000),
          },
        });
      } catch {
        await this.database.refund.updateMany({
          where: { id, status: "PROCESSING", providerRefundId: null },
          data: {
            status: "NEEDS_ATTENTION",
            providerStatus: "PROVIDER_SUBMISSION_UNCONFIRMED",
            failureMessage:
              "Reconcile the original provider submission; do not create another refund",
            nextReconcileAt: null,
          },
        });
      }
    }
    // Recovery after crash between committed claim and provider response. No replay of POST /refund.
    await this.database.refund.updateMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: "PROCESSING",
        providerRefundId: null,
        nextReconcileAt: { lte: new Date() },
      },
      data: {
        status: "NEEDS_ATTENTION",
        providerStatus: "PROVIDER_SUBMISSION_UNCONFIRMED",
        nextReconcileAt: null,
        failureMessage:
          "Worker stopped during submission; provider reconciliation required before further money movement",
      },
    });
    const pending = await this.database.refund.findMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: { in: ["PENDING", "PROCESSING"] },
        providerRefundId: { not: null },
        nextReconcileAt: { lte: new Date() },
      },
      include: { paymentAttempt: true },
      take: limit,
      orderBy: { nextReconcileAt: "asc" },
    });
    for (const refund of pending) {
      try {
        const provider = this.providers.get(
          refund.paymentAttempt.provider as OnlinePaymentProvider,
        );
        if (!provider.verifyRefund) throw new Error("Refund reconciliation unsupported");
        const result = await provider.verifyRefund(refund.providerRefundId!);
        await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refund.id}::uuid FOR UPDATE`;
          const current = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
          if (current.status === "SUCCEEDED") return;
          const exact =
            result.providerRefundId === current.providerRefundId &&
            result.amountKobo === current.amountKobo &&
            result.currency === current.currency;
          if (!exact) {
            await tx.refund.update({
              where: { id: refund.id },
              data: {
                status: "NEEDS_ATTENTION",
                providerStatus: "RECONCILIATION_MISMATCH",
                nextReconcileAt: null,
              },
            });
            return;
          }
          await tx.refund.update({
            where: { id: refund.id },
            data: {
              status:
                result.status === "succeeded"
                  ? "SUCCEEDED"
                  : result.status === "failed"
                    ? "NEEDS_ATTENTION"
                    : "PENDING",
              providerStatus: result.status,
              reconciliationFailures: 0,
              ...(result.status === "succeeded"
                ? { processedAt: new Date(), nextReconcileAt: null }
                : { nextReconcileAt: new Date(Date.now() + 300_000) }),
            },
          });
          if (result.status === "succeeded")
            await tx.paymentLedgerEntry.upsert({
              where: { sourceKey: `refund:${refund.id}` },
              update: {},
              create: {
                refundId: refund.id,
                sourceKey: `refund:${refund.id}`,
                type: "REFUND",
                direction: "DEBIT",
                amountKobo: refund.amountKobo,
                currency: refund.currency,
                occurredAt: new Date(),
              },
            });
        });
      } catch {
        await this.database.refund.updateMany({
          where: { id: refund.id, status: { in: ["PENDING", "PROCESSING"] } },
          data: {
            reconciliationFailures: { increment: 1 },
            ...(refund.reconciliationFailures >= 7
              ? { status: "NEEDS_ATTENTION", nextReconcileAt: null }
              : {
                  nextReconcileAt: new Date(
                    Date.now() +
                      Math.min(3_600_000, 60_000 * 2 ** refund.reconciliationFailures),
                  ),
                }),
            failureMessage:
              "Provider refund reconciliation unavailable; original refund retained, no money movement retried",
          },
        });
      }
    }
    return { submitted: claimed.length, reconciled: pending.length };
  }
}
