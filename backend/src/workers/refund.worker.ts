import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import {
  claimRefundSubmission,
  recordRefundSubmission,
} from "../modules/payments/refund-dispatch.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import {
  recordRefundObservationConflict,
  refundObservationMatches,
} from "../modules/payments/refund-observation.js";
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
    const candidates = await this.database.refund.findMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: "APPROVED",
        submissionStartedAt: null,
        providerRefundId: null,
        paymentAttempt: { provider: { not: "MANUAL" } },
      },
      select: { id: true, paymentAttemptId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    let submitted = 0;
    for (const candidate of candidates) {
      const refund = await claimRefundSubmission(this.database, candidate);
      if (!refund) continue;
      const id = refund.id;
      if (refund.nextReconcileAt!.getTime() <= Date.now()) {
        await this.database.refund.updateMany({
          where: {
            id,
            status: "PROCESSING",
            providerRefundId: null,
            submissionStartedAt: refund.submissionStartedAt,
          },
          data: {
            status: "NEEDS_ATTENTION",
            nextReconcileAt: null,
            providerStatus: "DISPATCH_WINDOW_EXPIRED",
            failureMessage:
              "Dispatch authorization expired before sending; review the original refund before further action",
          },
        });
        continue;
      }
      try {
        if (!refund.paymentAttempt.gatewayTransactionId)
          throw new Error("Missing captured transaction identity");
        const provider = this.providers.get(
          refund.paymentAttempt.provider as OnlinePaymentProvider,
        );
        submitted++;
        const result = await provider.refund({
          gatewayTransactionId: refund.paymentAttempt.gatewayTransactionId,
          amountKobo: refund.amountKobo,
          currency: "NGN",
          refundReference: refund.refundNumber,
          reason: refund.reason,
          customerNote: "Allied AutoTech refund",
        });
        await recordRefundSubmission(this.database, refund, result);
      } catch {
        await this.database.refund.updateMany({
          where: {
            id,
            status: "PROCESSING",
            providerRefundId: null,
            submissionStartedAt: refund.submissionStartedAt,
          },
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
    // Older releases could leave exhausted rows pending after overlapping polls.
    // Retain their count and require review without disturbing a live claim.
    await this.database.refund.updateMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: { in: ["PENDING", "PROCESSING"] },
        providerRefundId: { not: null },
        reconciliationFailures: { gte: 8 },
        OR: [
          { reconciliationLeaseUntil: null },
          { reconciliationLeaseUntil: { lte: new Date() } },
        ],
      },
      data: {
        status: "NEEDS_ATTENTION",
        nextReconcileAt: null,
        reconciliationToken: null,
        reconciliationLeaseUntil: null,
        failureMessage:
          "Provider refund reconciliation exhausted; review the original refund before further action",
      },
    });
    const pending = await this.database.refund.findMany({
      where: {
        ...(refundId ? { id: refundId } : {}),
        status: { in: ["PENDING", "PROCESSING"] },
        providerRefundId: { not: null },
        reconciliationFailures: { lt: 8 },
        nextReconcileAt: { lte: new Date() },
        OR: [
          { reconciliationLeaseUntil: null },
          { reconciliationLeaseUntil: { lte: new Date() } },
        ],
      },
      include: { paymentAttempt: true },
      take: limit,
      orderBy: [{ nextReconcileAt: "asc" }, { id: "asc" }],
    });
    let reconciled = 0;
    for (const refund of pending) {
      const token = randomUUID();
      // Claim immediately before I/O, not at batch discovery. A fresh claim must
      // survive other workers, and an expired claim must never own newer writes.
      const owned = await this.database.$executeRaw(Prisma.sql`
        UPDATE "Refund" SET "reconciliationToken" = ${token}::uuid,
          "reconciliationLeaseUntil" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '10 minutes',
          "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
        WHERE "id" = ${refund.id}::uuid AND "status" IN ('PENDING', 'PROCESSING')
          AND "providerRefundId" = ${refund.providerRefundId}
          AND "reconciliationFailures" < 8
          AND "nextReconcileAt" = ${refund.nextReconcileAt}
          AND "nextReconcileAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          AND ("reconciliationLeaseUntil" IS NULL OR
            "reconciliationLeaseUntil" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
      `);
      if (owned !== 1) continue;
      reconciled++;
      try {
        const provider = this.providers.get(
          refund.paymentAttempt.provider as OnlinePaymentProvider,
        );
        if (!provider.verifyRefund) throw new Error("Refund reconciliation unsupported");
        const result = await provider.verifyRefund(refund.providerRefundId!);
        await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refund.id}::uuid FOR UPDATE`;
          const current = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
          const exact = refundObservationMatches(current, result);
          // Preserve conflicting provider evidence even when a newer claim or
          // callback owns the state; the ownership guard below protects money.
          if (!exact || (current.status === "SUCCEEDED" && result.status === "failed"))
            await recordRefundObservationConflict(tx, current, result, "RECONCILIATION");
          // Re-read after the provider call: a callback may have completed the
          // refund or placed it under review while this poll was in flight.
          if (current.status !== "PENDING" && current.status !== "PROCESSING") return;
          if (current.reconciliationToken !== token) return;
          if (!exact) {
            await tx.refund.update({
              where: { id: refund.id },
              data: {
                status: "NEEDS_ATTENTION",
                providerStatus: "RECONCILIATION_MISMATCH",
                nextReconcileAt: null,
                reconciliationToken: null,
                reconciliationLeaseUntil: null,
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
              reconciliationToken: null,
              reconciliationLeaseUntil: null,
              failureMessage: null,
              ...(result.status === "succeeded"
                ? { processedAt: new Date(), nextReconcileAt: null }
                : {
                    nextReconcileAt:
                      result.status === "failed" ? null : new Date(Date.now() + 300_000),
                  }),
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
        await this.database.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${refund.id}::uuid FOR UPDATE`;
          const current = await tx.refund.findUniqueOrThrow({ where: { id: refund.id } });
          if (
            current.reconciliationToken !== token ||
            (current.status !== "PENDING" && current.status !== "PROCESSING")
          )
            return;
          await tx.refund.update({
            where: { id: refund.id },
            data: {
              reconciliationToken: null,
              reconciliationLeaseUntil: null,
              reconciliationFailures: { increment: 1 },
              ...(current.reconciliationFailures >= 7
                ? { status: "NEEDS_ATTENTION", nextReconcileAt: null }
                : {
                    nextReconcileAt: new Date(
                      Date.now() +
                        Math.min(3_600_000, 60_000 * 2 ** current.reconciliationFailures),
                    ),
                  }),
              failureMessage:
                "Provider refund reconciliation unavailable; original refund retained, no money movement retried",
            },
          });
        });
      }
    }
    return { submitted, reconciled };
  }
}
