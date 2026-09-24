import { sessionWindow } from "../helpers/session-window.js";
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

async function authenticated(role: UserRole, assured = true, branchId?: string) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-synthetic-owner-password")
      : await prisma.user.create({
          data: {
            email: `finance-boundary-${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic-password",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Customer",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: role,
                      branchId: branchId ?? null,
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: assured && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator finance boundaries",
  () => {
    const app = createApp({ checkReadiness: async () => undefined });
    afterAll(async () => prisma.$disconnect());

    async function operationalActors() {
      const branch = await prisma.branch.create({
        data: {
          code: `FIN-${randomUUID().slice(0, 8)}`,
          name: "Synthetic operations branch",
          address: "Test address",
          city: "Test city",
          state: "Test state",
        },
      });
      const [staff, admin, customer] = await Promise.all([
        authenticated("STAFF", true, branch.id),
        authenticated("ADMIN"),
        authenticated("CUSTOMER"),
      ]);
      const profile = await prisma.customerProfile.findUniqueOrThrow({
        where: { userId: customer.user.id },
      });
      const staffProfile = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: staff.user.id },
      });
      return { branch, staff, admin, customer, profile, staffProfile };
    }

    it("keeps vehicle acquisition costs administrator-only while preserving branch staff vehicle work", async () => {
      const { branch, staff, admin, customer } = await operationalActors();
      const create = {
        branchId: branch.id,
        stockNumber: `FIN-${randomUUID().slice(0, 20)}`,
        make: "Synthetic",
        model: "Vehicle",
        year: 2024,
      };
      const endpoint = "/api/v1/staff/vehicles";
      const denied = await request(app)
        .post(endpoint)
        .set(staff.headers)
        .send({ ...create, acquisitionCostKobo: "123456789" });
      expect(denied.status).toBe(403);
      expect(
        await prisma.vehicle.count({ where: { stockNumber: create.stockNumber } }),
      ).toBe(0);
      const created = await request(app).post(endpoint).set(staff.headers).send(create);
      expect(created.status).toBe(201);
      const id = created.body.data.id as string;
      expect(created.body.data).not.toHaveProperty("acquisitionCostKobo");
      expect(created.body.data).not.toHaveProperty("acquisitionCurrency");
      const priced = await request(app)
        .patch(`${endpoint}/${id}`)
        .set(admin.headers)
        .send({ expectedVersion: 0, acquisitionCostKobo: "123456789" });
      expect(priced.status).toBe(200);
      expect(priced.body.data.acquisitionCostKobo).toBe("123456789");
      for (const path of [endpoint, `${endpoint}/${id}`]) {
        const result = await request(app).get(path).set(staff.headers);
        expect(result.status).toBe(200);
        const row =
          path === endpoint
            ? result.body.data.items.find((item: { id: string }) => item.id === id)
            : result.body.data;
        expect(row).toBeDefined();
        expect(row).not.toHaveProperty("acquisitionCostKobo");
        expect(row).not.toHaveProperty("acquisitionCurrency");
      }
      for (const value of [null, "7654321"]) {
        expect(
          (
            await request(app)
              .patch(`${endpoint}/${id}`)
              .set(staff.headers)
              .send({ expectedVersion: 1, acquisitionCostKobo: value })
          ).status,
        ).toBe(403);
      }
      const updated = await request(app)
        .patch(`${endpoint}/${id}`)
        .set(staff.headers)
        .send({ expectedVersion: 1, color: "Blue" });
      expect(updated.status).toBe(200);
      expect(updated.body.data.color).toBe("Blue");
      expect(updated.body.data).not.toHaveProperty("acquisitionCostKobo");
      const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id } });
      expect(stored.acquisitionCostKobo).toBe(123456789n);
      expect(stored.version).toBe(2);
      const owner = await authenticated("SUPER_ADMIN");
      const ownerRead = await request(app).get(`${endpoint}/${id}`).set(owner.headers);
      expect(ownerRead.status).toBe(200);
      expect(ownerRead.body.data.acquisitionCostKobo).toBe("123456789");
      expect(
        (await request(app).get(`${endpoint}/${id}`).set(customer.headers)).status,
      ).toBe(403);
      const otherStaff = await authenticated("STAFF");
      expect(
        (await request(app).get(`${endpoint}/${id}`).set(otherStaff.headers)).status,
      ).toBe(403);
    }, 30000);

    it("omits invoices from STAFF order lists, details and update responses without disrupting fulfilment", async () => {
      const { branch, staff, admin, customer, profile } = await operationalActors();
      const order = await prisma.order.create({
        data: {
          customerId: profile.id,
          branchId: branch.id,
          orderNumber: `ORD-${randomUUID().slice(0, 20)}`,
          status: "CONFIRMED",
          paidAt: new Date(),
          createdAt: new Date(Date.now() - 1000),
          confirmedAt: new Date(),
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          customerName: "Synthetic Customer",
          customerEmail: customer.user.email,
          customerPhone: profile.phone,
          invoice: {
            create: {
              customerId: profile.id,
              invoiceNumber: `INV-${randomUUID()}`,
              subtotalKobo: 10000n,
              totalKobo: 10000n,
              status: "ISSUED",
              issuedAt: new Date(),
            },
          },
        },
        include: { invoice: true },
      });
      const list = await request(app).get("/api/v1/staff/orders").set(staff.headers);
      expect(list.status).toBe(200);
      expect(
        list.body.data.items.find((item: { id: string }) => item.id === order.id),
      ).not.toHaveProperty("invoice");
      const detail = await request(app)
        .get(`/api/v1/staff/orders/${order.id}`)
        .set(staff.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data).not.toHaveProperty("invoice");
      expect(detail.body.data.orderNumber).toBe(order.orderNumber);
      for (const [path, actor] of [
        ["staff", admin],
        ["customers", customer],
      ] as const) {
        const permitted = await request(app)
          .get(`/api/v1/${path}/orders/${order.id}`)
          .set(actor.headers);
        expect(permitted.status).toBe(200);
        expect(permitted.body.data.invoice.id).toBe(order.invoice!.id);
      }
      const changed = await request(app)
        .post(`/api/v1/staff/orders/${order.id}/status`)
        .set(staff.headers)
        .send({ status: "PROCESSING", expectedVersion: order.version });
      expect(changed.status).toBe(200);
      expect(changed.body.data.status).toBe("PROCESSING");
      expect(changed.body.data).not.toHaveProperty("invoice");
      const outsider = await authenticated("STAFF");
      expect(
        (await request(app).get(`/api/v1/staff/orders/${order.id}`).set(outsider.headers))
          .status,
      ).toBe(403);
    }, 30000);

    it("omits deposit records from STAFF bookings and rejects direct reads and mutations after branch deactivation", async () => {
      const { branch, staff, admin, customer, profile, staffProfile } =
        await operationalActors();
      const service = await prisma.service.create({
        data: {
          name: "Synthetic service",
          slug: `finance-${randomUUID()}`,
          pricingType: "FIXED",
          priceKobo: 10000n,
          durationMinutes: 30,
        },
      });
      const scheduledAt = new Date(Date.now() + 8 * 86400000);
      const slot = await prisma.bookingSlot.create({
        data: {
          branchId: branch.id,
          serviceId: service.id,
          staffId: staffProfile.id,
          startsAt: scheduledAt,
          endsAt: new Date(scheduledAt.getTime() + 1800000),
        },
      });
      const booking = await prisma.booking.create({
        data: {
          customerId: profile.id,
          branchId: branch.id,
          serviceId: service.id,
          assignedStaffId: staffProfile.id,
          bookingSlotId: slot.id,
          scheduledAt,
          status: "AWAITING_DEPOSIT",
          depositBaseKobo: 10000n,
          depositBasisPoints: 3000,
          depositAmountKobo: 3000n,
          depositPolicyVersion: "booking-deposit-v1",
          depositTermsAcceptedAt: new Date(),
          paymentHoldExpiresAt: new Date(Date.now() + 1800000),
          depositPayment: {
            create: {
              customerId: profile.id,
              paymentNumber: `PAY-${randomUUID()}`,
              purpose: "BOOKING_DEPOSIT",
              amountKobo: 3000n,
              idempotencyKeyHash: hashToken("payment-intent-idempotency", randomUUID()),
            },
          },
        },
        include: { depositPayment: true },
      });
      const list = await request(app).get("/api/v1/staff/bookings").set(staff.headers);
      expect(list.status).toBe(200);
      const listed = list.body.data.items.find(
        (item: { id: string }) => item.id === booking.id,
      );
      expect(listed.id).toBe(booking.id);
      expect(listed).not.toHaveProperty("depositPayment");
      const detail = await request(app)
        .get(`/api/v1/staff/bookings/${booking.id}`)
        .set(staff.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data).not.toHaveProperty("depositPayment");
      for (const [path, actor] of [
        ["staff", admin],
        ["customers", customer],
      ] as const) {
        const permitted = await request(app)
          .get(`/api/v1/${path}/bookings/${booking.id}`)
          .set(actor.headers);
        expect(permitted.status).toBe(200);
        expect(permitted.body.data.depositPayment.id).toBe(booking.depositPayment!.id);
      }
      const changed = await request(app)
        .patch(`/api/v1/staff/bookings/${booking.id}/assignment`)
        .set(staff.headers)
        .send({ assignedStaffId: staffProfile.id, expectedVersion: booking.version });
      expect(changed.status).toBe(200);
      expect(changed.body.data).not.toHaveProperty("depositPayment");
      const outsider = await authenticated("STAFF");
      expect(
        (
          await request(app)
            .get(`/api/v1/staff/bookings/${booking.id}`)
            .set(outsider.headers)
        ).status,
      ).toBe(403);
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
      expect(
        (
          await request(app)
            .get(`/api/v1/staff/bookings/${booking.id}`)
            .set(staff.headers)
        ).status,
      ).toBe(403);
      const denied = await request(app)
        .patch(`/api/v1/staff/bookings/${booking.id}/assignment`)
        .set(staff.headers)
        .send({
          assignedStaffId: staffProfile.id,
          expectedVersion: changed.body.data.version,
        });
      expect(denied.status).toBe(403);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).version,
      ).toBe(changed.body.data.version);
    }, 30000);

    it.each(["CUSTOMER", "STAFF"] as const)(
      "rejects direct %s finance requests before data access or mutation",
      async (role) => {
        const actor = await authenticated(role);
        const id = randomUUID();
        const endpoints = [
          ["get", "/staff/payments"],
          ["get", "/staff/invoices"],
          ["get", `/staff/invoices/${id}`],
          ["post", "/staff/invoices"],
          ["post", `/staff/invoices/${id}/issue`],
          ["post", `/staff/invoices/${id}/void`],
          ["post", `/staff/payments/manual-attempts/${id}/review`],
          ["post", `/staff/payments/manual-attempts/${id}/evidence-access`],
          ["post", "/staff/payments/refunds"],
          ["post", `/staff/payments/refunds/${id}/decision`],
        ] as const;
        for (const [method, endpoint] of endpoints) {
          const response = await request(app)
            [method](`/api/v1${endpoint}`)
            .set(actor.headers)
            .send(method === "post" ? {} : undefined);
          expect([endpoint, response.status, response.body.error?.code]).toEqual([
            endpoint,
            403,
            "FORBIDDEN",
          ]);
          expect(response.body).not.toHaveProperty("data");
        }
        if (role === "CUSTOMER") {
          for (const endpoint of ["/customers/payments", "/customers/invoices"]) {
            const own = await request(app).get(`/api/v1${endpoint}`).set(actor.headers);
            expect(own.status).toBe(200);
            expect(own.body.data.items).toEqual([]);
          }
        }
      },
      30000,
    );

    it.each(["ADMIN", "SUPER_ADMIN"] as const)(
      "allows MFA-assured %s finance reads",
      async (role) => {
        const actor = await authenticated(role);
        for (const endpoint of ["/staff/payments", "/staff/invoices"]) {
          expect(
            (await request(app).get(`/api/v1${endpoint}?limit=1`).set(actor.headers))
              .status,
          ).toBe(200);
        }
      },
    );

    it("requires MFA and rechecks a changed role on the existing session", async () => {
      const pending = await authenticated("ADMIN", false);
      const denied = await request(app)
        .get("/api/v1/staff/payments")
        .set(pending.headers);
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe("MFA_REQUIRED");
      const changed = await authenticated("ADMIN");
      expect(
        (await request(app).get("/api/v1/staff/invoices").set(changed.headers)).status,
      ).toBe(200);
      await prisma.user.update({
        where: { id: changed.user.id },
        data: { role: "STAFF" },
      });
      for (const endpoint of ["/staff/payments", "/staff/invoices"])
        expect(
          (await request(app).get(`/api/v1${endpoint}`).set(changed.headers)).status,
        ).toBe(403);
    });
  },
);
