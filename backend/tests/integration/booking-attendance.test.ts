import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { assertBookingCapacity } from "../../src/modules/service-operations/booking-capacity.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testCapability, testBranchCapacity } from "../helpers/owner-policy.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "verified physical attendance",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      admin: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["account"]>>,
      legacy: typeof admin,
      foreign: typeof admin,
      lead: typeof admin;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      admin = await f.account(null, "ADMIN");
      legacy = await f.account(null, "STAFF");
      foreign = await f.account(null, "STAFF", f.other.id);
      lead = await f.account("CUSTOMER_SERVICE");
    }, 60000);
    afterAll(() => prisma.$disconnect());
    async function booking(minutesAgo = 20, extra: Record<string, unknown> = {}) {
      return prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          serviceId: f.job1.serviceId,
          assignedStaffId: legacy.user.staffProfile!.id,
          scheduledAt: new Date(Date.now() - minutesAgo * 60000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
          ...extra,
        },
      });
    }
    function payload(kind: string, expectedVersion = 0, operationId = randomUUID()) {
      return {
        kind,
        operationId,
        expectedVersion,
        ...(kind === "ARRIVED"
          ? {}
          : { reason: "Synthetic staff checked the physical visit" }),
      };
    }
    function post(id: string, body: unknown, headers = admin.headers, managed = false) {
      return request(app)
        .post(`/api/v1/staff/${managed ? "workforce/" : ""}bookings/${id}/attendance`)
        .set(headers)
        .send(body);
    }
    it("treats customer RSVP as unverified arrival and exposes delegated provenance", async () => {
      const b = await booking(20, { attendanceConfirmedAt: new Date() });
      const r = await request(app)
        .get(`/api/v1/staff/bookings/${b.id}/attendance`)
        .set(admin.headers)
        .expect(200);
      expect(r.body.data.current).toBeNull();
      expect(r.body.data.checkAttendance).toBe(true);
      expect(r.body.data.policy).toMatchObject({
        graceMinutes: 15,
        source: "DELEGATED_DEFAULT",
        policyVersionId: null,
      });
    });
    it("blocks the legacy raw missed-status bypass", async () => {
      const b = await booking();
      await request(app)
        .post(`/api/v1/staff/bookings/${b.id}/status`)
        .set(admin.headers)
        .send({ status: "NO_SHOW", expectedVersion: 0, reason: "Synthetic absence" })
        .expect(409);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
      ).toBe("CONFIRMED");
    });
    it("rejects early absence with no partial update", async () => {
      const b = await booking(14);
      await post(b.id, payload("ABSENCE_CONFIRMED")).expect(409);
      expect(
        await prisma.bookingAttendanceEvent.count({ where: { bookingId: b.id } }),
      ).toBe(0);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).version,
      ).toBe(0);
    });
    it("requires a reason for absence, waiting and leaving", async () => {
      const b = await booking();
      for (const kind of ["ABSENCE_CONFIRMED", "WAITING", "LEFT"])
        await post(b.id, { operationId: randomUUID(), kind, expectedVersion: 0 }).expect(
          422,
        );
    });
    it("requires physical arrival before waiting or leaving", async () => {
      const b = await booking();
      for (const kind of ["WAITING", "LEFT"]) await post(b.id, payload(kind)).expect(409);
    });
    it("records arrival, waiting, leaving and a return without moving the appointment", async () => {
      const b = await booking();
      for (const [v, kind] of ["ARRIVED", "WAITING", "LEFT", "ARRIVED"].entries())
        await post(b.id, payload(kind, v)).expect(200);
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.scheduledAt).toEqual(b.scheduledAt);
      expect(row.status).toBe("CONFIRMED");
      expect(
        await prisma.bookingAttendanceEvent.count({ where: { bookingId: b.id } }),
      ).toBe(4);
      await post(b.id, payload("ABSENCE_CONFIRMED", 4)).expect(409);
    });
    it("replays the same operation without another version, event or notification", async () => {
      const b = await booking(),
        body = payload("ARRIVED");
      const one = await post(b.id, body).expect(200);
      const two = await post(b.id, body).expect(200);
      expect(two.body.data.event.id).toBe(one.body.data.event.id);
      expect(two.body.data.event).not.toHaveProperty("operationDigest");
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).version,
      ).toBe(1);
      expect(
        await prisma.bookingAttendanceEvent.count({ where: { bookingId: b.id } }),
      ).toBe(1);
    });
    it("does not reuse an operation reference for a different action", async () => {
      const b = await booking(),
        body = payload("ARRIVED");
      await post(b.id, body).expect(200);
      await post(b.id, {
        ...body,
        kind: "WAITING",
        reason: "Synthetic changed payload",
      }).expect(409);
    });
    it("serializes concurrent arrival and absence checks", async () => {
      const b = await booking();
      const r = await Promise.all([
        post(b.id, payload("ARRIVED")),
        post(b.id, payload("ABSENCE_CONFIRMED")),
      ]);
      expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.bookingAttendanceEvent.count({ where: { bookingId: b.id } }),
      ).toBe(1);
    });
    it("rejects a stale action after arrival", async () => {
      const b = await booking();
      await post(b.id, payload("ARRIVED")).expect(200);
      await post(b.id, payload("WAITING", 0)).expect(409);
    });
    it("marks only a staff-verified absence missed and records grace without financial effects", async () => {
      const b = await booking(),
        body = payload("ABSENCE_CONFIRMED");
      const r = await post(b.id, body).expect(200);
      expect(r.body.data.event).toMatchObject({
        kind: "ABSENCE_CONFIRMED",
        graceMinutes: 15,
        graceSource: "DELEGATED_DEFAULT",
        scheduleVersion: 0,
        bookingVersion: 1,
      });
      const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.status).toBe("NO_SHOW");
      expect(row.depositForfeitedAt).toBeNull();
      await post(b.id, body).expect(200);
      expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(0);
    });
    it("prevents direct database status updates without a matching absence event", async () => {
      const b = await booking();
      await expect(
        prisma.booking.update({
          where: { id: b.id },
          data: { status: "NO_SHOW", version: { increment: 1 } },
        }),
      ).rejects.toThrow();
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
      ).toBe("CONFIRMED");
    });
    it("keeps attendance history append-only", async () => {
      const b = await booking(),
        r = await post(b.id, payload("ARRIVED")).expect(200),
        id = r.body.data.event.id;
      await expect(
        prisma.bookingAttendanceEvent.update({
          where: { id },
          data: { reason: "Changed" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.bookingAttendanceEvent.delete({ where: { id } }),
      ).rejects.toThrow();
      expect(
        await prisma.bookingAttendanceEvent.count({ where: { bookingId: b.id } }),
      ).toBe(1);
    });
    it("allows assigned legacy staff but denies a different branch and customers", async () => {
      const b = await booking();
      await post(b.id, payload("ARRIVED"), foreign.headers).expect(403);
      await post(b.id, payload("ARRIVED"), f.customer.headers).expect(403);
      await post(b.id, payload("ARRIVED"), legacy.headers).expect(200);
    });
    it("retains managed booking scope and existing confirmation capability", async () => {
      const b = await booking();
      await post(b.id, payload("ARRIVED"), lead.headers, true).expect(403);
      await testCapability(lead.user.id, "BOOKING_CONFIRM");
      await post(b.id, payload("ARRIVED"), lead.headers, true).expect(200);
      const outside = await booking(20, { branchId: f.other.id });
      await post(outside.id, payload("ARRIVED"), lead.headers, true).expect(404);
    });
    it("allows existing assigned job-update duties without granting booking confirmation", async () => {
      const technician = await f.account("MECHANICAL_TECHNICIAN");
      const b = await booking(20, { assignedStaffId: technician.user.staffProfile!.id });
      await post(b.id, payload("ARRIVED"), technician.headers, true).expect(200);
      const unassigned = await booking();
      await post(unassigned.id, payload("ARRIVED"), technician.headers, true).expect(404);
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/jobs/${b.id}`)
        .set(technician.headers)
        .expect(200);
      expect(detail.body.data.attendanceEvents).toHaveLength(1);
      expect(detail.body.data.attendanceEvents[0]).not.toHaveProperty("operationDigest");
      expect(detail.body.data.attendanceEvents[0]).not.toHaveProperty("recordedByUserId");
    });
    it("retains Admin and Super Admin operational attendance access without employee profiles", async () => {
      const ownerSession = await f.session(f.owner.id, "SUPER_ADMIN");
      for (const headers of [admin.headers, ownerSession.headers]) {
        const b = await booking();
        await post(b.id, payload("ARRIVED"), headers, true).expect(200);
      }
    });
    it("does not mark a visit missed when its work order already records active processing", async () => {
      const b = await booking();
      await prisma.workOrder.create({
        data: {
          bookingId: b.id,
          workOrderNumber: `ATT-${randomUUID()}`,
          status: "IN_PROGRESS",
          openedAt: new Date(),
          startedAt: new Date(),
        },
      });
      const r = await request(app)
        .get(`/api/v1/staff/bookings/${b.id}/attendance`)
        .set(admin.headers)
        .expect(200);
      expect(r.body.data.checkAttendance).toBe(false);
      await post(b.id, payload("ABSENCE_CONFIRMED")).expect(409);
    });
    it("resolves an uncertain operation by a scoped opaque receipt lookup", async () => {
      const b = await booking(),
        body = payload("ARRIVED");
      await post(b.id, body).expect(200);
      const r = await request(app)
        .get(`/api/v1/staff/bookings/${b.id}/attendance?receiptId=${body.operationId}`)
        .set(admin.headers)
        .expect(200);
      expect(r.body.data.receipt.id).toBe(body.operationId);
      expect(r.body.data.receipt).not.toHaveProperty("recordedByUserId");
    });
    it("exposes only the minimal attendance history to the owning customer", async () => {
      const b = await booking();
      await post(b.id, payload("ARRIVED")).expect(200);
      const r = await request(app)
        .get(`/api/v1/customers/bookings/${b.id}`)
        .set(f.customer.headers)
        .expect(200);
      expect(r.body.data.attendanceEvents).toHaveLength(1);
      expect(r.body.data.attendanceEvents[0]).not.toHaveProperty("operationDigest");
      expect(r.body.data.attendanceEvents[0]).not.toHaveProperty("recordedByUserId");
    });
    it("uses the approved configurable branch grace", async () => {
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic attendance grace",
          address: "Synthetic address",
          city: "Test",
          state: "Test",
        },
      });
      await testBranchCapacity(branch.id, f.owner.id, 10);
      const prior = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: `booking-capacity:${branch.id}` },
      });
      await prisma.businessPolicyVersion.create({
        data: {
          key: prior.key,
          version: 2,
          approvalStatus: "APPROVED",
          source: "Synthetic configurable attendance grace",
          sourceQuestion: "D16 delegated configuration",
          approvedByUserId: f.owner.id,
          effectiveAt: new Date(Date.now() - 1000),
          settings: { ...(prior.settings as object), noShowGraceMinutes: 30 },
        },
      });
      const b = await booking(20, { branchId: branch.id });
      const r = await request(app)
        .get(`/api/v1/staff/bookings/${b.id}/attendance`)
        .set(admin.headers)
        .expect(200);
      expect(r.body.data.policy).toMatchObject({
        graceMinutes: 30,
        source: "APPROVED_BRANCH_POLICY",
      });
      await post(b.id, payload("ABSENCE_CONFIRMED")).expect(409);
    });
    it("does not count missed appointments against remaining daily capacity", async () => {
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic released capacity",
          address: "Synthetic address",
          city: "Test",
          state: "Test",
        },
      });
      await testBranchCapacity(branch.id, f.owner.id, 1);
      const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const time = new Date(`${day}T10:00:00+01:00`);
      await booking(-1, { branchId: branch.id, scheduledAt: time, status: "NO_SHOW" });
      const candidate = await booking(-1, {
        branchId: branch.id,
        scheduledAt: time,
        status: "REQUESTED",
      });
      await expect(
        prisma.$transaction((tx) =>
          assertBookingCapacity(
            tx,
            { ...candidate, service: { durationMinutes: 30 } },
            "Synthetic reviewed capacity after a missed visit",
          ),
        ),
      ).resolves.toBeUndefined();
    });
  },
);
