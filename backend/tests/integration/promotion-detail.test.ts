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
const endpoint = "/api/v1/admin/promotions",
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

const body = () => ({
  name: `Detail QA ${randomUUID()}`,
  code: null,
  description: null,
  discountType: "PERCENTAGE",
  percentageBasisPoints: 1234,
  fixedAmountKobo: null,
  minimumOrderAmountKobo: "0",
  maximumDiscountAmountKobo: "9999999999999999",
  usageLimit: 100,
  perCustomerLimit: 1,
  startsAt: "2026-10-17T09:00:37.100Z",
  endsAt: "2026-11-17T09:00:37.200Z",
  isActive: false,
});
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "promotion direct detail and versioned updates",
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
    it("persists zero configuration while checkout remains ineligible and negative values remain forbidden", async () => {
      const admin = await account("ADMIN"),
        customer = await account("CUSTOMER");
      for (const fixed of [false, true]) {
        const input = {
          ...body(),
          code: `ZERO-${randomUUID()}`,
          isActive: true,
          discountType: fixed ? "FIXED_AMOUNT" : "PERCENTAGE",
          percentageBasisPoints: fixed ? null : 1234,
          fixedAmountKobo: fixed ? "0" : null,
          maximumDiscountAmountKobo: fixed ? null : "0",
        };
        const saved = await request(app).post(endpoint).set(admin.headers).send(input);
        expect(saved.status).toBe(201);
        expect(saved.body.data).toMatchObject({
          fixedAmountKobo: input.fixedAmountKobo,
          maximumDiscountAmountKobo: input.maximumDiscountAmountKobo,
        });
        const preview = await request(app)
          .post("/api/v1/customers/promotions/preview")
          .set(customer.headers)
          .send({ code: input.code, subtotalKobo: "100000" });
        expect(preview.status).toBe(409);
        await expect(
          prisma.promotion.update({
            where: { id: saved.body.data.id },
            data: fixed ? { fixedAmountKobo: -1n } : { maximumDiscountAmountKobo: -1n },
          }),
        ).rejects.toThrow();
        expect(
          await prisma.promotionUsage.count({
            where: { promotionId: saved.body.data.id },
          }),
        ).toBe(0);
      }
    });
    it("directly reads precise saved settings and permits only one concurrent expected-version update", async () => {
      const admin = await account("ADMIN"),
        input = body(),
        created = await request(app).post(endpoint).set(admin.headers).send(input);
      expect(created.status).toBe(201);
      const id = created.body.data.id,
        url = `${endpoint}/${id}`;
      const read = await request(app).get(url).set(admin.headers);
      expect(read.status).toBe(200);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      expect(read.body.data).toMatchObject({ ...input, id, version: 0 });
      const change = {
        expectedVersion: 0,
        discountType: "FIXED_AMOUNT",
        percentageBasisPoints: null,
        fixedAmountKobo: "250001",
        maximumDiscountAmountKobo: "0",
        usageLimit: null,
        perCustomerLimit: null,
      };
      const updates = await Promise.all([
        request(app)
          .patch(url)
          .set(admin.headers)
          .send({ ...change, name: input.name + " A" }),
        request(app)
          .patch(url)
          .set(admin.headers)
          .send({ ...change, name: input.name + " B" }),
      ]);
      expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(updates.find((r) => r.status === 200)!.headers["cache-control"]).toBe(
        "private, no-store",
      );
      const final = await request(app).get(url).set(admin.headers);
      expect(final.body.data).toMatchObject({
        id,
        version: 1,
        discountType: "FIXED_AMOUNT",
        percentageBasisPoints: null,
        fixedAmountKobo: "250001",
        maximumDiscountAmountKobo: "0",
        usageLimit: null,
        perCustomerLimit: null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
      expect(
        await prisma.auditLog.count({
          where: { entityType: "PROMOTION", entityId: id, action: "UPDATE" },
        }),
      ).toBe(1);
      expect(await prisma.promotionUsage.count({ where: { promotionId: id } })).toBe(0);
    });
    it("checks live role, MFA, CSRF and invalid configuration without additional writes", async () => {
      const admin = await account("ADMIN"),
        created = await request(app).post(endpoint).set(admin.headers).send(body()),
        id = created.body.data.id,
        url = `${endpoint}/${id}`;
      for (const credentials of [
        undefined,
        (await account("STAFF")).headers,
        (await account("CUSTOMER")).headers,
        (await account("ADMIN", undefined, false)).headers,
      ]) {
        const read = request(app).get(url),
          write = request(app).patch(url).send({ expectedVersion: 0, isActive: true });
        if (credentials) {
          read.set(credentials);
          write.set(credentials);
        }
        expect([401, 403]).toContain((await read).status);
        expect([401, 403]).toContain((await write).status);
      }
      expect(
        (
          await request(app)
            .patch(url)
            .set({ ...admin.headers, "x-csrf-token": "bad" })
            .send({ expectedVersion: 0, isActive: true })
        ).status,
      ).toBe(403);
      expect(
        (await request(app).get(`${endpoint}/${randomUUID()}`).set(admin.headers)).status,
      ).toBe(404);
      for (const input of [
        { expectedVersion: 1, isActive: true },
        { expectedVersion: 0, endsAt: "2026-10-17T09:00:37.100Z" },
        { expectedVersion: 0, usageLimit: 1, perCustomerLimit: 2 },
      ])
        expect([409, 422]).toContain(
          (await request(app).patch(url).set(admin.headers).send(input)).status,
        );
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "UPDATE" } }),
      ).toBe(0);
      const owner = await account("SUPER_ADMIN");
      expect((await request(app).get(url).set(owner.headers)).status).toBe(200);
      expect(
        (
          await request(app)
            .patch(url)
            .set(owner.headers)
            .send({ expectedVersion: 0, isActive: true })
        ).status,
      ).toBe(200);
      await prisma.user.update({ where: { id: admin.user.id }, data: { role: "STAFF" } });
      expect((await request(app).get(url).set(admin.headers)).status).toBe(403);
      expect(
        (
          await request(app)
            .patch(url)
            .set(admin.headers)
            .send({ expectedVersion: 1, isActive: false })
        ).status,
      ).toBe(403);
      expect((await request(app).get(url).set(owner.headers)).body.data).toMatchObject({
        version: 1,
        isActive: true,
      });
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "UPDATE" } }),
      ).toBe(1);
    });
  },
);
