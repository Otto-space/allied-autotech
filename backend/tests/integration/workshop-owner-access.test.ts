import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { sessionWindow } from "../helpers/session-window.js";

// This suite needs its own migrated database: the sole owner must have no staff
// profile, unlike the shared owner fixture used by the other integration suites.
describe.skipIf(
  process.env.RUN_DATABASE_TESTS !== "true" ||
    process.env.RUN_WORKSHOP_ACCESS_TESTS !== "true",
)("Workshop access without an administrator staff profile", () => {
  afterAll(() => prisma.$disconnect());
  it("allows administrators to manage bookings and slots while retaining staff, MFA and CSRF boundaries", async () => {
    const existingOwner = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      include: { staffProfile: true },
    });
    if (existingOwner) expect(existingOwner.staffProfile).toBeNull();
    const app = createApp({ checkReadiness: async () => undefined });
    const account = (role: UserRole, branchId?: string) =>
      prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-test-only",
          role,
          emailVerifiedAt: new Date(),
          ...(branchId
            ? {
                staffProfile: {
                  create: { firstName: "Test", lastName: "Technician", branchId },
                },
              }
            : {}),
        },
        include: { staffProfile: true },
      });
    const session = async (userId: string, role: UserRole, verified = true) => {
      const now = new Date();
      const token = generateOpaqueToken();
      const csrf = generateOpaqueToken();
      await prisma.session.create({
        data: {
          userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          ...sessionWindow(3_600_000),
          mfaRequired: role !== "CUSTOMER",
          createdAt: now,
          lastRotatedAt: now,
          mfaVerifiedAt: verified && role !== "CUSTOMER" ? now : null,
        },
      });
      return {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      };
    };
    const branch = () =>
      prisma.branch.create({
        data: {
          code: `WS-${randomUUID().slice(0, 8)}`,
          name: "Workshop test branch",
          address: "Test road",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
    const [firstBranch, secondBranch] = await Promise.all([branch(), branch()]);
    const [owner, admin, staff, otherStaff, missingProfile, customer] = await Promise.all(
      [
        existingOwner ?? account("SUPER_ADMIN"),
        account("ADMIN"),
        account("STAFF", firstBranch.id),
        account("STAFF", secondBranch.id),
        account("STAFF"),
        account("CUSTOMER"),
      ],
    );
    const customerProfile = await prisma.customerProfile.create({
      data: {
        userId: customer.id,
        firstName: "Test",
        lastName: "Customer",
        phone: "+2348000000000",
      },
    });
    const service = await prisma.service.create({
      data: {
        name: "Workshop test service",
        slug: `workshop-${randomUUID()}`,
        pricingType: "FIXED",
        priceKobo: 10000n,
        durationMinutes: 60,
      },
    });
    const startsAt = new Date(Date.now() + 10 * 86_400_000);
    const bookings = await Promise.all(
      [firstBranch, secondBranch].map((b) =>
        prisma.booking.create({
          data: {
            customerId: customerProfile.id,
            branchId: b.id,
            serviceId: service.id,
            scheduledAt: startsAt,
            status: "REQUESTED",
          },
        }),
      ),
    );
    const [staffSession, otherSession, missingSession, customerSession] =
      await Promise.all([
        session(staff.id, staff.role),
        session(otherStaff.id, otherStaff.role),
        session(missingProfile.id, missingProfile.role),
        session(customer.id, customer.role),
      ]);
    for (const [index, actor] of [owner, admin].entries()) {
      expect(actor.staffProfile).toBeNull();
      const identity = await session(actor.id, actor.role);
      const list = await request(app).get("/api/v1/staff/bookings").set(identity);
      expect(list.status).toBe(200);
      expect(list.body.data.items.map((b: { id: string }) => b.id)).toEqual(
        expect.arrayContaining(bookings.map((b) => b.id)),
      );
      expect(
        (
          await request(app)
            .get(`/api/v1/staff/bookings/${bookings[index]!.id}`)
            .set(identity)
        ).status,
      ).toBe(200);
      const assigned = await request(app)
        .patch(`/api/v1/staff/bookings/${bookings[index]!.id}/assignment`)
        .set(identity)
        .send({
          expectedVersion: 0,
          assignedStaffId:
            index === 0 ? staff.staffProfile!.id : otherStaff.staffProfile!.id,
        });
      expect(assigned.status).toBe(200);
      const payload = {
        branchId: firstBranch.id,
        serviceId: service.id,
        staffId: staff.staffProfile!.id,
        startsAt: new Date(startsAt.getTime() + (index + 1) * 86_400_000).toISOString(),
      };
      expect(
        (
          await request(app)
            .post("/api/v1/staff/booking-slots")
            .set({ Cookie: identity.Cookie, Origin: identity.Origin })
            .send(payload)
        ).status,
      ).toBe(403);
      const created = await request(app)
        .post("/api/v1/staff/booking-slots")
        .set(identity)
        .send(payload);
      expect(created.status).toBe(201);
      const slotId = created.body.data.id as string;
      const slots = await request(app).get("/api/v1/staff/booking-slots").set(identity);
      expect(slots.status).toBe(200);
      expect(slots.body.data.items.map((s: { id: string }) => s.id)).toContain(slotId);
      expect(
        (
          await request(app)
            .patch(`/api/v1/staff/booking-slots/${slotId}`)
            .set(otherSession)
            .send({ expectedVersion: 0, status: "CLOSED" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`/api/v1/staff/booking-slots/${slotId}`)
            .set(identity)
            .send({ expectedVersion: 0, status: "CLOSED" })
        ).status,
      ).toBe(200);
      expect(
        await prisma.auditLog.count({
          where: { userId: actor.id, entityId: slotId, action: "CREATE" },
        }),
      ).toBe(1);
      expect(
        (
          await request(app)
            .post("/api/v1/staff/booking-slots")
            .set(identity)
            .send({ ...payload, staffId: otherStaff.staffProfile!.id })
        ).status,
      ).toBe(404);
    }
    for (const endpoint of ["bookings", "booking-slots"]) {
      const unverified = await session(owner.id, owner.role, false);
      for (const identity of [missingSession, customerSession, unverified]) {
        expect(
          (await request(app).get(`/api/v1/staff/${endpoint}`).set(identity)).status,
        ).toBe(403);
      }
    }
    const scoped = await request(app)
      .get(`/api/v1/staff/bookings?branchId=${secondBranch.id}`)
      .set(staffSession);
    expect(scoped.status).toBe(200);
    expect(scoped.body.data.items.map((b: { id: string }) => b.id)).toEqual([
      bookings[0]!.id,
    ]);
    expect(
      (
        await request(app)
          .get(`/api/v1/staff/bookings/${bookings[1]!.id}`)
          .set(staffSession)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/staff/bookings/${bookings[1]!.id}/assignment`)
          .set(staffSession)
          .send({ expectedVersion: 1, assignedStaffId: otherStaff.staffProfile!.id })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(`/api/v1/staff/booking-slots?branchId=${firstBranch.id}`)
          .set(otherSession)
      ).body.data.items,
    ).toEqual([]);
  });
});
