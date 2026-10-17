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
import { testOwner } from "../helpers/owner.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/staff/inventory",
  sessions: string[] = [];
async function account(role: UserRole, branchId?: string, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-qa-only")
      : await prisma.user.create({
          data: {
            email: `order-discovery-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      ...(branchId ? { branchId } : {}),
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiry = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
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
const branch = (active = true) =>
  prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 10),
      name: "Synthetic discovery workshop",
      address: "Test",
      city: "Test",
      state: "Test",
      isActive: active,
    },
  });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "staff inventory discovery",
  () => {
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database, host(inet_server_addr()) AS host, inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("searches literal names and SKUs across inactive records with stable paging and combined filters", async () => {
      const own = await branch(),
        historical = await branch(false),
        admin = await account("ADMIN");
      const category = await prisma.category.create({
        data: { name: "Synthetic inventory", slug: randomUUID() },
      });
      const prefix = randomUUID().slice(0, 8);
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: prefix + " Brake 50%_parts",
          sku: prefix + "-BP-001",
          slug: randomUUID(),
          priceKobo: 10000n,
          isActive: false,
        },
      });
      const first = await prisma.inventory.create({
        data: {
          productId: product.id,
          branchId: own.id,
          quantity: 10,
          reserved: 2,
          reorderLevel: 8,
        },
      });
      const second = await prisma.inventory.create({
        data: {
          productId: product.id,
          branchId: historical.id,
          quantity: 20,
          reserved: 2,
          reorderLevel: 5,
        },
      });
      const read = (query: object) =>
        request(app).get(endpoint).set(admin.headers).query(query);
      const found = await read({ search: prefix.toUpperCase(), limit: 1 });
      expect(found.status).toBe(200);
      expect(found.headers["cache-control"]).toBe("private, no-store");
      expect(found.body.data.items).toHaveLength(1);
      expect(found.body.data.nextCursor).toBe(found.body.data.items[0].id);
      const next = await read({
        search: prefix,
        limit: 1,
        cursor: found.body.data.nextCursor,
      });
      expect(
        new Set([...found.body.data.items, ...next.body.data.items].map((row) => row.id)),
      ).toEqual(new Set([first.id, second.id]));
      const low = await read({ search: prefix, lowStock: "true", productId: product.id });
      expect(low.body.data.items.map((row) => row.id)).toEqual([first.id]);
      expect(low.body.data.items[0].available).toBe(8);
      expect(
        (
          await read({ search: prefix + "-bp-001", branchId: historical.id })
        ).body.data.items.map((row) => row.id),
      ).toEqual([second.id]);
      expect(
        (await read({ search: "50%_parts", productId: product.id })).body.data.items,
      ).toHaveLength(2);
      expect(
        (await read({ search: "50XXparts", productId: product.id })).body.data.items,
      ).toHaveLength(0);
    });
    it("keeps Staff in its active branch and rejects unauthorized or invalid searches", async () => {
      const own = await branch(),
        foreign = await branch(),
        staff = await account("STAFF", own.id),
        missing = await account("STAFF"),
        unverified = await account("STAFF", own.id, false),
        customer = await account("CUSTOMER"),
        admin = await account("ADMIN");
      const category = await prisma.category.create({
          data: { name: "Synthetic inventory", slug: randomUUID() },
        }),
        prefix = randomUUID();
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: prefix,
          sku: randomUUID(),
          slug: randomUUID(),
          priceKobo: 100n,
        },
      });
      const a = await prisma.inventory.create({
        data: { branchId: own.id, productId: product.id },
      });
      await prisma.inventory.create({
        data: { branchId: foreign.id, productId: product.id },
      });
      expect(
        (
          await request(app)
            .get(endpoint)
            .set(staff.headers)
            .query({ search: prefix, branchId: foreign.id })
        ).body.data.items.map((row) => row.id),
      ).toEqual([a.id]);
      for (const actor of [missing, unverified, customer])
        expect((await request(app).get(endpoint).set(actor.headers)).status).toBe(403);
      expect((await request(app).get(endpoint)).status).toBe(401);
      for (const search of [" ", "x".repeat(101), "a\u0001b"])
        expect(
          (await request(app).get(endpoint).set(admin.headers).query({ search })).status,
        ).toBe(422);
      expect(
        (
          await request(app)
            .get(endpoint + "?search=a&search=b")
            .set(admin.headers)
        ).status,
      ).toBe(422);
      await prisma.branch.update({ where: { id: own.id }, data: { isActive: false } });
      expect((await request(app).get(endpoint).set(staff.headers)).status).toBe(403);
      expect(await prisma.inventory.findUnique({ where: { id: a.id } })).not.toBeNull();
    });
    it("keeps detail, reservations and history private and enforces current branch access", async () => {
      const own = await branch(),
        other = await branch(),
        admin = await account("ADMIN"),
        staff = await account("STAFF", own.id),
        foreign = await account("STAFF", other.id),
        category = await prisma.category.create({
          data: { name: "Synthetic detail", slug: randomUUID() },
        }),
        product = await prisma.product.create({
          data: {
            name: "Synthetic detail part",
            slug: randomUUID(),
            sku: randomUUID(),
            categoryId: category.id,
            priceKobo: 10000n,
          },
        }),
        inventory = await prisma.inventory.create({
          data: { productId: product.id, branchId: own.id, quantity: 10, reserved: 2 },
        });
      for (const suffix of ["", "/history", "/reservations"]) {
        const url = endpoint + "/" + inventory.id + suffix;
        const allowed = await request(app).get(url).set(staff.headers);
        expect(allowed.status).toBe(200);
        expect(allowed.headers["cache-control"]).toBe("private, no-store");
        expect((await request(app).get(url).set(foreign.headers)).status).toBe(403);
      }
      const updated = await request(app)
        .patch(endpoint + "/" + inventory.id)
        .set(admin.headers)
        .send({ reorderLevel: 11, expectedVersion: 0 });
      expect(updated.status).toBe(200);
      expect(updated.headers["cache-control"]).toBe("private, no-store");
      await prisma.branch.update({ where: { id: own.id }, data: { isActive: false } });
      for (const suffix of ["", "/history", "/reservations"]) {
        const url = endpoint + "/" + inventory.id + suffix;
        expect((await request(app).get(url).set(staff.headers)).status).toBe(403);
        expect((await request(app).get(url).set(admin.headers)).status).toBe(200);
      }
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: inventory.id } }))
          .quantity,
      ).toBe(10);
    });
  },
);
