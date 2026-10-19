import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { serviceDiscoveryPageSchema } from "../../src/modules/service-operations/service-discovery.openapi.js";
import { serviceCategoryUpdateSchema } from "../../src/modules/service-operations/service-discovery.schemas.js";
import { testOwner } from "../helpers/owner.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { ServiceDiscoveryRepository } from "../../src/modules/service-operations/service-discovery.repository.js";
import { maintainTestServiceSearch } from "../helpers/service-search-maintenance.js";

const app = createApp({ checkReadiness: async () => undefined });
const path = "/api/v1/public/services/discovery",
  categories = "/api/v1/public/services/categories",
  admin = "/api/v1/admin/service-categories";
async function account(role: UserRole, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-password")
      : await prisma.user.create({
          data: {
            email: `service-${randomUUID()}@example.test`,
            passwordHash: "unusable-password",
            role,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiresAt = new Date(Date.now() + 3600000);
  await prisma.session.create({
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
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
async function fixture() {
  const prefix = `Svc-${randomUUID().slice(0, 8)}`;
  const category = await prisma.serviceCategory.create({
    data: { name: prefix, slug: prefix.toLowerCase() },
  });
  const rows = [];
  for (let i = 0; i < 9; i++)
    rows.push(
      await prisma.service.create({
        data: {
          name: `${prefix} ${Math.floor(i / 2)}`,
          slug: `${prefix.toLowerCase()}-${i}`,
          categoryId: category.id,
          pricingType: i % 2 ? "QUOTE_REQUIRED" : "FIXED",
          priceKobo: i % 2 ? null : 10000n,
          durationMinutes: i >= 6 ? null : 30 + Math.floor(i / 2) * 15,
          isActive: i !== 8,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(i / 2))),
        },
      }),
    );
  return { prefix, category, rows };
}
async function page(query: Record<string, string | number | undefined>) {
  const res = await request(app).get(path).query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(JSON.stringify(res.body.data)).not.toMatch(
    /"(?:mediaImages|objectKey|assetToken|bucket|accessKey)"/,
  );
  return serviceDiscoveryPageSchema.parse(res.body.data);
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Service discovery and category authority",
  () => {
    afterAll(() => prisma.$disconnect());
    it.each(["name", "newest", "duration_asc"] as const)(
      "traverses %s ties and nulls with exact totals and compatible UUID anchors",
      async (sort) => {
        const f = await fixture(),
          query = { search: f.prefix, sort };
        const all = await page({ ...query, limit: 50 });
        expect(all.totalMatches).toBe(8);
        const ids: string[] = [];
        let cursor: string | undefined;
        do {
          const result = await page({ ...query, limit: 2, cursor });
          expect(result.totalMatches).toBe(8);
          ids.push(...result.items.map((i) => i.id));
          cursor = result.nextCursor;
          expect(ids.length).toBeLessThanOrEqual(8);
        } while (cursor);
        expect(ids).toEqual(all.items.map((i) => i.id));
        expect(new Set(ids).size).toBe(8);
        expect(
          (await page({ ...query, cursor: ids[0], limit: 50 })).items.map((i) => i.id),
        ).toEqual(ids.slice(1));
        if (sort === "duration_asc")
          expect(all.items.slice(-2).map((i) => i.durationMinutes)).toEqual([null, null]);
        expect((await page({ ...query, pricingType: "FIXED" })).totalMatches).toBe(4);
      },
    );
    it("rejects forged and cross-filter cursors and retains deleted-anchor traversal", async () => {
      const f = await fixture();
      const first = await page({ categoryId: f.category.id, limit: 2 });
      for (const query of [
        { categoryId: f.category.id, cursor: first.nextCursor, sort: "newest" },
        { categoryId: randomUUID(), cursor: first.nextCursor },
        {
          categoryId: f.category.id,
          cursor:
            first.nextCursor!.slice(0, -1) +
            (first.nextCursor!.endsWith("a") ? "b" : "a"),
        },
        { categoryId: f.category.id, cursor: f.rows[8]!.id },
      ])
        expect((await request(app).get(path).query(query)).status).toBe(422);
      await prisma.service.delete({ where: { id: first.items[1]!.id } });
      const rest = await page({ categoryId: f.category.id, cursor: first.nextCursor });
      expect(rest.items).toHaveLength(6);
      expect(rest.totalMatches).toBe(7);
      expect(
        (
          await request(app)
            .get(path)
            .query({ categoryId: f.category.id, cursor: first.items[1]!.id })
        ).status,
      ).toBe(422);
    });
    it("treats SQL-like and wildcard text literally across all searched fields", async () => {
      const f = await fixture();
      for (const field of ["name", "description", "shortDescription"] as const) {
        await prisma.service.update({
          where: { id: f.rows[0]!.id },
          data: { [field]: "Literal%_\\'--" },
        });
        expect(
          (await page({ categoryId: f.category.id, search: " %_\\'-- " })).totalMatches,
        ).toBe(1);
      }
      expect(
        (await page({ categoryId: f.category.id, search: "does not exist" }))
          .totalMatches,
      ).toBe(0);
    });
    it("paginates bounded category options and excludes empty or inactive categories", async () => {
      const f = await fixture();
      const second = await prisma.serviceCategory.create({
        data: { name: `${f.prefix}-Second`, slug: `${f.prefix.toLowerCase()}-second` },
      });
      await prisma.service.update({
        where: { id: f.rows[0]!.id },
        data: { categoryId: second.id },
      });
      await prisma.serviceCategory.create({
        data: { name: `${f.prefix}-Empty`, slug: `${f.prefix.toLowerCase()}-empty` },
      });
      const first = await request(app)
        .get(categories)
        .query({ search: f.prefix.toLowerCase(), limit: 1 });
      expect(first.status).toBe(200);
      expect(first.body.data.items).toHaveLength(1);
      const next = await request(app).get(categories).query({
        search: f.prefix.toLowerCase(),
        cursor: first.body.data.nextCursor,
        limit: 1,
      });
      expect(next.body.data.items.map((i: { id: string }) => i.id)).toEqual([second.id]);
      expect(next.body.data.nextCursor).toBeUndefined();
      expect(
        (
          await request(app)
            .get(categories)
            .query({ search: "Other", cursor: first.body.data.nextCursor })
        ).status,
      ).toBe(422);
      expect((await request(app).get(`${categories}/${second.id}`)).status).toBe(200);
      await prisma.serviceCategory.update({
        where: { id: second.id },
        data: { isActive: false },
      });
      expect((await request(app).get(`${categories}/${second.id}`)).status).toBe(404);
      const visible = await page({ search: f.prefix });
      expect(visible.totalMatches).toBe(8);
      expect(visible.items.find((i) => i.id === f.rows[0]!.id)?.category).toBeNull();
      expect(visible.items.find((i) => i.id === f.rows[0]!.id)?.categoryId).toBeNull();
      expect((await page({ categoryId: second.id })).items).toEqual([]);
      const legacy = await request(app).get(`/api/v1/public/services/${f.rows[0]!.id}`);
      expect(legacy.body.data.category).toBeNull();
    });
    it.each(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
      "enforces %s category permissions, versions and audit",
      async (role) => {
        const actor = await account(role),
          slug = `cat-${randomUUID()}`;
        const allowed = role === "ADMIN" || role === "SUPER_ADMIN";
        const created = await request(app)
          .post(admin)
          .set(actor.headers)
          .send({ name: "Maintenance", slug });
        expect(created.status, JSON.stringify(created.body)).toBe(allowed ? 201 : 403);
        expect((await request(app).get(admin).set(actor.headers)).status).toBe(
          allowed ? 200 : 403,
        );
        const id = allowed ? (created.body.data.id as string) : randomUUID();
        const updated = await request(app)
          .patch(`${admin}/${id}`)
          .set(actor.headers)
          .send({ expectedVersion: 0, isActive: false });
        expect(updated.status).toBe(allowed ? 200 : 403);
        if (!allowed) return;
        expect(
          (
            await request(app)
              .patch(`${admin}/${id}`)
              .set(actor.headers)
              .send({ expectedVersion: 0, name: "Stale" })
          ).status,
        ).toBe(409);
        const renamed = await request(app)
          .patch(`${admin}/${id}`)
          .set(actor.headers)
          .send({ expectedVersion: 1, name: "Archived category" });
        expect(renamed.body.data.isActive).toBe(false);
        expect(
          serviceCategoryUpdateSchema.parse({ expectedVersion: 1, name: "Name" })
            .isActive,
        ).toBeUndefined();
        expect(
          (
            await request(app)
              .post(admin)
              .set(actor.headers)
              .send({ name: "Duplicate", slug })
          ).status,
        ).toBe(409);
        expect(
          await prisma.auditLog.count({
            where: {
              entityType: "SERVICE_CATEGORY",
              entityId: id,
              userId: actor.user.id,
            },
          }),
        ).toBe(3);
      },
    );
    it("requires authentication, privileged MFA and valid CSRF", async () => {
      expect((await request(app).get(admin)).status).toBe(401);
      expect((await request(app).post(admin).send({})).status).toBe(401);
      const pending = await account("ADMIN", false),
        actor = await account("ADMIN");
      expect((await request(app).get(admin).set(pending.headers)).status).toBe(403);
      expect(
        (
          await request(app)
            .post(admin)
            .set({ Cookie: actor.headers.Cookie, Origin: actor.headers.Origin })
            .send({ name: "X", slug: "test" })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .patch(`${admin}/${randomUUID()}`)
            .set({ ...actor.headers, Origin: "https://untrusted.example" })
            .send({ expectedVersion: 0, name: "X" })
        ).status,
      ).toBe(403);
    });
    it("assigns only active categories through real service mutations and permits clearing", async () => {
      const f = await fixture(),
        actor = await account("ADMIN"),
        base = "/api/v1/admin/services";
      const created = await request(app)
        .post(base)
        .set(actor.headers)
        .send({
          name: "Service assignment",
          slug: `assignment-${randomUUID()}`,
          categoryId: f.category.id,
          pricingType: "FIXED",
          priceKobo: "10000",
          durationMinutes: 30,
        });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = created.body.data.id as string;
      expect(
        (await request(app).get(`/api/v1/public/services/${id}`)).body.data.category.id,
      ).toBe(f.category.id);
      await prisma.serviceCategory.update({
        where: { id: f.category.id },
        data: { isActive: false },
      });
      expect(
        (
          await request(app)
            .patch(`${base}/${id}`)
            .set(actor.headers)
            .send({ expectedVersion: 0, categoryId: f.category.id })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .patch(`${base}/${id}`)
            .set(actor.headers)
            .send({ expectedVersion: 0, categoryId: randomUUID() })
        ).status,
      ).toBe(409);
      const cleared = await request(app)
        .patch(`${base}/${id}`)
        .set(actor.headers)
        .send({ expectedVersion: 0, categoryId: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.categoryId).toBeNull();
    });
    it("rejects excessive limits, malformed input and undocumented fields", async () => {
      for (const query of [
        { limit: "51" },
        { limit: "1.0" },
        { limit: "0" },
        { search: "x" },
        { search: "x".repeat(101) },
        { search: "one\ntwo" },
        { categoryId: "bad" },
        { sort: "price" },
        { pricingType: "FREE" },
        { includeInactive: "true" },
        { cursor: "bad" },
      ])
        expect((await request(app).get(path).query(query)).status).toBe(422);
      expect((await request(app).get(categories).query({ limit: 51 })).status).toBe(422);
    });
    it("keeps page and exact count consistent during concurrent unpublication", async () => {
      const f = await fixture();
      let changed = false;
      const db = prisma.$extends({
        query: {
          service: {
            async findMany({ args, query }) {
              const rows = await query(args);
              if (!changed) {
                changed = true;
                await prisma.service.update({
                  where: { id: f.rows[0]!.id },
                  data: { isActive: false },
                });
              }
              return rows;
            },
          },
        },
      });
      const result = await new ServiceDiscoveryRepository(
        db as unknown as PrismaClient,
      ).services({ categoryId: f.category.id, sort: "name", limit: 50 });
      expect(changed).toBe(true);
      expect(result.items).toHaveLength(8);
      expect(result.totalMatches).toBe(8);
      expect((await page({ categoryId: f.category.id })).totalMatches).toBe(7);
    });
    it("returns exact totals and indexed search at representative volume", async () => {
      const prefix = `Volume-${randomUUID().slice(0, 8)}`;
      await prisma.service.createMany({
        data: Array.from({ length: 10000 }, (_, i) => ({
          name: `${prefix} ${i}`,
          slug: `${prefix.toLowerCase()}-${i}`,
          pricingType: "FIXED" as const,
          priceKobo: 1000n,
          durationMinutes: 30,
        })),
      });
      const started = performance.now();
      const result = await page({ search: prefix, limit: 12 });
      expect(result.totalMatches).toBe(10000);
      expect(result.items).toHaveLength(12);
      const next = await page({ search: prefix, limit: 12, cursor: result.nextCursor });
      expect(new Set([...result.items, ...next.items].map((i) => i.id)).size).toBe(24);
      const indexes = await prisma.$queryRaw<
        { indexname: string }[]
      >`SELECT indexname FROM pg_indexes WHERE tablename = 'Service' AND indexname LIKE '%search_idx'`;
      expect(indexes.map((i) => i.indexname).sort()).toEqual([
        "Service_description_search_idx",
        "Service_name_search_idx",
        "Service_shortDescription_search_idx",
      ]);
      // Exercise the maintained GIN index after bulk insertion; pending entries
      // otherwise make plan selection depend on whether autovacuum has run yet.
      await maintainTestServiceSearch();
      const pattern = `%${prefix} 9999%`;
      const plan =
        await prisma.$queryRaw`EXPLAIN (FORMAT JSON) SELECT id FROM "Service" WHERE "isActive" = true AND (name ILIKE ${pattern} OR description ILIKE ${pattern} OR "shortDescription" ILIKE ${pattern})`;
      expect(JSON.stringify(plan)).toContain("Service_name_search_idx");
      console.info(
        `10,000 services: two pages and exact totals in ${(performance.now() - started).toFixed(1)} ms`,
      );
    }, 30000);
  },
);
