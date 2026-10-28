import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "scoped workforce booking confirmation",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      day = 0;
    const note =
      "Synthetic people and equipment availability checked for this appointment";
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture(
      options: {
        capability?: boolean;
        role?: "STAFF" | "ADMIN";
        scope?: boolean;
        branchId?: string;
        assigned?: boolean;
        policy?: boolean;
        status?: "REQUESTED" | "AWAITING_DEPOSIT";
      } = {},
    ) {
      const who = await f.account(
        options.scope === false ? "ACCOUNTANT" : "CUSTOMER_SERVICE",
        options.role ?? "STAFF",
      );
      const branchId = options.branchId ?? f.home.id;
      const scheduledAt = new Date(Date.now() + (10 + day++) * 86400000);
      scheduledAt.setUTCHours(9, 0, 0, 0);
      let grantId: string | undefined;
      if (options.capability !== false)
        grantId = (
          await prisma.userCapability.create({
            data: {
              userId: who.user.id,
              capability: "BOOKING_CONFIRM",
              grantedByUserId: f.owner.id,
            },
          })
        ).id;
      if (
        options.policy !== false &&
        !(await prisma.businessPolicyVersion.findFirst({
          where: { key: `booking-capacity:${branchId}` },
        }))
      )
        await prisma.businessPolicyVersion.create({
          data: {
            key: `booking-capacity:${branchId}`,
            version: 1,
            approvalStatus: "APPROVED",
            source: "Isolated scoped booking fixture",
            sourceQuestion: "Synthetic only",
            approvedByUserId: f.owner.id,
            effectiveAt: new Date(Date.now() - 1000),
            settings: {
              dailyLimit: 20,
              openingDays: [0, 1, 2, 3, 4, 5, 6],
              opensAt: "08:00",
              closesAt: "18:00",
              holidays: [],
              timezone: "Africa/Lagos",
            },
          },
        });
      const booking = await prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId,
          serviceId: f.job1.serviceId,
          scheduledAt,
          assignedStaffId:
            options.assigned === false
              ? null
              : branchId === f.other.id
                ? f.electrical.user.staffProfile!.id
                : f.mechanical1.user.staffProfile!.id,
          status: options.status ?? "REQUESTED",
        },
      });
      return { who, booking, grantId };
    }
    const confirm = (
      who: { headers: Record<string, string> },
      id: string,
      body: object = { expectedVersion: 0, resourceReviewNote: note },
    ) =>
      request(app)
        .post(`/api/v1/staff/workforce/bookings/${id}/confirmation`)
        .set(who.headers)
        .send(body);
    it("completes a permitted reviewed confirmation using real capacity/schedule/version safeguards", async () => {
      const v = await fixture();
      const result = await confirm(v.who, v.booking.id);
      expect(result.status).toBe(200);
      expect(result.headers["cache-control"]).toContain("no-store");
      expect(
        workforceResponseSchema("bookingConfirmation").safeParse(result.body.data)
          .success,
      ).toBe(true);
      expect(result.body.data).toMatchObject({
        id: v.booking.id,
        status: "CONFIRMED",
        version: 1,
        performedByUserId: v.who.user.id,
        branchId: f.home.id,
        assignedStaffId: v.booking.assignedStaffId,
        resourceReviewNote: note,
      });
      expect(result.body.data.confirmedAt).toBeTruthy();
      expect(result.body.data).not.toHaveProperty("customer");
      expect(result.body.data).not.toHaveProperty("staffNotes");
      const stored = await prisma.booking.findUniqueOrThrow({
        where: { id: v.booking.id },
      });
      expect(stored).toMatchObject({
        status: "CONFIRMED",
        version: 1,
        resourceReviewNote: note,
      });
      expect(stored.capacityPolicyVersionId).toBeTruthy();
      expect(
        await prisma.bookingReminder.count({ where: { bookingId: v.booking.id } }),
      ).toBeGreaterThan(0);
      expect(
        await prisma.auditLog.count({
          where: {
            userId: v.who.user.id,
            entityId: v.booking.id,
            action: "STATUS_CHANGE",
          },
        }),
      ).toBe(1);
      expect((await confirm(v.who, v.booking.id)).status).toBe(409);
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${v.booking.id}`)
        .set(v.who.headers);
      expect(detail.status).toBe(200);
      expect(workforceResponseSchema("booking").safeParse(detail.body.data).success).toBe(
        true,
      );
      expect(detail.body.data.service.durationMinutes).toBe(60);
    });
    it("requires both responsibility scope and the explicit grant", async () => {
      for (const options of [{ capability: false }, { scope: false }]) {
        const v = await fixture(options);
        expect((await confirm(v.who, v.booking.id)).status).toBe(403);
        expect(
          (await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } }))
            .status,
        ).toBe("REQUESTED");
      }
    });
    it("preserves the unenrolled Admin's existing confirmation route", async () => {
      const v = await fixture();
      const legacy = await f.account(null, "ADMIN");
      await prisma.userCapability.create({
        data: {
          userId: legacy.user.id,
          capability: "BOOKING_CONFIRM",
          grantedByUserId: f.owner.id,
        },
      });
      const result = await request(app)
        .post(`/api/v1/staff/bookings/${v.booking.id}/status`)
        .set(legacy.headers)
        .send({ status: "CONFIRMED", expectedVersion: 0, resourceReviewNote: note });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        id: v.booking.id,
        status: "CONFIRMED",
        version: 1,
      });
    });
    it("commits once when scoped and legacy confirmations compete for the same booking", async () => {
      const v = await fixture(),
        legacy = await f.account(null, "ADMIN");
      await prisma.userCapability.create({
        data: {
          userId: legacy.user.id,
          capability: "BOOKING_CONFIRM",
          grantedByUserId: f.owner.id,
        },
      });
      const results = await Promise.all([
        confirm(v.who, v.booking.id),
        request(app)
          .post(`/api/v1/staff/bookings/${v.booking.id}/status`)
          .set(legacy.headers)
          .send({ status: "CONFIRMED", expectedVersion: 0, resourceReviewNote: note }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: v.booking.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
      expect(
        await prisma.bookingReminder.count({ where: { bookingId: v.booking.id } }),
      ).toBe(1);
    });
    it("enforces actual approved daily capacity without committing review metadata", async () => {
      const v = await fixture({ branchId: f.other.id });
      await f.assignment(v.who.user.id, "CUSTOMER_SERVICE", false, f.other.id);
      const policy = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: `booking-capacity:${f.other.id}` },
        orderBy: { version: "desc" },
      });
      await prisma.businessPolicyVersion.create({
        data: {
          key: policy.key,
          version: policy.version + 1,
          approvalStatus: "APPROVED",
          source: "Isolated full-capacity fixture",
          sourceQuestion: "Synthetic only",
          approvedByUserId: f.owner.id,
          effectiveAt: new Date(),
          settings: { ...(policy.settings as object), dailyLimit: 1 },
        },
      });
      const technician = await f.account("MECHANICAL_TECHNICIAN", "STAFF", f.other.id);
      await prisma.booking.create({
        data: {
          customerId: v.booking.customerId,
          branchId: f.other.id,
          serviceId: v.booking.serviceId,
          assignedStaffId: technician.user.staffProfile!.id,
          scheduledAt: new Date(v.booking.scheduledAt.getTime() + 3600000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      const result = await confirm(v.who, v.booking.id);
      expect(result.status).toBe(409);
      expect(result.body.message).toContain("daily capacity is full");
      expect(result.body.error.code).toBe("BOOKING_CAPACITY_FULL");
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } }),
      ).toMatchObject({
        status: "REQUESTED",
        resourceReviewNote: null,
        capacityPolicyVersionId: null,
      });
    });
    it("does not let an enrolled Admin cross branches; an explicit cross-branch responsibility is honoured for Staff", async () => {
      const denied = await fixture({ branchId: f.other.id, role: "ADMIN" });
      expect((await confirm(denied.who, denied.booking.id)).status).toBe(404);
      const allowed = await fixture({ branchId: f.other.id });
      await f.assignment(allowed.who.user.id, "CUSTOMER_SERVICE", false, f.other.id);
      expect((await confirm(allowed.who, allowed.booking.id)).status).toBe(200);
    });
    it("rejects stale versions and rolls back capacity metadata and reminders", async () => {
      const v = await fixture();
      expect(
        (
          await confirm(v.who, v.booking.id, {
            expectedVersion: 99,
            resourceReviewNote: note,
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } }),
      ).toMatchObject({
        status: "REQUESTED",
        version: 0,
        capacityPolicyVersionId: null,
        resourceReviewNote: null,
      });
      expect(
        await prisma.bookingReminder.count({ where: { bookingId: v.booking.id } }),
      ).toBe(0);
    });
    it("distinguishes missing business policy and closed calendar without making a confirmation", async () => {
      const branch = await prisma.branch.create({
        data: {
          code: `W12-${randomUUID().slice(0, 8)}`,
          name: "Synthetic unconfigured workshop",
          address: "Synthetic only",
          city: "Test",
          state: "Test",
        },
      });
      const unconfigured = await fixture({ branchId: branch.id, policy: false });
      await f.assignment(unconfigured.who.user.id, "CUSTOMER_SERVICE", false, branch.id);
      const missing = await confirm(unconfigured.who, unconfigured.booking.id);
      expect(missing.status).toBe(409);
      expect(missing.body.error.code).toBe("BOOKING_CAPACITY_POLICY_REQUIRED");
      const night = await fixture();
      const scheduledAt = new Date(night.booking.scheduledAt);
      scheduledAt.setUTCHours(22);
      await prisma.booking.update({
        where: { id: night.booking.id },
        data: { scheduledAt },
      });
      const closed = await confirm(night.who, night.booking.id);
      expect(closed.status).toBe(409);
      expect(closed.body.error.code).toBe("BOOKING_CALENDAR_CLOSED");
      for (const booking of [unconfigured.booking, night.booking])
        expect(
          (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
        ).toBe("REQUESTED");
    });
    it("preserves missing-assignment, deposit-state and actual schedule conflict checks", async () => {
      for (const options of [
        { assigned: false },
        { status: "AWAITING_DEPOSIT" as const },
      ]) {
        const v = await fixture(options);
        expect((await confirm(v.who, v.booking.id)).status).toBe(409);
      }
      const v = await fixture();
      await prisma.booking.create({
        data: {
          customerId: v.booking.customerId,
          branchId: f.home.id,
          serviceId: v.booking.serviceId,
          assignedStaffId: v.booking.assignedStaffId,
          scheduledAt: v.booking.scheduledAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      expect((await confirm(v.who, v.booking.id)).status).toBe(409);
    });
    it("rejects a revoked grant or expired responsibility on the same session", async () => {
      const v = await fixture();
      await prisma.userCapability.update({
        where: { id: v.grantId! },
        data: { revokedAt: new Date() },
      });
      expect((await confirm(v.who, v.booking.id)).status).toBe(403);
      const expired = await fixture();
      await prisma.workforceAssignment.updateMany({
        where: { userId: expired.who.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await confirm(expired.who, expired.booking.id)).status).toBe(403);
    });
    it("preserves MFA, CSRF, strict field validation and one committed confirmation under concurrency", async () => {
      const v = await fixture();
      const pending = await f.session(v.who.user.id, "STAFF", false);
      expect((await confirm(pending, v.booking.id)).status).toBe(403);
      expect(
        (
          await confirm(v.who, v.booking.id, {
            expectedVersion: 0,
            resourceReviewNote: "short",
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await confirm(v.who, v.booking.id, {
            expectedVersion: 0,
            resourceReviewNote: note,
            staffNotes: "unpermitted",
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await confirm(
            { headers: { Cookie: v.who.headers.Cookie!, Origin: v.who.headers.Origin! } },
            v.booking.id,
          )
        ).status,
      ).toBe(403);
      const results = await Promise.all([
        confirm(v.who, v.booking.id),
        confirm(v.who, v.booking.id),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({
          where: { entityId: v.booking.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(1);
    });
  },
);
