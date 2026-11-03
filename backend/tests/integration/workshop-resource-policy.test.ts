import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { capacityWorkspaceResponse } from "../../src/modules/policies/capacity-policy-workspace.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 }),
  root = "/api/v1/admin/policies";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "controlled workshop resource publication",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      owner: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["session"]>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 30000);
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const branch = await prisma.branch.create({
        data: {
          code: `RESOURCE-${randomUUID().slice(0, 8)}`,
          name: "Synthetic resource workshop",
          address: "Synthetic test address",
          city: "Test",
          state: "Test",
        },
      });
      const worker = await f.account("MECHANICAL_TECHNICIAN", "STAFF", branch.id);
      const service = await prisma.service.create({
        data: {
          name: "Synthetic assessed service",
          slug: randomUUID(),
          pricingType: "FIXED",
          priceKobo: 10000n,
          durationMinutes: 60,
          preparationMinutes: 10,
          cleanupMinutes: 10,
        },
      });
      const settings = {
        timezone: "Africa/Lagos",
        resources: [
          {
            id: randomUUID(),
            name: "Synthetic physical lift",
            kind: "SPACE",
            pools: ["lift"],
            status: "AVAILABLE",
            workingPeriods: [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }],
            unavailablePeriods: [],
          },
        ],
        technicians: [
          {
            staffId: worker.user.staffProfile!.id,
            serviceIds: [service.id],
            workingPeriods: [{ weekday: 1, opensAt: "08:00", closesAt: "18:00" }],
            unavailablePeriods: [],
          },
        ],
        services: [
          { serviceId: service.id, requirements: [{ pool: "lift", quantity: 1 }] },
        ],
      };
      const body = {
        kind: "BRANCH_RESOURCES",
        branchId: branch.id,
        expectedVersion: 0,
        effectiveAt: new Date().toISOString(),
        settings,
        source: "Synthetic isolated owner resource configuration",
        approvalEvidence:
          "Synthetic owner evidence for this disposable test only; not operational approval.",
      };
      const publish = (headers = owner.headers, payload = body) =>
        request(app).post(root).set(headers).send(payload);
      const read = () =>
        request(app)
          .get(`${root}/booking-resources/${branch.id}/current`)
          .set(owner.headers);
      return {
        branch,
        worker,
        service,
        settings,
        body,
        publish,
        read,
        key: `booking-resources:${branch.id}`,
      };
    }
    it("publishes provenance, reads a private audited workspace and preserves earlier versions without creating bookings", async () => {
      const v = await fixture(),
        before = await prisma.booking.count();
      const first = await v.publish();
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect(first.body.data).toMatchObject({
        key: v.key,
        version: 1,
        approvalStatus: "APPROVED",
        sourceQuestion: "D06-D07",
        approvedByUserId: f.owner.id,
        settings: v.settings,
      });
      const read = await v.read();
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      expect(capacityWorkspaceResponse.safeParse(read.body.data).success).toBe(true);
      expect(read.body.data.current.id).toBe(first.body.data.id);
      expect(
        await prisma.auditLog.findFirst({
          where: {
            userId: f.owner.id,
            entityId: v.branch.id,
            newValues: { path: ["resource"], equals: "WORKSHOP_RESOURCES_CURRENT" },
          },
        }),
      ).not.toBeNull();
      await expect(
        prisma.businessPolicyVersion.update({
          where: { id: first.body.data.id },
          data: { source: "Synthetic forbidden history rewrite" },
        }),
      ).rejects.toThrow();
      const revised = structuredClone(v.body);
      revised.expectedVersion = 1;
      revised.settings.resources[0]!.status = "UNAVAILABLE";
      const second = await v.publish(owner.headers, revised);
      expect(second.status, JSON.stringify(second.body)).toBe(201);
      expect(
        (
          await prisma.businessPolicyVersion.findUniqueOrThrow({
            where: { id: first.body.data.id },
          })
        ).settings,
      ).toEqual(v.settings);
      expect(await prisma.booking.count()).toBe(before);
    });
    it("keeps the existing branch calendar workspace independent from resource approvals", async () => {
      const v = await fixture();
      const resource = await v.publish();
      expect(resource.status).toBe(201);
      const capacity = await request(app)
        .post(root)
        .set(owner.headers)
        .send({
          kind: "BRANCH_CAPACITY",
          branchId: v.branch.id,
          expectedVersion: 0,
          effectiveAt: new Date().toISOString(),
          settings: {
            dailyLimit: 4,
            openingDays: [1, 2, 3, 4, 5, 6],
            opensAt: "08:00",
            closesAt: "18:00",
            holidays: [],
            timezone: "Africa/Lagos",
          },
          source: "Synthetic separate calendar approval",
          approvalEvidence:
            "Synthetic isolated calendar decision; not real operating capacity.",
        });
      expect(capacity.status, JSON.stringify(capacity.body)).toBe(201);
      const calendar = await request(app)
        .get(`${root}/booking-capacity/${v.branch.id}/current`)
        .set(owner.headers);
      expect(calendar.status).toBe(200);
      expect(calendar.headers["cache-control"]).toBe("private, no-store");
      expect(calendar.body.data.current.id).toBe(capacity.body.data.id);
      expect(calendar.body.data.current.key).toBe(`booking-capacity:${v.branch.id}`);
      expect((await v.read()).body.data.current.id).toBe(resource.body.data.id);
    });
    it("rejects stale approval versions without duplicate policy history", async () => {
      const v = await fixture();
      expect((await v.publish()).status).toBe(201);
      expect((await v.publish()).status).toBe(409);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(1);
    });
    it("serializes two approvals of the same configuration revision", async () => {
      const v = await fixture();
      const responses = await Promise.all([v.publish(), v.publish()]);
      expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(1);
    });
    it("requires an authenticated owner with current MFA and CSRF", async () => {
      const v = await fixture(),
        admin = await f.account(null, "ADMIN"),
        weak = await f.session(f.owner.id, "SUPER_ADMIN", false);
      expect((await v.publish(admin.headers)).status).toBe(403);
      expect((await v.publish(v.worker.headers)).status).toBe(403);
      expect((await v.publish(weak.headers)).status).toBe(403);
      const { "X-CSRF-Token": _csrf, ...withoutCsrf } = owner.headers;
      expect((await v.publish(withoutCsrf as typeof owner.headers)).status).toBe(403);
      expect(
        (
          await request(app)
            .get(`${root}/booking-resources/${v.branch.id}/current`)
            .set(admin.headers)
        ).status,
      ).toBe(403);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(0);
    });
    it("rejects nonexistent or inactive services and inactive branches", async () => {
      const v = await fixture();
      await prisma.service.update({
        where: { id: v.service.id },
        data: { isActive: false },
      });
      expect((await v.publish()).status).toBe(409);
      await prisma.service.update({
        where: { id: v.service.id },
        data: { isActive: true },
      });
      await prisma.branch.update({
        where: { id: v.branch.id },
        data: { isActive: false },
      });
      expect((await v.publish()).status).toBe(409);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(0);
    });
    it("does not grant work access by listing customer-care staff as a technician", async () => {
      const v = await fixture(),
        care = await f.account("CUSTOMER_SERVICE", "STAFF", v.branch.id);
      v.body.settings.technicians[0]!.staffId = care.user.staffProfile!.id;
      expect((await v.publish()).status).toBe(409);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(0);
    });
    it("revalidates branch access and verification instead of trusting the selected staff label", async () => {
      const v = await fixture();
      v.body.settings.technicians[0]!.staffId = f.mechanical1.user.staffProfile!.id;
      expect((await v.publish()).status).toBe(409);
      v.body.settings.technicians[0]!.staffId = v.worker.user.staffProfile!.id;
      await prisma.user.update({
        where: { id: v.worker.user.id },
        data: { emailVerifiedAt: null },
      });
      expect((await v.publish()).status).toBe(409);
      expect(await prisma.businessPolicyVersion.count({ where: { key: v.key } })).toBe(0);
    });
    it("keeps future approved versions separate from the policy currently in force", async () => {
      const v = await fixture();
      v.body.effectiveAt = new Date(Date.now() + 86400000).toISOString();
      const published = await v.publish();
      expect(published.status, JSON.stringify(published.body)).toBe(201);
      const read = await v.read();
      expect(read.status).toBe(200);
      expect(read.body.data.current).toBeNull();
      expect(read.body.data.nextScheduled.id).toBe(published.body.data.id);
    });
  },
);
