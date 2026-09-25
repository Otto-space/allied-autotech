import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function fixture(beforeInitialize?: () => Promise<void>) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Isolated", lastName: "Attempt", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const actor: AuthenticatedActor = {
    userId: user.id,
    email: user.email,
    role: "CUSTOMER",
    sessionId: randomUUID(),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
  const branch = await prisma.branch.create({
    data: {
      code: `AE-${randomUUID().slice(0, 8)}`,
      name: "Isolated attempt test",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      customerId: user.profile!.id,
      branchId: branch.id,
      orderNumber: `AE-${randomUUID()}`,
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Isolated Attempt",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      paymentDueAt: new Date(Date.now() + 3600000),
    },
  });
  const initialize = vi.fn<PaymentProviderPort["initialize"]>(async (command) => {
    await beforeInitialize?.();
    return {
      authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
      accessCode: "synthetic",
      providerReference: command.reference,
      authorizationExpiresAt: new Date(Date.now() + 3600000),
    };
  });
  const provider: PaymentProviderPort = {
    initialize,
    async verify(reference) {
      return {
        reference,
        gatewayTransactionId: `synthetic-${reference}`,
        status: "failed",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: null,
        providerFeeKobo: 0n,
        method: "card",
      };
    },
    async refund(): Promise<never> {
      throw new Error("Unexpected refund");
    },
  };
  const service = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider }),
  );
  await service.createIntent(
    actor,
    { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
    randomUUID(),
    context(),
  );
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
  const manual = {
    method: "BANK_TRANSFER" as const,
    payerName: "Isolated Attempt",
    transferredAt: new Date().toISOString(),
    bankReference: `AE-${randomUUID()}`,
  };
  return { actor, service, payment, manual, initialize, provider };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "one unresolved attempt per payment",
  () => {
    afterAll(() => prisma.$disconnect());
    it("blocks both online providers while a reported manual payment is under review", async () => {
      const f = await fixture();
      await f.service.submitManual(
        f.actor,
        f.payment.id,
        f.manual,
        randomUUID(),
        context(),
      );
      for (const initialize of [
        f.service.initializePaystack.bind(f.service),
        f.service.initializeMonnify.bind(f.service),
      ]) {
        await expect(
          initialize(f.actor, f.payment.id, randomUUID(), context()),
        ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING", statusCode: 409 });
      }
      expect(f.initialize).not.toHaveBeenCalled();
    });
    it("keeps mismatched captured funds under review instead of allowing another charge", async () => {
      const f = await fixture();
      const originalKey = randomUUID();
      const initialized = await f.service.initializePaystack(
        f.actor,
        f.payment.id,
        originalKey,
        context(),
      );
      vi.spyOn(f.provider, "verify").mockImplementation(async (reference) => ({
        reference,
        gatewayTransactionId: `synthetic-${reference}`,
        status: "success",
        amountKobo: 9999n,
        currency: "NGN",
        paidAt: new Date(),
        providerFeeKobo: 0n,
        method: "card",
      }));
      await f.service.verifyAttempt(
        f.actor,
        f.payment.id,
        initialized.attemptId,
        context(),
      );
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: initialized.attemptId },
        }),
      ).toMatchObject({ status: "SUCCESSFUL", verificationStatus: "MISMATCH" });
      await expect(
        f.service.submitManual(f.actor, f.payment.id, f.manual, randomUUID(), context()),
      ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING" });
      await expect(
        f.service.initializeMonnify(f.actor, f.payment.id, randomUUID(), context()),
      ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING" });
      expect(f.initialize).toHaveBeenCalledTimes(1);
      await expect(
        f.service.initializePaystack(f.actor, f.payment.id, originalKey, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: initialized.attemptId },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentLedgerEntry.findUniqueOrThrow({
          where: { sourceKey: `capture:${initialized.attemptId}` },
        }),
      ).toMatchObject({ amountKobo: 9999n });
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
      ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
    });
    it("does not replay a checkout URL after provider verification has finished the attempt", async () => {
      const f = await fixture();
      const originalKey = randomUUID();
      const first = await f.service.initializePaystack(
        f.actor,
        f.payment.id,
        originalKey,
        context(),
      );
      await f.service.verifyAttempt(f.actor, f.payment.id, first.attemptId, context());
      await expect(
        f.service.initializePaystack(f.actor, f.payment.id, originalKey, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      const next = await f.service.initializeMonnify(
        f.actor,
        f.payment.id,
        randomUUID(),
        context(),
      );
      expect(next.attemptId).not.toBe(first.attemptId);
      expect(f.initialize).toHaveBeenCalledTimes(2);
    });
    it("serializes different-key manual submissions and preserves the committed original replay", async () => {
      const f = await fixture();
      const keys = [randomUUID(), randomUUID()];
      const outcomes = await Promise.allSettled(
        keys.map((key) =>
          f.service.submitManual(f.actor, f.payment.id, f.manual, key, context()),
        ),
      );
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((r) => r.status === "rejected")).toMatchObject({
        reason: { statusCode: 409, code: "PAYMENT_ATTEMPT_PENDING" },
      });
      const winner = outcomes.findIndex((r) => r.status === "fulfilled");
      expect(
        await f.service.submitManual(
          f.actor,
          f.payment.id,
          f.manual,
          keys[winner]!,
          context(),
        ),
      ).toMatchObject({ id: f.payment.id, replayed: true });
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(1);
      expect(
        await prisma.manualPaymentReview.count({
          where: { paymentAttempt: { paymentId: f.payment.id } },
        }),
      ).toBe(1);
    });
    it("serializes competing providers before making an external initialization call", async () => {
      const f = await fixture();
      const outcomes = await Promise.allSettled([
        f.service.initializePaystack(f.actor, f.payment.id, randomUUID(), context()),
        f.service.initializeMonnify(f.actor, f.payment.id, randomUUID(), context()),
      ]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((r) => r.status === "rejected")).toMatchObject({
        reason: { statusCode: 409, code: "PAYMENT_ATTEMPT_PENDING" },
      });
      expect(f.initialize).toHaveBeenCalledTimes(1);
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(1);
    });
    it("blocks manual reporting while provider initialization is in flight, then preserves original checkout replay", async () => {
      let signalStarted = () => {},
        release = () => {};
      const started = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const f = await fixture(async () => {
        signalStarted();
        await gate;
      });
      const key = randomUUID();
      const inFlight = f.service.initializePaystack(
        f.actor,
        f.payment.id,
        key,
        context(),
      );
      try {
        await started;
        await expect(
          f.service.submitManual(
            f.actor,
            f.payment.id,
            f.manual,
            randomUUID(),
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409, code: "PAYMENT_ATTEMPT_PENDING" });
      } finally {
        release();
      }
      const first = await inFlight;
      expect(
        await f.service.initializePaystack(f.actor, f.payment.id, key, context()),
      ).toMatchObject({ replayed: true, attemptId: first.attemptId });
      expect(f.initialize).toHaveBeenCalledTimes(1);
    });
    it("requires verification after an uncertain initialization and allows a new attempt after a verified failure", async () => {
      const f = await fixture();
      f.initialize.mockRejectedValueOnce(new Error("Synthetic provider timeout"));
      await expect(
        f.service.initializePaystack(f.actor, f.payment.id, randomUUID(), context()),
      ).rejects.toThrow("Synthetic provider timeout");
      await expect(
        f.service.submitManual(f.actor, f.payment.id, f.manual, randomUUID(), context()),
      ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING" });
      const first = await prisma.paymentAttempt.findFirstOrThrow({
        where: { paymentId: f.payment.id },
      });
      await f.service.verifyAttempt(f.actor, f.payment.id, first.id, context());
      await f.service.submitManual(
        f.actor,
        f.payment.id,
        f.manual,
        randomUUID(),
        context(),
      );
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(2);
      expect(
        await prisma.paymentAttempt.count({
          where: {
            paymentId: f.payment.id,
            status: { in: ["INITIALIZED", "PENDING", "PROCESSING"] },
          },
        }),
      ).toBe(1);
    });
  },
);
