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
import { productResponseSchema } from "../../src/modules/catalog/product-media.schemas.js";
import { testOwner } from "../helpers/owner.js";
const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/admin/catalog/products";
const sessions: string[] = [];
async function account(role: UserRole = "ADMIN", verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-password")
      : await prisma.user.create({
          data: {
            email: `product-qa-${randomUUID()}@example.test`,
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
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
async function product(active = true) {
  const id = randomUUID();
  return prisma.product.create({
    data: {
      name: `Product QA ${id}`,
      slug: `product-${id}`,
      sku: `QA-${id}`,
      priceKobo: 123456n,
      isActive: active,
      category: {
        create: { name: `Category ${id}`, slug: `category-${id}`, isActive: active },
      },
    },
  });
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "administrator product direct read and observed update",
  () => {
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const)
      for (const active of [true, false])
        it(`${role} reads ${active ? "active" : "inactive"} product and category without a public fallback`, async () => {
          const actor = await account(role),
            row = await product(active);
          const res = await request(app).get(`${endpoint}/${row.id}`).set(actor.headers);
          expect(res.status).toBe(200);
          expect(res.headers["cache-control"]).toBe("private, no-store");
          const parsed = productResponseSchema.parse(res.body.data);
          expect(parsed).toMatchObject({
            id: row.id,
            isActive: active,
            priceKobo: "123456",
            category: { isActive: active },
            images: [],
            compatibilities: [],
            availability: [],
          });
          expect(res.body.data.updatedAt).toBe(row.updatedAt.toISOString());
          expect(res.body.data).not.toHaveProperty("inventories");
          expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
        });
    it("projects media and branch availability without internal storage or stock fields", async () => {
      const actor = await account(),
        row = await product();
      const branch = await prisma.branch.create({
        data: {
          code: `QA-${randomUUID().slice(0, 8)}`,
          name: "Product QA branch",
          address: "Isolated QA address",
          city: "QA city",
          state: "QA state",
        },
      });
      await prisma.inventory.create({
        data: { productId: row.id, branchId: branch.id, quantity: 8, reserved: 3 },
      });
      await prisma.productImage.create({
        data: {
          productId: row.id,
          url: "https://media.example.test/qa.jpg",
        publicId: `qa-internal-${randomUUID()}`,
          altText: "QA part",
          isPrimary: true,
        },
      });
      const res = await request(app).get(`${endpoint}/${row.id}`).set(actor.headers);
      expect(res.status).toBe(200);
      expect(res.body.data.availability).toEqual([
        {
          branch: { id: branch.id, code: branch.code, name: branch.name },
          inStock: true,
        },
      ]);
      expect(res.body.data.images).toHaveLength(1);
      expect(Object.keys(res.body.data.images[0]).sort()).toEqual(
        [
          "id",
          "url",
          "altText",
          "sortOrder",
          "isPrimary",
          "createdAt",
          "source",
          "width",
          "height",
        ].sort(),
      );
      expect(res.body.data).not.toHaveProperty("inventories");
    });
    it("direct read works beyond the filtered first page and rejects list query parameters", async () => {
      const actor = await account(),
        row = await product(),
        prefix = `Paging ${randomUUID()}`;
      await prisma.product.createMany({
        data: Array.from({ length: 27 }, (_, i) => ({
          name: `${prefix} ${String(i).padStart(2, "0")}`,
          slug: `paging-${randomUUID()}`,
          sku: `P-${randomUUID()}`,
          categoryId: row.categoryId,
          priceKobo: 100n,
        })),
      });
      const last = await prisma.product.findFirstOrThrow({
        where: { name: { startsWith: prefix } },
        orderBy: { name: "desc" },
      });
      const page = await request(app)
        .get(endpoint)
        .query({ search: prefix, sort: "name", limit: 25 })
        .set(actor.headers);
      expect(page.status).toBe(200);
      expect(page.body.data.items).toHaveLength(25);
      expect(page.body.data.items.some((v: { id: string }) => v.id === last.id)).toBe(
        false,
      );
      expect(
        (await request(app).get(`${endpoint}/${last.id}`).set(actor.headers)).body.data
          .id,
      ).toBe(last.id);
      expect(
        (
          await request(app)
            .get(`${endpoint}/${last.id}?isActive=false`)
            .set(actor.headers)
        ).status,
      ).toBe(422);
    });
    for (const role of ["STAFF", "CUSTOMER"] as const)
      it(`denies ${role} reads and edits`, async () => {
        const actor = await account(role),
          row = await product();
        expect(
          (await request(app).get(`${endpoint}/${row.id}`).set(actor.headers)).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .patch(`${endpoint}/${row.id}`)
              .set(actor.headers)
              .send({ name: "Denied", expectedUpdatedAt: row.updatedAt.toISOString() })
          ).status,
        ).toBe(403);
      });
    it("denies anonymous and MFA-unverified sessions", async () => {
      const actor = await account("ADMIN", false),
        row = await product();
      expect((await request(app).get(`${endpoint}/${row.id}`)).status).toBe(401);
      expect(
        (await request(app).get(`${endpoint}/${row.id}`).set(actor.headers)).status,
      ).toBe(403);
    });
    it("rejects malformed and missing identifiers", async () => {
      const actor = await account();
      for (const [id, status] of [
        ["invalid", 422],
        [randomUUID(), 404],
      ] as const) {
        const res = await request(app).get(`${endpoint}/${id}`).set(actor.headers);
        expect(res.status).toBe(status);
        expect(res.body.data).toBeUndefined();
      }
    });
    it("read/update/read checks CSRF, changes once, excludes precondition from audit and rejects replay", async () => {
      const actor = await account(),
        row = await product(),
        body = {
          name: "Reviewed product",
          expectedUpdatedAt: row.updatedAt.toISOString(),
        };
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set({ Cookie: actor.headers.Cookie, Origin: actor.headers.Origin })
            .send(body)
        ).status,
      ).toBe(403);
      const save = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set(actor.headers)
        .send(body);
      expect(save.status).toBe(200);
      expect(Date.parse(save.body.data.updatedAt)).toBeGreaterThan(
        row.updatedAt.getTime(),
      );
      expect(
        (await request(app).patch(`${endpoint}/${row.id}`).set(actor.headers).send(body))
          .status,
      ).toBe(409);
      const current = await request(app).get(`${endpoint}/${row.id}`).set(actor.headers);
      expect(current.body.data.name).toBe(body.name);
      const audit = await prisma.auditLog.findMany({ where: { entityId: row.id } });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.newValues).toMatchObject({ changedFields: "name" });
    });
    it("two concurrent reviewed edits produce one winner and one audit", async () => {
      const actor = await account(),
        row = await product();
      const results = await Promise.all(
        ["First", "Second"].map((name) =>
          request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ name, expectedUpdatedAt: row.updatedAt.toISOString() }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = results.find((r) => r.status === 200)!;
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: row.id } })).name,
      ).toBe(winner.body.data.name);
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(1);
    });
    it("advances a future timestamp and prevents a same-snapshot second update", async () => {
      const actor = await account(),
        row = await product(),
        observed = new Date(Date.now() + 60000);
      await prisma.product.update({
        where: { id: row.id },
        data: { updatedAt: observed },
      });
      const save = await request(app)
        .patch(`${endpoint}/${row.id}`)
        .set(actor.headers)
        .send({ brand: "QA", expectedUpdatedAt: observed.toISOString() });
      expect(save.status).toBe(200);
      expect(Date.parse(save.body.data.updatedAt)).toBe(observed.getTime() + 1);
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ brand: "Other", expectedUpdatedAt: observed.toISOString() })
        ).status,
      ).toBe(409);
    });
    it("retains legacy updates while invalidating an older reviewed snapshot", async () => {
      const actor = await account(),
        row = await product();
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ brand: "Legacy" })
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ brand: "Old review", expectedUpdatedAt: row.updatedAt.toISOString() })
        ).status,
      ).toBe(409);
    });
    it("validates timestamp, nonempty fields and price constraints without writes", async () => {
      const actor = await account(),
        row = await product();
      for (const body of [
        { expectedUpdatedAt: row.updatedAt.toISOString() },
        { expectedUpdatedAt: "invalid", name: "No" },
        {
          expectedUpdatedAt: row.updatedAt.toISOString(),
          priceKobo: "1000",
          compareAtPriceKobo: "999",
        },
      ])
        expect(
          (
            await request(app)
              .patch(`${endpoint}/${row.id}`)
              .set(actor.headers)
              .send(body)
          ).status,
        ).toBe(422);
      expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(0);
    });
    it("keeps active-category and comparison-price rules under the new precondition", async () => {
      const actor = await account(),
        row = await product(false);
      expect(
        (
          await request(app)
            .patch(`${endpoint}/${row.id}`)
            .set(actor.headers)
            .send({ isActive: true, expectedUpdatedAt: row.updatedAt.toISOString() })
        ).status,
      ).toBe(409);
      const active = await product();
      await prisma.product.update({
        where: { id: active.id },
        data: { compareAtPriceKobo: 200000n },
      });
      const fresh = await prisma.product.findUniqueOrThrow({ where: { id: active.id } });
      expect(
        (
          await request(app).patch(`${endpoint}/${active.id}`).set(actor.headers).send({
            priceKobo: "300000",
            expectedUpdatedAt: fresh.updatedAt.toISOString(),
          })
        ).status,
      ).toBe(409);
      expect(
        await prisma.auditLog.count({ where: { entityId: { in: [row.id, active.id] } } }),
      ).toBe(0);
    });
  },
);
