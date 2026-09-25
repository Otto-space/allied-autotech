import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type {
  PaymentProviderPort,
  VerifiedPayment,
} from "../../src/providers/payments/payment-provider.port.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function fixture(paymentProvider: "PAYSTACK" | "MONNIFY" = "PAYSTACK") {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Synthetic", lastName: "Capture", phone: "+2348000000000" },
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
      code: `CA-${randomUUID().slice(0, 8)}`,
      name: "Synthetic capture",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      customerId: user.profile!.id,
      branchId: branch.id,
      orderNumber: `CA-${randomUUID()}`,
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Synthetic Capture",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      paymentDueAt: new Date(Date.now() + 3600000),
    },
  });
  const results = new Map<string, VerifiedPayment>();
  const initialize = vi.fn<PaymentProviderPort["initialize"]>(async (command) => ({
    authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
    accessCode: "synthetic",
    providerReference: command.reference,
    authorizationExpiresAt: new Date(Date.now() + 3600000),
  }));
  const provider: PaymentProviderPort = {
    initialize,
    async verify(reference) {
      const result = results.get(reference);
      if (!result) throw new Error("Missing synthetic result");
      return result;
    },
    async refund(): Promise<never> {
      throw new Error("No refund allowed");
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
  let number = 0;
  async function attempt(overrides: Partial<VerifiedPayment> = {}) {
    const reference = `CA-${randomUUID()}`;
    const record = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: ++number,
        internalReference: reference,
        providerReference: reference,
        provider: paymentProvider,
        amountKobo: payment.amountKobo,
        status: "PENDING",
      },
    });
    results.set(reference, {
      reference,
      gatewayTransactionId: `synthetic-${reference}`,
      status: "success",
      amountKobo: 10000n,
      currency: "NGN",
      paidAt: new Date(),
      providerFeeKobo: 0n,
      method: "card",
      ...overrides,
    });
    return record;
  }
  const verify = (id: string) => service.verifyAttempt(actor, payment.id, id, context());
  return { actor, service, payment, order, results, attempt, verify, initialize };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "capture accounting and immutable observations",
  () => {
    afterAll(() => prisma.$disconnect());
    for (const provider of ["PAYSTACK", "MONNIFY"] as const)
      for (const concurrent of [false, true])
        it(`credits a reused ${provider} transaction ID once across orders (${concurrent ? "concurrent" : "sequential"})`, async () => {
          const first = await fixture(provider);
          const second = await fixture(provider);
          const gatewayTransactionId = randomUUID();
          const a = await first.attempt({ gatewayTransactionId });
          const b = await second.attempt({ gatewayTransactionId });
          if (concurrent) await Promise.all([first.verify(a.id), second.verify(b.id)]);
          else {
            await first.verify(a.id);
            await second.verify(b.id);
          }
          const attempts = await prisma.paymentAttempt.findMany({
            where: { id: { in: [a.id, b.id] } },
          });
          expect(attempts.filter((row) => row.status === "SUCCESSFUL")).toHaveLength(1);
          const held = attempts.find((row) => row.status === "PROCESSING")!;
          expect(held).toMatchObject({
            verificationStatus: "UNVERIFIED",
            verifiedAmountKobo: null,
            redactedGatewayData: { verificationHold: true },
          });
          expect(
            await prisma.paymentLedgerEntry.count({
              where: { paymentAttemptId: { in: [a.id, b.id] } },
            }),
          ).toBe(1);
          expect(
            await prisma.order.count({
              where: {
                id: { in: [first.order.id, second.order.id] },
                paidAt: { not: null },
              },
            }),
          ).toBe(1);
          expect(
            await prisma.payment.findUniqueOrThrow({ where: { id: held.paymentId } }),
          ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
          await Promise.all([first.verify(a.id), second.verify(b.id)]);
          expect(
            await prisma.paymentAnomaly.findMany({
              where: { paymentAttemptId: held.id },
            }),
          ).toEqual([
            expect.objectContaining({
              details: expect.objectContaining({ reason: "REUSED_PROVIDER_TRANSACTION" }),
            }),
          ]);
          const heldFixture = held.id === a.id ? first : second;
          await expect(
            heldFixture.service.initializePaystack(
              heldFixture.actor,
              heldFixture.payment.id,
              randomUUID(),
              context(),
            ),
          ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING" });
        });
    it("does not treat a reused transaction ID as a second charge on the same payment", async () => {
      const f = await fixture();
      const gatewayTransactionId = randomUUID();
      const a = await f.attempt({ gatewayTransactionId });
      const b = await f.attempt({ gatewayTransactionId });
      await Promise.all([f.verify(a.id), f.verify(b.id)]);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: { in: [a.id, b.id] } },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentAttempt.count({
          where: { paymentId: f.payment.id, status: "SUCCESSFUL" },
        }),
      ).toBe(1);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
      ).toMatchObject({ status: "SUCCEEDED" });
    });
    it("reserves identity for a mismatched receipt without allocating it to another order", async () => {
      const first = await fixture();
      const second = await fixture();
      const gatewayTransactionId = randomUUID();
      const a = await first.attempt({ gatewayTransactionId, amountKobo: 9999n });
      const b = await second.attempt({ gatewayTransactionId });
      await first.verify(a.id);
      await second.verify(b.id);
      expect(
        await prisma.paymentLedgerEntry.findMany({
          where: { paymentAttemptId: { in: [a.id, b.id] } },
        }),
      ).toEqual([expect.objectContaining({ amountKobo: 9999n })]);
      expect(
        await prisma.order.count({
          where: { id: { in: [first.order.id, second.order.id] }, paidAt: { not: null } },
        }),
      ).toBe(0);
    });
    it("keeps transaction identities separate between providers", async () => {
      const first = await fixture("PAYSTACK");
      const second = await fixture("MONNIFY");
      const gatewayTransactionId = randomUUID();
      const a = await first.attempt({ gatewayTransactionId });
      const b = await second.attempt({ gatewayTransactionId });
      await Promise.all([first.verify(a.id), second.verify(b.id)]);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: { in: [a.id, b.id] } },
        }),
      ).toBe(2);
      expect(
        await prisma.order.count({
          where: { id: { in: [first.order.id, second.order.id] }, paidAt: { not: null } },
        }),
      ).toBe(2);
    });
    it("enforces receipt identity in the database even outside the service", async () => {
      const first = await fixture();
      const second = await fixture();
      const gatewayTransactionId = randomUUID();
      const a = await first.attempt({ gatewayTransactionId });
      const b = await second.attempt({ gatewayTransactionId });
      await first.verify(a.id);
      await expect(
        prisma.paymentAttempt.update({
          where: { id: b.id },
          data: {
            status: "SUCCESSFUL",
            verificationStatus: "VERIFIED",
            verifiedAmountKobo: 10000n,
            verifiedCurrency: "NGN",
            verifiedAt: new Date(),
            paidAt: new Date(),
            gatewayTransactionId,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });
    for (const duringInitialization of [false, true])
      it(`does not return a held checkout URL (${duringInitialization ? "during initialization" : "original-key replay"})`, async () => {
        const f = await fixture();
        async function hold(reference: string) {
          const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
            where: { internalReference: reference },
          });
          f.results.set(reference, {
            reference,
            gatewayTransactionId: `synthetic-${reference}`,
            status: "success",
            amountKobo: 10000n,
            currency: "USD",
            paidAt: new Date(),
            providerFeeKobo: 0n,
            method: "card",
          });
          await f.verify(attempt.id);
        }
        const key = randomUUID();
        if (duringInitialization) {
          const original = f.initialize.getMockImplementation()!;
          f.initialize.mockImplementation(async (command) => {
            await hold(command.reference);
            return original(command);
          });
          await expect(
            f.service.initializePaystack(f.actor, f.payment.id, key, context()),
          ).rejects.toMatchObject({ statusCode: 409 });
        } else {
          const first = await f.service.initializePaystack(
            f.actor,
            f.payment.id,
            key,
            context(),
          );
          const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
            where: { id: first.attemptId },
          });
          await hold(attempt.internalReference);
        }
        await expect(
          f.service.initializePaystack(f.actor, f.payment.id, key, context()),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(f.initialize).toHaveBeenCalledTimes(1);
      });
    for (const status of ["CANCELLED", "EXPIRED"] as const)
      it(`keeps a late mismatch for a ${status} payment under review with valid timestamps`, async () => {
        const f = await fixture();
        const attempt = await f.attempt({ amountKobo: 9999n });
        await prisma.payment.update({
          where: { id: f.payment.id },
          data: {
            status,
            ...(status === "CANCELLED"
              ? { cancelledAt: new Date() }
              : { expiredAt: new Date() }),
          },
        });
        await f.verify(attempt.id);
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
        ).toMatchObject({
          status: "REQUIRES_REVIEW",
          cancelledAt: null,
          expiredAt: null,
        });
      });
    for (const concurrent of [false, true])
      it(`records both exact captures on one payment (${concurrent ? "concurrent" : "sequential"}) without settling twice`, async () => {
        const f = await fixture();
        const first = await f.attempt(),
          second = await f.attempt();
        if (concurrent) await Promise.all([f.verify(first.id), f.verify(second.id)]);
        else {
          await f.verify(first.id);
          await f.verify(second.id);
        }
        const payment = await prisma.payment.findUniqueOrThrow({
          where: { id: f.payment.id },
        });
        expect(payment.status).toBe("SUCCEEDED");
        expect([first.id, second.id]).toContain(payment.settledAttemptId);
        expect(
          await prisma.paymentAttempt.count({
            where: {
              paymentId: payment.id,
              status: "SUCCESSFUL",
              verificationStatus: "VERIFIED",
            },
          }),
        ).toBe(2);
        const ledger = await prisma.paymentLedgerEntry.findMany({
          where: { paymentAttemptId: { in: [first.id, second.id] } },
        });
        expect(ledger).toHaveLength(2);
        expect(ledger.reduce((sum, row) => sum + row.amountKobo, 0n)).toBe(20000n);
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentId: payment.id, type: "DUPLICATE_SUCCESS" },
          }),
        ).toBe(1);
        await Promise.all([f.verify(first.id), f.verify(second.id)]);
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: { in: [first.id, second.id] } },
          }),
        ).toBe(2);
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentId: payment.id, type: "DUPLICATE_SUCCESS" },
          }),
        ).toBe(1);
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
        ).toMatchObject({
          settledAttemptId: payment.settledAttemptId,
          succeededAt: payment.succeededAt,
        });
      });
    it("replays an amount mismatch without rewriting its immutable facts or duplicating anomalies", async () => {
      const f = await fixture();
      const attempt = await f.attempt({ amountKobo: 9999n });
      await f.verify(attempt.id);
      const stored = await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      await Promise.all([f.verify(attempt.id), f.verify(attempt.id)]);
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      ).toEqual(stored);
      expect(
        await prisma.paymentAnomaly.count({ where: { paymentAttemptId: attempt.id } }),
      ).toBe(1);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
      ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: attempt.id },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentLedgerEntry.findUniqueOrThrow({
          where: { sourceKey: `capture:${attempt.id}` },
        }),
      ).toMatchObject({ amountKobo: 9999n, currency: "NGN" });
      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } }),
      ).toMatchObject({ paidAt: null });
    });
    for (const firstAmount of [10000n, 9999n])
      it(`retains conflicting later reports without rewriting the first ${firstAmount} capture`, async () => {
        const f = await fixture();
        const attempt = await f.attempt({ amountKobo: firstAmount });
        await f.verify(attempt.id);
        const stored = await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: attempt.id },
        });
        f.results.set(attempt.internalReference, {
          ...f.results.get(attempt.internalReference)!,
          amountKobo: firstAmount === 10000n ? 9999n : 10000n,
        });
        await Promise.all([f.verify(attempt.id), f.verify(attempt.id)]);
        expect(
          await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        ).toEqual(stored);
        const observations = await prisma.paymentAnomaly.findMany({
          where: { paymentAttemptId: attempt.id, type: "OTHER" },
        });
        expect(observations).toHaveLength(1);
        expect(observations[0]!.details).toMatchObject({
          reason: "CONFLICTING_PROVIDER_FACTS",
        });
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: attempt.id },
          }),
        ).toBe(1);
        expect(
          await prisma.paymentLedgerEntry.findUniqueOrThrow({
            where: { sourceKey: `capture:${attempt.id}` },
          }),
        ).toMatchObject({ amountKobo: firstAmount });
      });
    it("records an early mismatched webhook before checkout finalization supplies a provider reference", async () => {
      const f = await fixture();
      const attempt = await f.attempt({ amountKobo: 9999n });
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { providerReference: null },
      });
      await f.verify(attempt.id);
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      ).toMatchObject({
        status: "SUCCESSFUL",
        verificationStatus: "MISMATCH",
        providerReference: attempt.internalReference,
        verifiedAmountKobo: 9999n,
      });
    });
    for (const invalid of [
      { currency: "USD" },
      { amountKobo: 0n },
      { reference: "another-reference" },
    ])
      it(`retains an unallocatable result ${Object.keys(invalid)[0]} for review without inventing NGN capture facts`, async () => {
        const f = await fixture();
        const attempt = await f.attempt(invalid);
        await Promise.all([f.verify(attempt.id), f.verify(attempt.id)]);
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
        ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
        expect(
          await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        ).toMatchObject({
          status: "PROCESSING",
          verificationStatus: "UNVERIFIED",
          verifiedAmountKobo: null,
          verifiedCurrency: null,
        });
        expect(
          await prisma.paymentAnomaly.count({ where: { paymentAttemptId: attempt.id } }),
        ).toBe(1);
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: attempt.id },
          }),
        ).toBe(0);
        // A later apparently matching response must not silently resolve contradictory money evidence.
        f.results.set(attempt.internalReference, {
          ...f.results.get(attempt.internalReference)!,
          reference: attempt.internalReference,
          currency: "NGN",
          amountKobo: 10000n,
        });
        await f.verify(attempt.id);
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
        ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
        await expect(
          f.service.initializePaystack(f.actor, f.payment.id, randomUUID(), context()),
        ).rejects.toMatchObject({ code: "PAYMENT_ATTEMPT_PENDING" });
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: attempt.id },
          }),
        ).toBe(0);
      });
    it("preserves successful capture facts when a later report says failed", async () => {
      const f = await fixture();
      const attempt = await f.attempt();
      await f.verify(attempt.id);
      const stored = await prisma.paymentAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      f.results.set(attempt.internalReference, {
        ...f.results.get(attempt.internalReference)!,
        status: "failed",
      });
      await Promise.all([f.verify(attempt.id), f.verify(attempt.id)]);
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      ).toEqual(stored);
      expect(
        await prisma.paymentAnomaly.count({
          where: { paymentAttemptId: attempt.id, type: "OTHER" },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: attempt.id },
        }),
      ).toBe(1);
    });
  },
);
