import { workshopResourceSettingsSchema } from "../../src/modules/service-operations/workshop-resources.js";
import { ServiceOperationsRepository } from "../../src/modules/service-operations/service-operations.repository.js";
import { bookingAlternativeOptions } from "../../src/modules/service-operations/booking-alternatives.js";
import { captureBookingTiming } from "../../src/modules/service-operations/booking-timing.js";
import { allocateBookingResources } from "../../src/modules/service-operations/booking-resources.js";
import { effectiveAttendance } from "../../src/modules/service-operations/booking-attendance.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi, afterEach } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import { ServiceOperationsService } from "../../src/modules/service-operations/service-operations.service.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { reviewSourceCustomer, reviewSourceFixtures } from "../helpers/review-sources.js";
import { testOwner } from "../helpers/owner.js";
import {
  testCapability,
  testBranchCapacity,
  testBranchResources,
} from "../helpers/owner-policy.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
const operations = new ServiceOperationsService();
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function customer() {
  const value = await reviewSourceCustomer();
  const session = await prisma.session.findFirstOrThrow({
    where: { userId: value.user.id },
  });
  return {
    ...value,
    actor: {
      userId: value.user.id,
      email: value.user.email,
      role: "CUSTOMER",
      sessionId: session.id,
      mfaRequired: false,
      mfaVerifiedAt: null,
    } as AuthenticatedActor,
  };
}
async function fixture() {
  const buyer = await customer(),
    sources = await reviewSourceFixtures(buyer.customerId);
  await prisma.service.update({
    where: { id: sources.service.id },
    data: { durationMinutes: 60 },
  });
  const owner = await testOwner("unusable-fixture-only");
  await testCapability(owner.id, "BOOKING_CONFIRM");
  const ownerSession = await paymentTestSession(owner.id, owner.role);
  const actor: AuthenticatedActor = {
    userId: owner.id,
    email: owner.email,
    role: owner.role,
    sessionId: ownerSession,
    mfaRequired: true,
    mfaVerifiedAt: new Date(),
  };
  const branchId = sources.listing.branchId;
  const capacity = await testBranchCapacity(branchId, owner.id);
  const staff = await prisma.staffProfile.create({
    data: {
      firstName: "Synthetic",
      lastName: "Technician",
      branch: { connect: { id: branchId } },
      user: {
        create: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-only",
          role: "STAFF",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      },
    },
  });
  await testBranchResources(branchId, owner.id, [sources.service.id], [staff.id]);
  const startsAt = new Date(Date.now() + 9 * 86400000);
  startsAt.setUTCHours(8, 0, 0, 0);
  const nextAt = new Date(startsAt.getTime() + 86400000);
  const slot = async (time: Date) =>
    prisma.bookingSlot.create({
      data: {
        branchId,
        serviceId: sources.service.id,
        staffId: staff.id,
        durationMinutes: 60,
        preparationMinutes: 0,
        cleanupMinutes: 0,
        serviceTimingVersion: 0,
        startsAt: time,
        endsAt: new Date(time.getTime() + 3600000),
        status: "OPEN",
      },
    });
  const oldSlot = await slot(startsAt),
    nextSlot = await slot(nextAt);
  const createBooking = (
    customerId = buyer.customerId,
    time = startsAt,
    slotId: string | null = oldSlot.id,
  ) =>
    prisma.booking.create({
      data: {
        customerId,
        branchId,
        serviceId: sources.service.id,
        assignedStaffId: staff.id,
        bookingSlotId: slotId,
        scheduledAt: time,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        resourceReviewNote: "Synthetic mechanic and bay checked",
        capacityPolicyVersionId: capacity.id,
        policySnapshot: { historySentinel: "preserve" },
      },
    });
  const booking = await createBooking();
  const reminder = await prisma.bookingReminder.create({
    data: {
      bookingId: booking.id,
      kind: "ONE_HOUR",
      scheduledFor: new Date(startsAt.getTime() - 3600000),
      scheduleVersion: 0,
    },
  });
  const body = {
    slotId: nextSlot.id,
    expectedVersion: 0,
    reason: "Customer needs the following day",
  };
  const submit = () =>
    operations.rescheduleBooking(buyer.actor, booking.id, body, randomUUID(), context());
  const pending = () =>
    prisma.bookingRescheduleRequest.findFirstOrThrow({
      where: { bookingId: booking.id, status: "PENDING" },
    });
  const approve = async () =>
    operations.decideBookingReschedule(
      actor,
      booking.id,
      {
        requestId: (await pending()).id,
        expectedVersion: (
          await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
        ).version,
        decision: "APPROVE",
        reason: "Replacement reviewed with the customer",
        resourceReviewNote: "Synthetic assigned technician and bay capacity checked",
      },
      context(),
    );
  return {
    buyer,
    sources,
    actor,
    staff,
    branchId,
    booking,
    oldSlot,
    nextSlot,
    startsAt,
    nextAt,
    body,
    reminder,
    createBooking,
    submit,
    pending,
    approve,
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "atomic reschedule approval",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());
    it("keeps the original time, staff, slot, count and reminders until approval, with keyed replay", async () => {
      const f = await fixture(),
        key = randomUUID();
      await operations.rescheduleBooking(
        f.buyer.actor,
        f.booking.id,
        f.body,
        key,
        context(),
      );
      await operations.rescheduleBooking(
        f.buyer.actor,
        f.booking.id,
        f.body,
        key,
        context(),
      );
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({
        scheduledAt: f.startsAt,
        status: "CONFIRMED",
        bookingSlotId: f.oldSlot.id,
        assignedStaffId: f.staff.id,
        customerRescheduleCount: 0,
        scheduleVersion: 0,
        policySnapshot: { historySentinel: "preserve" },
      });
      expect(
        await prisma.bookingRescheduleRequest.count({
          where: { bookingId: f.booking.id },
        }),
      ).toBe(1);
      expect(
        await prisma.bookingReminder.findUnique({ where: { id: f.reminder.id } }),
      ).toMatchObject({ status: "PENDING", scheduleVersion: 0 });
      expect(
        await prisma.booking.count({ where: { bookingSlotId: f.nextSlot.id } }),
      ).toBe(0);
      await expect(f.submit()).rejects.toThrow(/already awaiting review/);
    });
    it("atomically confirms the replacement, releases the old slot and changes reminders once", async () => {
      const f = await fixture();
      await f.submit();
      const pending = await f.pending();
      await f.approve();
      const saved = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      expect(saved).toMatchObject({
        status: "CONFIRMED",
        scheduledAt: f.nextAt,
        bookingSlotId: f.nextSlot.id,
        version: 3,
        scheduleVersion: 1,
        customerRescheduleCount: 1,
        policySnapshot: { historySentinel: "preserve" },
      });
      expect(await prisma.booking.count({ where: { bookingSlotId: f.oldSlot.id } })).toBe(
        0,
      );
      expect(
        await prisma.bookingReminder.findUnique({ where: { id: f.reminder.id } }),
      ).toMatchObject({ status: "CANCELLED" });
      expect(
        await prisma.bookingReminder.count({
          where: { bookingId: f.booking.id, scheduleVersion: 1, status: "PENDING" },
        }),
      ).toBe(1);
      expect(
        await prisma.bookingRescheduleRequest.findUnique({ where: { id: pending.id } }),
      ).toMatchObject({ status: "APPROVED", decidedByUserId: f.actor.userId });
      await expect(
        operations.decideBookingReschedule(
          f.actor,
          f.booking.id,
          {
            requestId: pending.id,
            expectedVersion: saved.version,
            decision: "APPROVE",
            reason: "Duplicate attempt",
            resourceReviewNote: "Synthetic resource review repeated",
          },
          context(),
        ),
      ).rejects.toThrow();
    });
    it("preserves both original appointments when competing approvals lose replacement capacity", async () => {
      const f = await fixture(),
        other = await customer();
      const second = await f.createBooking(
        other.customerId,
        new Date(f.startsAt.getTime() + 2 * 86400000),
        null,
      );
      await f.submit();
      await operations.rescheduleBooking(
        other.actor,
        second.id,
        {
          preferredAt: f.nextAt.toISOString(),
          expectedVersion: 0,
          reason: "Second synthetic requested time",
        },
        randomUUID(),
        context(),
      );
      const secondRequest = await prisma.bookingRescheduleRequest.findFirstOrThrow({
        where: { bookingId: second.id, status: "PENDING" },
      });
      const results = await Promise.allSettled([
        f.approve(),
        operations.decideBookingReschedule(
          f.actor,
          second.id,
          {
            requestId: secondRequest.id,
            expectedVersion: 1,
            decision: "APPROVE",
            reason: "Second synthetic approval",
            resourceReviewNote: "Synthetic mechanic and bay review",
          },
          context(),
        ),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      for (const [i, original] of [f.booking, second].entries()) {
        const saved = await prisma.booking.findUniqueOrThrow({
          where: { id: original.id },
        });
        if (results[i]!.status === "rejected") {
          expect(saved.scheduledAt).toEqual(original.scheduledAt);
          expect(saved.status).toBe("CONFIRMED");
          expect(
            await prisma.bookingRescheduleRequest.count({
              where: { bookingId: original.id, status: "PENDING" },
            }),
          ).toBe(1);
        }
      }
    });
    it("withdraws or declines only the request and preserves the appointment and reminders", async () => {
      for (const action of ["WITHDRAW", "DECLINE"] as const) {
        const f = await fixture();
        await f.submit();
        const pending = await f.pending();
        if (action === "WITHDRAW")
          await operations.withdrawBookingReschedule(
            f.buyer.actor,
            f.booking.id,
            {
              requestId: pending.id,
              expectedVersion: 1,
              reason: "Original time now suits customer",
            },
            context(),
          );
        else
          await operations.decideBookingReschedule(
            f.actor,
            f.booking.id,
            {
              requestId: pending.id,
              expectedVersion: 1,
              decision: "DECLINE",
              reason: "Replacement cannot be offered",
            },
            context(),
          );
        expect(
          await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
        ).toMatchObject({
          status: "CONFIRMED",
          scheduledAt: f.startsAt,
          bookingSlotId: f.oldSlot.id,
          scheduleVersion: 0,
          customerRescheduleCount: 0,
        });
        expect(
          await prisma.bookingReminder.findUnique({ where: { id: f.reminder.id } }),
        ).toMatchObject({ status: "PENDING" });
      }
    });
    it("requires reason and ownership over HTTP without changing a booking", async () => {
      const f = await fixture(),
        originalMode = env.PUBLIC_LAUNCH_MODE;
      env.PUBLIC_LAUNCH_MODE = "full";
      try {
        const app = createApp({ checkReadiness: async () => undefined });
        const send = (cookie: string, csrf: string, body: object) =>
          request(app)
            .patch(`/api/v1/customers/bookings/${f.booking.id}/schedule`)
            .set("Origin", "http://localhost:3000")
            .set("Cookie", cookie)
            .set("X-CSRF-Token", csrf)
            .set("Idempotency-Key", randomUUID())
            .send(body);
        expect(
          (
            await send(f.buyer.cookie, f.buyer.csrf, {
              slotId: f.nextSlot.id,
              expectedVersion: 0,
            })
          ).status,
        ).toBe(422);
        const other = await customer();
        expect((await send(other.cookie, other.csrf, f.body)).status).toBe(404);
        expect(
          await prisma.bookingRescheduleRequest.count({
            where: { bookingId: f.booking.id },
          }),
        ).toBe(0);
        expect((await send(f.buyer.cookie, f.buyer.csrf, f.body)).status).toBe(200);
        expect(
          await prisma.booking.findUnique({ where: { id: f.booking.id } }),
        ).toMatchObject({ scheduledAt: f.startsAt, status: "CONFIRMED" });
      } finally {
        env.PUBLIC_LAUNCH_MODE = originalMode;
      }
    });
    it("rejects stale original schedules and revoked reviewer sessions without moving the appointment", async () => {
      const f = await fixture();
      await f.submit();
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { scheduleVersion: { increment: 1 } },
      });
      await expect(f.approve()).rejects.toThrow(/original appointment changed/);
      const g = await fixture();
      await g.submit();
      await prisma.session.update({
        where: { id: g.actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(g.approve()).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await prisma.booking.findUnique({ where: { id: g.booking.id } }),
      ).toMatchObject({ scheduledAt: g.startsAt, status: "CONFIRMED" });
    });
    it("retains immutable request details and terminal decisions and supersedes changes on cancellation", async () => {
      const f = await fixture();
      await f.submit();
      const pending = await f.pending();
      await expect(
        prisma.bookingRescheduleRequest.update({
          where: { id: pending.id },
          data: { reason: "Rewritten request" },
        }),
      ).rejects.toThrow(/immutable/);
      await operations.cancelBooking(
        f.buyer.actor,
        f.booking.id,
        { expectedVersion: 1, reason: "Customer cannot attend" },
        context(),
      );
      expect(
        await prisma.bookingRescheduleRequest.findUnique({ where: { id: pending.id } }),
      ).toMatchObject({ status: "SUPERSEDED" });
      await expect(
        prisma.bookingRescheduleRequest.delete({ where: { id: pending.id } }),
      ).rejects.toThrow(/cannot be deleted/);
      await expect(
        prisma.bookingRescheduleRequest.update({
          where: { id: pending.id },
          data: { status: "PENDING" },
        }),
      ).rejects.toThrow();
    });
  },
);

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "available late-visit alternatives",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterEach(() => vi.useRealTimers());
    async function lateVisit(kind: "ARRIVED" | "LEFT" = "ARRIVED") {
      const today = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${today}T12:00:00Z`));
      const f = await fixture();
      const original = new Date(Date.now() - 20 * 60000),
        replacement = new Date(Date.now() + 120 * 60000);
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { scheduledAt: original, bookingSlotId: null },
      });
      await prisma.$transaction(async (tx) => {
        const b = await tx.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
        await captureBookingTiming(tx, b, f.actor.userId);
        await allocateBookingResources(
          tx,
          f.actor,
          b.id,
          "Synthetic technician and physical resources checked",
        );
      });
      await operations.recordBookingAttendance(
        f.actor,
        f.booking.id,
        { operationId: randomUUID(), expectedVersion: 0, kind: "ARRIVED" },
        context(),
      );
      if (kind === "LEFT")
        await operations.recordBookingAttendance(
          f.actor,
          f.booking.id,
          {
            operationId: randomUUID(),
            expectedVersion: 1,
            kind: "LEFT",
            reason: "Customer left after discussing alternatives",
          },
          context(),
        );
      return { ...f, original, replacement };
    }
    async function proposeAccept(f: Awaited<ReturnType<typeof lateVisit>>) {
      const b = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      await operations.proposeBookingAlternative(
        f.actor,
        b.id,
        {
          preferredAt: f.replacement.toISOString(),
          expectedVersion: b.version,
          reason: "Customer arrived late; reviewed the next available turn",
        },
        context(),
      );
      const proposed = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      await operations.respondToBookingAlternative(
        f.buyer.actor,
        b.id,
        { decision: "ACCEPT", expectedVersion: proposed.version },
        context(),
      );
    }
    it("lists actual available day times and excludes occupied technician time", async () => {
      const f = await fixture();
      const read = async () =>
        prisma.$transaction(async (tx) => {
          const b = await new ServiceOperationsRepository().lockBooking(f.booking.id, tx);
          return bookingAlternativeOptions(tx, b!, f.nextAt.toISOString().slice(0, 10));
        });
      const available = await read();
      expect(
        available.items.some((i) => Date.parse(i.startsAt) === f.nextAt.getTime()),
      ).toBe(true);
      await f.createBooking((await customer()).customerId, f.nextAt, null);
      expect(
        (await read()).items.some((i) => Date.parse(i.startsAt) === f.nextAt.getTime()),
      ).toBe(false);
    });
    it("offers another qualified technician without bypassing approval assignment checks", async () => {
      const f = await fixture();
      const second = await prisma.staffProfile.create({
        data: {
          firstName: "Synthetic",
          lastName: "Second technician",
          branch: { connect: { id: f.branchId } },
          user: {
            create: {
              email: `${randomUUID()}@example.test`,
              passwordHash: "unusable-fixture",
              role: "STAFF",
              status: "ACTIVE",
              emailVerifiedAt: new Date(),
            },
          },
        },
      });
      await testBranchResources(
        f.branchId,
        f.actor.userId,
        [f.sources.service.id],
        [f.staff.id, second.id],
      );
      await f.createBooking((await customer()).customerId, f.nextAt, null);
      const options = (await operations.bookingAlternativeOptions(
        f.actor,
        f.booking.id,
        f.nextAt.toISOString().slice(0, 10),
      )) as { items: Array<{ startsAt: string }> };
      expect(
        options.items.some((i) => Date.parse(i.startsAt) === f.nextAt.getTime()),
      ).toBe(true);
      await operations.proposeBookingAlternative(
        f.actor,
        f.booking.id,
        {
          preferredAt: f.nextAt.toISOString(),
          expectedVersion: 0,
          reason: "An alternative qualified technician has capacity",
        },
        context(),
      );
      await operations.respondToBookingAlternative(
        f.buyer.actor,
        f.booking.id,
        { decision: "ACCEPT", expectedVersion: 1 },
        context(),
      );
      await expect(f.approve()).rejects.toThrow();
      const b = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      await operations.decideBookingReschedule(
        f.actor,
        b.id,
        {
          requestId: (await f.pending()).id,
          expectedVersion: b.version,
          decision: "APPROVE",
          assignedStaffId: second.id,
          reason: "Approved with the qualified replacement technician",
          resourceReviewNote: "Qualified technician and actual workshop capacity checked",
        },
        context(),
      );
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: b.id } }),
      ).toMatchObject({
        assignedStaffId: second.id,
        scheduledAt: f.nextAt,
        customerRescheduleCount: 0,
      });
    });
    it("hides unavailable required equipment and rejects a typed bypass without changing the booking", async () => {
      const f = await fixture();
      const prior = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: `booking-resources:${f.branchId}` },
        orderBy: { version: "desc" },
      });
      const settings = workshopResourceSettingsSchema.parse(prior.settings);
      settings.resources = [
        {
          id: randomUUID(),
          name: "Synthetic unavailable lift",
          kind: "EQUIPMENT",
          pools: ["lift"],
          status: "UNAVAILABLE",
          workingPeriods: settings.technicians[0].workingPeriods,
          unavailablePeriods: [],
        },
      ];
      settings.services[0].requirements = [{ pool: "lift", quantity: 1 }];
      await prisma.businessPolicyVersion.create({
        data: {
          key: prior.key,
          version: prior.version + 1,
          approvalStatus: "APPROVED",
          source: "Synthetic physical equipment exception",
          sourceQuestion: "D11 fixture",
          approvedByUserId: f.actor.userId,
          effectiveAt: new Date(Date.now() - 500),
          settings,
        },
      });
      const options = (await operations.bookingAlternativeOptions(
        f.actor,
        f.booking.id,
        f.nextAt.toISOString().slice(0, 10),
      )) as { items: unknown[] };
      expect(options.items).toEqual([]);
      await expect(
        operations.proposeBookingAlternative(
          f.actor,
          f.booking.id,
          {
            preferredAt: f.nextAt.toISOString(),
            expectedVersion: 0,
            reason: "Synthetic typed bypass of unavailable equipment",
          },
          context(),
        ),
      ).rejects.toThrow();
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({ version: 0, scheduledAt: f.startsAt, alternativeStartsAt: null });
    });
    it("does not expose protected availability to a customer actor", async () => {
      const f = await fixture();
      await expect(
        operations.bookingAlternativeOptions(
          f.buyer.actor,
          f.booking.id,
          f.nextAt.toISOString().slice(0, 10),
        ),
      ).rejects.toThrow();
    });
    it("rechecks a stale suggestion and preserves the original on conflict", async () => {
      const f = await lateVisit();
      await proposeAccept(f);
      const before = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      await f.createBooking((await customer()).customerId, f.replacement, null);
      await expect(f.approve()).rejects.toThrow();
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({
        scheduledAt: f.original,
        version: before.version,
        scheduleVersion: 0,
        status: "CONFIRMED",
      });
      expect((await f.pending()).status).toBe("PENDING");
    });
    it("retains actual arrival through same-day approval, supports leaving and refuses absence", async () => {
      const f = await lateVisit();
      await proposeAccept(f);
      await f.approve();
      const b = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      expect(b).toMatchObject({
        scheduledAt: f.replacement,
        scheduleVersion: 1,
        customerRescheduleCount: 0,
        status: "CONFIRMED",
      });
      expect(
        await prisma.bookingVisitContinuation.count({ where: { bookingId: b.id } }),
      ).toBe(1);
      expect((await prisma.$transaction((tx) => effectiveAttendance(tx, b)))?.kind).toBe(
        "ARRIVED",
      );
      await expect(
        operations.recordBookingAttendance(
          f.actor,
          b.id,
          {
            operationId: randomUUID(),
            expectedVersion: b.version,
            kind: "ABSENCE_CONFIRMED",
            reason: "Synthetic attempted invalid absence",
          },
          context(),
        ),
      ).rejects.toThrow();
      await operations.recordBookingAttendance(
        f.actor,
        b.id,
        {
          operationId: randomUUID(),
          expectedVersion: b.version,
          kind: "LEFT",
          reason: "Customer left the workshop after agreeing the new time",
        },
        context(),
      );
      expect(
        await prisma.bookingAttendanceEvent.count({
          where: { bookingId: b.id, kind: "ARRIVED" },
        }),
      ).toBe(1);
      await expect(
        prisma.bookingVisitContinuation.updateMany({
          where: { bookingId: b.id },
          data: { previousScheduleVersion: 10 },
        }),
      ).rejects.toThrow();
    });
    it("does not carry a departed customer into a later appointment", async () => {
      const f = await lateVisit("LEFT");
      await proposeAccept(f);
      await f.approve();
      const b = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      expect(
        await prisma.bookingVisitContinuation.count({ where: { bookingId: b.id } }),
      ).toBe(0);
      expect(await prisma.$transaction((tx) => effectiveAttendance(tx, b))).toBeNull();
    });
    it("does not open ordinary short-notice requests without an observed late visit", async () => {
      const f = await fixture();
      await expect(
        operations.proposeBookingAlternative(
          f.actor,
          f.booking.id,
          {
            preferredAt: new Date(Date.now() + 86400000).toISOString(),
            expectedVersion: 0,
            reason: "Synthetic short-notice request without arrival",
          },
          context(),
        ),
      ).rejects.toThrow();
    });
  },
);
