import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { customerCareSchema } from "../../src/modules/overview/customer-care.schemas.js";

async function account(role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  const user = await prisma.user.create({
    data: {
      email: `care-${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: { firstName: "Care", lastName: "QA", phone: "+2348000000000" },
            },
          }
        : {}),
    },
    include: { profile: true },
  });
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 3600000);
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "ADMIN" ? new Date() : null,
    },
  });
  return { user, cookie: `${sessionCookieName}=${token}` };
}
const endpoint = "/api/v1/customers/overview?from=2000-01-01&to=2000-01-01";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "customer current-care overview",
  () => {
    const app = createApp({ checkReadiness: async () => undefined });
    afterAll(async () => prisma.$disconnect());
    it("projects current care independently of historical totals and excludes private/foreign/expired records", async () => {
      const own = await account(),
        stranger = await account();
      const customerId = own.user.profile!.id;
      const now = new Date(),
        future = new Date(Date.now() + 86400000),
        later = new Date(Date.now() + 172800000),
        past = new Date(Date.now() - 86400000);
      const branch = await prisma.branch.create({
        data: {
          code: `CARE-${randomUUID().slice(0, 8)}`,
          name: "Care branch",
          address: "QA",
          city: "QA",
          state: "QA",
        },
      });
      const operator = await prisma.user.create({
        data: {
          email: `care-staff-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role: "STAFF",
          staffProfile: {
            create: { firstName: "QA", lastName: "Operator", branchId: branch.id },
          },
        },
        include: { staffProfile: true },
      });
      const service = await prisma.service.create({
        data: {
          name: "Care diagnostic",
          slug: `care-${randomUUID()}`,
          pricingType: "QUOTE_REQUIRED",
        },
      });
      const vehicle = await prisma.customerVehicle.create({
        data: {
          customerId,
          make: "Owned",
          model: "Vehicle",
          year: 2020,
          vin: `PRIVATE-VIN-${randomUUID()}`,
        },
      });
      const foreignVehicle = await prisma.customerVehicle.create({
        data: {
          customerId: stranger.user.profile!.id,
          make: "FOREIGN",
          model: "PRIVATE",
          year: 2021,
        },
      });
      const current = await prisma.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          vehicleId: vehicle.id,
          status: "IN_PROGRESS",
          scheduledAt: past,
          startedAt: now,
          staffNotes: "PRIVATE STAFF NOTES",
        },
      });
      const next = await prisma.booking.create({
        data: {
          customerId,
          serviceId: service.id,
          status: "REQUESTED",
          scheduledAt: future,
        },
      });
      await prisma.booking.createMany({
        data: [
          {
            customerId,
            serviceId: service.id,
            status: "CONFIRMED",
            scheduledAt: later,
            confirmedAt: now,
          },
          {
            customerId,
            serviceId: service.id,
            status: "CANCELLED",
            cancelledAt: now,
            cancellationReason: "QA cancellation",
            scheduledAt: new Date(Date.now() + 1000),
          },
          {
            customerId: stranger.user.profile!.id,
            serviceId: service.id,
            vehicleId: foreignVehicle.id,
            status: "IN_PROGRESS",
            startedAt: now,
            scheduledAt: now,
          },
        ],
      });
      const quote = await prisma.serviceQuote.create({
        data: {
          bookingId: current.id,
          createdByStaffId: operator.staffProfile!.id,
          quoteNumber: `CARE-${randomUUID().replaceAll("-", "")}`,
          status: "ISSUED",
          issuedAt: past,
          expiresAt: future,
          subtotalKobo: 9007199254740993n,
          totalKobo: 9007199254740993n,
          notes: "PRIVATE QUOTE NOTES",
        },
      });
      await prisma.serviceQuote.create({
        data: {
          bookingId: next.id,
          createdByStaffId: operator.staffProfile!.id,
          quoteNumber: `CARE-${randomUUID().replaceAll("-", "")}`,
          status: "ISSUED",
          issuedAt: new Date(past.getTime() - 86400000),
          createdAt: new Date(past.getTime() - 86400000),
          expiresAt: past,
          subtotalKobo: 1n,
          totalKobo: 1n,
        },
      });
      const order = await prisma.order.create({
        data: {
          customerId,
          branchId: branch.id,
          orderNumber: `CARE-${randomUUID().slice(0, 20)}`,
          status: "PROCESSING",
          processingAt: now,
          fulfillmentMethod: "DELIVERY",
          subtotalKobo: 1000n,
          totalKobo: 1000n,
          customerName: "PRIVATE NAME",
          customerEmail: own.user.email,
          customerPhone: "PRIVATE PHONE",
          deliveryAddress: "PRIVATE ADDRESS",
          deliveryName: "PRIVATE NAME",
          deliveryPhone: "PRIVATE PHONE",
          deliveryCity: "PRIVATE CITY",
          deliveryState: "PRIVATE STATE",
          deliveryCountry: "Nigeria",
        },
      });
      const payment = await prisma.payment.create({
        data: {
          customerId,
          orderId: order.id,
          paymentNumber: `CARE-${randomUUID()}`,
          purpose: "ORDER_PAYMENT",
          amountKobo: 1000n,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
          expiresAt: future,
          createdAt: past,
        },
      });
      await prisma.payment.create({
        data: {
          customerId,
          orderId: order.id,
          paymentNumber: `CARE-${randomUUID()}`,
          purpose: "ORDER_PAYMENT",
          amountKobo: 2000n,
          createdAt: new Date(past.getTime() - 86400000),
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
          expiresAt: past,
        },
      });
      const stock = await prisma.vehicle.create({
        data: {
          branchId: branch.id,
          stockNumber: `CARE-${randomUUID().slice(0, 20)}`,
          make: "QA",
          model: "Stock",
          year: 2021,
        },
      });
      const listing = await prisma.vehicleListing.create({
        data: {
          vehicleId: stock.id,
          branchId: branch.id,
          title: "Owned inspection listing",
          slug: `care-${randomUUID()}`,
          priceKobo: 1000n,
        },
      });
      const inspection = await prisma.inspectionRequest.create({
        data: {
          customerId,
          vehicleListingId: listing.id,
          customerName: "PRIVATE NAME",
          customerPhone: "PRIVATE PHONE",
          preferredStartAt: future,
          status: "REQUESTED",
          notes: "PRIVATE INSPECTION",
        },
      });
      const note = await prisma.notification.create({
        data: {
          userId: own.user.id,
          type: "SYSTEM",
          title: "Own update",
          message: "PRIVATE MESSAGE",
          createdAt: past,
        },
      });
      await prisma.notification.create({
        data: {
          userId: own.user.id,
          type: "SYSTEM",
          title: "EXPIRED NOTICE",
          message: "PRIVATE MESSAGE",
          expiresAt: past,
        },
      });
      await prisma.notification.create({
        data: {
          userId: stranger.user.id,
          type: "SYSTEM",
          title: "FOREIGN NOTICE",
          message: "PRIVATE MESSAGE",
        },
      });
      const res = await request(app).get(endpoint).set("Cookie", own.cookie);
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.headers["cache-control"]).toContain("no-store");
      const care = customerCareSchema.parse(res.body.data.care);
      expect(res.body.data.counts.bookings).toBe(0);
      expect(care).toMatchObject({
        vehicle: { id: vehicle.id },
        vehicleSource: "BOOKING",
        currentBooking: { id: current.id, status: "IN_PROGRESS" },
        nextBooking: { id: next.id, status: "REQUESTED" },
        quote: { id: quote.id, totalKobo: "9007199254740993" },
        payment: { id: payment.id, amountKobo: "1000" },
        order: { id: order.id, status: "PROCESSING", fulfillmentMethod: "DELIVERY" },
        inspection: { id: inspection.id, dateKind: "PREFERRED" },
        notification: { id: note.id, title: "Own update" },
      });
      expect(JSON.stringify(res.body.data)).not.toMatch(/PRIVATE|FOREIGN|EXPIRED NOTICE/);
      expect(res.body.data).not.toHaveProperty("finance");
      // Confirmed appointments outrank preferred requests; historical filters stay independent.
      const confirmed = await prisma.inspectionRequest.create({
        data: {
          customerId,
          vehicleListingId: listing.id,
          customerName: "QA",
          customerPhone: "QA",
          preferredStartAt: later,
          scheduledStartAt: later,
          scheduledEndAt: new Date(later.getTime() + 3600000),
          confirmedAt: now,
          status: "CONFIRMED",
        },
      });
      const again = await request(app).get(endpoint).set("Cookie", own.cookie);
      expect(again.body.data.care.inspection).toMatchObject({
        id: confirmed.id,
        dateKind: "SCHEDULED",
        startsAt: later.toISOString(),
      });
      // A bad cross-customer vehicle relation must not leak even if it exists historically.
      await prisma.booking.update({
        where: { id: current.id },
        data: { vehicleId: foreignVehicle.id },
      });
      const safe = await request(app).get(endpoint).set("Cookie", own.cookie);
      expect(safe.body.data.care.vehicle).toMatchObject({ id: vehicle.id });
      expect(safe.body.data.care.vehicleSource).toBe("RECENT");
      expect(JSON.stringify(safe.body.data)).not.toContain("FOREIGN");
    }, 30000);
    it("returns explicit null previews for a new account and rejects scope overrides", async () => {
      const own = await account();
      const res = await request(app).get(endpoint).set("Cookie", own.cookie);
      expect(res.status).toBe(200);
      expect(customerCareSchema.parse(res.body.data.care)).toEqual({
        vehicle: null,
        vehicleSource: "NONE",
        currentBooking: null,
        nextBooking: null,
        quote: null,
        payment: null,
        order: null,
        inspection: null,
        notification: null,
      });
      expect(
        (
          await request(app)
            .get(endpoint + `&customerId=${randomUUID()}`)
            .set("Cookie", own.cookie)
        ).status,
      ).toBe(422);
      expect((await request(app).get(endpoint)).status).toBe(401);
    });
    it("omits customer care for administrators and denies cross-role routes", async () => {
      const admin = await account("ADMIN");
      expect((await request(app).get(endpoint).set("Cookie", admin.cookie)).status).toBe(
        403,
      );
      const res = await request(app)
        .get(endpoint.replace("/customers/", "/staff/"))
        .set("Cookie", admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data).not.toHaveProperty("care");
      expect(res.body.data).toHaveProperty("finance");
    });
  },
);
