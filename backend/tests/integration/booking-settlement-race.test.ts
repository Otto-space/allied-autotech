import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { ExpirationWorker } from "../../src/workers/expiration.worker.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function fixture() {
  const user = await prisma.user.create({
    data: {
      email: `booking-race-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-password",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Isolated", lastName: "Booking", phone: "+2348000000000" },
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
      code: `BR-${randomUUID().slice(0, 8)}`,
      name: "Isolated booking race",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const staff = await prisma.user.create({
    data: {
      email: `booking-race-staff-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-password",
      role: "STAFF",
      emailVerifiedAt: new Date(),
      staffProfile: {
        create: { firstName: "Isolated", lastName: "Staff", branchId: branch.id },
      },
    },
    include: { staffProfile: true },
  });
  const service = await prisma.service.create({
    data: {
      name: "Isolated booking race",
      slug: `booking-race-${randomUUID()}`,
      pricingType: "FIXED",
      priceKobo: 10000n,
      durationMinutes: 30,
    },
  });
  const startsAt = new Date(Date.now() + 8 * 24 * 3600000);
  const slot = await prisma.bookingSlot.create({
    data: {
      branchId: branch.id,
      serviceId: service.id,
      staffId: staff.staffProfile!.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 1800000),
    },
  });
  const deadline = new Date(Date.now() - 10000);
  const paidAt = new Date(deadline.getTime() - 10000);
  const createdAt = new Date(paidAt.getTime() - 10000);
  const booking = await prisma.booking.create({
    data: {
      customerId: user.profile!.id,
      branchId: branch.id,
      serviceId: service.id,
      assignedStaffId: staff.staffProfile!.id,
      bookingSlotId: slot.id,
      scheduledAt: startsAt,
      status: "AWAITING_DEPOSIT",
      quotedPriceKobo: 10000n,
      createdAt,
      paymentHoldExpiresAt: deadline,
      depositBaseKobo: 10000n,
      depositBasisPoints: 3000,
      depositAmountKobo: 3000n,
      depositPolicyVersion: "booking-deposit-v1",
      depositTermsAcceptedAt: createdAt,
      depositPayment: {
        create: {
          customerId: user.profile!.id,
          paymentNumber: `BR-${randomUUID()}`,
          purpose: "BOOKING_DEPOSIT",
          amountKobo: 3000n,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
          status: "PROCESSING",
          createdAt,
          expiresAt: deadline,
        },
      },
    },
    include: { depositPayment: true },
  });
  const payment = booking.depositPayment!;
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      provider: "PAYSTACK",
      internalReference: `BR-${randomUUID()}`,
      status: "PENDING",
      amountKobo: 3000n,
      initiatedAt: createdAt,
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
        amountKobo: 3000n,
        currency: "NGN",
        paidAt,
        providerFeeKobo: 0n,
        gatewayTransactionId: `SYNTHETIC-${attempt.id}`,
        method: "card",
      };
    },
  };
  return { actor, booking, payment, attempt, paidAt, provider };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Booking settlement and expiry locking",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());
    for (const first of ["expiry", "settlement"] as const) {
      it(`completes both transactions when ${first} obtains its locks first`, async () => {
        const f = await fixture();
        const held = gate();
        const resume = gate();
        let paused = false;
        async function pause() {
          if (paused) return;
          paused = true;
          held.release();
          await resume.promise;
        }
        // The extension only pauses after real database work; writes and row locks remain real.
        // Prisma's extension type omits $on, which neither service uses.
        const database = prisma.$extends({
          query: {
            booking: {
              async findMany({ args, query }) {
                return query({ ...args, where: { ...args.where, id: f.booking.id } });
              },
              async findUnique({ args, query }) {
                const result = await query(args);
                if (
                  first === "expiry" &&
                  args.where.id === f.booking.id &&
                  args.select?.version
                )
                  await pause();
                return result;
              },
            },
            paymentLedgerEntry: {
              async upsert({ args, query }) {
                const result = await query(args);
                if (
                  first === "settlement" &&
                  args.where.sourceKey === `capture:${f.attempt.id}`
                )
                  await pause();
                return result;
              },
            },
          },
        }) as unknown as PrismaClient;
        const orders = new OrdersService(prisma);
        const vehicles = new VehicleSalesService(prisma);
        vi.spyOn(orders, "expireDueSystem").mockResolvedValue({ expired: 0 });
        vi.spyOn(vehicles, "expireSystem").mockResolvedValue({ expired: 0 });
        vi.spyOn(prisma.serviceQuote, "findMany").mockResolvedValue([]);
        vi.spyOn(prisma.inventoryReservation, "findMany").mockResolvedValue([]);
        const worker = new ExpirationWorker(database, orders, vehicles);
        const payments = new PaymentsService(
          database,
          new PaymentProviderRegistry({ PAYSTACK: f.provider }),
        );
        const expire = () =>
          worker.runOnce(1).then(
            (result) => ({ result }),
            (error: unknown) => ({ error }),
          );
        const verify = () =>
          payments.verifyAttempt(f.actor, f.payment.id, f.attempt.id, context()).then(
            () => null,
            (error: unknown) => error,
          );
        let expiry: ReturnType<typeof expire>;
        let verification: ReturnType<typeof verify>;
        if (first === "expiry") {
          expiry = expire();
          await held.promise;
          verification = verify();
        } else {
          verification = verify();
          await held.promise;
          expiry = expire();
        }
        try {
          await expect
            .poll(
              async () => {
                const rows = await prisma.$queryRaw<
                  { blocked: boolean }[]
                >`SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
            AND cardinality(pg_blocking_pids(pid)) > 0
            AND query LIKE '%FOR UPDATE%'
            AND (query LIKE '%"Booking"%' OR query LIKE '%"Payment"%')
          ) AS blocked`;
                return rows[0]?.blocked;
              },
              { timeout: 3000, interval: 20 },
            )
            .toBe(true);
        } finally {
          resume.release();
        }
        const results = await Promise.all([expiry, verification]);
        if ("error" in results[0]) throw results[0].error;
        expect(results[0]).toHaveProperty(
          "result.bookingHolds",
          first === "expiry" ? 1 : 0,
        );
        expect(results[1]).toBeNull();
        expect(
          await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
        ).toMatchObject({
          status: first === "expiry" ? "EXPIRED" : "REQUESTED",
          version: 1,
          depositPaidAt: first === "expiry" ? null : f.paidAt,
        });
        expect(
          await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
        ).toMatchObject({ status: "SUCCEEDED", settledAttemptId: f.attempt.id });
        expect(
          await prisma.bookingReminder.count({ where: { bookingId: f.booking.id } }),
        ).toBe(0);
        await payments.verifyAttempt(f.actor, f.payment.id, f.attempt.id, context());
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: f.attempt.id, type: "CAPTURE" },
          }),
        ).toBe(1);
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentAttemptId: f.attempt.id, type: "LATE_SUCCESS" },
          }),
        ).toBe(first === "expiry" ? 1 : 0);
      }, 20000);
    }
  },
);
