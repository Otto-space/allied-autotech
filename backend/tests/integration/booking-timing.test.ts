import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testBranchCapacity } from "../helpers/owner-policy.js";
import {
  captureBookingTiming,
  timingWindow,
} from "../../src/modules/service-operations/booking-timing.js";
import { ServiceOperationsRepository } from "../../src/modules/service-operations/service-operations.repository.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "saved appointment timing and reasoned overrides",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      day = 0;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      await testBranchCapacity(f.home.id, f.owner.id, 100);
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture(unknown = false, grant = true) {
      const who = await f.account("CUSTOMER_SERVICE");
      if (grant)
        await prisma.userCapability.create({
          data: {
            userId: who.user.id,
            capability: "BOOKING_CONFIRM",
            grantedByUserId: f.owner.id,
          },
        });
      const service = await prisma.service.create({
        data: {
          name: "Synthetic timing test",
          slug: `timing-${randomUUID()}`,
          pricingType: "FIXED",
          priceKobo: 10000n,
          currency: "NGN",
          durationMinutes: 60,
          preparationMinutes: unknown ? null : 15,
          cleanupMinutes: unknown ? null : 20,
        },
      });
      const scheduledAt = new Date(Date.now() + (10 + day++ * 2) * 86400000);
      scheduledAt.setUTCHours(9, 0, 0, 0);
      const booking = await prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          serviceId: service.id,
          assignedStaffId: f.mechanical1.user.staffProfile!.id,
          scheduledAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          policySnapshot: { historicalTimingTest: "preserve" },
        },
      });
      const body = {
        expectedVersion: 0,
        durationMinutes: 45,
        preparationMinutes: 10,
        cleanupMinutes: 10,
        reason: "Internal synthetic scheduling assessment",
        resourceReviewNote: "Synthetic people and equipment reviewed",
      };
      const submit = (input: object = body, headers = who.headers) =>
        request(app)
          .post(`/api/v1/staff/workforce/bookings/${booking.id}/timing`)
          .set(headers)
          .send(input);
      return { who, service, booking, body, submit };
    }
    it("records a reasoned scoped override while preserving the old estimate, status, start and financial snapshot", async () => {
      const v = await fixture();
      const result = await v.submit();
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(
        workforceResponseSchema("bookingTiming").safeParse(result.body.data).success,
      ).toBe(true);
      expect(result.body.data).toMatchObject({
        id: v.booking.id,
        version: 1,
        scheduleVersion: 1,
        status: "CONFIRMED",
        scheduledAt: v.booking.scheduledAt.toISOString(),
        performedByUserId: v.who.user.id,
        timing: {
          durationMinutes: 45,
          preparationMinutes: 10,
          cleanupMinutes: 10,
          source: "APPOINTMENT_OVERRIDE",
          reason: v.body.reason,
        },
      });
      const rows = await prisma.bookingTimingSnapshot.findMany({
        where: { bookingId: v.booking.id },
        orderBy: { scheduleVersion: "asc" },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        durationMinutes: 60,
        preparationMinutes: 15,
        cleanupMinutes: 20,
        source: "LEGACY_CAPTURE",
        serviceId: v.service.id,
      });
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } }))
          .policySnapshot,
      ).toEqual({ historicalTimingTest: "preserve" });
      expect((await v.submit()).status).toBe(409);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: v.booking.id } }),
      ).toBe(2);
    });
    it("pins existing timing before default edits and hides internal timing metadata from customers", async () => {
      const v = await fixture();
      const owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const historical = await prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          scheduledAt: new Date(v.booking.scheduledAt.getTime() - 86400000),
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "Synthetic prior cancellation",
        },
      });

      const result = await request(app)
        .patch(`/api/v1/admin/services/${v.service.id}`)
        .set(owner.headers)
        .send({
          expectedVersion: 0,
          durationMinutes: 15,
          preparationMinutes: 0,
          cleanupMinutes: 0,
        });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      const saved = await prisma.bookingTimingSnapshot.findUniqueOrThrow({
        where: {
          bookingId_scheduleVersion: { bookingId: v.booking.id, scheduleVersion: 0 },
        },
      });
      expect(saved.durationMinutes).toBe(60);
      expect(
        (
          await prisma.bookingTimingSnapshot.findUniqueOrThrow({
            where: {
              bookingId_scheduleVersion: { bookingId: historical.id, scheduleVersion: 0 },
            },
          })
        ).durationMinutes,
      ).toBe(60);

      const customer = await request(app)
        .get(`/api/v1/customers/bookings/${v.booking.id}`)
        .set(f.customer.headers);
      expect(customer.status).toBe(200);
      expect(customer.body.data.service.durationMinutes).toBe(60);
      expect(customer.body.data).not.toHaveProperty("timingSnapshots");
      expect(customer.body.data.service).not.toHaveProperty("preparationMinutes");
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/bookings/${v.booking.id}`)
        .set(v.who.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data.service.durationMinutes).toBe(60);
      const publicDetail = await request(app).get(
        `/api/v1/public/services/${v.service.id}`,
      );
      expect(publicDetail.status).toBe(200);
      expect(publicDetail.body.data.durationMinutes).toBe(15);
      expect(publicDetail.body.data).not.toHaveProperty("preparationMinutes");
    });
    it("uses the same safeguarded timing core for a current legacy administrator", async () => {
      const v = await fixture();
      if (
        !(await prisma.userCapability.findFirst({
          where: { userId: f.owner.id, capability: "BOOKING_CONFIRM", revokedAt: null },
        }))
      )
        await prisma.userCapability.create({
          data: {
            userId: f.owner.id,
            capability: "BOOKING_CONFIRM",
            grantedByUserId: f.owner.id,
          },
        });
      const owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const result = await request(app)
        .post(`/api/v1/staff/bookings/${v.booking.id}/timing`)
        .set(owner.headers)
        .send(v.body);
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      expect(result.body.data).toMatchObject({
        id: v.booking.id,
        version: 1,
        scheduleVersion: 1,
        performedByUserId: f.owner.id,
      });
    });
    it("rejects missing authority and CSRF before saving timing", async () => {
      const v = await fixture(false, false);
      expect((await v.submit()).status).toBe(403);
      const permitted = await fixture();
      expect(
        (
          await permitted.submit(permitted.body, {
            ...permitted.who.headers,
            "X-CSRF-Token": "invalid",
          })
        ).status,
      ).toBe(403);
      for (const item of [v, permitted]) {
        expect(
          await prisma.bookingTimingSnapshot.count({
            where: { bookingId: item.booking.id },
          }),
        ).toBe(0);
        expect(
          (await prisma.booking.findUniqueOrThrow({ where: { id: item.booking.id } }))
            .version,
        ).toBe(0);
      }
    });
    it("counts full buffers, permits independent technicians and releases cancelled capacity", async () => {
      const v = await fixture();
      const timing = await prisma.$transaction((tx) =>
        captureBookingTiming(tx, v.booking, f.owner.id),
      );
      const window = timingWindow(v.booking.scheduledAt, timing),
        repo = new ServiceOperationsRepository();
      expect(
        await prisma.$transaction((tx) =>
          repo.hasScheduleConflict(
            v.booking.assignedStaffId!,
            new Date(v.booking.scheduledAt.getTime() + 70 * 60000),
            new Date(v.booking.scheduledAt.getTime() + 90 * 60000),
            null,
            tx,
          ),
        ),
      ).toBe(true);
      expect(
        await prisma.$transaction((tx) =>
          repo.hasScheduleConflict(
            v.booking.assignedStaffId!,
            window.endsAt,
            new Date(window.endsAt.getTime() + 60000),
            null,
            tx,
          ),
        ),
      ).toBe(false);
      expect(
        await prisma.$transaction((tx) =>
          repo.hasScheduleConflict(
            f.mechanical2.user.staffProfile!.id,
            window.startsAt,
            window.endsAt,
            null,
            tx,
          ),
        ),
      ).toBe(false);
      const cancelled = await request(app)
        .post(`/api/v1/customers/bookings/${v.booking.id}/cancel`)
        .set(f.customer.headers)
        .send({ expectedVersion: 0, reason: "Synthetic customer cancellation" });
      expect(cancelled.status).toBe(200);
      expect(
        await prisma.$transaction((tx) =>
          repo.hasScheduleConflict(
            v.booking.assignedStaffId!,
            window.startsAt,
            window.endsAt,
            null,
            tx,
          ),
        ),
      ).toBe(false);
    });
    it("keeps an unassessed buffer unknown until explicit override and preserves immutable history", async () => {
      const v = await fixture(true);
      await prisma.bookingSlot.create({
        data: {
          branchId: f.home.id,
          serviceId: v.service.id,
          staffId: v.booking.assignedStaffId!,
          startsAt: new Date(v.booking.scheduledAt.getTime() + 86400000),
          endsAt: new Date(v.booking.scheduledAt.getTime() + 86400000 + 3600000),
        },
      });
      const slots = await request(app)
        .get(`/api/v1/public/services/${v.service.id}/slots`)
        .query({ branchId: f.home.id });
      expect(slots.status).toBe(200);
      expect(slots.body.data.items).toEqual([]);

      await expect(
        prisma.$transaction((tx) => captureBookingTiming(tx, v.booking, f.owner.id)),
      ).rejects.toThrow(/Unknown is not zero/);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: v.booking.id } }),
      ).toBe(0);
      expect((await v.submit()).status).toBe(200);
      const old = await prisma.bookingTimingSnapshot.findUniqueOrThrow({
        where: {
          bookingId_scheduleVersion: { bookingId: v.booking.id, scheduleVersion: 0 },
        },
      });
      expect(old.preparationMinutes).toBeNull();
      await expect(
        prisma.bookingTimingSnapshot.update({
          where: { id: old.id },
          data: { durationMinutes: 15 },
        }),
      ).rejects.toThrow(/immutable/);
      await expect(
        prisma.bookingTimingSnapshot.delete({ where: { id: old.id } }),
      ).rejects.toThrow(/immutable/);
    });
    it("rolls back an override that crosses opening/closing or conflicts with another held appointment", async () => {
      const v = await fixture();
      expect((await v.submit({ ...v.body, preparationMinutes: 180 })).status).toBe(409);
      expect((await v.submit({ ...v.body, durationMinutes: 600 })).status).toBe(409);
      const other = await prisma.booking.create({
        data: {
          customerId: f.stranger.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: v.booking.assignedStaffId,
          scheduledAt: new Date(v.booking.scheduledAt.getTime() + 90 * 60000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      await prisma.$transaction((tx) => captureBookingTiming(tx, other, f.owner.id));
      expect((await v.submit({ ...v.body, durationMinutes: 120 })).status).toBe(409);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: v.booking.id } }),
      ).toBe(0);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } })).version,
      ).toBe(0);
    });
    it("rechecks the saved occupied interval when reassigning an already classified appointment", async () => {
      const v = await fixture();
      await prisma.$transaction((tx) => captureBookingTiming(tx, v.booking, f.owner.id));
      const other = await prisma.booking.create({
        data: {
          customerId: f.stranger.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: f.mechanical2.user.staffProfile!.id,
          scheduledAt: new Date(v.booking.scheduledAt.getTime() + 30 * 60000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      await prisma.$transaction((tx) => captureBookingTiming(tx, other, f.owner.id));
      const result = await request(app)
        .patch(`/api/v1/staff/workforce/jobs/${v.booking.id}/assignment`)
        .set(f.lead.headers)
        .send({
          expectedVersion: 0,
          staffId: f.mechanical2.user.staffProfile!.id,
          reason: "Synthetic reassignment capacity review",
        });
      expect(result.status, JSON.stringify(result.body)).toBe(409);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: v.booking.id } }))
          .assignedStaffId,
      ).toBe(v.booking.assignedStaffId);
    });
    it("rejects duplicate concurrent overrides and stale resource-sensitive requests", async () => {
      const v = await fixture();
      const result = await Promise.all([v.submit(), v.submit()]);
      expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: v.booking.id } }),
      ).toBe(2);
    });
  },
);
