import * as auditService from "../../src/modules/audit/audit.service.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { workforceResponseSchema } from "../../src/modules/organization/workforce.schemas.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workforce concern classification",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
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
    const concern = "Engine rattles when starting from cold.";
    async function booking(branchId?: string) {
      return prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: branchId ?? f.home.id,
          serviceId: null,
          customerConcern: concern,
          scheduledAt: new Date(Date.now() + (8 + day++) * 86400000),
          status: "REQUESTED",
        },
      });
    }
    async function service(fixed = false) {
      return prisma.service.create({
        data: {
          name: "Synthetic classification service",
          slug: `classification-${randomUUID()}`,
          pricingType: fixed ? "FIXED" : "QUOTE_REQUIRED",
          priceKobo: fixed ? 1234567n : null,
          currency: "NGN",
          durationMinutes: 60,
        },
      });
    }
    const assign = (
      id: string,
      serviceId: string | undefined,
      who = f.lead,
      staffId = f.mechanical1.user.staffProfile!.id,
    ) =>
      request(app)
        .patch(`/api/v1/staff/workforce/jobs/${id}/assignment`)
        .set(who.headers)
        .send({
          expectedVersion: 0,
          staffId,
          serviceId,
          reason: "Reviewed concern and technician suitability.",
        });
    for (const fixed of [false, true])
      it(`classifies ${fixed ? "fixed-price" : "quotation"} concern without confirming or losing text`, async () => {
        const b = await booking(),
          s = await service(fixed),
          result = await assign(b.id, s.id);
        expect(result.status).toBe(200);
        expect(
          workforceResponseSchema("jobAssignment").safeParse(result.body.data).success,
        ).toBe(true);
        expect(result.body.data).toMatchObject({
          id: b.id,
          status: "REQUESTED",
          version: 1,
          customerConcern: concern,
          service: { id: s.id, name: s.name },
        });
        const stored = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
        expect(stored.quotedPriceKobo).toBe(fixed ? 1234567n : null);
        expect(stored.confirmedAt).toBeNull();
        expect(stored.assignedStaffId).toBe(f.mechanical1.user.staffProfile!.id);
        expect((await assign(b.id, s.id)).status).toBe(409);
      });
    it("rejects missing, unpublished and durationless services without partial assignment", async () => {
      const unpublished = await service(),
        durationless = await service();
      await prisma.service.update({
        where: { id: unpublished.id },
        data: { isActive: false },
      });
      await prisma.service.update({
        where: { id: durationless.id },
        data: { durationMinutes: null },
      });
      for (const id of [undefined, unpublished.id, durationless.id]) {
        const b = await booking();
        expect((await assign(b.id, id)).status).toBe(409);
        const stored = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
        expect(stored.serviceId).toBeNull();
        expect(stored.assignedStaffId).toBeNull();
        expect(stored.version).toBe(0);
      }
    });
    it("preserves branch scope and refuses overlapping technician appointments", async () => {
      const s = await service(),
        foreign = await booking(f.other.id);
      expect([403, 404]).toContain((await assign(foreign.id, s.id)).status);
      const b = await booking();
      await prisma.booking.create({
        data: {
          customerId: f.customer.user.profile!.id,
          branchId: f.home.id,
          serviceId: s.id,
          assignedStaffId: f.mechanical1.user.staffProfile!.id,
          scheduledAt: b.scheduledAt,
          status: "REQUESTED",
        },
      });
      expect((await assign(b.id, s.id)).status).toBe(409);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).version,
      ).toBe(0);
    });
    it("commits only one competing classification for the same technician and time", async () => {
      const first = await booking(),
        second = await booking(),
        s = await service();
      await prisma.booking.update({
        where: { id: second.id },
        data: { scheduledAt: first.scheduledAt },
      });
      const results = await Promise.all([
        assign(first.id, s.id),
        assign(second.id, s.id),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const rows = await prisma.booking.findMany({
        where: { id: { in: [first.id, second.id] } },
      });
      expect(rows.filter((r) => r.serviceId === s.id && r.version === 1)).toHaveLength(1);
      expect(
        rows.filter(
          (r) => r.serviceId === null && r.assignedStaffId === null && r.version === 0,
        ),
      ).toHaveLength(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: { in: [first.id, second.id] }, action: "UPDATE" },
        }),
      ).toBe(1);
    });
    for (const participant of ["lead", "technician"] as const)
      it(
        "rolls back classification when the " +
          participant +
          " responsibility expires during its audit",
        async () => {
          const lead = await f.account("WORKSHOP_LEAD"),
            tech = await f.account("MECHANICAL_TECHNICIAN"),
            b = await booking(),
            s = await service();
          const expiresAt = new Date(Date.now() + 30000);
          await prisma.workforceAssignment.updateMany({
            where: { userId: participant === "lead" ? lead.user.id : tech.user.id },
            data: { expiresAt },
          });
          const original = auditService.appendAuditEvent;
          vi.spyOn(auditService, "appendAuditEvent").mockImplementation(
            async (tx, event) => {
              await original(tx, event);
              if (event.entityId === b.id && event.action === "UPDATE") {
                vi.useFakeTimers({ toFake: ["Date"] });
                vi.setSystemTime(new Date(expiresAt.getTime() + 1));
              }
            },
          );
          const result = await assign(b.id, s.id, lead, tech.user.staffProfile!.id);
          expect([403, 404]).toContain(result.status);
          const stored = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
          expect(stored).toMatchObject({
            serviceId: null,
            assignedStaffId: null,
            version: 0,
            customerConcern: concern,
            status: "REQUESTED",
          });
          expect(
            await prisma.auditLog.count({ where: { entityId: b.id, action: "UPDATE" } }),
          ).toBe(0);
        },
      );
  },
);
