import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "scoped workforce account discovery",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    let owner: Awaited<ReturnType<typeof f.session>>;
    let foreign: Awaited<ReturnType<typeof f.account>>;
    const read = (
      actor: { headers: Record<string, string> },
      query: Record<string, unknown> = {},
    ) =>
      request(app)
        .get("/api/v1/admin/workforce/accounts")
        .set(actor.headers)
        .query(query);
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
      foreign = await f.account("CUSTOMER_SERVICE", "STAFF", f.other.id);
      await prisma.staffProfile.update({
        where: { userId: f.care.user.id },
        data: { firstName: "Ada", lastName: "Scope" },
      });
      await f.assignment(f.care.user.id, "ACCOUNTANT");
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("denies anonymous, customer, ordinary staff and an administrator without delegation", async () => {
      expect((await request(app).get("/api/v1/admin/workforce/accounts")).status).toBe(
        401,
      );
      for (const actor of [f.customer, f.mechanical1, f.operations])
        expect((await read(actor)).status).toBe(403);
    });
    it("lets the owner find real accounts across name fields while separating tier, position and assignments", async () => {
      const r = await read(owner, {
        q: `ADA scope ${f.care.user.email}`,
        role: "STAFF",
        position: "CUSTOMER_SERVICE",
        status: "ACTIVE",
      });
      expect(r.status).toBe(200);
      expect(r.headers["cache-control"]).toBe("private, no-store");
      expect(r.body.data.items).toHaveLength(1);
      expect(r.body.data.items[0]).toMatchObject({
        userId: f.care.user.id,
        name: "Ada Scope",
        role: "STAFF",
        managed: true,
        position: "CUSTOMER_SERVICE",
        status: "ACTIVE",
        accountBranch: { id: f.home.id },
      });
      expect(
        r.body.data.items[0].responsibilities.map(
          (a: { template: string }) => a.template,
        ),
      ).toEqual(expect.arrayContaining(["CUSTOMER_SERVICE", "ACCOUNTANT"]));
      for (const field of [
        "passwordHash",
        "mfaFactors",
        "delegatedTemplates",
        "phone",
        "customerNotes",
        "currentPassword",
      ])
        expect(JSON.stringify(r.body.data)).not.toContain('"' + field + '"');
    });
    it("limits delegated administrators to staff in their envelope and hides responsibility definitions they cannot manage", async () => {
      const r = await read(f.scopedAdmin, { q: f.care.user.email });
      expect(r.status).toBe(200);
      expect(r.body.data.items).toHaveLength(1);
      expect(
        r.body.data.items[0].responsibilities.map(
          (a: { template: string }) => a.template,
        ),
      ).toEqual(["CUSTOMER_SERVICE"]);
      expect(
        (await read(f.scopedAdmin, { q: foreign.user.email })).body.data.items,
      ).toEqual([]);
      expect(
        (await read(f.scopedAdmin, { role: "SUPER_ADMIN" })).body.data.items,
      ).toEqual([]);
      expect(
        (await read(f.scopedAdmin, { branchId: f.other.id })).body.data.items,
      ).toEqual([]);
    });
    it("does not expose customers, expired/future/revoked responsibilities or invalid assignment scopes", async () => {
      expect((await read(owner, { q: f.customer.user.email })).body.data.items).toEqual(
        [],
      );
      const future = await f.assignment(f.care.user.id, "SALES_SUPERVISOR");
      const expired = await f.assignment(f.care.user.id, "WORKSHOP_LEAD");
      const revoked = await f.assignment(f.care.user.id, "OPERATIONS");
      const invalid = await f.assignment(f.care.user.id, "ELECTRICAL_TECHNICIAN");
      await prisma.workforceAssignment.update({
        where: { id: future.id },
        data: { startsAt: new Date(Date.now() + 60000) },
      });
      await prisma.workforceAssignment.update({
        where: { id: expired.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await prisma.workforceAssignment.update({
        where: { id: revoked.id },
        data: {
          revokedAt: new Date(),
          revokedByUserId: f.owner.id,
          revocationReason: "Synthetic reviewed revocation",
        },
      });
      await prisma.workforceAssignment.update({
        where: { id: invalid.id },
        data: { scope: "BRANCH" },
      });
      const r = await read(owner, { q: f.care.user.email });
      expect(r.status).toBe(200);
      expect(
        r.body.data.items[0].responsibilities.map(
          (a: { template: string }) => a.template,
        ),
      ).toEqual(expect.arrayContaining(["CUSTOMER_SERVICE", "ACCOUNTANT"]));
      expect(r.body.data.items[0].responsibilities).toHaveLength(2);
    });
    it("uses stable scoped pagination and rejects out-of-scope cursors and forged filters", async () => {
      const first = await read(f.scopedAdmin, { limit: 2 });
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(2);
      const next = await read(f.scopedAdmin, {
        limit: 2,
        cursor: first.body.data.nextCursor,
      });
      expect(next.status).toBe(200);
      const previous = new Set(
        first.body.data.items.map((row: { userId: string }) => row.userId),
      );
      expect(
        next.body.data.items.some((row: { userId: string }) => previous.has(row.userId)),
      ).toBe(false);
      expect((await read(f.scopedAdmin, { cursor: foreign.user.id })).status).toBe(404);
      expect((await read(owner, { role: "CUSTOMER" })).status).toBe(422);
      expect((await read(owner, { capability: "SUPER_ADMIN" })).status).toBe(422);
      expect((await read(owner, { q: "unsafe\nsearch" })).status).toBe(422);
    });
    it("revokes discovery on the same active session as soon as the delegation envelope is removed", async () => {
      expect((await read(f.scopedAdmin)).status).toBe(200);
      await prisma.workforceAccess.update({
        where: { userId: f.scopedAdmin.user.id },
        data: { delegatedTemplates: [], version: { increment: 1 } },
      });
      expect((await read(f.scopedAdmin)).status).toBe(403);
      expect(
        (
          await request(app)
            .get(`/api/v1/admin/workforce/accounts/${f.care.user.id}`)
            .set(f.scopedAdmin.headers)
        ).status,
      ).toBe(403);
      const session = await prisma.session.findUnique({
        where: { id: f.scopedAdmin.record.id },
        select: { revokedAt: true },
      });
      expect(session?.revokedAt).toBeNull();
    });
  },
);
