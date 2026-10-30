import { PaymentReconciliationWorker } from "../../src/workers/reconciliation.worker.js";
import { beforeEach as beforePaymentMode, afterEach as afterPaymentMode } from "vitest";
import { env } from "../../src/config/env.js";
const previousPaystackMode = env.PAYSTACK_MODE;
beforePaymentMode(() => {
  env.PAYSTACK_MODE = "test";
});
afterPaymentMode(() => {
  env.PAYSTACK_MODE = previousPaystackMode;
});
import { createHash, randomInt, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { paystackProvider } from "../../src/providers/payments/paystack.adapter.js";
import { prisma } from "../../src/config/database.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import type { PaystackWebhookEvent } from "../../src/providers/payments/paystack-webhook.js";
import { PaymentWebhookRetryWorker } from "../../src/workers/webhook-retry.worker.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const context = { requestId: "webhook-financial-test", ipAddress: null, userAgent: null };

// Run the business writes in a real transaction, then arrange a replacement
// claim on another connection immediately before that transaction completes.
function takeoverDatabase(takeover: () => Promise<void>): PrismaClient {
  return new Proxy(prisma, {
    get(target, property) {
      if (property === "$transaction")
        return (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          target.$transaction((tx) =>
            operation(
              new Proxy(tx, {
                get(transaction, name) {
                  if (name === "paymentWebhookEvent")
                    return new Proxy(transaction.paymentWebhookEvent, {
                      get(model, method) {
                        if (method === "updateMany")
                          return async (
                            args: Prisma.PaymentWebhookEventUpdateManyArgs,
                          ) => {
                            await takeover();
                            return model.updateMany(args);
                          };
                        return Reflect.get(model, method);
                      },
                    });
                  return Reflect.get(transaction, name);
                },
              }),
            ),
          );
      return Reflect.get(target, property);
    },
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Webhook financial claim atomicity",
  () => {
    const jobs: string[] = [];
    afterEach(async () => {
      vi.restoreAllMocks();
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: { in: jobs }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", failedAt: new Date(), lockedAt: null },
      });
      jobs.length = 0;
    });
    afterAll(() => prisma.$disconnect());

    async function fixture(
      provider: "PAYSTACK" | "MONNIFY",
      refundNeeded = false,
      captured = false,
    ) {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable",
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Webhook",
              phone: "+2348000000000",
            },
          },
        },
        include: { profile: true },
      });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Webhook fixture",
          address: "Test",
          city: "Test",
          state: "Test",
        },
      });
      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          customerId: user.profile!.id,
          orderNumber: randomUUID(),
          customerName: "Synthetic Webhook",
          customerEmail: user.email,
          customerPhone: "+2348000000000",
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          paymentDueAt: new Date(Date.now() + 3600000),
        },
      });
      const payment = await prisma.payment.create({
        data: {
          customerId: user.profile!.id,
          orderId: order.id,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo: 10000n,
          idempotencyKeyHash: digest(randomUUID()),
        },
      });
      const attempt = await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: randomUUID(),
          provider,
          amountKobo: 10000n,
          ...(refundNeeded || captured
            ? {
                status: "SUCCESSFUL",
                verificationStatus: "VERIFIED",
                verifiedAmountKobo: 10000n,
                verifiedCurrency: "NGN",
                gatewayTransactionId: randomUUID(),
                providerReference: randomUUID(),
                paidAt: new Date(),
                verifiedAt: new Date(),
              }
            : {}),
        },
      });
      let refund = null;
      if (refundNeeded) {
        const approver = await prisma.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            passwordHash: "unusable",
            role: "ADMIN",
          },
        });
        refund = await prisma.refund.create({
          data: {
            paymentAttemptId: attempt.id,
            requestedByUserId: user.id,
            approvedByUserId: approver.id,
            approvedAt: new Date(),
            status: "PENDING",
            refundNumber: randomUUID(),
            idempotencyKeyHash: digest(randomUUID()),
            amountKobo: 1000n,
            reason: "Synthetic approved fixture",
            providerRefundId: randomUUID(),
          },
        });
      }
      const snapshot = async () => ({
        payment: await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
        attempt: await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        }),
        order: await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
        refunds: await prisma.refund.findMany({
          where: { paymentAttemptId: attempt.id },
        }),
        disputes: await prisma.paymentDispute.findMany({
          where: { paymentAttemptId: attempt.id },
        }),
        ledger: await prisma.paymentLedgerEntry.findMany({
          where: {
            OR: [
              { paymentAttemptId: attempt.id },
              ...(refund ? [{ refundId: refund.id }] : []),
            ],
          },
        }),
        anomalies: await prisma.paymentAnomaly.findMany({
          where: { paymentAttemptId: attempt.id },
        }),
        audit: await prisma.auditLog.findMany({ where: { entityId: attempt.id } }),
      });
      return { user, payment, attempt, refund, snapshot };
    }

    it.each(["verification", "reconciliation"] as const)(
      "holds a reversed unallocated payment once and blocks a later stale success via %s",
      async (source) => {
        const f = await fixture("PAYSTACK");
        const periodStart = new Date(Date.UTC(1990, 0, 1) + randomInt(500_000_000_000));
        const periodEnd = new Date(periodStart.getTime() + 1);
        await prisma.paymentAttempt.update({
          where: { id: f.attempt.id },
          data: { initiatedAt: periodStart },
        });
        const observe = async () => {
          const worker = new PaymentReconciliationWorker(prisma);
          for (const reobserve of [false, true]) {
            const run = await worker.run(periodStart, periodEnd, "PAYSTACK", reobserve);
            expect(run.status).toBe("DIFFERENCES_FOUND");
            const item = await prisma.paymentReconciliationItem.findFirstOrThrow({
              where: { runId: run.id },
            });
            expect(item).toMatchObject({
              paymentAttemptId: f.attempt.id,
              status: "STATUS_MISMATCH",
              providerAmountKobo: null,
            });
            expect(item.note).toContain("reversal");
          }
        };

        const verify = vi.spyOn(paystackProvider, "verify").mockResolvedValue({
          reference: f.attempt.internalReference,
          gatewayTransactionId: "reversed-receipt",
          status: "reversed",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: null,
          providerFeeKobo: null,
          method: null,
        });
        const service = new PaymentsService(prisma);
        const actor = {
          userId: f.user.id,
          sessionId: randomUUID(),
          role: "CUSTOMER" as const,
          email: f.user.email,
          mfaRequired: false,
          mfaVerifiedAt: null,
        };
        if (source === "reconciliation") {
          await observe();
          expect(await service.customerGet(actor, f.payment.id)).toMatchObject({
            reversalReported: true,
          });
        } else {
          await service.verifyAttempt(actor, f.payment.id, f.attempt.id, context);
        }
        await service.verifyAttempt(actor, f.payment.id, f.attempt.id, context);
        const held = await f.snapshot();
        expect(held.payment.status).toBe("REQUIRES_REVIEW");
        expect(held.attempt.gatewayStatus).toBe("reversed");
        expect(held.attempt.redactedGatewayData).toMatchObject({
          verificationHold: true,
        });
        expect(held.anomalies).toHaveLength(1);
        expect(held.anomalies[0]?.details).toMatchObject({
          observed: { status: "reversed" },
        });
        expect(held.ledger).toHaveLength(0);
        expect(held.refunds).toHaveLength(0);
        expect(held.order.paidAt).toBeNull();
        verify.mockResolvedValue({
          reference: f.attempt.internalReference,
          gatewayTransactionId: "reversed-receipt",
          status: "success",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: new Date(),
          providerFeeKobo: null,
          method: null,
        });
        await service.verifyAttempt(actor, f.payment.id, f.attempt.id, context);
        const after = await f.snapshot();
        expect(after.payment.status).toBe("REQUIRES_REVIEW");
        expect(after.ledger).toHaveLength(0);
        expect(after.refunds).toHaveLength(0);
        expect(after.order.paidAt).toBeNull();
      },
    );

    it.each(["verification", "reconciliation"] as const)(
      "reports a later reversal privately without rewriting a settled receipt via %s",
      async (source) => {
        const f = await fixture("PAYSTACK");
        const periodStart = new Date(Date.UTC(1990, 0, 1) + randomInt(500_000_000_000));
        const periodEnd = new Date(periodStart.getTime() + 1);
        await prisma.paymentAttempt.update({
          where: { id: f.attempt.id },
          data: { initiatedAt: periodStart },
        });
        const observe = async () => {
          const worker = new PaymentReconciliationWorker(prisma);
          for (const reobserve of [false, true]) {
            const run = await worker.run(periodStart, periodEnd, "PAYSTACK", reobserve);
            expect(run.status).toBe("DIFFERENCES_FOUND");
            const item = await prisma.paymentReconciliationItem.findFirstOrThrow({
              where: { runId: run.id },
            });
            expect(item).toMatchObject({
              paymentAttemptId: f.attempt.id,
              status: "STATUS_MISMATCH",
              providerAmountKobo: null,
            });
            expect(item.note).toContain("reversal");
          }
        };

        const service = new PaymentsService(prisma);
        const event = chargeEvent(f.attempt.internalReference);
        await service.ingestWebhook(event, digest(randomUUID()), context);
        const before = await f.snapshot();
        expect(before.payment.status).toBe("SUCCEEDED");
        vi.spyOn(paystackProvider, "verify").mockResolvedValue({
          reference: f.attempt.internalReference,
          gatewayTransactionId: event.gatewayTransactionId!,
          status: "reversed",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: before.attempt.paidAt,
          providerFeeKobo: null,
          method: null,
        });
        const actor = {
          userId: f.user.id,
          sessionId: randomUUID(),
          role: "CUSTOMER" as const,
          email: f.user.email,
          mfaRequired: false,
          mfaVerifiedAt: null,
        };
        if (source === "reconciliation") {
          await observe();
          expect(await service.customerGet(actor, f.payment.id)).toMatchObject({
            reversalReported: true,
          });
        } else {
          await service.verifyAttempt(actor, f.payment.id, f.attempt.id, context);
        }
        const detail = await service.verifyAttempt(
          actor,
          f.payment.id,
          f.attempt.id,
          context,
        );
        expect(detail).toMatchObject({
          id: f.payment.id,
          status: "SUCCEEDED",
          reversalReported: true,
        });
        expect(detail).not.toHaveProperty("anomalies");
        const list = await service.customerList(actor, { limit: 20 });
        expect(list).toMatchObject({
          items: [expect.objectContaining({ id: f.payment.id, reversalReported: true })],
        });
        const after = await f.snapshot();
        expect(after.attempt).toEqual(before.attempt);
        expect(after.payment).toEqual(before.payment);
        expect(after.order).toEqual(before.order);
        expect(after.ledger).toEqual(before.ledger);
        expect(after.refunds).toEqual(before.refunds);
        expect(after.anomalies).toHaveLength(1);
      },
    );

    function chargeEvent(reference: string): PaystackWebhookEvent {
      return {
        domain: "test",
        eventType: "charge.success",
        providerEventId: randomUUID(),
        resourceId: null,
        reference,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        gatewayTransactionId: randomUUID(),
        paidAt: null,
        providerFeeKobo: null,
        method: null,
        category: null,
        responseDueAt: null,
      };
    }

    it("retains the signed environment across a paused provider and rejects a different-mode retry", async () => {
      const f = await fixture("PAYSTACK");
      const event = chargeEvent(f.attempt.internalReference);
      const before = await f.snapshot();
      const service = new PaymentsService(prisma);
      env.PAYSTACK_MODE = "disabled";
      await expect(
        service.ingestWebhook(event, digest(randomUUID()), context),
      ).rejects.toThrow();
      const stored = await prisma.paymentWebhookEvent.findFirstOrThrow({
        where: { providerEventId: event.providerEventId },
      });
      jobs.push(stored.id);
      expect(stored.redactedPayload).toMatchObject({ domain: "test" });
      expect(await f.snapshot()).toEqual(before);
      env.PAYSTACK_MODE = "live";
      await new PaymentWebhookRetryWorker(prisma, service).runOnce(100);
      expect(await f.snapshot()).toEqual(before);
      expect(
        await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: stored.id } }),
      ).toMatchObject({
        status: "DEAD_LETTER",
        lastErrorCode: "PAYSTACK_EVENT_FACTS_MISMATCH",
      });
    });

    it("recovers a legacy event without domain only through authoritative verification", async () => {
      const f = await fixture("PAYSTACK");
      const event = chargeEvent(f.attempt.internalReference);
      delete event.domain;
      const verify = vi.spyOn(paystackProvider, "verify").mockResolvedValue({
        reference: f.attempt.internalReference,
        gatewayTransactionId: event.gatewayTransactionId!,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: null,
        providerFeeKobo: null,
        method: null,
      });
      await new PaymentsService(prisma).ingestWebhook(
        event,
        digest(randomUUID()),
        context,
      );
      expect(verify).toHaveBeenCalledExactlyOnceWith(f.attempt.internalReference);
      expect((await f.snapshot()).payment.status).toBe("SUCCEEDED");
      expect(
        (await f.snapshot()).ledger.filter((entry) => entry.type === "CAPTURE"),
      ).toHaveLength(1);
    });

    const cases = [
      ["PAYSTACK", "capture"],
      ["MONNIFY", "capture"],
      ["PAYSTACK", "refund"],
      ["MONNIFY", "refund"],
      ["PAYSTACK", "dispute"],
    ] as const;
    it.each(cases)(
      "%s %s rolls back business writes after losing the claim",
      async (provider, kind) => {
        const f = await fixture(provider, kind === "refund", kind === "dispute");
        const payloadSha256 = digest(randomUUID());
        const event: PaystackWebhookEvent = {
          domain: "test",
          eventType:
            kind === "capture"
              ? "charge.success"
              : kind === "refund"
                ? "refund.processed"
                : "charge.dispute.create",
          providerEventId: randomUUID(),
          resourceId: f.refund?.providerRefundId ?? randomUUID(),
          reference: f.attempt.internalReference,
          status:
            kind === "refund" ? "processed" : kind === "dispute" ? "lost" : "success",
          amountKobo: kind === "refund" ? 1000n : 10000n,
          currency: "NGN",
          gatewayTransactionId: randomUUID(),
          paidAt: null,
          providerFeeKobo: null,
          method: null,
          category: null,
          responseDueAt: null,
        };
        const row = await prisma.paymentWebhookEvent.create({
          data: {
            provider,
            providerEventId: event.providerEventId,
            eventType: event.eventType,
            payloadSha256,
            deduplicationKey: digest(
              `${event.eventType}:${event.providerEventId}:${payloadSha256}`,
            ),
            signatureVerifiedAt: new Date(),
            status: "PROCESSING",
            processingAttempts: 1,
            lockedAt: new Date(),
            ...(provider === "MONNIFY"
              ? f.refund
                ? { refundId: f.refund.id }
                : { paymentAttemptId: f.attempt.id }
              : {}),
            redactedPayload:
              provider === "PAYSTACK"
                ? {
                    ...event,
                    amountKobo: event.amountKobo!.toString(),
                    paidAt: null,
                    providerFeeKobo: null,
                    responseDueAt: null,
                  }
                : kind === "refund"
                  ? {
                      kind: "refund",
                      providerRefundId: f.refund!.providerRefundId,
                      amountKobo: "1000",
                      currency: "NGN",
                      status: "succeeded",
                    }
                  : {
                      kind: "transaction",
                      reference: event.reference,
                      gatewayTransactionId: event.gatewayTransactionId,
                      status: "success",
                      amountKobo: "10000",
                      currency: "NGN",
                      paidAt: null,
                      providerFeeKobo: null,
                      method: null,
                    },
          },
        });
        jobs.push(row.id);
        const before = await f.snapshot();
        let takeovers = 0;
        const database = takeoverDatabase(async () => {
          takeovers++;
          await prisma.paymentWebhookEvent.update({
            where: { id: row.id },
            data: { processingAttempts: { increment: 1 }, lockedAt: new Date() },
          });
        });
        const service = new PaymentsService(database);
        const claim = {
          id: row.id,
          processingAttempts: 1,
          status: "PROCESSING" as const,
        };
        if (provider === "PAYSTACK")
          await service.ingestWebhook(event, payloadSha256, context, claim);
        else await service.retryMonnifyWebhook(row.id, context, claim);
        expect(takeovers).toBe(1);
        expect(await f.snapshot()).toEqual(before);
        expect(
          await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: row.id } }),
        ).toMatchObject({ status: "PROCESSING", processingAttempts: 2 });
        await prisma.paymentWebhookEvent.update({
          where: { id: row.id },
          data: { lockedAt: new Date(0) },
        });
        if (kind === "dispute")
          vi.spyOn(paystackProvider, "verifyDispute").mockResolvedValue({
            providerDisputeId: event.resourceId!,
            reference: f.attempt.internalReference,
            gatewayTransactionId: f.attempt.gatewayTransactionId!,
            transactionAmountKobo: 10000n,
            currency: "NGN",
            providerStatus: "lost",
            resolution: null,
            refundAmountKobo: 10000n,
            category: null,
            responseDueAt: null,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          });
        await new PaymentWebhookRetryWorker(prisma, new PaymentsService(prisma)).runOnce(
          100,
        );
        expect(
          await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id: row.id } }),
        ).toMatchObject({ status: "PROCESSED", processingAttempts: 3, lockedAt: null });
        if (kind === "capture") {
          expect((await f.snapshot()).payment.status).toBe("SUCCEEDED");
          expect(
            await prisma.paymentLedgerEntry.count({
              where: { paymentAttemptId: f.attempt.id, type: "CAPTURE" },
            }),
          ).toBe(1);
        } else if (kind === "refund") {
          expect((await f.snapshot()).refunds[0]!.status).toBe("SUCCEEDED");
          expect(
            await prisma.paymentLedgerEntry.count({
              where: { refundId: f.refund!.id, type: "REFUND" },
            }),
          ).toBe(1);
        } else {
          const dispute = await prisma.paymentDispute.findFirstOrThrow({
            where: { paymentAttemptId: f.attempt.id },
          });
          expect(dispute.status).toBe("LOST");
          expect(
            await prisma.paymentLedgerEntry.count({
              where: { disputeId: dispute.id, type: "CHARGEBACK" },
            }),
          ).toBe(1);
        }
      },
    );

    it("initial Paystack ingestion rolls back if the retry worker takes ownership", async () => {
      const f = await fixture("PAYSTACK");
      const event: PaystackWebhookEvent = {
        domain: "test",
        eventType: "charge.success",
        providerEventId: randomUUID(),
        resourceId: null,
        reference: f.attempt.internalReference,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        gatewayTransactionId: randomUUID(),
        paidAt: null,
        providerFeeKobo: null,
        method: null,
        category: null,
        responseDueAt: null,
      };
      const before = await f.snapshot();
      let id = "";
      const database = takeoverDatabase(async () => {
        const record = await prisma.paymentWebhookEvent.findFirstOrThrow({
          where: { provider: "PAYSTACK", providerEventId: event.providerEventId },
        });
        id = record.id;
        jobs.push(id);
        expect(record).toMatchObject({ status: "RECEIVED", processingAttempts: 0 });
        await prisma.paymentWebhookEvent.update({
          where: { id },
          data: { status: "PROCESSING", processingAttempts: 1, lockedAt: new Date() },
        });
      });
      expect(
        await new PaymentsService(database).ingestWebhook(
          event,
          digest(randomUUID()),
          context,
        ),
      ).toMatchObject({ accepted: true });
      expect(id).not.toBe("");
      expect(await f.snapshot()).toEqual(before);
      await prisma.paymentWebhookEvent.update({
        where: { id },
        data: { lockedAt: new Date(0) },
      });
      await new PaymentWebhookRetryWorker(prisma, new PaymentsService(prisma)).runOnce(
        100,
      );
      expect((await f.snapshot()).payment.status).toBe("SUCCEEDED");
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: f.attempt.id, type: "CAPTURE" },
        }),
      ).toBe(1);
    });

    it("records a Monnify verification mismatch atomically as a review hold", async () => {
      const f = await fixture("MONNIFY");
      const provider: PaymentProviderPort = {
        async initialize() {
          throw new Error("Not used");
        },
        async refund() {
          throw new Error("Not used");
        },
        async verify(reference) {
          return {
            reference,
            gatewayTransactionId: "verified-receipt",
            status: "success",
            amountKobo: 10000n,
            currency: "NGN",
            paidAt: new Date(),
            providerFeeKobo: null,
            method: null,
          };
        },
      };
      const service = new PaymentsService(
        prisma,
        new PaymentProviderRegistry({ MONNIFY: provider }),
      );
      const eventId = randomUUID();
      await service.ingestMonnifyWebhook(
        {
          kind: "transaction",
          eventType: "SUCCESSFUL_TRANSACTION",
          providerEventId: eventId,
          reference: f.attempt.internalReference,
          gatewayTransactionId: "mismatched-receipt",
          status: "PAID",
          amountKobo: 20000n,
          currency: "NGN",
          paidAt: null,
          providerFeeKobo: null,
          method: null,
        },
        digest(randomUUID()),
        true,
        context,
      );
      const event = await prisma.paymentWebhookEvent.findFirstOrThrow({
        where: { providerEventId: eventId },
      });
      jobs.push(event.id);
      expect(event.status).toBe("PROCESSED");
      expect((await f.snapshot()).payment.status).toBe("REQUIRES_REVIEW");
      expect((await f.snapshot()).ledger).toHaveLength(0);
      await new PaymentWebhookRetryWorker(prisma, service).runOnce(100);
      expect((await f.snapshot()).payment.status).toBe("REQUIRES_REVIEW");
      expect((await f.snapshot()).anomalies).toHaveLength(1);

      const rollbackDatabase = new Proxy(prisma, {
        get(target, property) {
          if (property === "$transaction")
            return (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
              target.$transaction(async (tx) => {
                await operation(tx);
                throw new Error("Synthetic rollback of review hold");
              });
          return Reflect.get(target, property);
        },
      });
      const rejectedEventId = randomUUID();
      const before = await f.snapshot();
      await expect(
        new PaymentsService(
          rollbackDatabase,
          new PaymentProviderRegistry({ MONNIFY: provider }),
        ).ingestMonnifyWebhook(
          {
            kind: "transaction",
            eventType: "SUCCESSFUL_TRANSACTION",
            providerEventId: rejectedEventId,
            reference: f.attempt.internalReference,
            gatewayTransactionId: "mismatched-receipt",
            status: "PAID",
            amountKobo: 20000n,
            currency: "NGN",
            paidAt: null,
            providerFeeKobo: null,
            method: null,
          },
          digest(randomUUID()),
          true,
          context,
        ),
      ).rejects.toThrow("Synthetic rollback");
      expect(
        await prisma.paymentWebhookEvent.count({
          where: { providerEventId: rejectedEventId },
        }),
      ).toBe(0);
      expect(await f.snapshot()).toEqual(before);
    });
  },
);
