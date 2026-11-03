import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { resourceOptionsResponse } from "../../src/modules/policies/workshop-resource-options.js";
const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owner workshop resource options",
  () => {
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      owner: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["session"]>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 30000);
    afterAll(() => prisma.$disconnect());
    const read = (
      branch = f.home.id,
      query: Record<string, string | number> = { kind: "TECHNICIAN" },
      headers = owner.headers,
    ) =>
      request(app)
        .get(`/api/v1/admin/policies/booking-resources/${branch}/options`)
        .query(query)
        .set(headers);
    async function branch() {
      return prisma.branch.create({
        data: {
          code: `OPT-${randomUUID().slice(0, 8)}`,
          name: "Synthetic lookup branch",
          address: "Synthetic address",
          city: "Test",
          state: "Test",
        },
      });
    }
    async function service(name: string, isActive = true) {
      return prisma.service.create({
        data: { name, slug: randomUUID(), pricingType: "QUOTE_REQUIRED", isActive },
      });
    }
    it("returns real labels in a private audited response without contact or account details", async () => {
      const r = await read();
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      expect(resourceOptionsResponse.safeParse(r.body.data).success).toBe(true);
      expect(r.body.data.items).toContainEqual({
        id: f.mechanical1.user.staffProfile!.id,
        label: "Synthetic MECHANICAL_TECHNICIAN",
        eligible: true,
      });
      for (const item of r.body.data.items)
        expect(Object.keys(item).sort()).toEqual(["eligible", "id", "label"]);
      expect(JSON.stringify(r.body.data)).not.toMatch(/example\.test|password|phone|@/);
      const event = await prisma.auditLog.findFirst({
        where: {
          userId: f.owner.id,
          entityId: f.home.id,
          newValues: { path: ["resource"], equals: "WORKSHOP_RESOURCE_OPTIONS" },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(event?.newValues).toEqual({
        resource: "WORKSHOP_RESOURCE_OPTIONS",
        kind: "TECHNICIAN",
        returnedCount: r.body.data.items.length,
      });
    });
    it("requires a current owner MFA session and rejects staff, admin and customer sessions", async () => {
      for (const headers of [
        f.mechanical1.headers,
        f.operations.headers,
        f.customer.headers,
        (await f.session(f.owner.id, "SUPER_ADMIN", false)).headers,
      ])
        expect((await read(f.home.id, { kind: "TECHNICIAN" }, headers)).status).toBe(403);
      expect(
        (
          await request(app).get(
            `/api/v1/admin/policies/booking-resources/${f.home.id}/options?kind=TECHNICIAN`,
          )
        ).status,
      ).toBe(401);
    });
    it("filters service names before keyset pagination and preserves inactive selected references honestly", async () => {
      const q = `Synthetic-${randomUUID()}`;
      const rows = await Promise.all([
        service(q + " first"),
        service(q + " second"),
        service(q + " retired", false),
        service("Synthetic unrelated service"),
      ]);
      const ids = rows
        .slice(0, 2)
        .map((x) => x.id)
        .sort();
      const first = await read(f.home.id, { kind: "SERVICE", q, limit: 1 });
      expect(first.status).toBe(200);
      expect(first.body.data.items.map((x: { id: string }) => x.id)).toEqual([ids[0]]);
      expect(first.body.data.nextCursor).toBe(ids[0]);
      const second = await read(f.home.id, {
        kind: "SERVICE",
        q,
        limit: 1,
        cursor: first.body.data.nextCursor,
      });
      expect(second.body.data.items.map((x: { id: string }) => x.id)).toEqual([ids[1]]);
      expect(second.body.data.nextCursor).toBeNull();
      const selected = await read(f.home.id, {
        kind: "SERVICE",
        ids: [rows[0]!.id.toUpperCase(), rows[2]!.id, randomUUID()].join(","),
      });
      expect(selected.body.data.items).toHaveLength(2);
      expect(selected.body.data.items).toContainEqual({
        id: rows[2]!.id,
        label: q + " retired",
        eligible: false,
      });
      expect(selected.body.data.nextCursor).toBeNull();
    });
    it("filters actual job duties before technician pagination, includes legacy branch staff, and excludes care-only or foreign staff", async () => {
      const b = await branch(),
        q = `Lookup${randomUUID().replaceAll("-", "")}`;
      const care = await f.account("CUSTOMER_SERVICE", "STAFF", b.id),
        legacy = await f.account(null, "STAFF", b.id),
        tech = await f.account("MECHANICAL_TECHNICIAN", "STAFF", b.id),
        foreign = await f.account("ELECTRICAL_TECHNICIAN", "STAFF", f.other.id);
      for (const a of [care, legacy, tech, foreign])
        await prisma.staffProfile.update({
          where: { id: a.user.staffProfile!.id },
          data: { firstName: q, lastName: "Synthetic" },
        });
      const ids = [legacy, tech].map((x) => x.user.staffProfile!.id).sort();
      const first = await read(b.id, { kind: "TECHNICIAN", q, limit: 1 });
      expect(first.status, JSON.stringify(first.body)).toBe(200);
      expect(first.body.data.items.map((x: { id: string }) => x.id)).toEqual([ids[0]]);
      expect(first.body.data.nextCursor).toBe(ids[0]);
      const second = await read(b.id, {
        kind: "TECHNICIAN",
        q,
        limit: 1,
        cursor: first.body.data.nextCursor,
      });
      expect(second.body.data.items.map((x: { id: string }) => x.id)).toEqual([ids[1]]);
      expect(second.body.data.nextCursor).toBeNull();
      const exact = await read(b.id, {
        kind: "TECHNICIAN",
        ids: [care, legacy, tech, foreign].map((x) => x.user.staffProfile!.id).join(","),
      });
      expect(exact.body.data.items).toHaveLength(4);
      for (const a of [care, foreign])
        expect(exact.body.data.items).toContainEqual({
          id: a.user.staffProfile!.id,
          label: q + " Synthetic",
          eligible: false,
        });
    });
    it("does not restore legacy access to a managed account with revoked, expired or future job duties", async () => {
      const b = await branch();
      const changes = [
        { revokedAt: new Date(), revokedByUserId: f.owner.id },
        { expiresAt: new Date(Date.now() - 1000) },
        { startsAt: new Date(Date.now() + 86400000) },
      ];
      for (const change of changes) {
        const a = await f.account("MECHANICAL_TECHNICIAN", "STAFF", b.id);
        await prisma.workforceAssignment.updateMany({
          where: { userId: a.user.id },
          data: change,
        });
        const selected = await read(b.id, {
          kind: "TECHNICIAN",
          ids: a.user.staffProfile!.id,
        });
        expect(selected.status).toBe(200);
        expect(selected.body.data.items[0].eligible).toBe(false);
        expect((await read(b.id)).body.data.items).not.toContainEqual(
          expect.objectContaining({ id: a.user.staffProfile!.id }),
        );
      }
    });
    it("rechecks verified active accounts and never treats a resource selection as a permission grant", async () => {
      const b = await branch();
      for (const change of [
        { emailVerifiedAt: null },
        { status: "SUSPENDED" as const },
      ]) {
        const a = await f.account("MECHANICAL_TECHNICIAN", "STAFF", b.id);
        await prisma.user.update({ where: { id: a.user.id }, data: change });
        const r = await read(b.id, { kind: "TECHNICIAN", ids: a.user.staffProfile!.id });
        expect(r.body.data.items[0].eligible).toBe(false);
      }
    });
    it("keeps inactive branch history readable but marks all references ineligible", async () => {
      const b = await branch(),
        a = await f.account("ELECTRICAL_TECHNICIAN", "STAFF", b.id);
      await prisma.branch.update({ where: { id: b.id }, data: { isActive: false } });
      const r = await read(b.id, { kind: "TECHNICIAN", ids: a.user.staffProfile!.id });
      expect(r.status).toBe(200);
      expect(r.body.data.items[0].eligible).toBe(false);
      const services = await read(b.id, { kind: "SERVICE", ids: f.job1.serviceId! });
      expect(services.body.data.items[0].eligible).toBe(false);
    });
    it("rejects malformed, oversized or ambiguous lookups and unknown branches", async () => {
      for (const query of [
        { kind: "CUSTOMER" },
        { kind: "SERVICE", ids: "bad" },
        {
          kind: "SERVICE",
          ids: f.job1.serviceId! + "," + f.job1.serviceId!.toUpperCase(),
        },
        { kind: "TECHNICIAN", limit: 51 },
        { kind: "SERVICE", ids: f.job1.serviceId!, q: "synthetic" },
        { kind: "SERVICE", cursor: "not-a-reference" },
        { kind: "SERVICE", q: "x".repeat(81) },
        {
          kind: "SERVICE",
          ids: Array.from({ length: 101 }, () => randomUUID()).join(","),
        },
      ])
        expect((await read(f.home.id, query)).status, JSON.stringify(query)).toBe(422);
      expect((await read(randomUUID())).status).toBe(404);
    });
    it("rejects revoked owner sessions without disclosing option labels", async () => {
      const s = await f.session(f.owner.id, "SUPER_ADMIN");
      await prisma.session.update({
        where: { id: s.record.id },
        data: { revokedAt: new Date() },
      });
      const r = await read(f.home.id, { kind: "SERVICE" }, s.headers);
      expect(r.status).toBe(401);
      expect(r.body.data).toBeUndefined();
    });
  },
);
