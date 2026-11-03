import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testBranchCapacity, testCapability } from "../helpers/owner-policy.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  note = "Synthetic actual people, equipment and shared-space review";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "atomic workshop resource lifecycle",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      owner: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["session"]>>,
      admin: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["account"]>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
      admin = await f.account(null, "ADMIN");
      await testCapability(admin.user.id, "BOOKING_CONFIRM");
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture(publish = true) {
      const branch = await prisma.branch.create({
        data: {
          code: `ALLOC-${randomUUID().slice(0, 8)}`,
          name: "Synthetic resource-allocation workshop",
          address: "Synthetic fixture address",
          city: "Test",
          state: "Test",
        },
      });
      const w1 = await f.account("MECHANICAL_TECHNICIAN", "STAFF", branch.id),
        w2 = await f.account("MECHANICAL_TECHNICIAN", "STAFF", branch.id),
        w3 = await f.account("ELECTRICAL_TECHNICIAN", "STAFF", branch.id),
        lead = await f.account("WORKSHOP_LEAD", "STAFF", branch.id);
      async function service(label: string) {
        return prisma.service.create({
          data: {
            name: `Synthetic ${label}`,
            slug: randomUUID(),
            pricingType: "FIXED",
            priceKobo: 10000n,
            durationMinutes: 60,
            preparationMinutes: 15,
            cleanupMinutes: 20,
          },
        });
      }
      const a = await service("alignment assessment"),
        b = await service("mechanical assessment"),
        c = await service("independent no-equipment consultation");
      await testBranchCapacity(branch.id, f.owner.id, 100);
      const workingPeriods = Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        opensAt: "08:00",
        closesAt: "18:00",
      }));
      const bay = randomUUID(),
        machine1 = randomUUID(),
        machine2 = randomUUID();
      const settings = {
        timezone: "Africa/Lagos",
        resources: [
          {
            id: bay,
            name: "Synthetic shared bay",
            kind: "SPACE",
            pools: ["bay"],
            status: "AVAILABLE",
            workingPeriods,
            unavailablePeriods: [],
          },
          {
            id: machine1,
            name: "Synthetic alignment machine one",
            kind: "EQUIPMENT",
            pools: ["alignment"],
            status: "AVAILABLE",
            workingPeriods,
            unavailablePeriods: [],
          },
          {
            id: machine2,
            name: "Synthetic alignment machine two",
            kind: "EQUIPMENT",
            pools: ["alignment"],
            status: "AVAILABLE",
            workingPeriods,
            unavailablePeriods: [],
          },
        ],
        technicians: [
          {
            staffId: w1.user.staffProfile!.id,
            serviceIds: [a.id],
            workingPeriods,
            unavailablePeriods: [],
          },
          {
            staffId: w2.user.staffProfile!.id,
            serviceIds: [b.id],
            workingPeriods,
            unavailablePeriods: [],
          },
          {
            staffId: w3.user.staffProfile!.id,
            serviceIds: [c.id],
            workingPeriods,
            unavailablePeriods: [],
          },
        ],
        services: [
          {
            serviceId: a.id,
            requirements: [
              { pool: "alignment", quantity: 1 },
              { pool: "bay", quantity: 1 },
            ],
          },
          { serviceId: b.id, requirements: [{ pool: "bay", quantity: 1 }] },
          { serviceId: c.id, requirements: [] },
        ],
      };
      let policyVersion = 0;
      async function approve() {
        const response = await request(app)
          .post("/api/v1/admin/policies")
          .set(owner.headers)
          .send({
            kind: "BRANCH_RESOURCES",
            branchId: branch.id,
            expectedVersion: policyVersion,
            effectiveAt: new Date().toISOString(),
            settings,
            source: "Synthetic isolated resource allocation approval",
            approvalEvidence:
              "Synthetic fixture only; not operational approval or a real workshop inventory.",
          });
        expect(response.status, JSON.stringify(response.body)).toBe(201);
        policyVersion++;
        return response.body.data;
      }
      if (publish) await approve();
      const at = new Date(Date.now() + 10 * 86400000);
      at.setUTCHours(9, 0, 0, 0);
      async function book(
        serviceId = a.id,
        staffId = w1.user.staffProfile!.id,
        scheduledAt = at,
      ) {
        const buyer = await f.account(null, "CUSTOMER");
        const booking = await prisma.booking.create({
          data: {
            customerId: buyer.user.profile!.id,
            branchId: branch.id,
            serviceId,
            assignedStaffId: staffId,
            scheduledAt,
            status: "REQUESTED",
            policySnapshot: { syntheticFinancialHistory: "preserve" },
          },
        });
        return { ...booking, buyer };
      }
      const status = (id: string, expectedVersion: number, status: string) =>
        request(app)
          .post(`/api/v1/staff/bookings/${id}/status`)
          .set(admin.headers)
          .send({ expectedVersion, status, resourceReviewNote: note });
      const allocations = (bookingId: string) =>
        prisma.bookingResourceAllocation.findMany({
          where: { bookingId },
          orderBy: { bookingVersion: "asc" },
        });
      const cancel = (
        booking: Awaited<ReturnType<typeof book>>,
        expectedVersion: number,
      ) =>
        request(app)
          .post(`/api/v1/customers/bookings/${booking.id}/cancel`)
          .set(booking.buyer.headers)
          .send({
            expectedVersion,
            reason: "Synthetic customer cancellation; preserve payment and work history",
          });
      return {
        branch,
        w1,
        w2,
        w3,
        lead,
        a,
        b,
        c,
        bay,
        machine1,
        machine2,
        settings,
        approve,
        at,
        book,
        status,
        allocations,
        cancel,
      };
    }
    it("reserves the full saved interval and immutable actual resource identities without creating a payment", async () => {
      const v = await fixture();
      // UUID case is an identity representation, not another physical unit.
      v.settings.resources.forEach((row) => {
        row.id = row.id.toUpperCase();
      });
      v.settings.services.forEach((row) => {
        row.serviceId = row.serviceId.toUpperCase();
      });
      v.settings.technicians.forEach((row) => {
        row.staffId = row.staffId.toUpperCase();
        row.serviceIds = row.serviceIds.map((id) => id.toUpperCase());
      });
      await v.approve();
      const booking = await v.book();
      const confirmed = await v.status(booking.id, 0, "CONFIRMED");
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      const [allocation] = await v.allocations(booking.id);
      expect(allocation).toMatchObject({
        bookingVersion: 1,
        scheduleVersion: 0,
        staffId: v.w1.user.staffProfile!.id,
        startsAt: new Date(v.at.getTime() - 15 * 60000),
        endsAt: new Date(v.at.getTime() + 80 * 60000),
        createdByUserId: admin.user.id,
      });
      expect(allocation!.resourceIds).toHaveLength(2);
      expect(allocation!.resourceIds).toContain(v.bay);
      expect(
        allocation!.resourceIds.some((id) => [v.machine1, v.machine2].includes(id)),
      ).toBe(true);
      await expect(
        prisma.bookingResourceAllocation.update({
          where: { id: allocation!.id },
          data: { reason: "Synthetic forbidden rewrite" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.bookingResourceAllocation.delete({ where: { id: allocation!.id } }),
      ).rejects.toThrow();
      expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .policySnapshot,
      ).toEqual(booking.policySnapshot);
      const customer = await request(app)
        .get(`/api/v1/customers/bookings/${booking.id}`)
        .set(booking.buyer.headers);
      expect(customer.status).toBe(200);
      expect(JSON.stringify(customer.body)).not.toContain(v.bay);
      expect(JSON.stringify(customer.body)).not.toContain(allocation!.id);
    });
    it("allows only one concurrent claim on a shared bay and rolls back the losing confirmation", async () => {
      const v = await fixture(),
        a = await v.book(),
        b = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      const results = await Promise.all([
        v.status(a.id, 0, "CONFIRMED"),
        v.status(b.id, 0, "CONFIRMED"),
      ]);
      expect(
        results.map((row) => row.status).sort(),
        JSON.stringify(results.map((row) => row.body)),
      ).toEqual([200, 409]);
      const rows = await prisma.booking.findMany({
        where: { id: { in: [a.id, b.id] } },
        orderBy: { status: "asc" },
      });
      expect(rows.map((row) => row.status).sort()).toEqual(["CONFIRMED", "REQUESTED"]);
      expect(
        await prisma.bookingResourceAllocation.count({
          where: { bookingId: { in: [a.id, b.id] } },
        }),
      ).toBe(1);
      const loser = rows.find((row) => row.status === "REQUESTED")!;
      expect(loser.version).toBe(0);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: loser.id } }),
      ).toBe(0);
    });
    it("allows independent work but never treats two machines as another qualified technician", async () => {
      const v = await fixture(),
        a = await v.book(),
        independent = await v.book(v.c.id, v.w3.user.staffProfile!.id);
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      expect((await v.status(independent.id, 0, "CONFIRMED")).status).toBe(200);
      const sameTechnician = await v.book();
      expect((await v.status(sameTechnician.id, 0, "CONFIRMED")).status).toBe(409);
      const wrong = await v.book(v.a.id, v.w2.user.staffProfile!.id);
      const denied = await v.status(wrong.id, 0, "CONFIRMED");
      expect(denied.status, JSON.stringify(denied.body)).toBe(409);
      expect(await v.allocations(wrong.id)).toHaveLength(0);
    });
    it("preserves explicit legacy branch work access without granting access to another branch", async () => {
      const v = await fixture(),
        legacy = await f.account(null, "STAFF", v.branch.id);
      v.settings.technicians.push({
        staffId: legacy.user.staffProfile!.id,
        serviceIds: [v.a.id],
        workingPeriods: v.settings.technicians[0]!.workingPeriods,
        unavailablePeriods: [],
      });
      await v.approve();
      const booking = await v.book(v.a.id, legacy.user.staffProfile!.id);
      expect((await v.status(booking.id, 0, "CONFIRMED")).status).toBe(200);
      await prisma.staffProfile.update({
        where: { id: legacy.user.staffProfile!.id },
        data: { branchId: f.other.id },
      });
      const next = await v.book(
        v.a.id,
        legacy.user.staffProfile!.id,
        new Date(v.at.getTime() + 86400000),
      );
      expect((await v.status(next.id, 0, "CONFIRMED")).status).toBe(409);
      expect(await v.allocations(next.id)).toHaveLength(0);
    });
    it("keeps setup and cleanup occupied while allowing exactly touching resource periods", async () => {
      const v = await fixture(),
        a = await v.book();
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      const tooEarly = await v.book(
        v.b.id,
        v.w2.user.staffProfile!.id,
        new Date(v.at.getTime() + 95 * 60000 - 1),
      );
      expect((await v.status(tooEarly.id, 0, "CONFIRMED")).status).toBe(409);
      expect((await v.cancel(tooEarly, 0)).status).toBe(200);
      const touching = await v.book(
        v.b.id,
        v.w2.user.staffProfile!.id,
        new Date(v.at.getTime() + 95 * 60000),
      );
      expect((await v.status(touching.id, 0, "CONFIRMED")).status).toBe(200);
    });
    it("releases an eligible cancelled visit atomically while retaining its allocation and money history", async () => {
      const v = await fixture(),
        a = await v.book();
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      const original = (await v.allocations(a.id))[0]!;
      expect((await v.cancel(a, 1)).status).toBe(200);
      const b = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      expect((await v.status(b.id, 0, "CONFIRMED")).status).toBe(200);
      expect(await v.allocations(a.id)).toEqual([original]);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).policySnapshot,
      ).toEqual(a.policySnapshot);
    });
    it("preserves the original appointment and reminders after a conflicting reschedule, then moves allocation atomically", async () => {
      const v = await fixture(),
        a = await v.book(),
        target = new Date(v.at.getTime() + 86400000),
        b = await v.book(v.b.id, v.w2.user.staffProfile!.id, target);
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      expect((await v.status(b.id, 0, "CONFIRMED")).status).toBe(200);
      const requested = await request(app)
        .patch(`/api/v1/customers/bookings/${a.id}/schedule`)
        .set(a.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({
          expectedVersion: 1,
          preferredAt: target.toISOString(),
          reason: "Synthetic customer requested next-day appointment",
        });
      expect(requested.status, JSON.stringify(requested.body)).toBe(200);
      const pending = await prisma.bookingRescheduleRequest.findFirstOrThrow({
        where: { bookingId: a.id, status: "PENDING" },
      });
      const competingOriginal = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      const held = await v.status(competingOriginal.id, 0, "CONFIRMED");
      expect(held.status, JSON.stringify(held.body)).toBe(409);
      expect((await v.cancel(competingOriginal, 0)).status).toBe(200);
      const history = await v.allocations(a.id);
      const reminders = await prisma.bookingReminder.findMany({
        where: { bookingId: a.id },
        orderBy: { id: "asc" },
      });
      const approve = () =>
        request(app)
          .post(`/api/v1/staff/bookings/${a.id}/reschedule-decision`)
          .set(admin.headers)
          .send({
            expectedVersion: 2,
            requestId: pending.id,
            decision: "APPROVE",
            reason: "Synthetic replacement approval after resource check",
            resourceReviewNote: note,
          });
      expect((await approve()).status).toBe(409);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).scheduledAt,
      ).toEqual(v.at);
      expect(await v.allocations(a.id)).toEqual(history);
      expect(
        await prisma.bookingReminder.findMany({
          where: { bookingId: a.id },
          orderBy: { id: "asc" },
        }),
      ).toEqual(reminders);
      expect((await v.cancel(b, 1)).status).toBe(200);
      const approved = await approve();
      expect(approved.status, JSON.stringify(approved.body)).toBe(200);
      const moved = await v.allocations(a.id);
      expect(moved).toHaveLength(2);
      expect(moved[1]).toMatchObject({ scheduleVersion: 1, scheduledAt: target });
      expect(moved[0]).toEqual(history[0]);
      const oldTime = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      expect((await v.status(oldTime.id, 0, "CONFIRMED")).status).toBe(200);
    });
    it("rejects a resource-conflicting timing extension without changing the saved estimate, then records a safe review", async () => {
      const v = await fixture(),
        a = await v.book(),
        b = await v.book(
          v.b.id,
          v.w2.user.staffProfile!.id,
          new Date(v.at.getTime() + 120 * 60000),
        );
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      expect((await v.status(b.id, 0, "CONFIRMED")).status).toBe(200);
      const override = () =>
        request(app)
          .post(`/api/v1/staff/bookings/${a.id}/timing`)
          .set(admin.headers)
          .send({
            expectedVersion: 1,
            durationMinutes: 120,
            preparationMinutes: 15,
            cleanupMinutes: 20,
            reason: "Synthetic individual extended assessment",
            resourceReviewNote: note,
          });
      expect((await override()).status).toBe(409);
      expect(await v.allocations(a.id)).toHaveLength(1);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).scheduleVersion,
      ).toBe(0);
      expect(
        await prisma.bookingTimingSnapshot.count({ where: { bookingId: a.id } }),
      ).toBe(1);
      expect((await v.cancel(b, 1)).status).toBe(200);
      const updated = await override();
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      expect(await v.allocations(a.id)).toHaveLength(2);
    });
    it("revalidates current resource policy and staff scope at legacy and managed reassignment boundaries", async () => {
      const v = await fixture(),
        a = await v.book();
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      v.settings.technicians[1]!.serviceIds.push(v.a.id);
      for (const unit of v.settings.resources)
        if (unit.pools.includes("alignment")) unit.status = "UNAVAILABLE";
      await v.approve();
      const denied = await request(app)
        .patch(`/api/v1/staff/bookings/${a.id}/assignment`)
        .set(admin.headers)
        .send({ expectedVersion: 1, assignedStaffId: v.w2.user.staffProfile!.id });
      expect(denied.status, JSON.stringify(denied.body)).toBe(409);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).assignedStaffId,
      ).toBe(v.w1.user.staffProfile!.id);
      expect(await v.allocations(a.id)).toHaveLength(1);
      for (const unit of v.settings.resources) unit.status = "AVAILABLE";
      await v.approve();
      const assigned = await request(app)
        .patch(`/api/v1/staff/workforce/jobs/${a.id}/assignment`)
        .set(v.lead.headers)
        .send({
          expectedVersion: 1,
          staffId: v.w2.user.staffProfile!.id,
          reason: "Synthetic reviewed technician replacement",
        });
      expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
      expect(await v.allocations(a.id)).toHaveLength(2);
      const otherTechnician = await f.account(
        "MECHANICAL_TECHNICIAN",
        "STAFF",
        v.branch.id,
      );
      v.settings.technicians.push({
        staffId: otherTechnician.user.staffProfile!.id,
        serviceIds: [v.b.id],
        workingPeriods: v.settings.technicians[0]!.workingPeriods,
        unavailablePeriods: [],
      });
      v.settings.services[0]!.requirements = [{ pool: "alignment", quantity: 1 }];
      await v.approve();
      const stillHeld = await v.book(v.b.id, otherTechnician.user.staffProfile!.id);
      const beforeReview = await v.status(stillHeld.id, 0, "CONFIRMED");
      expect(beforeReview.status, JSON.stringify(beforeReview.body)).toBe(409);
      expect((await v.cancel(stillHeld, 0)).status).toBe(200);
      const reviewed = await request(app)
        .patch(`/api/v1/staff/workforce/jobs/${a.id}/assignment`)
        .set(v.lead.headers)
        .send({
          expectedVersion: 2,
          staffId: v.w1.user.staffProfile!.id,
          reason:
            "Synthetic explicit review of current service resources and technician return",
        });
      expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);
      const history = await v.allocations(a.id);
      expect(history).toHaveLength(3);
      expect(history[2]!.resourceIds).not.toContain(v.bay);
      expect(history[2]!.staffId).toBe(history[0]!.staffId);
      expect(history[2]!.id).not.toBe(history[0]!.id);
      const released = await v.book(v.b.id, otherTechnician.user.staffProfile!.id);
      expect((await v.status(released.id, 0, "CONFIRMED")).status).toBe(200);
    });
    it("requires approved resources before confirmation and cannot infer approval from a daily limit", async () => {
      const v = await fixture(false),
        a = await v.book();
      const denied = await v.status(a.id, 0, "CONFIRMED");
      expect(denied.status, JSON.stringify(denied.body)).toBe(409);
      expect(JSON.stringify(denied.body)).toContain("resources are not configured");
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: a.id } })).status,
      ).toBe("REQUESTED");
      expect(await v.allocations(a.id)).toHaveLength(0);
      await v.approve();
      await prisma.branch.update({
        where: { id: v.branch.id },
        data: { isActive: false },
      });
      const closed = await v.status(a.id, 0, "CONFIRMED");
      expect(closed.status, JSON.stringify(closed.body)).toBe(409);
      expect(await v.allocations(a.id)).toHaveLength(0);
    });
    it("retains actual cleanup after completion and allows capacity once that cleanup period ends", async () => {
      const v = await fixture(),
        a = await v.book();
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      await prisma.booking.update({
        where: { id: a.id },
        data: {
          status: "COMPLETED",
          startedAt: v.at,
          completedAt: new Date(v.at.getTime() + 30 * 60000),
          version: { increment: 1 },
        },
      });
      const early = await v.book(
        v.b.id,
        v.w2.user.staffProfile!.id,
        new Date(v.at.getTime() + 64 * 60000),
      );
      expect((await v.status(early.id, 0, "CONFIRMED")).status).toBe(409);
      expect((await v.cancel(early, 0)).status).toBe(200);
      const after = await v.book(
        v.b.id,
        v.w2.user.staffProfile!.id,
        new Date(v.at.getTime() + 65 * 60000),
      );
      expect((await v.status(after.id, 0, "CONFIRMED")).status).toBe(200);
      expect(await v.allocations(a.id)).toHaveLength(1);
    });
    it("uses an actual late start when protecting a technician even without required equipment", async () => {
      const v = await fixture(),
        a = await v.book(v.c.id, v.w3.user.staffProfile!.id);
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      // Prepared synthetic late-running state; no claim of a real physical arrival.
      await prisma.booking.update({
        where: { id: a.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(v.at.getTime() + 20 * 60000),
          version: { increment: 1 },
        },
      });
      const next = await v.book(
        v.c.id,
        v.w3.user.staffProfile!.id,
        new Date(v.at.getTime() + 95 * 60000),
      );
      expect((await v.status(next.id, 0, "CONFIRMED")).status).toBe(409);
      expect(await v.allocations(next.id)).toHaveLength(0);
    });
    it("keeps overdue work occupied until recorded completion rather than inferring release from an estimate", async () => {
      const v = await fixture(),
        past = new Date();
      past.setUTCDate(past.getUTCDate() - 1);
      past.setUTCHours(9, 0, 0, 0);
      const a = await v.book(v.a.id, v.w1.user.staffProfile!.id, past);
      expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
      await prisma.booking.update({
        where: { id: a.id },
        data: { status: "IN_PROGRESS", startedAt: past, version: { increment: 1 } },
      });
      const b = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      expect((await v.status(b.id, 0, "CONFIRMED")).status).toBe(409);
      expect((await v.cancel(b, 0)).status).toBe(200);
      await prisma.booking.update({
        where: { id: a.id },
        data: { status: "COMPLETED", completedAt: new Date(), version: { increment: 1 } },
      });
      const after = await v.book(v.b.id, v.w2.user.staffProfile!.id);
      expect((await v.status(after.id, 0, "CONFIRMED")).status).toBe(200);
      expect(await v.allocations(a.id)).toHaveLength(1);
    });
    it("rechecks work start and preserves cleanup through the real status API under a declared synthetic clock", async () => {
      const previousOwner = owner,
        previousAdmin = admin;
      const morning = new Date();
      morning.setUTCDate(morning.getUTCDate() - 1);
      morning.setUTCHours(9, 0, 0, 0);
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(morning);
      try {
        owner = await f.session(f.owner.id, "SUPER_ADMIN");
        admin = await f.account(null, "ADMIN");
        await testCapability(admin.user.id, "BOOKING_CONFIRM");
        const v = await fixture(),
          a = await v.book(v.a.id, v.w1.user.staffProfile!.id, morning);
        expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
        const started = await v.status(a.id, 1, "IN_PROGRESS");
        expect(started.status, JSON.stringify(started.body)).toBe(200);
        expect(await v.allocations(a.id)).toHaveLength(2);
        vi.setSystemTime(new Date(morning.getTime() + 30 * 60000));
        // The clock advance correctly expires the idle fixture session. Sign in
        // with a fresh synthetic session rather than relaxing authentication.
        admin = { ...admin, ...(await f.session(admin.user.id, "ADMIN")) };
        expect((await v.status(a.id, 2, "COMPLETED")).status).toBe(200);
        const next = await v.book(
          v.b.id,
          v.w2.user.staffProfile!.id,
          new Date(morning.getTime() + 65 * 60000),
        );
        expect((await v.status(next.id, 0, "CONFIRMED")).status).toBe(200);
        vi.setSystemTime(new Date(morning.getTime() + 50 * 60000));
        admin = { ...admin, ...(await f.session(admin.user.id, "ADMIN")) };
        const legacyOrder = await prisma.workOrder.create({
          data: {
            bookingId: next.id,
            workOrderNumber: `ALLOC-${randomUUID()}`.slice(0, 40),
            status: "APPROVED",
            openedAt: new Date(),
          },
        });
        const legacyStart = await request(app)
          .post(`/api/v1/staff/bookings/${next.id}/work-orders/${legacyOrder.id}/status`)
          .set(admin.headers)
          .send({ expectedVersion: 0, status: "IN_PROGRESS" });
        expect(legacyStart.status, JSON.stringify(legacyStart.body)).toBe(200);
        expect(await v.allocations(next.id)).toHaveLength(2);
        const technical = await v.book(v.c.id, v.w3.user.staffProfile!.id, new Date());
        expect((await v.status(technical.id, 0, "CONFIRMED")).status).toBe(200);
        await prisma.workOrder.create({
          data: {
            bookingId: technical.id,
            workOrderNumber: `ALLOC-${randomUUID()}`.slice(0, 40),
            status: "APPROVED",
            openedAt: new Date(),
          },
        });
        const technicalSession = await f.session(v.w3.user.id, "STAFF");
        const managedStart = await request(app)
          .patch(`/api/v1/staff/workforce/jobs/${technical.id}/work`)
          .set(technicalSession.headers)
          .send({
            expectedVersion: 0,
            status: "IN_PROGRESS",
            diagnosis: "Synthetic actual technical start",
          });
        expect(managedStart.status, JSON.stringify(managedStart.body)).toBe(200);
        expect(await v.allocations(technical.id)).toHaveLength(2);
      } finally {
        vi.useRealTimers();
        owner = previousOwner;
        admin = previousAdmin;
      }
    });
    for (const status of ["IN_PROGRESS", "CONFIRMED"] as const)
      it(`prevents customer cancellation after recorded work start, including legacy ${status} state`, async () => {
        const v = await fixture(),
          a = await v.book(v.a.id, v.w1.user.staffProfile!.id);
        expect((await v.status(a.id, 0, "CONFIRMED")).status).toBe(200);
        // Explicitly prepared synthetic legacy state; this is not evidence of physical work.
        await prisma.booking.update({
          where: { id: a.id },
          data: { status, startedAt: new Date(), version: { increment: 1 } },
        });
        const before = await v.allocations(a.id);
        expect((await v.cancel(a, 2)).status).toBe(409);
        const after = await prisma.booking.findUniqueOrThrow({ where: { id: a.id } });
        expect(after.status).toBe(status);
        expect(after.version).toBe(2);
        expect(after.cancelledAt).toBeNull();
        expect(await v.allocations(a.id)).toEqual(before);
      });
  },
);
