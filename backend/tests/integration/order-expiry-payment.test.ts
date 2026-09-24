import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { OrdersRepository } from "../../src/modules/orders/orders.repository.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function account(role: "CUSTOMER" | "ADMIN"): Promise<AuthenticatedActor> {
  const user = await prisma.user.create({
    data: {
      email: `expiry-${randomUUID()}@example.test`,
      passwordHash: "unusable-test-password",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Isolated",
                lastName: "Expiry",
                phone: "+2348000000000",
              },
            },
          }
        : {}),
    },
  });
  return {
    userId: user.id,
    email: user.email,
    role,
    sessionId: randomUUID(),
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
  };
}
async function fixture(state: "unpaid" | "review" | "processing") {
  const owner = await account("CUSTOMER");
  const profile = await prisma.customerProfile.findUniqueOrThrow({
    where: { userId: owner.userId },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `EX-${randomUUID().slice(0, 8)}`,
      name: "Isolated expiry",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const category = await prisma.category.create({
    data: { name: "Expiry", slug: `expiry-${randomUUID()}` },
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: "Isolated part",
      slug: `expiry-${randomUUID()}`,
      sku: `EX-${randomUUID()}`,
      priceKobo: 10000n,
    },
  });
  const inventory = await prisma.inventory.create({
    data: { productId: product.id, branchId: branch.id, quantity: 3, reserved: 1 },
  });
  const order = await prisma.order.create({
    data: {
      customerId: profile.id,
      branchId: branch.id,
      orderNumber: `EX-${randomUUID()}`,
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Isolated Expiry",
      customerEmail: owner.email,
      customerPhone: "+2348000000000",
      paymentDueAt: new Date(Date.now() + 3600000),
    },
  });
  const reservation = await prisma.inventoryReservation.create({
    data: {
      inventoryId: inventory.id,
      customerId: profile.id,
      quantity: 1,
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() - 1000),
      idempotencyKey: randomUUID(),
      requestHash: "a".repeat(64),
      referenceType: "ORDER",
      referenceId: order.id,
    },
  });
  if (state !== "unpaid") {
    const payments = new PaymentsService(prisma);
    await payments.createIntent(
      owner,
      { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
      randomUUID(),
      context(),
    );
    const payment = await prisma.payment.findFirstOrThrow({
      where: { orderId: order.id },
    });
    if (state === "review") {
      await payments.submitManual(
        owner,
        payment.id,
        {
          method: "BANK_TRANSFER",
          payerName: "Isolated Expiry",
          transferredAt: new Date().toISOString(),
        },
        randomUUID(),
        context(),
      );
    } else {
      await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: `EX-${randomUUID()}`,
          provider: "PAYSTACK",
          status: "PROCESSING",
          amountKobo: payment.amountKobo,
        },
      });
    }
  }
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentDueAt: new Date(Date.now() - 1000) },
  });
  const candidate = { id: order.id, version: order.version };
  // Isolate candidate discovery; all locking, payment reads, releases and audits use real PostgreSQL.
  const candidates = vi
    .spyOn(OrdersRepository.prototype, "dueOrderIds")
    .mockResolvedValue([candidate]);
  return { order, reservation, inventory, candidates, candidate };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Strict unpaid order expiry",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());
    for (const mode of ["operator", "worker"] as const) {
      for (const state of ["unpaid", "review", "processing"] as const) {
        it(`${mode} expiry releases stock once during ${state}`, async () => {
          const f = await fixture(state);
          const administrator = await account("ADMIN");
          const service = new OrdersService(prisma);
          const expire = () =>
            mode === "operator"
              ? service.expireDue(administrator, { limit: 100 }, context())
              : service.expireDueSystem(100);
          expect(await expire()).toEqual({ expired: 1 });
          expect(await expire()).toEqual({ expired: 0 });
          expect(
            (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).status,
          ).toBe("CANCELLED");
          expect(
            (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
              .reserved,
          ).toBe(0);
          expect(
            (
              await prisma.inventoryReservation.findUniqueOrThrow({
                where: { id: f.reservation.id },
              })
            ).status,
          ).toBe("RELEASED");
          expect(
            await prisma.inventoryTransaction.count({
              where: { referenceId: f.order.id, type: "RESERVATION_RELEASE" },
            }),
          ).toBe(1);
          const audit = await prisma.auditLog.findMany({
            where: { entityType: "ORDER", entityId: f.order.id, action: "STATUS_CHANGE" },
          });
          expect(audit).toHaveLength(1);
          if (state === "unpaid")
            expect(audit[0]?.userId).toBe(
              mode === "operator" ? administrator.userId : null,
            );
        });
      }
    }
    it("rechecks extended deadlines and permits only one winner when worker and operator race", async () => {
      const f = await fixture("unpaid");
      const administrator = await account("ADMIN");
      const service = new OrdersService(prisma);
      f.candidates.mockImplementationOnce(async () => {
        await prisma.order.update({
          where: { id: f.order.id },
          data: { paymentDueAt: new Date(Date.now() + 3600000) },
        });
        return [f.candidate];
      });
      expect(await service.expireDue(administrator, { limit: 100 }, context())).toEqual({
        expired: 0,
      });
      await prisma.order.update({
        where: { id: f.order.id },
        data: { paymentDueAt: new Date(Date.now() - 1000) },
      });
      const results = await Promise.all([
        service.expireDue(administrator, { limit: 100 }, context()),
        service.expireDueSystem(100),
      ]);
      expect(results.map((result) => result.expired).sort()).toEqual([0, 1]);
      expect(
        await prisma.inventoryTransaction.count({
          where: { referenceId: f.order.id, type: "RESERVATION_RELEASE" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "ORDER", entityId: f.order.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
    });
  },
);
