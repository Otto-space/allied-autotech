import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import {
  testBranchCapacity,
  testCapability,
  testBranchResources,
} from "../helpers/owner-policy.js";
import { captureBookingTiming } from "../../src/modules/service-operations/booking-timing.js";
import {
  ServiceOperationsService,
  bookingPolicy,
} from "../../src/modules/service-operations/service-operations.service.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "versioned full-period appointment offers",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      admin: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["account"]>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      admin = await f.account(null, "ADMIN");
      await testCapability(admin.user.id, "BOOKING_CONFIRM");
      await testBranchCapacity(f.home.id, f.owner.id, 100);
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const service = await prisma.service.create({
        data: {
          name: "Synthetic slot timing",
          slug: randomUUID(),
          pricingType: "FIXED",
          priceKobo: 10000n,
          durationMinutes: 60,
          preparationMinutes: 15,
          cleanupMinutes: 20,
        },
      });
      const worker = await f.account("MECHANICAL_TECHNICIAN"),
        buyer = await f.account(null, "CUSTOMER");
      await testBranchResources(
        f.home.id,
        f.owner.id,
        [service.id],
        [
          worker.user.staffProfile!.id,
          f.mechanical1.user.staffProfile!.id,
          f.mechanical2.user.staffProfile!.id,
          f.electrical.user.staffProfile!.id,
        ],
      );
      const startsAt = new Date(Date.now() + 9 * 86400000);
      startsAt.setUTCHours(9, 0, 0, 0);
      const publish = (time = startsAt, staffId = worker.user.staffProfile!.id) =>
        request(app).post("/api/v1/staff/booking-slots").set(admin.headers).send({
          branchId: f.home.id,
          serviceId: service.id,
          staffId,
          startsAt: time.toISOString(),
        });
      const list = (query: Record<string, string | number> = {}) =>
        request(app)
          .get(`/api/v1/public/services/${service.id}/slots`)
          .query({ branchId: f.home.id, ...query });
      const claim = (slotId: string) =>
        request(app)
          .post("/api/v1/customers/bookings")
          .set(buyer.headers)
          .set("Idempotency-Key", randomUUID())
          .send({ slotId, policyVersion: bookingPolicy.version });
      const edit = (version: number, values: object) =>
        request(app)
          .patch(`/api/v1/admin/services/${service.id}`)
          .set(admin.headers)
          .send({ expectedVersion: version, ...values });
      return { service, worker, buyer, startsAt, publish, list, claim, edit };
    }
    it("reserves preparation and cleanup between offers, allows touching periods and independent technicians", async () => {
      const v = await fixture(),
        first = await v.publish();
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect(first.body.data).toMatchObject({
        durationMinutes: 60,
        preparationMinutes: 15,
        cleanupMinutes: 20,
        serviceTimingVersion: 0,
      });
      expect((await v.publish(new Date(v.startsAt.getTime() + 60 * 60000))).status).toBe(
        409,
      );
      expect((await v.publish(new Date(v.startsAt.getTime() + 95 * 60000))).status).toBe(
        201,
      );
      expect(
        (await v.publish(v.startsAt, f.mechanical2.user.staffProfile!.id)).status,
      ).toBe(201);
      await new ServiceOperationsService().publicBookingSlots(v.service.id, {
        branchId: f.home.id,
        limit: 25,
      });
      const listed = await v.list();
      expect(listed.status).toBe(200);
      expect(listed.body.data.items).toHaveLength(3);
      for (const slot of listed.body.data.items) {
        expect(slot).not.toHaveProperty("preparationMinutes");
        expect(slot).not.toHaveProperty("serviceTimingVersion");
        expect(slot.service).not.toHaveProperty("timingVersion");
      }
    });
    it("enforces complete occupied periods at both opening and closing", async () => {
      const v = await fixture(),
        early = new Date(v.startsAt),
        late = new Date(v.startsAt);
      early.setUTCHours(7);
      late.setUTCHours(16);
      expect((await v.publish(early)).status).toBe(409);
      expect((await v.publish(late)).status).toBe(409);
      const good = new Date(v.startsAt);
      good.setUTCHours(15, 40);
      expect((await v.publish(good)).status).toBe(201);
    });
    it("retires changed and reverted defaults from public choices and cached claims, then explicitly reviews an unheld offer", async () => {
      const v = await fixture(),
        slot = (await v.publish()).body.data;
      expect((await v.list()).body.data.items).toHaveLength(1);
      const changed = await v.edit(0, { durationMinutes: 75 });
      expect(changed.status).toBe(200);
      expect((await v.list()).body.data.items).toEqual([]);
      expect((await v.claim(slot.id)).status).toBe(409);
      expect((await v.edit(1, { durationMinutes: 60 })).status).toBe(200);
      expect((await v.list()).body.data.items).toEqual([]);
      const staff = await request(app)
        .get("/api/v1/staff/booking-slots")
        .set(admin.headers)
        .query({ serviceId: v.service.id });
      expect(
        staff.body.data.items.find((row: { id: string }) => row.id === slot.id)
          .timingReviewRequired,
      ).toBe(true);
      const staleReview = await request(app)
        .patch(`/api/v1/staff/booking-slots/${slot.id}`)
        .set(admin.headers)
        .send({ expectedVersion: 0, status: "OPEN", expectedServiceVersion: 0 });
      expect(staleReview.status).toBe(409);
      const reopened = await request(app)
        .patch(`/api/v1/staff/booking-slots/${slot.id}`)
        .set(admin.headers)
        .send({ expectedVersion: 0, status: "OPEN", expectedServiceVersion: 2 });
      expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
      expect(reopened.body.data.serviceTimingVersion).toBe(2);
      expect((await v.list()).body.data.items).toHaveLength(1);
      const claimed = await v.claim(slot.id);
      expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
      expect(claimed.body.data.booking).toMatchObject({
        status: "REQUESTED",
        scheduledAt: v.startsAt.toISOString(),
      });
      expect(claimed.body.data.booking).not.toHaveProperty("timingSnapshots");
      expect(claimed.body.data.booking.service).not.toHaveProperty("timingVersion");
      expect(claimed.body.data.booking.service).not.toHaveProperty("preparationMinutes");
      expect(claimed.body.data.booking.bookingSlot).not.toHaveProperty(
        "preparationMinutes",
      );
      expect(claimed.body.data.booking.bookingSlot).not.toHaveProperty(
        "serviceTimingVersion",
      );
      expect(claimed.body.data.booking.bookingSlot.service).not.toHaveProperty(
        "timingVersion",
      );
      expect(claimed.body.data.booking.bookingSlot.service).not.toHaveProperty(
        "cleanupMinutes",
      );
      expect(
        (
          await request(app)
            .patch(`/api/v1/staff/booking-slots/${slot.id}`)
            .set(admin.headers)
            .send({ expectedVersion: 1, status: "OPEN" })
        ).status,
      ).toBe(409);
    });
    it("hides legacy unassessed offers without inventing zero and filters before pagination", async () => {
      const v = await fixture();
      const legacy = await prisma.bookingSlot.create({
        data: {
          branchId: f.home.id,
          serviceId: v.service.id,
          staffId: v.worker.user.staffProfile!.id,
          startsAt: v.startsAt,
          endsAt: new Date(v.startsAt.getTime() + 3600000),
        },
      });
      expect((await v.claim(legacy.id)).status).toBe(409);
      expect((await v.publish(new Date(v.startsAt.getTime() + 2 * 3600000))).status).toBe(
        201,
      );
      expect((await v.publish(new Date(v.startsAt.getTime() + 4 * 3600000))).status).toBe(
        201,
      );
      const first = await v.list({ limit: 1 });
      expect(first.body.data.items).toHaveLength(1);
      expect(first.body.data.items[0].id).not.toBe(legacy.id);
      expect(first.body.data.nextCursor).toBeTruthy();
      const next = await v.list({ limit: 1, cursor: first.body.data.nextCursor });
      expect(next.body.data.items).toHaveLength(1);
      expect(next.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
      expect(next.body.data.nextCursor).toBeUndefined();
    });
    it("serializes overlapping publication and rejects stale cached offers after actual occupancy, releasing on customer cancellation", async () => {
      const v = await fixture();
      const racing = await Promise.all([
        v.publish(),
        v.publish(new Date(v.startsAt.getTime() + 30 * 60000)),
      ]);
      expect(racing.map((row) => row.status).sort()).toEqual([201, 409]);
      const slot = racing.find((row) => row.status === 201)!.body.data;
      const other = await f.account(null, "CUSTOMER");
      const booking = await prisma.booking.create({
        data: {
          customerId: other.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: v.worker.user.staffProfile!.id,
          scheduledAt: new Date(slot.startsAt),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      await prisma.$transaction((tx) => captureBookingTiming(tx, booking, admin.user.id));
      expect((await v.list()).body.data.items).toEqual([]);
      expect((await v.claim(slot.id)).status).toBe(409);
      const cancelled = await request(app)
        .post(`/api/v1/customers/bookings/${booking.id}/cancel`)
        .set(other.headers)
        .send({ expectedVersion: 0, reason: "Synthetic customer cannot attend" });
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
      expect((await v.list()).body.data.items).toHaveLength(1);
    });
    it("allows an unpaid concern preference without calendar policy while hiding unreviewed offers", async () => {
      const v = await fixture(),
        branch = await prisma.branch.create({
          data: {
            code: `NO-CALENDAR-${randomUUID().slice(0, 8)}`,
            name: "Synthetic unconfigured branch",
            address: "Synthetic test address",
            city: "Test",
            state: "Test",
          },
        });
      const result = await request(app)
        .post("/api/v1/customers/bookings")
        .set(v.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({
          branchId: branch.id,
          preferredAt: v.startsAt.toISOString(),
          customerConcern: "Synthetic inspection concern with no invented service",
          policyVersion: bookingPolicy.version,
        });
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      expect(result.body.data.booking).toMatchObject({
        service: null,
        status: "REQUESTED",
        assignedStaff: null,
      });
      const slots = await v.list({ branchId: branch.id });
      expect(slots.body.data.items).toEqual([]);
    });
    it("preserves known estimates when defaults become unknown, including customer conflict preflight and atomic approval", async () => {
      const v = await fixture();
      const booking = await prisma.booking.create({
        data: {
          customerId: v.buyer.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: v.worker.user.staffProfile!.id,
          scheduledAt: v.startsAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          policySnapshot: { preserveFinancialHistory: true },
        },
      });
      await prisma.$transaction((tx) => captureBookingTiming(tx, booking, admin.user.id));
      expect(
        (
          await v.edit(0, {
            durationMinutes: null,
            preparationMinutes: null,
            cleanupMinutes: null,
          })
        ).status,
      ).toBe(200);
      const target = new Date(v.startsAt.getTime() + 86400000);
      const pending = await request(app)
        .patch(`/api/v1/customers/bookings/${booking.id}/schedule`)
        .set(v.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({
          expectedVersion: 0,
          preferredAt: target.toISOString(),
          reason: "Synthetic customer moves their original assessed visit",
        });
      expect(pending.status, JSON.stringify(pending.body)).toBe(200);
      const row = await prisma.bookingRescheduleRequest.findFirstOrThrow({
        where: { bookingId: booking.id, status: "PENDING" },
      });
      const approved = await request(app)
        .post(`/api/v1/staff/bookings/${booking.id}/reschedule-decision`)
        .set(admin.headers)
        .send({
          requestId: row.id,
          expectedVersion: 1,
          decision: "APPROVE",
          reason: "Synthetic replacement reviewed",
          resourceReviewNote: "Synthetic people and equipment checked",
        });
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(saved).toMatchObject({
        status: "CONFIRMED",
        scheduledAt: target,
        scheduleVersion: 1,
        policySnapshot: { preserveFinancialHistory: true },
      });
      const timing = await prisma.bookingTimingSnapshot.findUniqueOrThrow({
        where: {
          bookingId_scheduleVersion: { bookingId: booking.id, scheduleVersion: 1 },
        },
      });
      expect(timing).toMatchObject({
        durationMinutes: 60,
        preparationMinutes: 15,
        cleanupMinutes: 20,
        source: "RESCHEDULE_CARRY_FORWARD",
      });
      const reassigned = await request(app)
        .patch(`/api/v1/staff/bookings/${booking.id}/assignment`)
        .set(admin.headers)
        .send({
          expectedVersion: saved.version,
          assignedStaffId: f.mechanical2.user.staffProfile!.id,
        });
      expect(reassigned.status, JSON.stringify(reassigned.body)).toBe(200);
    });
    it("serializes same-day rescheduling and a separate timing override without deadlocking or displacing either appointment", async () => {
      const v = await fixture(),
        target = new Date(v.startsAt.getTime() + 86400000);
      const first = await prisma.booking.create({
        data: {
          customerId: v.buyer.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: v.worker.user.staffProfile!.id,
          scheduledAt: v.startsAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      const second = await prisma.booking.create({
        data: {
          customerId: v.buyer.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          assignedStaffId: v.worker.user.staffProfile!.id,
          scheduledAt: new Date(target.getTime() + 3 * 3600000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      await prisma.$transaction(async (tx) => {
        await captureBookingTiming(tx, first, admin.user.id);
        await captureBookingTiming(tx, second, admin.user.id);
      });
      const pending = await request(app)
        .patch(`/api/v1/customers/bookings/${first.id}/schedule`)
        .set(v.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({
          expectedVersion: 0,
          preferredAt: target.toISOString(),
          reason: "Synthetic same-day review request",
        });
      expect(pending.status).toBe(200);
      const change = await prisma.bookingRescheduleRequest.findFirstOrThrow({
        where: { bookingId: first.id, status: "PENDING" },
      });
      const results = await Promise.all([
        request(app)
          .post(`/api/v1/staff/bookings/${first.id}/reschedule-decision`)
          .set(admin.headers)
          .send({
            expectedVersion: 1,
            requestId: change.id,
            decision: "APPROVE",
            reason: "Synthetic safe replacement",
            resourceReviewNote: "Synthetic technician and equipment available",
          }),
        request(app)
          .post(`/api/v1/staff/bookings/${second.id}/timing`)
          .set(admin.headers)
          .send({
            expectedVersion: 0,
            durationMinutes: 45,
            preparationMinutes: 10,
            cleanupMinutes: 10,
            reason: "Synthetic separate assessment",
            resourceReviewNote: "Synthetic separate technician period checked",
          }),
      ]);
      expect(
        results.map((row) => row.status),
        JSON.stringify(results.map((row) => row.body)),
      ).toEqual([200, 200]);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: first.id } })).scheduledAt,
      ).toEqual(target);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: second.id } }))
          .scheduledAt,
      ).toEqual(second.scheduledAt);
    });
    it("rejects unsupported slot-bound reassignment without a server error and preserves the occupied slot", async () => {
      const v = await fixture(),
        oldSlot = (await v.publish()).body.data,
        targetAt = new Date(v.startsAt.getTime() + 86400000);
      const original = await prisma.booking.create({
        data: {
          customerId: v.buyer.user.profile!.id,
          branchId: f.home.id,
          serviceId: v.service.id,
          bookingSlotId: oldSlot.id,
          assignedStaffId: v.worker.user.staffProfile!.id,
          scheduledAt: v.startsAt,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          disruptionResolution: "PENDING",
          disruptionRequestedAt: new Date(),
          disruptionReason: "Synthetic equipment interruption",
          policySnapshot: { preserveDisruptedHistory: true },
        },
      });
      await prisma.$transaction((tx) =>
        captureBookingTiming(tx, original, admin.user.id),
      );
      const target = (await v.publish(targetAt)).body.data,
        otherBuyer = await f.account(null, "CUSTOMER"),
        otherWorker = await f.account("MECHANICAL_TECHNICIAN");
      const claimed = await request(app)
        .post("/api/v1/customers/bookings")
        .set(otherBuyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({ slotId: target.id, policyVersion: bookingPolicy.version });
      expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
      const occupied = claimed.body.data.booking;
      const reassigned = await request(app)
        .patch(`/api/v1/staff/bookings/${occupied.id}/assignment`)
        .set(admin.headers)
        .send({ expectedVersion: 0, assignedStaffId: otherWorker.user.staffProfile!.id });
      expect(reassigned.status, JSON.stringify(reassigned.body)).toBe(409);
      expect(JSON.stringify(reassigned.body)).toContain("published slot");
      const managed = await request(app)
        .patch(`/api/v1/staff/workforce/jobs/${occupied.id}/assignment`)
        .set(f.lead.headers)
        .send({
          expectedVersion: 0,
          staffId: otherWorker.user.staffProfile!.id,
          reason: "Synthetic reassignment requiring reviewed replacement",
        });
      expect(managed.status, JSON.stringify(managed.body)).toBe(409);
      const resolution = await request(app)
        .post(`/api/v1/customers/bookings/${original.id}/disruption-resolution`)
        .set(v.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedVersion: 0, resolution: "TRANSFER", slotId: target.id });
      expect(resolution.status, JSON.stringify(resolution.body)).toBe(409);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: original.id } }),
      ).toMatchObject({
        bookingSlotId: oldSlot.id,
        scheduledAt: v.startsAt,
        status: "CONFIRMED",
        scheduleVersion: 0,
        disruptionResolution: "PENDING",
        policySnapshot: { preserveDisruptedHistory: true },
      });
      expect(
        await prisma.booking.count({
          where: {
            bookingSlotId: target.id,
            status: { in: ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"] },
          },
        }),
      ).toBe(1);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: occupied.id } }))
          .assignedStaffId,
      ).toBe(v.worker.user.staffProfile!.id);
    });
    it("preserves a used slot's schedule after cancellation and requires a new offer for changed estimates", async () => {
      const v = await fixture();
      const published = await v.publish();
      expect(published.status, JSON.stringify(published.body)).toBe(201);
      const slot = published.body.data;
      const claimed = await v.claim(slot.id);
      expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
      const booking = claimed.body.data.booking;
      const cancelled = await request(app)
        .post(`/api/v1/customers/bookings/${booking.id}/cancel`)
        .set(v.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({
          expectedVersion: 0,
          reason: "Synthetic cancellation before workshop confirmation",
        });
      expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
      const edited = await v.edit(0, { durationMinutes: 75 });
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      const reopened = await request(app)
        .patch(`/api/v1/staff/booking-slots/${slot.id}`)
        .set(admin.headers)
        .send({
          expectedVersion: slot.version,
          status: "OPEN",
          expectedServiceVersion: 1,
        });
      expect(reopened.status, JSON.stringify(reopened.body)).toBe(409);
      expect(JSON.stringify(reopened.body)).toContain("booking history");
      expect(
        await prisma.bookingSlot.findUniqueOrThrow({ where: { id: slot.id } }),
      ).toMatchObject({
        durationMinutes: 60,
        serviceTimingVersion: 0,
        endsAt: new Date(v.startsAt.getTime() + 60 * 60000),
      });
      const premature = await v.publish();
      expect(premature.status, JSON.stringify(premature.body)).toBe(409);
      expect(JSON.stringify(premature.body)).toContain("Close obsolete offers");
      const closed = await request(app)
        .patch(`/api/v1/staff/booking-slots/${slot.id}`)
        .set(admin.headers)
        .send({ expectedVersion: slot.version, status: "CLOSED" });
      expect(closed.status, JSON.stringify(closed.body)).toBe(200);
      expect(
        await prisma.bookingSlot.findUniqueOrThrow({ where: { id: slot.id } }),
      ).toMatchObject({
        status: "CLOSED",
        durationMinutes: 60,
        serviceTimingVersion: 0,
        endsAt: new Date(v.startsAt.getTime() + 60 * 60000),
      });
      const replacement = await v.publish();
      expect(replacement.status, JSON.stringify(replacement.body)).toBe(201);
      expect(replacement.body.data.id).not.toBe(slot.id);
      expect(replacement.body.data.durationMinutes).toBe(75);
      const listed = await v.list();
      expect(listed.status, JSON.stringify(listed.body)).toBe(200);
      expect(JSON.stringify(listed.body)).toContain(replacement.body.data.id);
      expect(JSON.stringify(listed.body)).not.toContain(slot.id);
    });
  },
);
