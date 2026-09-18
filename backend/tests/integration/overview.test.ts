import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";

async function account(role: UserRole, branchId?: string, assured = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-synthetic-owner-password")
      : await prisma.user.create({
          data: {
            email: `overview-${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic-password",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Overview",
                      lastName: "Customer",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Overview",
                      lastName: role,
                      branchId: branchId ?? null,
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 600000);
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: assured && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  return { user, cookie: `${sessionCookieName}=${token}` };
}
const branch = () =>
  prisma.branch.create({
    data: {
      code: `OV-${randomUUID().slice(0, 8)}`,
      name: "Overview branch",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
const range = "from=2020-03-01&to=2020-03-02";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")("role-scoped overview", () => {
  const app = createApp({ checkReadiness: async () => undefined });
  afterAll(async () => prisma.$disconnect());
  it("counts the full scope, respects Lagos midnight, excludes drafts and limits previews", async () => {
    const first = await branch();
    const other = await branch();
    const customer = await account("CUSTOMER");
    const stranger = await account("CUSTOMER");
    const staff = await account("STAFF", first.id);
    const profile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customer.user.id },
    });
    const otherProfile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId: stranger.user.id },
    });
    const operator = await prisma.staffProfile.findUniqueOrThrow({
      where: { userId: staff.user.id },
    });
    const service = await prisma.service.create({
      data: {
        name: "Overview diagnostic",
        slug: `overview-${randomUUID()}`,
        pricingType: "QUOTE_REQUIRED",
        durationMinutes: 60,
      },
    });
    const created = [];
    for (let index = 0; index < 7; index++)
      created.push(
        await prisma.booking.create({
          data: {
            customerId: profile.id,
            branchId: first.id,
            serviceId: service.id,
            scheduledAt: new Date("2020-03-15T10:00:00Z"),
            createdAt: new Date(
              index === 0 ? "2020-02-29T23:00:00Z" : "2020-03-01T23:00:00Z",
            ),
            staffNotes: "PRIVATE STAFF NOTE",
          },
        }),
      );
    await prisma.booking.createMany({
      data: [
        {
          customerId: profile.id,
          branchId: first.id,
          serviceId: service.id,
          scheduledAt: new Date(),
          createdAt: new Date("2020-02-29T22:59:59.999Z"),
        },
        {
          customerId: profile.id,
          branchId: first.id,
          serviceId: service.id,
          scheduledAt: new Date(),
          createdAt: new Date("2020-03-02T23:00:00Z"),
        },
        {
          customerId: otherProfile.id,
          branchId: other.id,
          serviceId: service.id,
          scheduledAt: new Date(),
          createdAt: new Date("2020-03-01T12:00:00Z"),
        },
      ],
    });
    await prisma.serviceQuote.createMany({
      data: (["DRAFT", "VOID", "ISSUED"] as const).map((status, index) => ({
        bookingId: created[0]!.id,
        createdByStaffId: operator.id,
        quoteNumber: `OV-${randomUUID()}`,
        version: index + 1,
        status,
        subtotalKobo: 100n,
        totalKobo: 100n,
        issuedAt: status === "ISSUED" ? new Date("2020-03-01T12:00:00Z") : null,
        voidedAt: status === "VOID" ? new Date() : null,
      })),
    });
    for (let index = 0; index < 6; index++)
      await prisma.order.create({
        data: {
          customerId: profile.id,
          branchId: first.id,
          orderNumber: `OV-${randomUUID().slice(0, 20)}`,
          subtotalKobo: 12345n,
          totalKobo: 12345n,
          customerName: "PRIVATE CUSTOMER",
          customerEmail: customer.user.email,
          customerPhone: "+2348000000000",
          createdAt: new Date("2020-03-01T12:00:00Z"),
        },
      });
    await prisma.customerVehicle.create({
      data: {
        customerId: profile.id,
        make: "Test",
        model: "Car",
        year: 2020,
        createdAt: new Date("2020-03-01T12:00:00Z"),
      },
    });
    for (const [audience, actor] of [
      ["customers", customer],
      ["staff", staff],
    ] as const) {
      const response = await request(app)
        .get(`/api/v1/${audience}/overview?${range}`)
        .set("Cookie", actor.cookie);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.body.data.counts).toMatchObject({
        bookings: 7,
        orders: 6,
        quotations: 1,
        inspections: 0,
      });
      expect(response.body.data.activity).toEqual([
        { date: "2020-03-01", bookings: 1, orders: 6 },
        { date: "2020-03-02", bookings: 6, orders: 0 },
      ]);
      expect(response.body.data.recentBookings).toHaveLength(5);
      expect(response.body.data.recentOrders).toHaveLength(4);
      expect(response.body.data.bookingStatuses).toEqual([
        { status: "REQUESTED", count: 7 },
      ]);
      expect(response.body.data).not.toHaveProperty("finance");
      expect(JSON.stringify(response.body.data)).not.toContain("PRIVATE");
      expect(JSON.stringify(response.body.data)).not.toContain(customer.user.email);
      if (audience === "customers") expect(response.body.data.counts.vehicles).toBe(1);
      else expect(response.body.data.branch.id).toBe(first.id);
    }
    const strangerRead = await request(app)
      .get(`/api/v1/customers/overview?${range}`)
      .set("Cookie", stranger.cookie);
    expect(strangerRead.body.data.counts.bookings).toBe(1);
    expect(strangerRead.body.data.counts.orders).toBe(0);
    const empty = await request(app)
      .get("/api/v1/customers/overview?from=2001-01-01&to=2001-01-01")
      .set("Cookie", customer.cookie);
    expect(empty.body.data.activity).toEqual([
      { date: "2001-01-01", bookings: 0, orders: 0 },
    ]);
  }, 30000);

  it("denies scope overrides, invalid ranges, role mismatches and unassigned or inactive staff", async () => {
    const assigned = await branch();
    const staff = await account("STAFF", assigned.id);
    const unassigned = await account("STAFF");
    const customer = await account("CUSTOMER");
    const admin = await account("ADMIN", undefined, false);
    for (const [audience, actor] of [
      ["staff", unassigned],
      ["staff", customer],
      ["customers", staff],
      ["staff", admin],
    ] as const)
      expect(
        (
          await request(app)
            .get(`/api/v1/${audience}/overview?${range}`)
            .set("Cookie", actor.cookie)
        ).status,
      ).toBe(403);
    expect((await request(app).get(`/api/v1/customers/overview?${range}`)).status).toBe(
      401,
    );
    for (const query of [
      `${range}&customerId=${randomUUID()}`,
      `${range}&branchId=${assigned.id}`,
      "from=2020-02-30&to=2020-03-01",
      "from=2020-03-02&to=2020-03-01",
      "from=2020-01-01&to=2020-04-01",
      "from=2020-01-01",
    ])
      expect(
        (
          await request(app)
            .get(`/api/v1/staff/overview?${query}`)
            .set("Cookie", staff.cookie)
        ).status,
      ).toBe(422);
    await prisma.branch.update({ where: { id: assigned.id }, data: { isActive: false } });
    expect(
      (
        await request(app)
          .get(`/api/v1/staff/overview?${range}`)
          .set("Cookie", staff.cookie)
      ).status,
    ).toBe(403);
  }, 30000);

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "includes separate financial aggregates only for an assured %s",
    async (role) => {
      const actor = await account(role);
      const response = await request(app)
        .get("/api/v1/staff/overview?from=2001-01-01&to=2001-01-01")
        .set("Cookie", actor.cookie);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.scope).toBe("ORGANISATION");
      expect(response.body.data.finance).toEqual({ payments: [], refunds: [] });
    },
  );

  it("sums exact settled amounts once and separates completed refunds from pending requests", async () => {
    const admin = await account("ADMIN");
    const customer = await account("CUSTOMER");
    const profile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId: customer.user.id },
    });
    const endpoint = "/api/v1/staff/overview?from=2002-06-12&to=2002-06-12";
    const before = (await request(app).get(endpoint).set("Cookie", admin.cookie)).body
      .data.finance;
    const settledAt = new Date("2002-06-12T10:00:00Z");
    const paymentBranch = await branch();
    let refundAttempt = "";
    for (const [index, amount] of [9999999999999999n, 1n, 500n].entries()) {
      const order = await prisma.order.create({
        data: {
          customerId: profile.id,
          branchId: paymentBranch.id,
          orderNumber: `OV-${randomUUID().slice(0, 20)}`,
          subtotalKobo: amount,
          totalKobo: amount,
          customerName: "Synthetic",
          customerEmail: customer.user.email,
          customerPhone: profile.phone,
        },
      });
      const payment = await prisma.payment.create({
        data: {
          customerId: profile.id,
          orderId: order.id,
          paymentNumber: `OV-${randomUUID()}`,
          purpose: "ORDER_PAYMENT",
          amountKobo: amount,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        },
      });
      if (index === 2) continue;
      const attempt = await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: `OV-${randomUUID()}`,
          provider: "PAYSTACK",
          providerReference: `OV-${randomUUID()}`,
          gatewayTransactionId: randomUUID(),
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          amountKobo: amount,
          verifiedAmountKobo: amount,
          verifiedCurrency: "NGN",
          verifiedAt: settledAt,
          paidAt: settledAt,
        },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          succeededAt: settledAt,
          settledAttemptId: attempt.id,
        },
      });
      if (index === 0) refundAttempt = attempt.id;
    }
    for (const status of ["SUCCEEDED", "REQUESTED"] as const)
      await prisma.refund.create({
        data: {
          paymentAttemptId: refundAttempt,
          requestedByUserId: customer.user.id,
          refundNumber: `OV-${randomUUID()}`,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
          amountKobo: 101n,
          status,
          reason: "Synthetic overview refund",
          ...(status === "SUCCEEDED"
            ? {
                approvedByUserId: admin.user.id,
                approvedAt: settledAt,
                processedAt: settledAt,
              }
            : {}),
        },
      });
    const response = await request(app).get(endpoint).set("Cookie", admin.cookie);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const after = response.body.data.finance;
    const previousPayments = before.payments.find(
      (row: { currency: string }) => row.currency === "NGN",
    );
    const previousRefunds = before.refunds.find(
      (row: { currency: string }) => row.currency === "NGN",
    );
    expect(after.payments).toEqual([
      {
        currency: "NGN",
        amountKobo: (
          BigInt(previousPayments?.amountKobo ?? "0") + 10000000000000000n
        ).toString(),
        count: (previousPayments?.count ?? 0) + 2,
      },
    ]);
    expect(after.refunds).toEqual([
      {
        currency: "NGN",
        amountKobo: (BigInt(previousRefunds?.amountKobo ?? "0") + 101n).toString(),
        count: (previousRefunds?.count ?? 0) + 1,
      },
    ]);
  }, 30000);
});
