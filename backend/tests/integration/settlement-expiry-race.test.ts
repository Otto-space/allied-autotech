import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { OrdersRepository } from "../../src/modules/orders/orders.repository.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { VehicleSalesRepository } from "../../src/modules/vehicle-sales/vehicle-sales.repository.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function account(role: "CUSTOMER" | "ADMIN"): Promise<AuthenticatedActor> {
  const user = await prisma.user.create({
    data: {
      role,
      email: `settlement-expiry-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-password",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Isolated",
                lastName: "Race",
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
async function fixture(kind: "order" | "vehicle") {
  const owner = await account("CUSTOMER");
  const administrator = await account("ADMIN");
  const customer = await prisma.customerProfile.findUniqueOrThrow({
    where: { userId: owner.userId },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `SX-${randomUUID().slice(0, 8)}`,
      name: "Isolated settlement",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const deadline = new Date(Date.now() - 10000);
  const paidAt = new Date(deadline.getTime() - 10000);
  const snapshot = {
    customerId: customer.id,
    customerName: "Isolated Race",
    customerEmail: owner.email,
    customerPhone: "+2348000000000",
  };
  const order =
    kind === "order"
      ? await prisma.order.create({
          data: {
            ...snapshot,
            branchId: branch.id,
            orderNumber: `SX-${randomUUID()}`,
            subtotalKobo: 10000n,
            totalKobo: 10000n,
            paymentDueAt: deadline,
          },
        })
      : null;
  const vehicle =
    kind === "vehicle"
      ? await prisma.vehicle.create({
          data: {
            branchId: branch.id,
            stockNumber: `SX-${randomUUID()}`,
            make: "Test",
            model: "Race",
            year: 2025,
          },
        })
      : null;
  const listing = vehicle
    ? await prisma.vehicleListing.create({
        data: {
          branchId: branch.id,
          vehicleId: vehicle.id,
          title: "Isolated race",
          slug: `sx-${randomUUID()}`,
          priceKobo: 10000n,
          status: "RESERVED",
          publishedAt: paidAt,
          reservedAt: paidAt,
        },
      })
    : null;
  const sale = listing
    ? await prisma.vehicleTransaction.create({
        data: {
          ...snapshot,
          vehicleListingId: listing.id,
          transactionNumber: `SX-${randomUUID()}`,
          askingPriceKobo: 10000n,
          agreedPriceKobo: 10000n,
          status: "PAYMENT_PENDING",
          termsVersion: "synthetic-race-test",
          termsAcceptedAt: paidAt,
          reservationExpiresAt: deadline,
        },
      })
    : null;
  const payment = await prisma.payment.create({
    data: {
      customerId: customer.id,
      paymentNumber: `SX-${randomUUID()}`,
      purpose: kind === "order" ? "ORDER_PAYMENT" : "VEHICLE_FULL_PAYMENT",
      ...(order ? { orderId: order.id } : { vehicleTransactionId: sale!.id }),
      amountKobo: 10000n,
      idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
      status: "PROCESSING",
      createdAt: new Date(paidAt.getTime() - 20000),
      expiresAt: deadline,
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      provider: "PAYSTACK",
      internalReference: `SX-${randomUUID()}`,
      status: "PENDING",
      amountKobo: 10000n,
      initiatedAt: new Date(paidAt.getTime() - 10000),
    },
  });
  const unused = async (): Promise<never> => {
    throw new Error("Unexpected provider operation");
  };
  const provider: PaymentProviderPort = {
    initialize: unused,
    refund: unused,
    async verify(reference) {
      return {
        reference,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt,
        providerFeeKobo: 0n,
        gatewayTransactionId: `SYNTHETIC-${attempt.id}`,
        method: "card",
      };
    },
  };
  const payments = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: provider }),
  );
  return { owner, administrator, order, listing, sale, payment, attempt, payments };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Settlement racing payable expiry",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());
    for (const kind of ["order", "vehicle"] as const) {
      it(`records a late capture without restoring an expired ${kind} when expiry owns the source lock`, async () => {
        const f = await fixture(kind);
        const held = gate();
        const resume = gate();
        let expiryPid = 0;
        async function hold(tx: Prisma.TransactionClient) {
          const rows = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          expiryPid = rows[0]!.pid;
          held.release();
          await resume.promise;
        }
        if (f.order) {
          vi.spyOn(OrdersRepository.prototype, "dueOrderIds").mockResolvedValue([
            { id: f.order.id, version: f.order.version },
          ]);
          const original = OrdersRepository.prototype.lockOrder;
          vi.spyOn(OrdersRepository.prototype, "lockOrder").mockImplementation(
            async function (this: OrdersRepository, id, tx) {
              const result = await original.call(this, id, tx);
              await hold(tx);
              return result;
            },
          );
        } else {
          vi.spyOn(prisma.vehicleTransaction, "findMany").mockResolvedValue([f.sale!]);
          const original = VehicleSalesRepository.prototype.lockTransaction;
          vi.spyOn(
            VehicleSalesRepository.prototype,
            "lockTransaction",
          ).mockImplementation(async function (this: VehicleSalesRepository, id, tx) {
            const result = await original.call(this, id, tx);
            await hold(tx);
            return result;
          });
        }
        const expiry = (
          kind === "order"
            ? new OrdersService(prisma).expireDue(
                f.administrator,
                { limit: 1 },
                context(),
              )
            : new VehicleSalesService(prisma).expire(
                f.administrator,
                { limit: 1 },
                context(),
              )
        ).then(
          (result) => ({ result }),
          (error: unknown) => ({ error }),
        );
        await held.promise;
        const verification = f.payments
          .verifyAttempt(f.owner, f.payment.id, f.attempt.id, context())
          .then(
            () => null,
            (error: unknown) => error,
          );
        try {
          // Observe actual PostgreSQL contention, rather than timing a sleep or replacing settlement writes.
          await expect
            .poll(
              async () => {
                const rows = await prisma.$queryRaw<
                  { blocked: boolean }[]
                >`SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND ${expiryPid}::int = ANY(pg_blocking_pids(pid))
          ) AS blocked`;
                return rows[0]?.blocked;
              },
              { timeout: 3000, interval: 20 },
            )
            .toBe(true);
        } finally {
          resume.release();
        }
        expect(await expiry).toEqual({ result: { expired: 1 } });
        expect(await verification).toBeNull();
        expect(
          (await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }))
            .status,
        ).toBe("SUCCEEDED");
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: f.attempt.id, type: "CAPTURE" },
          }),
        ).toBe(1);
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentAttemptId: f.attempt.id, type: "LATE_SUCCESS" },
          }),
        ).toBe(1);
        if (f.order) {
          expect(
            await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } }),
          ).toMatchObject({ status: "CANCELLED", paidAt: null });
        } else {
          expect(
            await prisma.vehicleTransaction.findUniqueOrThrow({
              where: { id: f.sale!.id },
            }),
          ).toMatchObject({ status: "EXPIRED", paidAt: null });
          expect(
            (
              await prisma.vehicleListing.findUniqueOrThrow({
                where: { id: f.listing!.id },
              })
            ).status,
          ).toBe("AVAILABLE");
        }
        await f.payments.verifyAttempt(f.owner, f.payment.id, f.attempt.id, context());
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentAttemptId: f.attempt.id, type: "LATE_SUCCESS" },
          }),
        ).toBe(1);
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: f.attempt.id, type: "CAPTURE" },
          }),
        ).toBe(1);
      });
    }
  },
);
