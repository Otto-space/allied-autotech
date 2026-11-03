import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testBranchCapacity, testBranchResources } from "../helpers/owner-policy.js";
import { createPendingReschedule } from "../../src/modules/service-operations/booking-reschedule.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
import * as notifications from "../../src/modules/notifications/notifications.service.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "scoped workforce reschedule HTTP journey",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      day = 0;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
    async function fixture(
      options: {
        lead?: boolean;
        grant?: boolean;
        role?: "STAFF" | "ADMIN";
        cross?: boolean;
        changedStaff?: boolean;
        targetScope?: boolean;
      } = {},
    ) {
      const who = await f.account(
        options.lead ? "WORKSHOP_LEAD" : "CUSTOMER_SERVICE",
        options.role ?? "STAFF",
      );
      if (options.lead) await f.assignment(who.user.id, "CUSTOMER_SERVICE", true);
      if (options.grant !== false)
        await prisma.userCapability.create({
          data: {
            userId: who.user.id,
            capability: "BOOKING_CONFIRM",
            grantedByUserId: f.owner.id,
          },
        });
      const branchId = options.cross ? f.other.id : f.home.id;
      const crossTechnician = options.cross
        ? await f.account("ELECTRICAL_TECHNICIAN", "STAFF", f.other.id)
        : null;
      if (options.cross) {
        if (options.targetScope) {
          await f.assignment(who.user.id, "CUSTOMER_SERVICE", true, f.other.id);
          if (options.lead)
            await f.assignment(who.user.id, "WORKSHOP_LEAD", true, f.other.id);
        }
      }
      if (
        !(await prisma.businessPolicyVersion.findFirst({
          where: { key: `booking-capacity:${branchId}` },
        }))
      )
        await testBranchCapacity(branchId, f.owner.id, 100);
      const originalAt = new Date(Date.now() + (10 + day++ * 2) * 86400000);
      originalAt.setUTCHours(9, 0, 0, 0);
      const startsAt = new Date(originalAt.getTime() + 86400000);
      const originalStaff = f.mechanical1.user.staffProfile!.id;
      const selectedStaff = options.cross
        ? crossTechnician!.user.staffProfile!.id
        : options.changedStaff
          ? f.mechanical2.user.staffProfile!.id
          : originalStaff;
      const service = await prisma.service.create({
        data: {
          name: "Synthetic reschedule service",
          slug: `reschedule-${randomUUID()}`,
          pricingType: "FIXED",
          priceKobo: 10000n,
          currency: "NGN",
          durationMinutes: 60,
          preparationMinutes: 0,
          cleanupMinutes: 0,
          isActive: true,
        },
      });
      await testBranchResources(branchId, f.owner.id, [service.id], [selectedStaff]);
      if (branchId !== f.home.id)
        await testBranchResources(f.home.id, f.owner.id, [service.id], [originalStaff]);
      const booking = await prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          serviceId: service.id,
          assignedStaffId: originalStaff,
          scheduledAt: originalAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          staffNotes: "Private original staff note",
          policySnapshot: { historicalSentinel: "preserved" },
        },
      });
      const slot = await prisma.bookingSlot.create({
        data: {
          branchId,
          serviceId: booking.serviceId!,
          staffId: selectedStaff,
          durationMinutes: 60,
          preparationMinutes: 0,
          cleanupMinutes: 0,
          serviceTimingVersion: 0,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 3600000),
        },
      });
      const pending = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id}::uuid FOR UPDATE`;
        const row = await createPendingReschedule(
          tx,
          booking,
          f.customer.user.id,
          { id: slot.id, branchId, startsAt },
          "Synthetic customer change request",
          "CUSTOMER",
        );
        await tx.booking.update({
          where: { id: booking.id },
          data: { version: { increment: 1 } },
        });
        return row;
      });
      const body = {
        requestId: pending.id,
        expectedVersion: 1,
        decision: "APPROVE",
        assignedStaffId: selectedStaff,
        reason: "Synthetic reviewed decision",
        resourceReviewNote: "Synthetic people and required equipment checked",
      };
      const decide = (input: object = body, headers = who.headers) =>
        request(app)
          .post(`/api/v1/staff/workforce/bookings/${booking.id}/reschedule-decision`)
          .set(headers)
          .send(input);
      return { who, booking, pending, slot, body, selectedStaff, decide };
    }
    it.each(["STAFF", "ADMIN"] as const)(
      "lets scoped %s confirm the existing technician through HTTP without leaking financial/private details",
      async (role) => {
        const v = await fixture({ role });
        const response = await v.decide();
        expect(response.status).toBe(200);
        expect(
          workforceResponseSchema("bookingReschedule").safeParse(response.body.data)
            .success,
        ).toBe(true);
        expect(Object.keys(response.body.data).sort()).toEqual([
          "assignedStaffId",
          "branchId",
          "decidedAt",
          "id",
          "performedByUserId",
          "requestId",
          "requestStatus",
          "scheduledAt",
          "status",
          "version",
        ]);
        expect(response.body.data).toMatchObject({
          id: v.booking.id,
          version: 3,
          status: "CONFIRMED",
          scheduledAt: v.slot.startsAt.toISOString(),
          requestStatus: "APPROVED",
          performedByUserId: v.who.user.id,
        });
        const saved = await prisma.booking.findUniqueOrThrow({
          where: { id: v.booking.id },
        });
        expect(saved.policySnapshot).toEqual({ historicalSentinel: "preserved" });
        expect((await v.decide()).status).toBe(409);
      },
    );
    it("requires CSRF and independent confirmation authority without changing the original", async () => {
      const v = await fixture();
      const withoutCsrf = { ...v.who.headers, "X-CSRF-Token": "invalid" };
      expect((await v.decide(v.body, withoutCsrf)).status).toBe(403);
      const missingGrant = await fixture({ grant: false });
      expect((await missingGrant.decide()).status).toBe(403);
      for (const value of [v, missingGrant])
        expect(
          await prisma.booking.findUnique({ where: { id: value.booking.id } }),
        ).toMatchObject({ scheduledAt: value.booking.scheduledAt, version: 1 });
    });
    it("separates assignment duty from confirmation but permits a decline without changing assignment", async () => {
      const v = await fixture({ changedStaff: true });
      expect((await v.decide()).status).toBe(404);
      const deniedOptions = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${v.booking.id}/reschedule-assignees`)
        .query({ requestId: v.pending.id, limit: 25 })
        .set(v.who.headers);
      expect(deniedOptions.status).toBe(403);
      const declined = await v.decide({
        requestId: v.pending.id,
        expectedVersion: 1,
        decision: "DECLINE",
        reason: "Replacement technician cannot be assigned by this operator",
      });
      expect(declined.status).toBe(200);
      expect(declined.body.data).toMatchObject({
        requestStatus: "DECLINED",
        version: 2,
        scheduledAt: v.booking.scheduledAt.toISOString(),
        assignedStaffId: v.booking.assignedStaffId,
      });
    });
    it("reuses scoped candidates and atomically changes the technician only with assignment duty", async () => {
      const v = await fixture({ lead: true, changedStaff: true });
      const options = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${v.booking.id}/reschedule-assignees`)
        .query({ requestId: v.pending.id, staffId: v.selectedStaff, limit: 25 })
        .set(v.who.headers);
      expect(options.status, JSON.stringify(options.body)).toBe(200);
      expect(options.body.data).toMatchObject({
        requestId: v.pending.id,
        jobId: v.booking.id,
        jobVersion: 1,
        branchId: f.home.id,
      });
      expect(options.body.data.items.map((person: { id: string }) => person.id)).toEqual([
        v.selectedStaff,
      ]);
      const response = await v.decide();
      expect(response.status).toBe(200);
      expect(response.body.data.assignedStaffId).toBe(v.selectedStaff);
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${v.booking.id}`)
        .set(v.who.headers);
      expect(detail.status).toBe(200);
      const history = detail.body.data.rescheduleRequests[0];
      expect(history).toMatchObject({
        id: v.pending.id,
        status: "APPROVED",
        proposedStaff: { id: v.selectedStaff },
      });
      for (const key of [
        "originalSchedule",
        "requestedByUserId",
        "decidedByUserId",
        "slot",
      ])
        expect(history).not.toHaveProperty(key);
    });
    it("requires both branch scopes and redacts out-of-scope proposed staff names", async () => {
      const denied = await fixture({ lead: true, cross: true });
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${denied.booking.id}`)
        .set(denied.who.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data.rescheduleRequests[0].proposedStaff).toBeNull();
      expect([403, 404]).toContain((await denied.decide()).status);
      const allowed = await fixture({ lead: true, cross: true, targetScope: true });
      const response = await allowed.decide();
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        branchId: f.other.id,
        assignedStaffId: allowed.selectedStaff,
      });
    });
    it("rejects retired technician duty, closed slot and wrong request ownership", async () => {
      const v = await fixture();
      const grants = await prisma.workforceAssignment.findMany({
        where: { userId: f.mechanical1.user.id, revokedAt: null },
      });
      await prisma.workforceAssignment.updateMany({
        where: { id: { in: grants.map((grant) => grant.id) } },
        data: {
          revokedAt: new Date(),
          revokedByUserId: f.owner.id,
          revocationReason: "Synthetic temporary test revocation",
        },
      });
      expect((await v.decide()).status).toBe(403);
      await f.assignment(f.mechanical1.user.id, "MECHANICAL_TECHNICIAN", true);
      await prisma.bookingSlot.update({
        where: { id: v.slot.id },
        data: { status: "CLOSED" },
      });
      expect((await v.decide()).status).toBe(409);
      const other = await fixture();
      expect(
        (await other.decide({ ...other.body, requestId: v.pending.id })).status,
      ).toBe(404);
    });
    it("rolls back if the original branch duty expires after the switch while replacement scope stays valid", async () => {
      const v = await fixture({ lead: true, cross: true, targetScope: true });
      const cutoff = new Date(Date.now() + 30000);
      await prisma.workforceAssignment.updateMany({
        where: { userId: v.who.user.id, branchId: f.home.id, revokedAt: null },
        data: { temporary: true, expiresAt: cutoff },
      });
      const enqueue = notifications.enqueueNotification;
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.spyOn(notifications, "enqueueNotification").mockImplementationOnce(
        async (...args) => {
          const result = await enqueue(...args);
          vi.setSystemTime(new Date(cutoff.getTime() + 1000));
          return result;
        },
      );
      const response = await v.decide();
      expect([403, 404]).toContain(response.status);
      expect(
        await prisma.booking.findUnique({ where: { id: v.booking.id } }),
      ).toMatchObject({
        scheduledAt: v.booking.scheduledAt,
        branchId: v.booking.branchId,
        version: 1,
      });
      expect(
        await prisma.bookingRescheduleRequest.findUnique({ where: { id: v.pending.id } }),
      ).toMatchObject({ status: "PENDING" });
    });
    it("rolls back if technician eligibility expires while saving notifications", async () => {
      const v = await fixture();
      const cutoff = new Date(Date.now() + 30000);
      await prisma.workforceAssignment.updateMany({
        where: { userId: f.mechanical1.user.id, branchId: f.home.id, revokedAt: null },
        data: { temporary: true, expiresAt: cutoff },
      });
      const enqueue = notifications.enqueueNotification;
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.spyOn(notifications, "enqueueNotification").mockImplementationOnce(
        async (...args) => {
          const result = await enqueue(...args);
          vi.setSystemTime(new Date(cutoff.getTime() + 1000));
          return result;
        },
      );
      expect((await v.decide()).status).toBe(403);
      expect(
        await prisma.booking.findUnique({ where: { id: v.booking.id } }),
      ).toMatchObject({ scheduledAt: v.booking.scheduledAt, version: 1 });
    });
  },
);
