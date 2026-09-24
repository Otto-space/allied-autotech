import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { RefundWorker } from "../../src/workers/refund.worker.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaystackWebhookEvent } from "../../src/providers/payments/paystack-webhook.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import {
  assertFinanceGate,
  currentPolicy,
  safeCapabilities,
} from "../../src/modules/policies/policies.service.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function fixture(provider: "PAYSTACK" | "MONNIFY" = "PAYSTACK") {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-hash",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Owner", lastName: "Policy", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `OP-${randomUUID().slice(0, 8)}`,
      name: "Isolated owner test",
      address: "Test",
      city: "Port Harcourt",
      state: "Rivers",
    },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Owner Policy",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      paymentDueAt: new Date(Date.now() - 1000),
    },
  });
  const payment = await prisma.payment.create({
    data: {
      customerId: user.profile!.id,
      orderId: order.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      internalReference: randomUUID(),
      provider,
      amountKobo: 10000n,
    },
  });
  const event: PaystackWebhookEvent = {
    eventType: "charge.success",
    providerEventId: randomUUID(),
    resourceId: randomUUID(),
    reference: attempt.internalReference,
    gatewayTransactionId: randomUUID(),
    status: "success",
    amountKobo: 10000n,
    currency: "NGN",
    paidAt: new Date(),
    providerFeeKobo: null,
    method: "card",
    category: null,
    responseDueAt: null,
  };
  return { user, order, payment, attempt, event };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Owner financial controls on isolated PostgreSQL",
  () => {
    afterAll(() => prisma.$disconnect());
    it("records duplicate late captures once, queues one system reversal, and never fulfils the order", async () => {
      const f = await fixture();
      const service = new PaymentsService(prisma);
      const payload = "a".repeat(64);
      await service.ingestWebhook(f.event, payload, context());
      await service.ingestWebhook(f.event, payload, context());
      const refunds = await prisma.refund.findMany({
        where: { paymentAttemptId: f.attempt.id },
      });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]).toMatchObject({
        authorizationKind: "SYSTEM_LATE_ORDER",
        status: "APPROVED",
        amountKobo: 10000n,
        requestedByUserId: null,
        approvedByUserId: null,
      });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).paidAt,
      ).toBeNull();
      const refund = vi
        .fn()
        .mockResolvedValue({ providerRefundId: randomUUID(), status: "pending" });
      const registry = new PaymentProviderRegistry({
        PAYSTACK: { refund, initialize: vi.fn(), verify: vi.fn(), verifyRefund: vi.fn() },
      });
      const worker = new RefundWorker(prisma, registry);
      await Promise.all([
        worker.runOnce(25, refunds[0]!.id),
        worker.runOnce(25, refunds[0]!.id),
      ]);
      expect(refund).toHaveBeenCalledTimes(1);
      expect(
        (await prisma.refund.findUniqueOrThrow({ where: { id: refunds[0]!.id } })).status,
      ).toBe("PENDING");
      expect(
        await prisma.paymentLedgerEntry.count({ where: { refundId: refunds[0]!.id } }),
      ).toBe(0);
    });
    it("retains an ambiguous provider submission for reconciliation instead of retrying money movement", async () => {
      const f = await fixture();
      await new PaymentsService(prisma).ingestWebhook(f.event, "b".repeat(64), context());
      const refund = vi
        .fn()
        .mockRejectedValue(new Error("Provider accepted then connection closed"));
      const worker = new RefundWorker(
        prisma,
        new PaymentProviderRegistry({
          PAYSTACK: { refund, initialize: vi.fn(), verify: vi.fn() },
        }),
      );
      const record = await prisma.refund.findFirstOrThrow({
        where: { paymentAttemptId: f.attempt.id },
      });
      await worker.runOnce(25, record.id);
      await worker.runOnce(25, record.id);
      expect(refund).toHaveBeenCalledTimes(1);
      expect(
        await prisma.refund.findFirst({ where: { paymentAttemptId: f.attempt.id } }),
      ).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "PROVIDER_SUBMISSION_UNCONFIRMED",
      });
    });
    it("rejects broad admin refund approval without the assigned duty and preserves policy versions", async () => {
      const f = await fixture();
      const actor: AuthenticatedActor = {
        userId: f.user.id,
        email: f.user.email,
        role: "ADMIN",
        sessionId: randomUUID(),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      await expect(
        new PaymentsService(prisma).decideRefund(
          actor,
          randomUUID(),
          { decision: "APPROVED" },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      const policy = await currentPolicy(prisma, "vehicle");
      await expect(
        prisma.businessPolicyVersion.update({
          where: { id: policy.id },
          data: { approvalStatus: "APPROVED" },
        }),
      ).rejects.toThrow();
      expect(await safeCapabilities(prisma)).toMatchObject({
        vehicleDeposits: { enabled: false },
        marketing: { enabled: false },
      });
    });
    it("blocks live financial operations until accounting approval while preserving private draft testing", async () => {
      const prior = env.DEPLOYMENT_ENV;
      try {
        env.DEPLOYMENT_ENV = "production";
        await expect(assertFinanceGate(prisma)).rejects.toMatchObject({
          statusCode: 409,
        });
        env.DEPLOYMENT_ENV = "staging";
        expect((await assertFinanceGate(prisma)).approvalStatus).toBe("DRAFT");
      } finally {
        env.DEPLOYMENT_ENV = prior;
      }
    });
    it("keeps unmatched and wrong-provider signed events visible without settling another provider", async () => {
      const f = await fixture("MONNIFY");
      const service = new PaymentsService(prisma);
      const unknown = {
        ...f.event,
        providerEventId: randomUUID(),
        reference: randomUUID(),
      };
      await service.ingestWebhook(unknown, "c".repeat(64), context());
      expect(
        await prisma.paymentWebhookEvent.findFirst({
          where: { providerEventId: unknown.providerEventId },
        }),
      ).toMatchObject({ status: "FAILED", lastErrorCode: "UNKNOWN_PAYMENT_REFERENCE" });
      await service.ingestWebhook(f.event, "d".repeat(64), context());
      expect(
        (await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: f.attempt.id } }))
          .verificationStatus,
      ).toBe("UNVERIFIED");
      expect(
        await prisma.refund.count({ where: { paymentAttemptId: f.attempt.id } }),
      ).toBe(0);
    });
    it("holds an approved reversal if a dispute arrives before provider dispatch", async () => {
      const f = await fixture();
      await new PaymentsService(prisma).ingestWebhook(f.event, "e".repeat(64), context());
      const record = await prisma.refund.findFirstOrThrow({
        where: { paymentAttemptId: f.attempt.id },
      });
      await prisma.paymentDispute.create({
        data: {
          paymentAttemptId: f.attempt.id,
          provider: "PAYSTACK",
          providerDisputeId: randomUUID(),
          status: "AWAITING_RESPONSE",
          category: "OTHER",
          amountKobo: 10000n,
          openedAt: new Date(),
        },
      });
      const refund = vi.fn();
      await new RefundWorker(
        prisma,
        new PaymentProviderRegistry({
          PAYSTACK: { refund, initialize: vi.fn(), verify: vi.fn() },
        }),
      ).runOnce(25, record.id);
      expect(refund).not.toHaveBeenCalled();
      expect(await prisma.refund.findUnique({ where: { id: record.id } })).toMatchObject({
        status: "NEEDS_ATTENTION",
        providerStatus: "DISPUTE_REVIEW_REQUIRED",
      });
    });
  },
);
