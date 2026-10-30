import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
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
      const service = await prisma.service.create({
        data: {
          name: "Synthetic concern inspection",
          slug: randomUUID(),
          pricingType: "QUOTE_REQUIRED",
          durationMinutes: 60,
        },
      });
      const preferred = new Date(Date.now() + 10 * 86400000);
      preferred.setUTCHours(9, 0, 0, 0);
      const concern = "The engine rattles when starting from cold.";
      const body = {
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
        customerConcern: concern,
      });
      const replay = await create();
      expect(replay.status).toBe(201);
      expect(replay.body.data.booking.id).toBe(id);
      expect(replay.body.data.replayed).toBe(true);
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
        scheduledAt: alternative,
        assignedStaffId: null,
        alternativeStartsAt: null,
      });
      expect((await assign(3)).status).toBe(200);
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
      const confirmed = await request(app)
        .post(`/api/v1/staff/workforce/bookings/${id}/confirmation`)
        .set(f.care.headers)
        .send({
          expectedVersion: 4,
          resourceReviewNote: "Reviewed technician, equipment and workshop capacity.",
        });
      expect(confirmed.status).toBe(200);
      const final = await read();
      expect(final.status).toBe(200);
      expect(final.body.data).toMatchObject({
        id,
        status: "CONFIRMED",
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
    });
  },
);
