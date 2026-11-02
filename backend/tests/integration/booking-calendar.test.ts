import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "customer calendar through authenticated HTTP",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    it("uses a half-open Nigeria-time month, owned records only, safe projections and stable paging", async () => {
      const owner = await f.account(null, "CUSTOMER"),
        stranger = await f.account(null, "CUSTOMER");
      const make = (customerId: string, scheduledAt: string) =>
        prisma.booking.create({
          data: {
            customerId,
            branchId: f.home.id,
            serviceId: f.job1.serviceId,
            status: "REQUESTED",
            scheduledAt: new Date(scheduledAt),
            staffNotes: "Never disclose this private staff note",
          },
        });
      const first = await make(owner.user.profile!.id, "2026-10-31T23:00:00Z"),
        last = await make(owner.user.profile!.id, "2026-11-30T22:59:59Z");
      await make(owner.user.profile!.id, "2026-11-30T23:00:00Z");
      await make(stranger.user.profile!.id, "2026-11-15T10:00:00Z");
      const proposed = await prisma.booking.create({
        data: {
          customerId: owner.user.profile!.id,
          branchId: f.home.id,
          serviceId: f.job1.serviceId,
          status: "REQUESTED",
          scheduledAt: new Date("2026-10-15T10:00:00Z"),
          alternativeStartsAt: new Date("2026-11-15T10:00:00Z"),
          alternativeReason: "Synthetic calendar proposal",
          alternativeVersion: 1,
          version: 1,
        },
      });
      const query = {
        scheduledFrom: "2026-11-01T00:00:00+01:00",
        scheduledTo: "2026-12-01T00:00:00+01:00",
        limit: 1,
      };
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const r = await request(app)
          .get("/api/v1/customers/bookings")
          .query({ ...query, ...(cursor ? { cursor } : {}) })
          .set(owner.headers);
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).not.toContain("Never disclose");
        ids.push(...r.body.data.items.map((row: { id: string }) => row.id));
        cursor = r.body.data.nextCursor;
      } while (cursor);
      expect(ids.sort()).toEqual([first.id, last.id, proposed.id].sort());
      expect(
        (await request(app).get("/api/v1/customers/bookings").query(query)).status,
      ).toBe(401);
    });
    it("rejects invalid/reversed/oversized ranges and forged customer identity", async () => {
      for (const query of [
        { scheduledFrom: "invalid" },
        { scheduledFrom: "2026-12-01T00:00:00Z", scheduledTo: "2026-11-01T00:00:00Z" },
        { scheduledFrom: "2026-01-01T00:00:00Z", scheduledTo: "2028-01-01T00:00:00Z" },
        { customerId: f.stranger.user.profile!.id },
      ])
        expect(
          (
            await request(app)
              .get("/api/v1/customers/bookings")
              .query(query)
              .set(f.customer.headers)
          ).status,
        ).toBe(422);
    });
  },
);
