import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
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
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: { in: jobs }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", failedAt: new Date(), lockedAt: null },
      });
      jobs.length = 0;
    });
    afterAll(() => prisma.$disconnect());

    async function fixture(provider: "PAYSTACK" | "MONNIFY", refundNeeded = false) {
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
          ...(refundNeeded
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
        const f = await fixture(provider, kind === "refund");
        const payloadSha256 = digest(randomUUID());
        const event: PaystackWebhookEvent = {
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
