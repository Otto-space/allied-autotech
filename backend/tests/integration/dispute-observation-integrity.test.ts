import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import type { PaystackWebhookEvent } from "../../src/providers/payments/paystack-webhook.js";
const digest = () => createHash("sha256").update(randomUUID()).digest("hex");
type Provider = "PAYSTACK" | "MONNIFY";
const events: string[] = [];
async function observe(
  attempt: { internalReference: string },
  id: string,
  overrides: Partial<PaystackWebhookEvent> = {},
  database: PrismaClient = prisma,
) {
  const event: PaystackWebhookEvent = {
    eventType: "charge.dispute.resolve",
    providerEventId: randomUUID(),
    resourceId: id,
    reference: attempt.internalReference,
    gatewayTransactionId: null,
    status: "lost",
    amountKobo: 10000n,
    currency: "NGN",
    paidAt: null,
    providerFeeKobo: null,
    method: null,
    category: "OTHER",
    responseDueAt: null,
    ...overrides,
  };
  events.push(event.providerEventId!);
  await new PaymentsService(database).ingestWebhook(event, digest(), {
    requestId: randomUUID(),
    ipAddress: null,
    userAgent: null,
  });
  return prisma.paymentWebhookEvent.findFirstOrThrow({
    where: { provider: "PAYSTACK", providerEventId: event.providerEventId },
  });
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
  return { attempt };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Dispute observation integrity",
  () => {
    afterAll(() => prisma.$disconnect());
    afterEach(async () => {
      await prisma.paymentWebhookEvent.updateMany({
        where: { providerEventId: { in: events }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", failedAt: new Date(), lockedAt: null },
      });
      events.length = 0;
    });
    async function opened() {
      const f = await fixture("PAYSTACK"),
        id = randomUUID();
      await observe(f.attempt, id, {
        eventType: "charge.dispute.create",
        status: "awaiting_response",
        responseDueAt: new Date(Date.now() + 86400000),
      });
      const snapshot = () =>
        prisma.paymentDispute.findUniqueOrThrow({
          where: {
            provider_providerDisputeId: { provider: "PAYSTACK", providerDisputeId: id },
          },
        });
      const dispute = await snapshot();
      const ledger = () =>
        prisma.paymentLedgerEntry.findMany({ where: { disputeId: dispute.id } });
      return { ...f, id, dispute, snapshot, ledger };
    }
    it.each(["reference", "amount", "currency"] as const)(
      "retains a conflicting %s observation without settling the existing dispute",
      async (kind) => {
        const f = await opened(),
          other = await fixture("PAYSTACK"),
          before = await f.snapshot();
        const event = await observe(
          f.attempt,
          f.id,
          kind === "reference"
            ? { reference: other.attempt.internalReference }
            : kind === "amount"
              ? { amountKobo: 9000n }
              : { currency: "USD" },
        );
        expect(event.status).toBe("PROCESSED");
        expect(await f.snapshot()).toEqual(before);
        expect(await f.ledger()).toHaveLength(0);
        expect(
          await prisma.paymentAnomaly.count({
            where: { disputeId: f.dispute.id, paymentAttemptId: f.attempt.id },
          }),
        ).toBe(1);
        expect(
          await prisma.auditLog.count({
            where: {
              entityType: "DISPUTE",
              entityId: f.dispute.id,
              action: "DISPUTE_UPDATED",
            },
          }),
        ).toBe(1);
      },
    );
    for (const status of ["won", "lost", "accepted", "expired"] as const) {
      it.each(["awaiting_response", status === "won" ? "lost" : "won"])(
        `${status}: preserves resolution and ledger after a later %s callback`,
        async (later) => {
          const f = await opened();
          await observe(f.attempt, f.id, { status });
          const before = await f.snapshot(),
            ledger = await f.ledger();
          const event = await observe(f.attempt, f.id, {
            status: later,
            responseDueAt: new Date(Date.now() + 172800000),
          });
          expect(event.status).toBe("PROCESSED");
          expect(await f.snapshot()).toEqual(before);
          expect(await f.ledger()).toEqual(ledger);
          expect(
            await prisma.paymentAnomaly.count({ where: { disputeId: f.dispute.id } }),
          ).toBe(later === "awaiting_response" ? 0 : 1);
        },
      );
    }
    it("does not rewrite resolved metadata or append another change audit on a distinct matching event", async () => {
      const f = await opened();
      await observe(f.attempt, f.id);
      const before = await f.snapshot(),
        ledger = await f.ledger();
      await observe(f.attempt, f.id);
      expect(await f.snapshot()).toEqual(before);
      expect(await f.ledger()).toEqual(ledger);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "DISPUTE",
            entityId: f.dispute.id,
            action: "DISPUTE_UPDATED",
          },
        }),
      ).toBe(2);
    });
    it("serializes competing resolutions and retains the losing observation", async () => {
      const f = await opened();
      await Promise.all([
        observe(f.attempt, f.id, { status: "lost" }),
        observe(f.attempt, f.id, { status: "won" }),
      ]);
      const current = await f.snapshot();
      expect(["LOST", "WON"]).toContain(current.status);
      expect(await f.ledger()).toHaveLength(current.status === "LOST" ? 1 : 0);
      expect(
        await prisma.paymentAnomaly.count({ where: { disputeId: f.dispute.id } }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "DISPUTE",
            entityId: f.dispute.id,
            action: "DISPUTE_UPDATED",
          },
        }),
      ).toBe(2);
    });
    it("rolls back a conflict anomaly when another worker owns the webhook receipt", async () => {
      const f = await opened(),
        before = await f.snapshot();
      let replaced = false;
      const database = new Proxy(prisma, {
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
                                if (!replaced) {
                                  replaced = true;
                                  await prisma.paymentWebhookEvent.updateMany({
                                    where: { providerEventId: events.at(-1)! },
                                    data: {
                                      status: "PROCESSING",
                                      processingAttempts: { increment: 1 },
                                      lockedAt: new Date(),
                                    },
                                  });
                                }
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
      }) as PrismaClient;
      const event = await observe(f.attempt, f.id, { amountKobo: 9000n }, database);
      expect(replaced).toBe(true);
      expect(event.status).toBe("PROCESSING");
      expect(await f.snapshot()).toEqual(before);
      expect(await f.ledger()).toHaveLength(0);
      expect(
        await prisma.paymentAnomaly.count({ where: { disputeId: f.dispute.id } }),
      ).toBe(0);
    });
    it("allows operational metadata without changing a resolved financial outcome", async () => {
      const f = await opened();
      await observe(f.attempt, f.id);
      const before = await f.snapshot();
      const updated = await prisma.paymentDispute.update({
        where: { id: f.dispute.id },
        data: { escalatedAt: new Date() },
      });
      expect(updated.escalatedAt).not.toBeNull();
      expect(updated.status).toBe(before.status);
      expect(updated.resolvedAt).toEqual(before.resolvedAt);
    });
    it.each(["status", "resolvedAt"] as const)(
      "database rejects changing a resolved dispute's %s",
      async (field) => {
        const f = await opened();
        await observe(f.attempt, f.id);
        const before = await f.snapshot();
        await expect(
          prisma.paymentDispute.update({
            where: { id: f.dispute.id },
            data:
              field === "status"
                ? { status: "WON" }
                : { resolvedAt: new Date(before.resolvedAt!.getTime() + 1000) },
          }),
        ).rejects.toThrow();
        expect(await f.snapshot()).toEqual(before);
      },
    );
  },
);
