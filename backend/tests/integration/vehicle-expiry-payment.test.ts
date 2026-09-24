import { hashToken } from "../../src/common/security/session-tokens.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
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
      code: `VX-${randomUUID().slice(0, 8)}`,
      name: "Isolated expiry",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      branchId: branch.id,
      stockNumber: `VX-${randomUUID()}`,
      make: "Test",
      model: "Expiry",
      year: 2025,
    },
  });
  const listing = await prisma.vehicleListing.create({
    data: {
      vehicleId: vehicle.id,
      branchId: branch.id,
      title: "Isolated expiry",
      slug: `expiry-${randomUUID()}`,
      priceKobo: 10000n,
      status: "RESERVED",
      publishedAt: new Date(),
      reservedAt: new Date(),
    },
  });
  const sale = await prisma.vehicleTransaction.create({
    data: {
      customerId: profile.id,
      vehicleListingId: listing.id,
      transactionNumber: `VX-${randomUUID()}`,
      askingPriceKobo: 10000n,
      agreedPriceKobo: 10000n,
      customerName: "Isolated Expiry",
      customerEmail: owner.email,
      customerPhone: "+2348000000000",
      status: "PAYMENT_PENDING",
      termsVersion: "synthetic-expiry-test",
      termsAcceptedAt: new Date(),
      reservationExpiresAt: new Date(Date.now() + 3600000),
    },
  });
  if (state !== "unpaid") {
    const payments = new PaymentsService(prisma);
    await expect(
      payments.createIntent(
        owner,
        {
          targetType: "VEHICLE_TRANSACTION",
          targetId: sale.id,
          purpose: "VEHICLE_FULL_PAYMENT",
        },
        randomUUID(),
        context(),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    // Historical in-flight money is protected without enabling new draft-policy deposits.
    await prisma.payment.create({
      data: {
        customerId: profile.id,
        vehicleTransactionId: sale.id,
        paymentNumber: `VX-${randomUUID()}`,
        idempotencyKeyHash: hashToken("payment-idempotency", randomUUID()),
        purpose: "VEHICLE_FULL_PAYMENT",
        amountKobo: sale.agreedPriceKobo,
        status: state === "review" ? "REQUIRES_REVIEW" : "PROCESSING",
        attempts: {
          create: {
            attemptNumber: 1,
            internalReference: `VX-${randomUUID()}`,
            provider: state === "review" ? "MANUAL" : "PAYSTACK",
            status: "PROCESSING",
            amountKobo: sale.agreedPriceKobo,
          },
        },
      },
    });
  }

  await prisma.vehicleTransaction.update({
    where: { id: sale.id },
    data: { reservationExpiresAt: new Date(Date.now() - 1000) },
  });
  // Isolate candidate discovery only; all locks, payment reads, writes and audits are real.
  const candidates = vi
    .spyOn(prisma.vehicleTransaction, "findMany")
    .mockResolvedValue([sale]);
  return { sale, listing, candidates };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Vehicle expiry payment protection",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());
    for (const mode of ["operator", "worker"] as const) {
      for (const state of ["unpaid", "review", "processing"] as const) {
        it(`${mode} expiry ${state === "unpaid" ? "releases an unpaid listing once" : `preserves the listing during ${state}`}`, async () => {
          const f = await fixture(state);
          const administrator = await account("ADMIN");
          const service = new VehicleSalesService(prisma);
          const expire = () =>
            mode === "operator"
              ? service.expire(administrator, { limit: 100 }, context())
              : service.expireSystem(100);
          expect(await expire()).toEqual({ expired: state === "unpaid" ? 1 : 0 });
          expect(await expire()).toEqual({ expired: 0 });
          expect(
            (
              await prisma.vehicleTransaction.findUniqueOrThrow({
                where: { id: f.sale.id },
              })
            ).status,
          ).toBe(state === "unpaid" ? "EXPIRED" : "PAYMENT_PENDING");
          expect(
            (
              await prisma.vehicleListing.findUniqueOrThrow({
                where: { id: f.listing.id },
              })
            ).status,
          ).toBe(state === "unpaid" ? "AVAILABLE" : "RESERVED");
          expect(
            await prisma.vehicleTransactionStatusHistory.count({
              where: { vehicleTransactionId: f.sale.id, toStatus: "EXPIRED" },
            }),
          ).toBe(state === "unpaid" ? 1 : 0);
          const audit = await prisma.auditLog.findMany({
            where: {
              entityType: "VEHICLE_TRANSACTION",
              entityId: f.sale.id,
              action: "VEHICLE_RELEASED",
            },
          });
          expect(audit).toHaveLength(state === "unpaid" ? 1 : 0);
          if (state === "unpaid")
            expect(audit[0]?.userId).toBe(
              mode === "operator" ? administrator.userId : null,
            );
        });
      }
      it(`${mode} rechecks a deadline extended after candidate selection`, async () => {
        const f = await fixture("unpaid");
        const administrator = await account("ADMIN");
        f.candidates.mockImplementationOnce(async () => {
          await prisma.vehicleTransaction.update({
            where: { id: f.sale.id },
            data: { reservationExpiresAt: new Date(Date.now() + 3600000) },
          });
          return [f.sale];
        });
        const service = new VehicleSalesService(prisma);
        const result =
          mode === "operator"
            ? await service.expire(administrator, { limit: 100 }, context())
            : await service.expireSystem(100);
        expect(result).toEqual({ expired: 0 });
        expect(
          (await prisma.vehicleListing.findUniqueOrThrow({ where: { id: f.listing.id } }))
            .status,
        ).toBe("RESERVED");
      });
    }
    it("expires once when worker and operator race", async () => {
      const f = await fixture("unpaid");
      const administrator = await account("ADMIN");
      const service = new VehicleSalesService(prisma);
      const results = await Promise.all([
        service.expire(administrator, { limit: 100 }, context()),
        service.expireSystem(100),
      ]);
      expect(results.map((result) => result.expired).sort()).toEqual([0, 1]);
      expect(
        await prisma.vehicleTransactionStatusHistory.count({
          where: { vehicleTransactionId: f.sale.id, toStatus: "EXPIRED" },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "VEHICLE_TRANSACTION",
            entityId: f.sale.id,
            action: "VEHICLE_RELEASED",
          },
        }),
      ).toBe(1);
    });
  },
);
