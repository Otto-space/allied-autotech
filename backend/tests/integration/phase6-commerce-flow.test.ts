import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";
async function createUser(role: UserRole, branchId?: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `${role.toLowerCase()}-${id}@example.test`,
      passwordHash: await hashPassword(`phase six passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Phase",
                lastName: id.slice(0, 8),
                phone: `+23481${id.replaceAll("-", "").slice(0, 8)}`,
                cart: { create: {} },
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Phase", lastName: role, branchId: branchId ?? null },
            },
          }),
    },
    select: {
      id: true,
      role: true,
      profile: { select: { id: true, cart: { select: { id: true } } } },
      staffProfile: { select: { id: true } },
    },
  });
}
async function createSession(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiry = new Date(now.getTime() + 3_600_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : now,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf };
}
const mutation = (session: Awaited<ReturnType<typeof createSession>>, key?: string) => ({
  Origin: origin,
  Cookie: session.cookie,
  "X-CSRF-Token": session.csrf,
  ...(key === undefined ? {} : { "Idempotency-Key": key }),
});

describe.skipIf(!runDatabaseTests)("Phase 6 orders, promotions, and billing", () => {
  afterAll(async () => prisma.$disconnect());
  it("keeps checkout pricing, promotion limits, inventory, invoices, and lifecycles atomic", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `P6-${randomUUID().slice(0, 8)}`,
        name: "Phase Six",
        address: "6 Test Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const otherBranch = await prisma.branch.create({
      data: {
        code: `P6-${randomUUID().slice(0, 8)}`,
        name: "Other Six",
        address: "7 Test Road",
        city: "Abuja",
        state: "FCT",
      },
    });
    const [admin, staff, otherStaff, first, second] = await Promise.all([
      createUser("ADMIN"),
      createUser("STAFF", branch.id),
      createUser("STAFF", otherBranch.id),
      createUser("CUSTOMER"),
      createUser("CUSTOMER"),
    ]);
    const [adminSession, staffSession, otherStaffSession, firstSession, secondSession] =
      await Promise.all([
        createSession(admin.id, admin.role),
        createSession(staff.id, staff.role),
        createSession(otherStaff.id, otherStaff.role),
        createSession(first.id, first.role),
        createSession(second.id, second.role),
      ]);
    const category = await prisma.category.create({
      data: { name: "P6 parts", slug: `p6-parts-${randomUUID().slice(0, 8)}` },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: "Secure filter",
        slug: `secure-filter-${randomUUID().slice(0, 8)}`,
        sku: `P6-${randomUUID().slice(0, 8)}`,
        priceKobo: 125_000n,
      },
    });
    const inventory = await prisma.inventory.create({
      data: { branchId: branch.id, productId: product.id, quantity: 10 },
    });
    await prisma.cartItem.createMany({
      data: [
        { cartId: first.profile!.cart!.id, productId: product.id, quantity: 2 },
        { cartId: second.profile!.cart!.id, productId: product.id, quantity: 2 },
      ],
    });
    const promotionResponse = await request(app)
      .post("/api/v1/admin/promotions")
      .set(mutation(adminSession))
      .send({
        name: "One secure use",
        code: `ONCE${randomUUID().slice(0, 6)}`,
        discountType: "PERCENTAGE",
        percentageBasisPoints: 1000,
        usageLimit: 1,
        perCustomerLimit: 1,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    expect(promotionResponse.status).toBe(201);
    const code = promotionResponse.body.data.code as string;
    const attempts = await Promise.all([
      request(app)
        .post("/api/v1/customers/orders/checkout")
        .set(mutation(firstSession, "phase6-first-checkout"))
        .send({
          branchId: branch.id,
          fulfillmentMethod: "COLLECTION",
          promotionCode: code,
        }),
      request(app)
        .post("/api/v1/customers/orders/checkout")
        .set(mutation(secondSession, "phase6-second-checkout"))
        .send({
          branchId: branch.id,
          fulfillmentMethod: "COLLECTION",
          promotionCode: code,
        }),
    ]);
    expect(attempts.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winningIndex = attempts.findIndex(({ status }) => status === 201);
    const winner = attempts[winningIndex]!;
    const winnerSession = winningIndex === 0 ? firstSession : secondSession;
    const loserSession = winningIndex === 0 ? secondSession : firstSession;
    const winnerUser = winningIndex === 0 ? first : second;
    expect(winner.body.data.order.subtotalKobo).toBe("250000");
    expect(winner.body.data.order.discountAmountKobo).toBe("25000");
    expect(winner.body.data.order.totalKobo).toBe("225000");
    expect(winner.body.data.order.invoice).toBeNull();
    const orderId = winner.body.data.order.id as string;
    const invoiceId = (await prisma.invoice.findUniqueOrThrow({ where: { orderId } })).id;
    const winnerKey =
      winningIndex === 0 ? "phase6-first-checkout" : "phase6-second-checkout";
    const replay = await request(app)
      .post("/api/v1/customers/orders/checkout")
      .set(mutation(winnerSession, winnerKey))
      .send({
        branchId: branch.id,
        fulfillmentMethod: "COLLECTION",
        promotionCode: code,
      });
    expect(replay.status).toBe(201);
    expect(replay.body.data.replayed).toBe(true);
    expect(replay.body.data.order.id).toBe(orderId);
    const crossCustomer = await request(app)
      .get(`/api/v1/customers/orders/${orderId}`)
      .set("Cookie", loserSession.cookie);
    expect(crossCustomer.status).toBe(404);
    const crossBranch = await request(app)
      .get(`/api/v1/staff/orders/${orderId}`)
      .set("Cookie", otherStaffSession.cookie);
    expect(crossBranch.status).toBe(403);
    const hiddenDraft = await request(app)
      .get(`/api/v1/customers/invoices/${invoiceId}`)
      .set("Cookie", winnerSession.cookie);
    expect(hiddenDraft.status).toBe(404);
    const issued = await request(app)
      .post(`/api/v1/staff/invoices/${invoiceId}/issue`)
      .set(mutation(adminSession))
      .send({ expectedVersion: 0 });
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe("ISSUED");
    const visibleInvoice = await request(app)
      .get(`/api/v1/customers/invoices/${invoiceId}`)
      .set("Cookie", winnerSession.cookie);
    expect(visibleInvoice.status).toBe(200);
    const confirmed = await request(app)
      .post(`/api/v1/staff/orders/${orderId}/status`)
      .set(mutation(staffSession))
      .send({ status: "CONFIRMED", expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.confirmedAt).toBeTruthy();
    const stockAfterConfirm = await prisma.inventory.findUniqueOrThrow({
      where: { id: inventory.id },
    });
    expect(stockAfterConfirm.quantity).toBe(8);
    expect(stockAfterConfirm.reserved).toBe(0);
    const stale = await request(app)
      .post(`/api/v1/staff/orders/${orderId}/status`)
      .set(mutation(staffSession))
      .send({ status: "PROCESSING", expectedVersion: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe(errorCodes.staleVersion);
    let version = 1;
    for (const status of ["PROCESSING", "READY", "COMPLETED"] as const) {
      const transition = await request(app)
        .post(`/api/v1/staff/orders/${orderId}/status`)
        .set(mutation(staffSession))
        .send({ status, expectedVersion: version });
      expect(transition.status).toBe(200);
      version = transition.body.data.version as number;
    }
    const loserCheckout = await request(app)
      .post("/api/v1/customers/orders/checkout")
      .set(mutation(loserSession, "phase6-loser-retry"))
      .send({ branchId: branch.id, fulfillmentMethod: "COLLECTION" });
    expect(loserCheckout.status).toBe(201);
    const loserOrderId = loserCheckout.body.data.order.id as string;
    const cancelled = await request(app)
      .post(`/api/v1/customers/orders/${loserOrderId}/cancel`)
      .set(mutation(loserSession))
      .send({ expectedVersion: 0, reason: "No longer required" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("CANCELLED");
    const cancelledStock = await prisma.inventory.findUniqueOrThrow({
      where: { id: inventory.id },
    });
    expect(cancelledStock.quantity).toBe(8);
    expect(cancelledStock.reserved).toBe(0);
    expect(
      await prisma.promotionUsage.count({
        where: { promotionId: promotionResponse.body.data.id },
      }),
    ).toBe(1);
    const bookingService = await prisma.service.create({
      data: {
        name: "Phase 6 billed service",
        slug: `phase-6-billed-${randomUUID().slice(0, 8)}`,
        pricingType: "QUOTE_REQUIRED",
        durationMinutes: 60,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        customerId: winnerUser.profile!.id,
        branchId: branch.id,
        serviceId: bookingService.id,
        assignedStaffId: staff.staffProfile!.id,
        scheduledAt: new Date(Date.now() + 86_400_000),
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    await prisma.serviceQuote.create({
      data: {
        bookingId: booking.id,
        createdByStaffId: staff.staffProfile!.id,
        quoteNumber: `P6Q-${randomUUID().slice(0, 12)}`,
        status: "ACCEPTED",
        subtotalKobo: 50_000n,
        taxKobo: 3_750n,
        totalKobo: 53_750n,
        issuedAt: new Date(),
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const bookingInvoice = await request(app)
      .post("/api/v1/staff/invoices")
      .set(mutation(adminSession))
      .send({ sourceType: "BOOKING", sourceId: booking.id });
    expect(bookingInvoice.status).toBe(201);
    expect(bookingInvoice.body.data.totalKobo).toBe("53750");

    const vehicle = await prisma.vehicle.create({
      data: {
        branchId: branch.id,
        stockNumber: `P6V-${randomUUID().slice(0, 8)}`,
        make: "Toyota",
        model: "Corolla",
        year: 2024,
      },
    });
    const listing = await prisma.vehicleListing.create({
      data: {
        vehicleId: vehicle.id,
        branchId: branch.id,
        title: "Phase 6 test vehicle",
        slug: `phase-6-vehicle-${randomUUID().slice(0, 8)}`,
        priceKobo: 20_000_000n,
      },
    });
    const vehicleTransaction = await prisma.vehicleTransaction.create({
      data: {
        vehicleListingId: listing.id,
        customerId: winnerUser.profile!.id,
        transactionNumber: `P6T-${randomUUID().slice(0, 12)}`,
        customerName: "Phase Customer",
        customerPhone: "+2348100000000",
        askingPriceKobo: 20_000_000n,
        agreedPriceKobo: 19_500_000n,
        status: "PAYMENT_PENDING",
        termsVersion: "v1",
        termsAcceptedAt: new Date(),
      },
    });
    const vehicleInvoice = await request(app)
      .post("/api/v1/staff/invoices")
      .set(mutation(adminSession))
      .send({ sourceType: "VEHICLE_TRANSACTION", sourceId: vehicleTransaction.id });
    expect(vehicleInvoice.status).toBe(201);
    expect(vehicleInvoice.body.data.totalKobo).toBe("19500000");
    const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId } });
    await expect(
      prisma.orderItem.update({ where: { id: orderItem.id }, data: { quantity: 99 } }),
    ).rejects.toThrow(/immutable/i);
    const usage = await prisma.promotionUsage.findFirstOrThrow({ where: { orderId } });
    await expect(
      prisma.promotionUsage.update({
        where: { id: usage.id },
        data: { discountAmountKobo: 1n },
      }),
    ).rejects.toThrow(/immutable/i);
    await expect(
      prisma.order.update({ where: { id: orderId }, data: { totalKobo: 1n } }),
    ).rejects.toThrow(/immutable/i);
    await expect(
      prisma.invoice.update({ where: { id: invoiceId }, data: { totalKobo: 1n } }),
    ).rejects.toThrow(/immutable/i);
    expect(
      await prisma.idempotencyRecord.count({
        where: { responseBody: { path: ["orderId"], equals: orderId } },
      }),
    ).toBe(1);
  }, 30_000);
});
