import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type {
  PaymentProviderPort,
  VerifiedRefund,
} from "../../src/providers/payments/payment-provider.port.js";
import { RefundWorker } from "../../src/workers/refund.worker.js";

const digest = () => createHash("sha256").update(randomUUID()).digest("hex");
const context = {
  requestId: "refund-observation-test",
  ipAddress: null,
  userAgent: null,
};
const eventIds: string[] = [];
type Provider = "PAYSTACK" | "MONNIFY";
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
function registry(verifyRefund: NonNullable<PaymentProviderPort["verifyRefund"]>) {
  const provider: PaymentProviderPort = {
    async initialize() {
      throw new Error("No checkout in this test");
    },
    async verify() {
      throw new Error("No charge verification in this test");
    },
    async refund() {
      throw new Error("No refund submission in this test");
    },
    verifyRefund,
  };
  return new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider });
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
      status: "PENDING",
      refundNumber: randomUUID(),
      idempotencyKeyHash: digest(),
      amountKobo: 1000n,
      reason: "Synthetic approved refund",
      providerRefundId: randomUUID(),
      nextReconcileAt: new Date(0),
    },
  });
  const exact: VerifiedRefund = {
    providerRefundId: refund.providerRefundId!,
    status: "succeeded",
    amountKobo: refund.amountKobo,
    currency: refund.currency,
  };
  const snapshot = () => prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
  const ledger = () =>
    prisma.paymentLedgerEntry.findMany({ where: { refundId: refund.id } });
  const anomalies = () =>
    prisma.paymentAnomaly.findMany({
      where: { refundId: refund.id, type: "REFUND_MISMATCH" },
    });
  async function observe(result: VerifiedRefund, asProvider = provider) {
    const service = new PaymentsService(
      prisma,
      registry(async () => result),
    );
    const providerEventId = randomUUID();
    eventIds.push(providerEventId);
    if (asProvider === "PAYSTACK")
      await service.ingestWebhook(
        {
          eventType: `refund.${result.status === "succeeded" ? "processed" : result.status}`,
          providerEventId,
          resourceId: refund.providerRefundId,
          reference: attempt.internalReference,
          status: result.status === "succeeded" ? "processed" : result.status,
          amountKobo: result.amountKobo,
          currency: result.currency,
          gatewayTransactionId: attempt.gatewayTransactionId,
          paidAt: null,
          providerFeeKobo: null,
          method: null,
          category: null,
          responseDueAt: null,
        },
        digest(),
        context,
      );
    else
      await service.ingestMonnifyWebhook(
        {
          kind: "refund",
          eventType: result.status === "failed" ? "FAILED_REFUND" : "SUCCESSFUL_REFUND",
          providerEventId,
          refundReference: refund.providerRefundId!,
          gatewayTransactionId: attempt.gatewayTransactionId!,
          status: result.status,
          amountKobo: result.amountKobo ?? 0n,
          currency: result.currency,
        },
        digest(),
        true,
        context,
      );
    return prisma.paymentWebhookEvent.findFirstOrThrow({
      where: { provider: asProvider, providerEventId },
    });
  }
  return { provider, refund, exact, snapshot, ledger, anomalies, observe };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Refund observation integrity",
  () => {
    afterEach(async () => {
      await prisma.paymentWebhookEvent.updateMany({
        where: { providerEventId: { in: eventIds }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", failedAt: new Date(), lockedAt: null },
      });
      eventIds.length = 0;
    });
    afterAll(() => prisma.$disconnect());
    for (const provider of ["PAYSTACK", "MONNIFY"] as const) {
      it.each(["pending", "failed"] as const)(
        `${provider}: a later %s callback preserves a mismatch review hold`,
        async (status) => {
          const f = await fixture(provider);
          await f.observe({ ...f.exact, amountKobo: 2000n });
          const held = await f.snapshot();
          expect(held.status).toBe("NEEDS_ATTENTION");
          expect((await f.observe({ ...f.exact, status })).status).toBe("PROCESSED");
          expect(await f.snapshot()).toEqual(held);
          expect(await f.ledger()).toHaveLength(0);
        },
      );
      it.each(["pending", "failed", "amount", "currency"] as const)(
        `${provider}: completed refunds survive a later %s observation`,
        async (kind) => {
          const f = await fixture(provider);
          await f.observe(f.exact);
          const completed = await f.snapshot(),
            ledger = await f.ledger();
          expect(completed.status).toBe("SUCCEEDED");
          expect(ledger).toHaveLength(1);
          const result: VerifiedRefund = {
            ...f.exact,
            ...(kind === "amount"
              ? { amountKobo: 2000n }
              : kind === "currency"
                ? { currency: "USD" }
                : { status: kind }),
          };
          const event = await f.observe(result);
          expect(event.status).toBe("PROCESSED");
          expect(await f.snapshot()).toEqual(completed);
          expect(await f.ledger()).toEqual(ledger);
          expect(await f.anomalies()).toHaveLength(kind === "pending" ? 0 : 1);
        },
      );

      it.each(["failed", "amount"] as const)(
        `${provider}: a late reconciliation %s cannot erase a completed refund or its discrepancy`,
        async (kind) => {
          const f = await fixture(provider);
          const started = gate(),
            finish = gate();
          const result: VerifiedRefund = {
            ...f.exact,
            ...(kind === "amount" ? { amountKobo: 2000n } : { status: "failed" }),
          };
          const run = new RefundWorker(
            prisma,
            registry(async () => {
              started.release();
              await finish.promise;
              return result;
            }),
          ).runOnce(1, f.refund.id);
          try {
            await started.promise;
            await f.observe(f.exact);
            const completed = await f.snapshot(),
              ledger = await f.ledger();
            finish.release();
            await run;
            expect(await f.snapshot()).toEqual(completed);
            expect(await f.ledger()).toEqual(ledger);
            expect(await f.anomalies()).toHaveLength(1);
          } finally {
            finish.release();
            await run;
          }
        },
      );

      it(`${provider}: an older pending poll cannot reopen a mismatch held for review`, async () => {
        const f = await fixture(provider);
        const started = gate(),
          finish = gate();
        const run = new RefundWorker(
          prisma,
          registry(async () => {
            started.release();
            await finish.promise;
            return { ...f.exact, status: "pending" };
          }),
        ).runOnce(1, f.refund.id);
        try {
          await started.promise;
          await f.observe({ ...f.exact, amountKobo: 2000n });
          const held = await f.snapshot();
          expect(held.status).toBe("NEEDS_ATTENTION");
          finish.release();
          await run;
          expect(await f.snapshot()).toEqual(held);
          expect(await f.ledger()).toHaveLength(0);
        } finally {
          finish.release();
          await run;
        }
      });
    }

    it.each([false, true])(
      "Paystack cannot correlate a Monnify refund (completed=%s)",
      async (completed) => {
        const f = await fixture("MONNIFY");
        if (completed) await f.observe(f.exact);
        const before = await f.snapshot(),
          ledger = await f.ledger();
        const event = await f.observe(f.exact, "PAYSTACK");
        expect(event).toMatchObject({
          status: "FAILED",
          refundId: null,
          lastErrorCode: "REFUND_CORRELATION_PENDING",
        });
        expect(await f.snapshot()).toEqual(before);
        expect(await f.ledger()).toEqual(ledger);
        expect(await f.anomalies()).toHaveLength(0);
      },
    );

    it("retains the database's protection against direct completed-refund rewrites", async () => {
      const f = await fixture("PAYSTACK");
      await f.observe(f.exact);
      const before = await f.snapshot();
      await expect(
        prisma.refund.update({
          where: { id: f.refund.id },
          data: { status: "NEEDS_ATTENTION" },
        }),
      ).rejects.toThrow("Succeeded refund financial fields are immutable");
      expect(await f.snapshot()).toEqual(before);
    });
  },
);
