import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";

const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/admin/catalog/categories";
const sessions: string[] = [];
async function account(role: UserRole = "ADMIN", verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-password")
      : await prisma.user.create({
          data: {
            email: `category-qa-${randomUUID()}@example.test`,
            passwordHash: "unusable-password",
            role,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiresAt = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: new Date(Date.now() - 1000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  sessions.push(session.id);
  return {
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
function category(active = true, name = `Category QA ${randomUUID()}`) {
  return prisma.category.create({
    data: { name, slug: `category-${randomUUID()}`, isActive: active },
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator product categories",
  () => {
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string }[]
      >`SELECT current_database() AS database`;
      expect(actual?.database).toBe(env.DB_NAME);
      expect(actual?.database).toMatch(/_(test|ci)$/);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const)
      for (const active of [true, false]) {
        it(`${role} reads ${active ? "active" : "inactive"} categories privately without audit`, async () => {
          const actor = await account(role),
            row = await category(active);
          const res = await request(app).get(`${endpoint}/${row.id}`).set(actor.headers);
          expect(res.status).toBe(200);
          expect(res.headers["cache-control"]).toBe("private, no-store");
          expect(res.body.data).toEqual({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: null,
            isActive: active,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          });
          expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
        });
      }
    for (const role of ["STAFF", "CUSTOMER"] as const)
      it(`denies ${role} list, direct read and update`, async () => {
        const actor = await account(role),
          row = await category();
        expect((await request(app).get(endpoint).set(actor.headers)).status).toBe(403);
        expect(
          (await request(app).get(`${endpoint}/${row.id}`).set(actor.headers)).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .patch(`${endpoint}/${row.id}`)
              .set(actor.headers)
              .send({ name: "Denied" })
          ).status,
        ).toBe(403);
        expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
      });
    it("searches case-insensitive literal name prefixes with visibility and stable name/ID ties", async () => {
      const actor = await account(),
        prefix = `Prefix ${randomUUID()}`;
      const a = await category(true, `${prefix} A`),
        b = await category(false, `${prefix} B`),
        c = await category(true, `${prefix} C`);
      await category(true, `Other ${prefix}`);
      const first = await request(app)
        .get(endpoint)
        .query({ search: prefix.toLowerCase(), limit: 1 })
        .set(actor.headers);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items.map((r: { id: string }) => r.id)).toEqual([a.id]);
      expect(first.body.data.nextCursor).toBe(a.id);
      const second = await request(app)
        .get(endpoint)
        .query({ search: prefix, limit: 2, cursor: a.id })
        .set(actor.headers);
      expect(second.body.data.items.map((r: { id: string }) => r.id)).toEqual([
        b.id,
        c.id,
      ]);
      const inactive = await request(app)
        .get(endpoint)
        .query({ search: prefix, isActive: "false" })
        .set(actor.headers);
      expect(inactive.body.data.items.map((r: { id: string }) => r.id)).toEqual([b.id]);
      expect(
        (await request(app).get(`${endpoint}/${c.id}`).set(actor.headers)).body.data.id,
      ).toBe(c.id);
    });
    it("treats percent, underscore and backslash as literal search characters", async () => {
      const actor = await account(),
        prefix = `Literal ${randomUUID()}`;
      for (const suffix of ["%", "_", "\\"]) {
        const row = await category(true, `${prefix}${suffix} literal`);
        await category(true, `${prefix}X alternate`);
        const response = await request(app)
          .get(endpoint)
          .query({ search: prefix + suffix })
          .set(actor.headers);
        expect(response.status).toBe(200);
        expect(response.body.data.items.map((r: { id: string }) => r.id)).toEqual([
          row.id,
        ]);
      }
    });
    it("reads beyond the first full page and rejects missing records and invalid queries", async () => {
      const actor = await account(),
        prefix = `Paging ${randomUUID()}`;
      for (let n = 0; n < 27; n++)
        await category(true, `${prefix} ${String(n).padStart(2, "0")}`);
      const list = await request(app)
        .get(endpoint)
        .query({ search: prefix })
        .set(actor.headers);
      expect(list.body.data.items).toHaveLength(25);
      const last = await prisma.category.findFirstOrThrow({
        where: { name: { startsWith: prefix } },
        orderBy: { name: "desc" },
      });
      expect(
        (await request(app).get(`${endpoint}/${last.id}`).set(actor.headers)).body.data
          .id,
      ).toBe(last.id);
      expect(
        (await request(app).get(`${endpoint}/${randomUUID()}`).set(actor.headers)).status,
      ).toBe(404);
      expect(
        (await request(app).get(`${endpoint}/invalid`).set(actor.headers)).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get(`${endpoint}/${last.id}?isActive=false`)
            .set(actor.headers)
        ).status,
      ).toBe(422);
      for (const query of [
        { search: "X".repeat(121) },
        { search: "bad\nname" },
        { search: ["one", "two"] },
        { unknown: "value" },
      ])
        expect(
          (await request(app).get(endpoint).query(query).set(actor.headers)).status,
        ).toBe(422);
    });
    it("requires MFA/session and CSRF without changing the category", async () => {
      const actor = await account(),
        unverified = await account("ADMIN", false),
        row = await category();
      expect((await request(app).get(`${endpoint}/${row.id}`)).status).toBe(401);
      expect(
        (await request(app).get(`${endpoint}/${row.id}`).set(unverified.headers)).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set({ Cookie: actor.headers.Cookie, Origin: actor.headers.Origin })
            .send({ name: "No CSRF" })
        ).status,
      ).toBe(403);
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
    });
    it("checks observed timestamps atomically and records only changed domain fields", async () => {
      const actor = await account(),
        row = await category();
      const responses = await Promise.all(
        ["First", "Second"].map((name) =>
          request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({
              name,
              description: null,
              expectedUpdatedAt: row.updatedAt.toISOString(),
            }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = responses.find((r) => r.status === 200)!;
      expect(Date.parse(winner.body.data.updatedAt)).toBeGreaterThan(
        row.updatedAt.getTime(),
      );
      const audits = await prisma.auditLog.findMany({ where: { entityId: row.id } });
      expect(audits).toHaveLength(1);
      expect(audits[0]?.newValues).toMatchObject({
        resourceType: "CATEGORY",
        changedFields: "description,name",
      });
    });
    it("advances future timestamps and preserves legacy writes while invalidating old reviews", async () => {
      const actor = await account(),
        row = await category(),
        future = new Date(Date.now() + 60000);
      await prisma.category.update({
        where: { id: row.id },
        data: { updatedAt: future },
      });
      const legacy = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set(actor.headers)
        .send({ description: "Legacy edit" });
      expect(legacy.status).toBe(200);
      expect(Date.parse(legacy.body.data.updatedAt)).toBe(future.getTime() + 1);
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ name: "Stale", expectedUpdatedAt: future.toISOString() })
        ).status,
      ).toBe(409);
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(1);
    });
    it("rejects an invalid or standalone precondition and preserves active-product deactivation rules", async () => {
      const actor = await account(),
        row = await category();
      for (const body of [
        { expectedUpdatedAt: row.updatedAt.toISOString() },
        { name: "Bad date", expectedUpdatedAt: "2026-10-13" },
        { name: "Bad precision", expectedUpdatedAt: "2026-10-13T08:00:00Z" },
      ])
        expect(
          (
            await request(app)
              .patch(`${endpoint}/${row.id}`)
              .set(actor.headers)
              .send(body)
          ).status,
        ).toBe(422);
      const product = await prisma.product.create({
        data: {
          name: "Active QA product",
          slug: `p-${randomUUID()}`,
          sku: `P-${randomUUID()}`,
          categoryId: row.id,
          priceKobo: 100n,
        },
      });
      const update = () =>
        request(app)
          .patch(`${endpoint}/${row.id}`)
          .set(actor.headers)
          .send({ isActive: false, expectedUpdatedAt: row.updatedAt.toISOString() });
      expect((await update()).status).toBe(409);
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
      await prisma.product.update({
        where: { id: product.id },
        data: { isActive: false },
      });
      expect((await update()).status).toBe(200);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).isActive,
      ).toBe(false);
    });
    it("product activation waits for an in-flight category deactivation and rechecks eligibility", async () => {
      const actor = await account(),
        row = await category();
      const product = await prisma.product.create({
        data: {
          name: "Inactive QA product",
          slug: `p-${randomUUID()}`,
          sku: `P-${randomUUID()}`,
          categoryId: row.id,
          priceKobo: 100n,
          isActive: false,
        },
      });
      let entered!: () => void, release!: () => void;
      const ready = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const archive = prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`category:${row.id}`}, 0))`;
          await tx.category.update({ where: { id: row.id }, data: { isActive: false } });
          entered();
          await hold;
        },
        { timeout: 10000 },
      );
      await ready;
      const activation = request(app)
        .patch(`/api/v1/admin/catalog/products/${product.id}`)
        .set(actor.headers)
        .send({ isActive: true, expectedUpdatedAt: product.updatedAt.toISOString() })
        .then((response) => response);
      try {
        let waiting = false;
        for (let i = 0; i < 100 && !waiting; i++) {
          const [lock] = await prisma.$queryRaw<
            { waiting: boolean }[]
          >`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND objid = ((hashtextextended(${`category:${row.id}`}, 0) & 4294967295)::oid)) AS waiting`;
          waiting = lock?.waiting === true;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
        await archive;
      }
      expect((await activation).status).toBe(409);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).isActive,
      ).toBe(false);
      expect(await prisma.auditLog.count({ where: { entityId: product.id } })).toBe(0);
    });
  },
);
