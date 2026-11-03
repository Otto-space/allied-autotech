import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testBranchResources } from "../helpers/owner-policy.js";
import { bookingPolicy } from "../../src/modules/service-operations/service-operations.service.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "customer-to-workforce concern booking journey",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    it("rejects withdrawn or mismatched groups and snapshots a service group without inventing a price", async () => {
      const customer = await f.account(null, "CUSTOMER");
      const group = await prisma.serviceCategory.create({
        data: { name: "Published inspection group", slug: randomUUID() },
      });
      const other = await prisma.serviceCategory.create({
        data: { name: "Other group", slug: randomUUID() },
      });
      const hidden = await prisma.serviceCategory.create({
        data: { name: "Private group", slug: randomUUID(), isActive: false },
      });
      const service = await prisma.service.create({
        data: {
          name: "Group inspection",
          slug: randomUUID(),
          categoryId: group.id,
          pricingType: "QUOTE_REQUIRED",
        },
      });
      const body = {
        branchId: f.home.id,
        preferredAt: new Date(Date.now() + 8 * 86400000).toISOString(),
        policyVersion: bookingPolicy.version,
      };
      const send = (detail: object) =>
        request(app)
          .post("/api/v1/customers/bookings")
          .set(customer.headers)
          .set("Idempotency-Key", randomUUID())
          .send({ ...body, ...detail });
      for (const serviceCategoryId of [hidden.id, randomUUID()]) {
        expect(
          (
            await send({
              serviceCategoryId,
              customerConcern: "Please inspect the vehicle noise.",
            })
          ).status,
        ).toBe(404);
      }
      expect(
        (await send({ serviceId: service.id, serviceCategoryId: other.id })).status,
      ).toBe(409);
      expect(
        await prisma.booking.count({ where: { customerId: customer.user.profile!.id } }),
      ).toBe(0);
      const result = await send({ serviceId: service.id });
      expect(result.status).toBe(201);
      expect(result.body.data.booking).toMatchObject({
        requestedServiceCategoryId: group.id,
        requestedServiceCategoryName: group.name,
        quotedPriceKobo: null,
        status: "REQUESTED",
      });
      await prisma.service.update({
        where: { id: service.id },
        data: { categoryId: other.id },
      });
      const read = await request(app)
        .get(`/api/v1/customers/bookings/${result.body.data.booking.id}`)
        .set(customer.headers);
      expect(read.body.data).toMatchObject({
        requestedServiceCategoryId: group.id,
        requestedServiceCategoryName: group.name,
      });
    });
    it("retains one customer request through classification, proposed time, acceptance and explicit confirmation", async () => {
      const customer = await f.account(null, "CUSTOMER");
      const vehicle = await prisma.customerVehicle.create({
        data: {
          customerId: customer.user.profile!.id,
          make: "Synthetic",
          model: "Journey",
          year: 2020,
        },
      });
      const group = await prisma.serviceCategory.create({
        data: { name: "Original engine work", slug: randomUUID() },
      });
      const service = await prisma.service.create({
        data: {
          name: "Synthetic concern inspection",
          slug: randomUUID(),
          pricingType: "QUOTE_REQUIRED",
          durationMinutes: 60,
          preparationMinutes: 0,
          cleanupMinutes: 0,
        },
      });
      const preferred = new Date(Date.now() + 10 * 86400000);
      preferred.setUTCHours(9, 0, 0, 0);
      const concern = "The engine rattles when starting from cold.";
      const body = {
        serviceCategoryId: group.id,
        customerConcern: concern,
        vehicleId: vehicle.id,
        branchId: f.home.id,
        preferredAt: preferred.toISOString(),
        customerNotes: "Please retain these customer notes.",
        policyVersion: bookingPolicy.version,
      };
      const key = randomUUID();
      const create = () =>
        request(app)
          .post("/api/v1/customers/bookings")
          .set(customer.headers)
          .set("Idempotency-Key", key)
          .send(body);
      const created = await create();
      expect(created.status).toBe(201);
      const id = created.body.data.booking.id;
      expect(created.body.data.booking).toMatchObject({
        id,
        status: "REQUESTED",
        service: null,
        requestedServiceCategoryId: group.id,
        requestedServiceCategoryName: group.name,
        customerConcern: concern,
      });
      await prisma.serviceCategory.update({
        where: { id: group.id },
        data: { name: "Changed engine group", isActive: false },
      });
      const changedGroup = await request(app)
        .post("/api/v1/customers/bookings")
        .set(customer.headers)
        .set("Idempotency-Key", key)
        .send({ ...body, serviceCategoryId: randomUUID() });
      expect(changedGroup.status).toBe(409);
      const replay = await create();
      expect(replay.status).toBe(201);
      expect(replay.body.data.booking.id).toBe(id);
      expect(replay.body.data.replayed).toBe(true);
      const changedConcern = await request(app)
        .post("/api/v1/customers/bookings")
        .set(customer.headers)
        .set("Idempotency-Key", key)
        .send({ ...body, customerConcern: "The brakes squeal when slowing down." });
      expect(changedConcern.status).toBe(409);
      expect(await prisma.booking.findUniqueOrThrow({ where: { id } })).toMatchObject({
        customerConcern: concern,
        status: "REQUESTED",
        version: 0,
      });
      expect((await create()).body.data).toMatchObject({
        booking: { id, customerConcern: concern },
        replayed: true,
      });
      expect(
        await prisma.booking.count({ where: { customerId: customer.user.profile!.id } }),
      ).toBe(1);
      const read = () =>
        request(app).get(`/api/v1/customers/bookings/${id}`).set(customer.headers);
      expect(
        (
          await request(app)
            .get(`/api/v1/customers/bookings/${id}`)
            .set(f.stranger.headers)
        ).status,
      ).toBe(404);
      const assign = (expectedVersion: number) =>
        request(app)
          .patch(`/api/v1/staff/workforce/jobs/${id}/assignment`)
          .set(f.lead.headers)
          .send({
            expectedVersion,
            staffId: f.mechanical1.user.staffProfile!.id,
            serviceId: service.id,
            reason: "Reviewed the reported concern and technician suitability.",
          });
      expect((await assign(0)).status).toBe(200);
      const staffRead = await request(app)
        .get(`/api/v1/staff/workforce/jobs/${id}`)
        .set(f.lead.headers);
      expect(staffRead.status).toBe(200);
      expect(staffRead.body.data).toMatchObject({
        requestedServiceCategoryId: group.id,
        requestedServiceCategoryName: group.name,
      });
      expect((await read()).body.data).toMatchObject({
        id,
        status: "REQUESTED",
        service: { id: service.id },
        customerConcern: concern,
        customerNotes: body.customerNotes,
        vehicle: { id: vehicle.id },
      });
      await prisma.userCapability.create({
        data: {
          userId: f.care.user.id,
          capability: "BOOKING_CONFIRM",
          grantedByUserId: f.owner.id,
        },
      });
      const alternative = new Date(preferred.getTime() + 86400000).toISOString();
      const proposal = await request(app)
        .post(`/api/v1/staff/workforce/bookings/${id}/alternative`)
        .set(f.care.headers)
        .send({
          expectedVersion: 1,
          preferredAt: alternative,
          reason: "The workshop proposes a later diagnostic appointment.",
        });
      expect(proposal.status).toBe(200);
      expect((await read()).body.data).toMatchObject({
        scheduledAt: preferred.toISOString(),
        alternativeStartsAt: alternative,
        status: "REQUESTED",
      });
      const answer = { decision: "ACCEPT", expectedVersion: 2 };
      expect(
        (
          await request(app)
            .post(`/api/v1/customers/bookings/${id}/alternative-response`)
            .set(f.stranger.headers)
            .send(answer)
        ).status,
      ).toBe(404);
      const accepted = await request(app)
        .post(`/api/v1/customers/bookings/${id}/alternative-response`)
        .set(customer.headers)
        .send(answer);
      expect(accepted.status).toBe(200);
      const pending = await read();
      expect(pending.body.data).toMatchObject({
        id,
        status: "REQUESTED",
        scheduledAt: preferred.toISOString(),
        assignedStaffId: f.mechanical1.user.staffProfile!.id,
        alternativeStartsAt: null,
        rescheduleRequests: [
          { status: "PENDING", source: "WORKSHOP", startsAt: alternative },
        ],
      });
      const requestId = pending.body.data.rescheduleRequests[0].id;
      expect(await prisma.booking.findUniqueOrThrow({ where: { id } })).toMatchObject({
        scheduledAt: preferred,
        assignedStaffId: f.mechanical1.user.staffProfile!.id,
        status: "REQUESTED",
        version: 3,
        customerRescheduleCount: 0,
      });
      expect(
        await prisma.bookingResourceAllocation.count({ where: { bookingId: id } }),
      ).toBe(0);
      expect(await prisma.bookingReminder.count({ where: { bookingId: id } })).toBe(0);
      await prisma.businessPolicyVersion.create({
        data: {
          key: `booking-capacity:${f.home.id}`,
          version: 1,
          approvalStatus: "APPROVED",
          source: "Isolated HTTP journey fixture",
          sourceQuestion: "Synthetic capacity only",
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
      await testBranchResources(
        f.home.id,
        f.owner.id,
        [service.id],
        [f.mechanical1.user.staffProfile!.id],
      );
      const decision = {
        requestId,
        expectedVersion: 3,
        decision: "APPROVE",
        reason: "Reviewed the accepted alternative diagnostic appointment.",
        resourceReviewNote: "Reviewed technician, equipment and workshop capacity.",
      };
      const approve = () =>
        request(app)
          .post(`/api/v1/staff/workforce/bookings/${id}/reschedule-decision`)
          .set(f.care.headers)
          .send(decision);
      const confirmed = await approve();
      expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
      expect(confirmed.body.data).toMatchObject({
        requestId,
        requestStatus: "APPROVED",
        status: "CONFIRMED",
        scheduledAt: alternative,
      });
      expect((await approve()).status).toBe(409);
      expect(
        await prisma.bookingResourceAllocation.count({ where: { bookingId: id } }),
      ).toBe(1);
      const final = await read();
      expect(final.status).toBe(200);
      expect(final.body.data).toMatchObject({
        id,
        status: "CONFIRMED",
        requestedServiceCategoryId: group.id,
        requestedServiceCategoryName: group.name,
        scheduledAt: alternative,
        customerConcern: concern,
        customerNotes: body.customerNotes,
        service: { id: service.id },
        vehicle: { id: vehicle.id },
      });
      const stored = await prisma.booking.findUniqueOrThrow({ where: { id } });
      expect(stored.confirmedAt).not.toBeNull();
      expect(stored.depositAmountKobo).toBeNull();
      expect(stored.quotedPriceKobo).toBeNull();
      expect(stored.customerRescheduleCount).toBe(0);
      // Staff classification and rescheduling preserve the original request key.
      const confirmedReplay = await create();
      expect(confirmedReplay.status).toBe(201);
      expect(confirmedReplay.body.data).toMatchObject({
        booking: { id, customerConcern: concern, status: "CONFIRMED" },
        replayed: true,
      });
      expect(
        await prisma.booking.count({ where: { customerId: customer.user.profile!.id } }),
      ).toBe(1);
    });
  },
);
