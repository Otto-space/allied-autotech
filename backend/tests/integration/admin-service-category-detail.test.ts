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
import { adminServiceCategorySchema } from "../../src/modules/service-operations/service-discovery.schemas.js";
import { testOwner } from "../helpers/owner.js";
const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/admin/service-categories";
const sessions: string[] = [];

async function account(role: UserRole = "ADMIN", verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-password")
      : await prisma.user.create({
          data: {
            email: `admin-category-${randomUUID()}@example.test`,
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

async function category(isActive = true) {
  const name = `Category QA ${randomUUID()}`;
  return prisma.serviceCategory.create({
    data: { name, slug: name.toLowerCase().replaceAll(" ", "-"), isActive },
  });
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator category direct read",
  () => {
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
      for (const active of [true, false])
        it(`${role} reads ${active ? "active" : "inactive"} empty category with current safe fields`, async () => {
          const a = await account(role),
            row = await category(active);
          const auditBefore = await prisma.auditLog.count({
            where: { entityId: row.id },
          });
          const res = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
          expect(res.status).toBe(200);
          expect(res.headers["cache-control"]).toBe("private, no-store");
          const parsed = adminServiceCategorySchema.parse(res.body.data);
          expect(parsed).toMatchObject({
            id: row.id,
            name: row.name,
            slug: row.slug,
            isActive: active,
            description: null,
            version: 0,
          });
          expect(Object.keys(res.body.data).sort()).toEqual(
            [
              "id",
              "name",
              "slug",
              "description",
              "isActive",
              "version",
              "createdAt",
              "updatedAt",
            ].sort(),
          );
          expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(
            auditBefore,
          );
        });
    }
    it("reads a category outside the first filtered page and rejects foreign list parameters", async () => {
      const a = await account(),
        prefix = `Category page ${randomUUID()}`;
      await prisma.serviceCategory.createMany({
        data: Array.from({ length: 27 }, (_, i) => ({
          name: `${prefix} ${String(i).padStart(2, "0")}`,
          slug: `${prefix.toLowerCase().replaceAll(" ", "-")}-${i}`,
        })),
      });
      const last = await prisma.serviceCategory.findFirstOrThrow({
        where: { name: { startsWith: prefix } },
        orderBy: { name: "desc" },
      });
      const page = await request(app)
        .get(endpoint)
        .query({ search: prefix, limit: 25 })
        .set(a.headers);
      expect(page.status).toBe(200);
      expect(page.body.data.items).toHaveLength(25);
      expect(page.body.data.items.some((v: { id: string }) => v.id === last.id)).toBe(
        false,
      );
      const res = await request(app).get(`${endpoint}/${last.id}`).set(a.headers);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(last.id);
      expect(
        (await request(app).get(`${endpoint}/${last.id}?isActive=false`).set(a.headers))
          .status,
      ).toBe(422);
    });
    for (const role of ["CUSTOMER", "STAFF"] as const)
      it(`denies ${role}`, async () => {
        const a = await account(role),
          row = await category();
        const res = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
        expect(res.status).toBe(403);
        expect(res.body.data).toBeUndefined();
      });
    it("denies anonymous and unverified administrator sessions", async () => {
      const row = await category(),
        a = await account("ADMIN", false);
      expect((await request(app).get(`${endpoint}/${row.id}`)).status).toBe(401);
      expect(
        (await request(app).get(`${endpoint}/${row.id}`).set(a.headers)).status,
      ).toBe(403);
    });
    it("rejects malformed and unknown identifiers without exposing a record", async () => {
      const a = await account();
      for (const [id, status] of [
        ["not-a-uuid", 422],
        [randomUUID(), 404],
      ] as const) {
        const res = await request(app).get(`${endpoint}/${id}`).set(a.headers);
        expect(res.status).toBe(status);
        expect(res.body.data).toBeUndefined();
      }
    });
    it("read/update/read preserves atomic revision, audit and grouping semantics", async () => {
      const a = await account(),
        row = await category();
      const service = await prisma.service.create({
        data: {
          name: row.name,
          slug: row.slug,
          categoryId: row.id,
          pricingType: "QUOTE_REQUIRED",
          isActive: true,
        },
      });
      const read = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
      const body = {
        description: "Updated category description",
        isActive: false,
        expectedVersion: read.body.data.version,
      };
      const noCsrf = { Cookie: a.headers.Cookie, Origin: a.headers.Origin };
      expect(
        (await request(app).patch(`${endpoint}/${row.id}`).set(noCsrf).send(body)).status,
      ).toBe(403);
      const save = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set(a.headers)
        .send(body);
      expect(save.status).toBe(200);
      expect(
        (await request(app).patch(`${endpoint}/${row.id}`).set(a.headers).send(body))
          .status,
      ).toBe(409);
      const current = await request(app).get(`${endpoint}/${row.id}`).set(a.headers);
      expect(current.body.data).toMatchObject({
        id: row.id,
        isActive: false,
        version: 1,
        description: body.description,
      });
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(1);
      expect(
        await prisma.service.findUnique({ where: { id: service.id } }),
      ).toMatchObject({ isActive: true, categoryId: row.id });
      expect(
        (await request(app).get(`/api/v1/public/services/categories/${row.id}`)).status,
      ).toBe(404);
    });
  },
);
