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
      passwordHash: await hashPassword(`phase five passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Phase",
                lastName: "Customer",
                phone: `+23480${id.replaceAll("-", "").slice(0, 8)}`,
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
      profile: { select: { id: true } },
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
const mutation = (session: Awaited<ReturnType<typeof createSession>>) => ({
  Origin: origin,
  Cookie: session.cookie,
  "X-CSRF-Token": session.csrf,
});

describe.skipIf(!runDatabaseTests)("Phase 5 service operations", () => {
  afterAll(async () => prisma.$disconnect());

  it("enforces ownership, schedules, immutable quote versions, totals, and lifecycles", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `P5-${randomUUID().slice(0, 8)}`,
        name: "Phase Five",
        address: "5 Test Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const otherBranch = await prisma.branch.create({
      data: {
        code: `P5-${randomUUID().slice(0, 8)}`,
        name: "Other Five",
        address: "6 Test Road",
        city: "Abuja",
        state: "FCT",
      },
    });
    const [admin, customer, secondCustomer, staff, coworker, otherStaff] =
      await Promise.all([
        createUser("ADMIN"),
        createUser("CUSTOMER"),
        createUser("CUSTOMER"),
        createUser("STAFF", branch.id),
        createUser("STAFF", branch.id),
        createUser("STAFF", otherBranch.id),
      ]);
    const [
      adminSession,
      customerSession,
      staffSession,
      coworkerSession,
      otherStaffSession,
    ] = await Promise.all([
      createSession(admin.id, admin.role),
      createSession(customer.id, customer.role),
      createSession(staff.id, staff.role),
      createSession(coworker.id, coworker.role),
      createSession(otherStaff.id, otherStaff.role),
    ]);

    const serviceResponse = await request(app)
      .post("/api/v1/admin/services")
      .set(mutation(adminSession))
      .send({
        name: "Secure diagnostics",
        slug: `secure-diagnostics-${randomUUID().slice(0, 8)}`,
        pricingType: "QUOTE_REQUIRED",
        priceKobo: null,
        durationMinutes: 60,
      });
    expect(serviceResponse.status).toBe(201);
    expect(serviceResponse.body.data.priceKobo).toBeNull();
    const serviceId = serviceResponse.body.data.id as string;

    const publicService = await request(app).get(`/api/v1/public/services/${serviceId}`);
    expect(publicService.status).toBe(200);
    const vehicle = await prisma.customerVehicle.create({
      data: {
        customerId: customer.profile!.id,
        make: "Toyota",
        model: "Camry",
        year: 2022,
      },
    });
    const scheduledAt = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const bookingResponse = await request(app)
      .post("/api/v1/customers/bookings")
      .set(mutation(customerSession))
      .send({
        branchId: branch.id,
        serviceId,
        vehicleId: vehicle.id,
        scheduledAt,
        customerNotes: "Check warning light",
      });
    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.data).not.toHaveProperty("staffNotes");
    const bookingId = bookingResponse.body.data.id as string;

    const crossBranch = await request(app)
      .get(`/api/v1/staff/bookings/${bookingId}`)
      .set("Cookie", otherStaffSession.cookie);
    expect(crossBranch.status).toBe(403);
    const assigned = await request(app)
      .patch(`/api/v1/staff/bookings/${bookingId}/assignment`)
      .set(mutation(staffSession))
      .send({ assignedStaffId: staff.staffProfile!.id, expectedVersion: 0 });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.version).toBe(1);

    const colleagueMutation = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/status`)
      .set(mutation(coworkerSession))
      .send({ status: "CONFIRMED", expectedVersion: 1 });
    expect(colleagueMutation.status).toBe(403);

    const staleAssignment = await request(app)
      .patch(`/api/v1/staff/bookings/${bookingId}/assignment`)
      .set(mutation(staffSession))
      .send({ assignedStaffId: staff.staffProfile!.id, expectedVersion: 0 });
    expect(staleAssignment.status).toBe(409);
    expect(staleAssignment.body.error.code).toBe(errorCodes.staleVersion);

    const confirmed = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/status`)
      .set(mutation(staffSession))
      .send({ status: "CONFIRMED", expectedVersion: 1, staffNotes: "Bay 2" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.confirmedAt).toBeTruthy();

    const overlapping = await prisma.booking.create({
      data: {
        customerId: secondCustomer.profile!.id,
        branchId: branch.id,
        serviceId,
        assignedStaffId: staff.staffProfile!.id,
        scheduledAt: new Date(scheduledAt),
      },
    });
    const overlapRejected = await request(app)
      .post(`/api/v1/staff/bookings/${overlapping.id}/status`)
      .set(mutation(staffSession))
      .send({ status: "CONFIRMED", expectedVersion: 0 });
    expect(overlapRejected.status).toBe(409);
    expect(overlapRejected.body.error.code).toBe(errorCodes.scheduleConflict);

    const category = await prisma.category.create({
      data: { name: "P5 parts", slug: `p5-parts-${randomUUID().slice(0, 8)}` },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: "Sensor",
        slug: `sensor-${randomUUID().slice(0, 8)}`,
        sku: `P5-${randomUUID().slice(0, 8)}`,
        priceKobo: 125_000n,
      },
    });
    const quoteDraft = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/quotes`)
      .set(mutation(staffSession))
      .send({
        expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        taxKobo: "7500",
        items: [
          {
            type: "PART",
            productId: product.id,
            quantity: 2,
            description: "Replacement sensor",
          },
          {
            type: "LABOUR",
            description: "Diagnostics labour",
            quantity: 1,
            unitPriceKobo: "50000",
          },
        ],
      });
    expect(quoteDraft.status).toBe(201);
    expect(quoteDraft.body.data.subtotalKobo).toBe("300000");
    expect(quoteDraft.body.data.totalKobo).toBe("307500");
    const originalQuoteId = quoteDraft.body.data.id as string;

    const revised = await request(app)
      .put(`/api/v1/staff/bookings/${bookingId}/quotes/${originalQuoteId}`)
      .set(mutation(staffSession))
      .send({
        expectedRevision: 0,
        expiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        taxKobo: "0",
        items: [{ type: "PART", productId: product.id, quantity: 1 }],
      });
    expect(revised.status).toBe(200);
    expect(revised.body.data.revision).toBe(0);
    expect(revised.body.data.id).not.toBe(originalQuoteId);
    expect(revised.body.data.version).toBe(2);
    expect(revised.body.data.totalKobo).toBe("125000");
    const quoteId = revised.body.data.id as string;
    const issued = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/quotes/${quoteId}/issue`)
      .set(mutation(staffSession))
      .send({ expectedRevision: 0 });
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe("ISSUED");

    const immutable = await request(app)
      .put(`/api/v1/staff/bookings/${bookingId}/quotes/${quoteId}`)
      .set(mutation(staffSession))
      .send({
        expectedRevision: 1,
        expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        taxKobo: "0",
        items: [
          { type: "LABOUR", description: "Tampered", quantity: 1, unitPriceKobo: "1" },
        ],
      });
    expect(immutable.status).toBe(409);
    expect(immutable.body.error.code).toBe(errorCodes.invalidTransition);

    const accepted = await request(app)
      .post(`/api/v1/customers/bookings/${bookingId}/quotes/${quoteId}/accept`)
      .set(mutation(customerSession))
      .send({ expectedRevision: 1 });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe("ACCEPTED");
    const customerView = await request(app)
      .get(`/api/v1/customers/bookings/${bookingId}`)
      .set("Cookie", customerSession.cookie);
    expect(customerView.status).toBe(200);
    expect(customerView.body.data.quotedPriceKobo).toBe("125000");
    expect(customerView.body.data).not.toHaveProperty("staffNotes");

    const work = await request(app)
      .post(`/api/v1/staff/bookings/${bookingId}/work-orders`)
      .set(mutation(staffSession))
      .send({
        expectedBookingVersion: 3,
        diagnosis: "Faulty sensor",
        internalNotes: "Internal only",
        items: [{ type: "PART", productId: product.id, quantity: 1 }],
      });
    expect(work.status).toBe(201);
    const workOrderId = work.body.data.id as string;
    let version = work.body.data.version as number;
    for (const status of [
      "APPROVED",
      "IN_PROGRESS",
      "QUALITY_CHECK",
      "COMPLETED",
    ] as const) {
      const transitioned = await request(app)
        .post(`/api/v1/staff/bookings/${bookingId}/work-orders/${workOrderId}/status`)
        .set(mutation(staffSession))
        .send({ status, expectedVersion: version });
      expect(transitioned.status).toBe(200);
      version = transitioned.body.data.version as number;
    }
    const finalCustomerView = await request(app)
      .get(`/api/v1/customers/bookings/${bookingId}`)
      .set("Cookie", customerSession.cookie);
    expect(finalCustomerView.body.data.status).toBe("COMPLETED");
    expect(finalCustomerView.body.data.workOrder).not.toHaveProperty("internalNotes");
    await expect(
      prisma.$executeRaw`DELETE FROM "WorkOrderItem" WHERE "workOrderId" = ${workOrderId}::uuid`,
    ).rejects.toThrow(/delete|immutable|append-only/i);
  }, 20_000);
});
