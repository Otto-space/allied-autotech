import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import sharp from "sharp";
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
import {
  adminServicePageSchema,
  adminServiceSchema,
} from "../../src/modules/service-operations/service-operations.openapi.js";
import { ServiceMediaService } from "../../src/modules/service-operations/service-media.service.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
import { testOwner } from "../helpers/owner.js";

const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/admin/services";
const sessions: string[] = [];

async function account(role: UserRole = "ADMIN", verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-password")
      : await prisma.user.create({
          data: {
            email: `admin-service-${randomUUID()}@example.test`,
            passwordHash: "unusable-password",
            role,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 3_600_000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: new Date(Date.now() - 1_000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  sessions.push(session.id);
  return {
    user,
    session,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
async function fixture(count = 7) {
  const prefix = `AdminSvc-${randomUUID().slice(0, 8)}`;
  const category = await prisma.serviceCategory.create({
    data: { name: prefix, slug: prefix.toLowerCase() },
  });
  await prisma.service.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      name: `${prefix} ${i}`,
      slug: `${prefix.toLowerCase()}-${i}`,
      categoryId: category.id,
      pricingType: i % 2 ? ("QUOTE_REQUIRED" as const) : ("FIXED" as const),
      priceKobo: i % 2 ? null : 123456n,
      durationMinutes: i === 0 ? null : 30,
      isActive: i % 3 !== 0,
    })),
  });
  const rows = await prisma.service.findMany({
    where: { categoryId: category.id },
    orderBy: { id: "asc" },
  });
  return { prefix, category, rows };
}
async function page(
  headers: Record<string, string>,
  query: Record<string, string | number | undefined> = {},
) {
  const res = await request(app).get(endpoint).set(headers).query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expect(res.headers["cache-control"]).toContain("no-store");
  expect(JSON.stringify(res.body.data)).not.toMatch(
    /"(?:mediaImages|objectKey|assetToken|bucket|accessKey)"/,
  );
  return adminServicePageSchema.parse(res.body.data);
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Administrator service catalogue",
  () => {
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });

    it("searches the full catalogue and combines category, pricing and visibility filters", async () => {
      const a = await account(),
        f = await fixture(31);
      const all = await page(a.headers, {
        search: `  ${f.prefix.toLowerCase()}  `,
        categoryId: f.category.id,
        limit: 100,
      });
      expect(all.items.map((r) => r.id)).toEqual(f.rows.map((r) => r.id));
      const found: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await page(a.headers, {
          search: f.prefix,
          categoryId: f.category.id,
          limit: 5,
          cursor,
        });
        found.push(...result.items.map((r) => r.id));
        cursor = result.nextCursor;
        expect(found.length).toBeLessThanOrEqual(31);
      } while (cursor);
      expect(found).toEqual(all.items.map((r) => r.id));
      for (const isActive of [true, false])
        for (const pricingType of ["FIXED", "QUOTE_REQUIRED"] as const) {
          const result = await page(a.headers, {
            search: f.prefix,
            categoryId: f.category.id,
            isActive: String(isActive),
            pricingType,
            limit: 100,
          });
          expect(result.items.map((r) => r.id)).toEqual(
            f.rows
              .filter((r) => r.isActive === isActive && r.pricingType === pricingType)
              .map((r) => r.id),
          );
        }
      expect(
        (await page(a.headers, { search: f.prefix, categoryId: randomUUID() })).items,
      ).toEqual([]);
    });

    it.each(["name", "shortDescription", "description"] as const)(
      "treats wildcard and SQL-like text literally in %s",
      async (field) => {
        const a = await account(),
          f = await fixture();
        await prisma.service.update({
          where: { id: f.rows[0]!.id },
          data: { [field]: "Literal%_\\'--" },
        });
        expect(
          (
            await page(a.headers, { search: "%_\\'--", categoryId: f.category.id })
          ).items.map((r) => r.id),
        ).toEqual([f.rows[0]!.id]);
        expect(
          (await page(a.headers, { search: "No match", categoryId: f.category.id }))
            .items,
        ).toEqual([]);
      },
    );

    it("keeps UUID paging compatible and continues after an anchor changes or is deleted", async () => {
      const a = await account(),
        f = await fixture();
      const first = await page(a.headers, { categoryId: f.category.id, limit: 2 });
      expect(first.nextCursor).toBe(f.rows[1]!.id);
      const expected = f.rows.slice(2).map((r) => r.id);
      await prisma.service.update({
        where: { id: first.nextCursor! },
        data: { categoryId: null },
      });
      expect(
        (
          await page(a.headers, { categoryId: f.category.id, cursor: first.nextCursor })
        ).items.map((r) => r.id),
      ).toEqual(expected);
      await prisma.service.delete({ where: { id: first.nextCursor! } });
      expect(
        (
          await page(a.headers, { categoryId: f.category.id, cursor: first.nextCursor })
        ).items.map((r) => r.id),
      ).toEqual(expected);
      // Existing clients can still use only pricing, status, limit and UUID cursor.
      const legacy = await page(a.headers, {
        pricingType: "FIXED",
        isActive: "true",
        limit: 1,
      });
      expect(legacy.items).toHaveLength(1);
      expect(
        (
          await page(a.headers, {
            pricingType: "FIXED",
            isActive: "true",
            limit: 1,
            cursor: legacy.items[0]!.id,
          })
        ).items.every((r) => r.id > legacy.items[0]!.id),
      ).toBe(true);
    });

    it.each(["ADMIN", "SUPER_ADMIN"] as const)(
      "lets %s read inactive services and categories directly",
      async (role) => {
        const a = await account(role),
          f = await fixture();
        await prisma.serviceCategory.update({
          where: { id: f.category.id },
          data: { isActive: false },
        });
        const row = f.rows.find((r) => !r.isActive)!;
        const res = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toContain("no-store");
        const detail = adminServiceSchema.parse(res.body.data);
        expect(detail).toMatchObject({
          id: row.id,
          name: row.name,
          version: row.version,
          isActive: false,
          image: null,
          categoryId: f.category.id,
          category: { id: f.category.id },
        });
        expect(
          (
            await page(a.headers, { categoryId: f.category.id, isActive: "false" })
          ).items.map((r) => r.id),
        ).toContain(row.id);
        expect((await request(app).get(`/api/v1/public/services/${row.id}`)).status).toBe(
          404,
        );
      },
    );

    it.each(["CUSTOMER", "STAFF"] as const)(
      "denies %s list and direct record reads",
      async (role) => {
        const a = await account(role),
          f = await fixture(1);
        for (const path of [endpoint, `${endpoint}/${f.rows[0]!.id}`]) {
          const res = await request(app).get(path).set(a.headers);
          expect(res.status).toBe(403);
          expect(res.body.data).toBeUndefined();
        }
      },
    );

    it("requires authentication and verified MFA before either read", async () => {
      const a = await account("ADMIN", false),
        f = await fixture(1);
      for (const path of [endpoint, `${endpoint}/${f.rows[0]!.id}`]) {
        expect((await request(app).get(path)).status).toBe(401);
        expect((await request(app).get(path).set(a.headers)).status).toBe(403);
      }
    });

    it("rejects malformed, repeated, oversized and unexpected inputs", async () => {
      const a = await account();
      for (const query of [
        { search: "x" },
        { search: " " },
        { search: "x".repeat(101) },
        { search: "ab\ncd" },
        { search: ["first", "second"] },
        { categoryId: "invalid" },
        { cursor: "invalid" },
        { limit: 101 },
        { sort: "name" },
      ]) {
        expect(
          (await request(app).get(endpoint).set(a.headers).query(query)).status,
        ).toBe(422);
      }
      expect((await request(app).get(`${endpoint}/invalid`).set(a.headers)).status).toBe(
        422,
      );
      expect(
        (await request(app).get(`${endpoint}/${randomUUID()}`).set(a.headers)).status,
      ).toBe(404);
      expect(
        (await request(app).get(`${endpoint}/${randomUUID()}?extra=1`).set(a.headers))
          .status,
      ).toBe(422);
    });

    it("returns current revisions and preserves PATCH conflict and CSRF checks", async () => {
      const a = await account(),
        f = await fixture(1),
        row = f.rows[0]!;
      await prisma.service.update({ where: { id: row.id }, data: { categoryId: null } });
      const read = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
      expect(adminServiceSchema.parse(read.body.data)).toMatchObject({
        category: null,
        categoryId: null,
        image: null,
        durationMinutes: null,
      });
      const body = { expectedVersion: row.version, name: `${f.prefix} updated` };
      const denied = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set({ Cookie: a.headers.Cookie, Origin: a.headers.Origin })
        .send(body);
      expect(denied.status).toBe(403);
      const saved = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set(a.headers)
        .send(body);
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(
        (await request(app).patch(`${endpoint}/${row.id}`).set(a.headers).send(body))
          .status,
      ).toBe(409);
      const current = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
      expect(adminServiceSchema.parse(current.body.data)).toMatchObject({
        name: body.name,
        version: row.version + 1,
      });
      expect(
        await prisma.auditLog.count({ where: { entityId: row.id, action: "UPDATE" } }),
      ).toBe(1);
    });

    it("uses existing search indexes at representative catalogue volume", async () => {
      const a = await account(),
        f = await fixture(10_000);
      // Supply our own unrelated catalogue baseline. With only this fixture,
      // PostgreSQL can correctly prefer a small sequential scan; relying on
      // another test file's rows makes the index-use assertion order-dependent.
      await fixture(10_000);
      const needle = `${f.prefix} 9999`;
      const result = await page(a.headers, { search: needle, limit: 25 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.name).toBe(needle);
      // Clear the GIN pending list and update statistics after the synthetic bulk load.
      // No planner setting is forced: this exercises the normal index choice.
      await prisma.$executeRaw`VACUUM (ANALYZE) "Service"`;
      const pattern = `%${needle}%`;
      const plan = await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM "Service"
      WHERE name ILIKE ${pattern} OR "shortDescription" ILIKE ${pattern} OR description ILIKE ${pattern}
      ORDER BY id ASC LIMIT 26`;
      expect(JSON.stringify(plan)).toContain("Service_name_search_idx");
      console.info(`Administrator search plan: ${JSON.stringify(plan)}`);
    }, 60_000);

    it("projects authorized image metadata without exposing storage internals", async () => {
      const a = await account(),
        f = await fixture(1),
        row = f.rows[0]!;
      const storage = new MemoryMediaStorage();
      const media = new ServiceMediaService(prisma, storage);
      const actor = {
        userId: a.user.id,
        email: a.user.email,
        role: "ADMIN" as const,
        sessionId: a.session.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
      const bytes = await sharp({
        create: { width: 96, height: 64, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const ticket = await media.prepare(
        actor,
        row.id,
        {
          mimeType: "image/png",
          sizeBytes: bytes.length,
          checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        },
        context,
      );
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      const attached = await media.confirm(
        actor,
        row.id,
        {
          assetToken: ticket.assetToken,
          expectedVersion: row.version,
          altText: "Synthetic service photograph",
        },
        context,
      );
      const res = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
      expect(res.status).toBe(200);
      const detail = adminServiceSchema.parse(res.body.data);
      expect(detail.image).toMatchObject({
        id: attached.images[0]!.id,
        url: `/api/v1/admin/services/${row.id}/images/${attached.images[0]!.id}/content`,
        altText: "Synthetic service photograph",
      });
      expect(JSON.stringify(res.body.data)).not.toMatch(
        /"(?:mediaImages|objectKey|assetToken|bucket|accessKey|checksumSha256)"/,
      );
      expect((await request(app).get(`/api/v1/public/services/${row.id}`)).status).toBe(
        404,
      );
    });
  },
);
