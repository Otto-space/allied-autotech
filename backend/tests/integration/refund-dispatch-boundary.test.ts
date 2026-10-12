import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { RefundWorker } from "../../src/workers/refund.worker.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
const digest = () => createHash("sha256").update(randomUUID()).digest("hex");
type Provider = "PAYSTACK" | "MONNIFY";
const refundIds: string[] = [];
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
function worker(refund: PaymentProviderPort["refund"], database: PrismaClient = prisma) {
  return new RefundWorker(
    database,
    new PaymentProviderRegistry({
      PAYSTACK: { initialize: vi.fn(), verify: vi.fn(), refund },
      MONNIFY: { initialize: vi.fn(), verify: vi.fn(), refund },
    }),
  );
}
async function fixture(provider: Provider) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable",
      profile: {
        create: { firstName: "Refund", lastName: "Observation", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const approver = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable",
      role: "ADMIN",
    },
  });
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Refund test",
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
      customerName: "Refund Observation",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      customerId: user.profile!.id,
      orderId: order.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      idempotencyKeyHash: digest(),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      internalReference: randomUUID(),
      provider,
      amountKobo: 10000n,
      status: "SUCCESSFUL",
      verificationStatus: "VERIFIED",
      verifiedAmountKobo: 10000n,
      verifiedCurrency: "NGN",
      gatewayTransactionId: randomUUID(),
      providerReference: randomUUID(),
      paidAt: new Date(),
      verifiedAt: new Date(),
    },
  });
  const refund = await prisma.refund.create({
    data: {
      paymentAttemptId: attempt.id,
      requestedByUserId: user.id,
      approvedByUserId: approver.id,
      approvedAt: new Date(),
      status: "APPROVED",
      refundNumber: randomUUID(),
      idempotencyKeyHash: digest(),
      amountKobo: 1000n,
      reason: "Synthetic approved refund",
      createdAt: new Date(0),
    },
  });
  refundIds.push(refund.id);
  const snapshot = () => prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
  return { refund, attempt, snapshot };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Refund dispatch boundary",
  () => {
    afterEach(async () => {
      vi.restoreAllMocks();
      await prisma.refund.updateMany({
        where: { id: { in: refundIds }, status: "APPROVED" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      refundIds.length = 0;
    });
    afterAll(() => prisma.$disconnect());

    it("retries a rolled-back receipt transaction without repeating the provider submission", async () => {
      const f = await fixture("PAYSTACK"),
        receipt = randomUUID();
      let transactions = 0,
        injected = false;
      const database = new Proxy(prisma, {
        get(target, property) {
          if (property === "$transaction")
            return (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
              target.$transaction(async (tx) => {
                transactions++;
                const result = await operation(tx);
                if (transactions === 2) {
                  injected = true;
                  throw Object.assign(new Error("Synthetic transaction rollback"), {
                    code: "P2034",
                  });
                }
                return result;
              });
          return Reflect.get(target, property);
        },
      }) as PrismaClient;
      const refund = vi.fn(async () => ({
        providerRefundId: receipt,
        status: "pending",
      }));
      await worker(refund, database).runOnce(1, f.refund.id);
      expect(injected).toBe(true);
      expect(refund).toHaveBeenCalledTimes(1);
      expect(await f.snapshot()).toMatchObject({
        status: "PENDING",
        providerRefundId: receipt,
      });
      expect(
        await prisma.paymentAnomaly.count({ where: { refundId: f.refund.id } }),
      ).toBe(0);
      expect(
        await prisma.paymentLedgerEntry.count({ where: { refundId: f.refund.id } }),
      ).toBe(0);
    });

    it("retains a conflicting provider identity for review without rebinding another refund", async () => {
      const first = await fixture("PAYSTACK"),
        second = await fixture("PAYSTACK"),
        receipt = randomUUID();
      const refund = vi.fn(async () => ({
          providerRefundId: receipt,
          status: "pending",
        })),
        w = worker(refund);
      await w.runOnce(1, first.refund.id);
      const committed = await first.snapshot();
      await w.runOnce(1, second.refund.id);
      expect(await first.snapshot()).toEqual(committed);
      expect(await second.snapshot()).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "REFUND_SUBMISSION_IDENTITY_CONFLICT",
        providerRefundId: null,
        nextReconcileAt: null,
      });
      const anomaly = await prisma.paymentAnomaly.findFirstOrThrow({
        where: { refundId: second.refund.id },
      });
      expect(anomaly.details).toMatchObject({
        source: "REFUND_SUBMISSION",
        providerRefundId: receipt,
      });
      await w.runOnce(1, second.refund.id);
      expect(refund).toHaveBeenCalledTimes(2);
    });

    it("does not send when the process resumes after its committed dispatch window", async () => {
      const f = await fixture("PAYSTACK");
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 601000);
      const refund = vi.fn(async () => ({
        providerRefundId: randomUUID(),
        status: "pending",
      }));
      expect(await worker(refund).runOnce(1, f.refund.id)).toMatchObject({
        submitted: 0,
      });
      expect(refund).not.toHaveBeenCalled();
      expect(await f.snapshot()).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "DISPATCH_WINDOW_EXPIRED",
        nextReconcileAt: null,
        providerRefundId: null,
      });
    });

    it("preserves a recovered hold when the delayed provider call fails", async () => {
      const f = await fixture("PAYSTACK"),
        started = gate(),
        finish = gate();
      const refund = vi.fn(async () => {
        started.release();
        await finish.promise;
        throw new Error("Synthetic lost response");
      });
      const w = worker(refund),
        run = w.runOnce(1, f.refund.id);
      try {
        await started.promise;
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: { nextReconcileAt: new Date(0) },
        });
        await w.runOnce(1, f.refund.id);
        const held = await f.snapshot();
        finish.release();
        await run;
        expect(await f.snapshot()).toEqual(held);
        await w.runOnce(1, f.refund.id);
        expect(refund).toHaveBeenCalledTimes(1);
      } finally {
        finish.release();
        await run;
      }
    });

    it("allows dispatch after a won dispute and never repeats an ambiguous submission", async () => {
      const f = await fixture("PAYSTACK");
      await prisma.paymentDispute.create({
        data: {
          paymentAttemptId: f.attempt.id,
          provider: "PAYSTACK",
          providerDisputeId: randomUUID(),
          status: "WON",
          category: "OTHER",
          amountKobo: 10000n,
          openedAt: new Date(),
          resolvedAt: new Date(),
        },
      });
      const refund = vi.fn(async () => {
        throw new Error("Provider response lost");
      });
      const w = worker(refund);
      expect(await w.runOnce(1, f.refund.id)).toMatchObject({ submitted: 1 });
      expect(await w.runOnce(1, f.refund.id)).toMatchObject({ submitted: 0 });
      expect(refund).toHaveBeenCalledTimes(1);
      expect(await f.snapshot()).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "PROVIDER_SUBMISSION_UNCONFIRMED",
        providerRefundId: null,
      });
    });

    it("waits for an in-flight dispute transaction and rechecks its committed decision", async () => {
      const f = await fixture("PAYSTACK"),
        written = gate(),
        finish = gate();
      const database = new Proxy(prisma, {
        get(target, property) {
          if (property === "$transaction")
            return (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
              target.$transaction((tx) =>
                operation(
                  new Proxy(tx, {
                    get(transaction, name) {
                      if (name === "paymentDispute")
                        return new Proxy(transaction.paymentDispute, {
                          get(model, method) {
                            if (method === "upsert")
                              return async (args: Prisma.PaymentDisputeUpsertArgs) => {
                                const result = await model.upsert(args);
                                written.release();
                                await finish.promise;
                                return result;
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
      }) as PrismaClient;
      const observe = new PaymentsService(database).ingestWebhook(
        {
          eventType: "charge.dispute.create",
          providerEventId: randomUUID(),
          resourceId: randomUUID(),
          reference: f.attempt.internalReference,
          gatewayTransactionId: f.attempt.gatewayTransactionId,
          status: "awaiting_response",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: null,
          providerFeeKobo: null,
          method: null,
          category: "OTHER",
          responseDueAt: null,
        },
        digest(),
        { requestId: randomUUID(), ipAddress: null, userAgent: null },
      );
      const refund = vi.fn(async () => ({
        providerRefundId: randomUUID(),
        status: "pending",
      }));
      let run: Promise<unknown> | undefined;
      try {
        await written.promise;
        run = worker(refund).runOnce(1, f.refund.id);
        const outcome = await Promise.race([
          run,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 250)),
        ]);
        expect(outcome).toBeNull();
        expect(refund).not.toHaveBeenCalled();
        finish.release();
        await observe;
        await run;
        expect(refund).not.toHaveBeenCalled();
        expect(await f.snapshot()).toMatchObject({
          status: "NEEDS_ATTENTION",
          providerStatus: "DISPUTE_REVIEW_REQUIRED",
          submissionStartedAt: null,
        });
      } finally {
        finish.release();
        await Promise.all([observe, run]);
      }
    });

    it.each(["dispute", "hold"] as const)(
      "does not dispatch a later batch item after a %s arrives",
      async (kind) => {
        const first = await fixture("PAYSTACK"),
          next = await fixture("PAYSTACK"),
          started = gate(),
          finish = gate();
        await prisma.refund.update({
          where: { id: next.refund.id },
          data: { createdAt: new Date(1) },
        });
        const refund = vi.fn(async (command) => {
          if (command.refundReference === first.refund.refundNumber) {
            started.release();
            await finish.promise;
          }
          return { providerRefundId: randomUUID(), status: "pending" };
        });
        const run = worker(refund).runOnce(2);
        try {
          await started.promise;
          if (kind === "dispute")
            await prisma.paymentDispute.create({
              data: {
                paymentAttemptId: next.attempt.id,
                provider: "PAYSTACK",
                providerDisputeId: randomUUID(),
                status: "AWAITING_RESPONSE",
                category: "OTHER",
                amountKobo: 10000n,
                openedAt: new Date(),
              },
            });
          else
            await prisma.refund.update({
              where: { id: next.refund.id },
              data: {
                status: "NEEDS_ATTENTION",
                providerStatus: "MANUAL_REVIEW_REQUIRED",
              },
            });
          finish.release();
          await run;
          expect(refund).toHaveBeenCalledTimes(1);
          expect(await next.snapshot()).toMatchObject({
            status: "NEEDS_ATTENTION",
            submissionStartedAt: null,
            providerRefundId: null,
          });
        } finally {
          finish.release();
          await run;
        }
      },
    );

    it("leaves queued batch items unsubmitted until their own dispatch begins", async () => {
      const first = await fixture("PAYSTACK"),
        next = await fixture("PAYSTACK"),
        started = gate(),
        finish = gate();
      await prisma.refund.update({
        where: { id: next.refund.id },
        data: { createdAt: new Date(1) },
      });
      const refund = vi.fn(async (command) => {
        if (command.refundReference === first.refund.refundNumber) {
          started.release();
          await finish.promise;
        }
        return { providerRefundId: randomUUID(), status: "pending" };
      });
      const run = worker(refund).runOnce(2);
      try {
        await started.promise;
        expect(await next.snapshot()).toMatchObject({
          status: "APPROVED",
          submissionStartedAt: null,
          nextReconcileAt: null,
        });
      } finally {
        finish.release();
        await run;
      }
      expect(refund).toHaveBeenCalledTimes(2);
    });

    it("retains a late provider receipt after crash recovery without releasing review or resubmitting", async () => {
      const f = await fixture("PAYSTACK"),
        started = gate(),
        finish = gate(),
        receipt = randomUUID();
      const refund = vi.fn(async () => {
        started.release();
        await finish.promise;
        return { providerRefundId: receipt, status: "pending" };
      });
      const w = worker(refund),
        run = w.runOnce(1, f.refund.id);
      try {
        await started.promise;
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: { nextReconcileAt: new Date(0) },
        });
        await w.runOnce(1, f.refund.id);
        const held = await f.snapshot();
        expect(held.status).toBe("NEEDS_ATTENTION");
        finish.release();
        await run;
        expect(await f.snapshot()).toMatchObject({
          status: "NEEDS_ATTENTION",
          providerStatus: held.providerStatus,
          providerRefundId: receipt,
          nextReconcileAt: null,
        });
        await w.runOnce(1, f.refund.id);
        expect(refund).toHaveBeenCalledTimes(1);
        expect(
          await prisma.paymentLedgerEntry.count({ where: { refundId: f.refund.id } }),
        ).toBe(0);
        expect(
          await prisma.paymentAnomaly.count({
            where: { refundId: f.refund.id, type: "OTHER" },
          }),
        ).toBe(1);
      } finally {
        finish.release();
        await run;
      }
    });
  },
);
