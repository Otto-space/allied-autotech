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

const key = (issued = Date.now()) => `promotion-v1.${issued}.${randomUUID()}`;
const input = () => ({
  name: `Create QA ${randomUUID()}`,
  code: null,
  description: null,
  discountType: "PERCENTAGE",
  percentageBasisPoints: 1234,
  fixedAmountKobo: null,
  minimumOrderAmountKobo: "0",
  maximumDiscountAmountKobo: "9999999999999999",
  usageLimit: 20,
  perCustomerLimit: 2,
  startsAt: "2026-10-17T10:00:37.123+01:00",
  endsAt: "2026-11-17T10:00:37.456+01:00",
  isActive: false,
});
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "promotion creation recovery",
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
    it("atomically replays concurrent code-less creation and reads only the actor's receipt", async () => {
      const admin = await account("ADMIN"),
        other = await account("ADMIN"),
        requestKey = key(),
        body = input();
      const post = (payload: object) =>
        request(app)
          .post(endpoint)
          .set(admin.headers)
          .set("Idempotency-Key", requestKey)
          .send(payload);
      const results = await Promise.all([post(body), post(body)]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      const id = results[0]!.body.data.id;
      expect(results[1]!.body.data.id).toBe(id);
      expect(results.map((r) => r.body.data.replayed).sort()).toEqual([false, true]);
      expect(results[0]!.body.data).toMatchObject({
        code: null,
        isActive: false,
        percentageBasisPoints: 1234,
        minimumOrderAmountKobo: "0",
        maximumDiscountAmountKobo: "9999999999999999",
        startsAt: "2026-10-17T09:00:37.123Z",
      });
      expect(await prisma.promotion.count({ where: { name: body.name } })).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityType: "PROMOTION", entityId: id, action: "CREATE" },
        }),
      ).toBe(1);
      const receipts = await prisma.idempotencyRecord.findMany({
        where: { scope: `promotion-create:${admin.user.id}` },
      });
      expect(receipts).toHaveLength(1);
      expect(receipts[0]!.responseBody).toEqual({ resourceId: id });
      const url = `${endpoint}/creation-receipts/${requestKey}`,
        found = await request(app).get(url).set(admin.headers);
      expect(found.status).toBe(200);
      expect(found.headers["cache-control"]).toBe("private, no-store");
      expect(found.body.data).toEqual({ key: requestKey, promotionId: id });
      expect((await request(app).get(url).set(other.headers)).body.data).toEqual({
        key: requestKey,
        promotionId: null,
      });
      const conflict = await post({ ...body, name: body.name + " changed" });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
      const edited = await request(app)
        .patch(`${endpoint}/${id}`)
        .set(admin.headers)
        .send({ expectedVersion: 0, name: body.name + " edited", isActive: true });
      expect(edited.status).toBe(200);
      const replay = await post({ ...body, startsAt: "2026-10-17T09:00:37.123Z" });
      expect(replay.status).toBe(201);
      expect(replay.body.data).toMatchObject({
        id,
        replayed: true,
        version: 1,
        isActive: true,
        name: body.name + " edited",
      });
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "CREATE" } }),
      ).toBe(1);
    });
    it("rejects expired, future, malformed and altered keys without creating records", async () => {
      const admin = await account("ADMIN"),
        body = input();
      for (const requestKey of [
        key(Date.now() - 86_401_000),
        key(Date.now() + 120_000),
      ]) {
        const response = await request(app)
          .post(endpoint)
          .set(admin.headers)
          .set("Idempotency-Key", requestKey)
          .send(body);
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("IDEMPOTENCY_EXPIRED");
        expect(
          (
            await request(app)
              .get(`${endpoint}/creation-receipts/${requestKey}`)
              .set(admin.headers)
          ).status,
        ).toBe(409);
      }
      for (const requestKey of ["bad", `${key()},${key()}`])
        expect(
          (
            await request(app)
              .post(endpoint)
              .set(admin.headers)
              .set("Idempotency-Key", requestKey)
              .send(body)
          ).status,
        ).toBe(422);
      expect(
        (
          await request(app)
            .get(`${endpoint}/creation-receipts/${key()}?unexpected=1`)
            .set(admin.headers)
        ).status,
      ).toBe(422);
      expect(await prisma.promotion.count({ where: { name: body.name } })).toBe(0);
      expect(
        await prisma.idempotencyRecord.count({
          where: { scope: `promotion-create:${admin.user.id}` },
        }),
      ).toBe(0);
    });
    it("checks permission, MFA and CSRF on receipt reads and every replay", async () => {
      const body = input(),
        requestKey = key(),
        admin = await account("ADMIN"),
        owner = await account("SUPER_ADMIN");
      expect(
        (
          await request(app)
            .post(endpoint)
            .set(owner.headers)
            .set("Idempotency-Key", requestKey)
            .send(body)
        ).status,
      ).toBe(201);
      for (const credentials of [
        undefined,
        (await account("STAFF")).headers,
        (await account("CUSTOMER")).headers,
        (await account("ADMIN", undefined, false)).headers,
      ]) {
        const get = request(app).get(`${endpoint}/creation-receipts/${requestKey}`),
          post = request(app)
            .post(endpoint)
            .set("Idempotency-Key", requestKey)
            .send(body);
        if (credentials) {
          get.set(credentials);
          post.set(credentials);
        }
        expect([401, 403]).toContain((await get).status);
        expect([401, 403]).toContain((await post).status);
      }
      expect(
        (
          await request(app)
            .post(endpoint)
            .set({ ...admin.headers, "x-csrf-token": "bad" })
            .set("Idempotency-Key", key())
            .send(input())
        ).status,
      ).toBe(403);
      await prisma.user.update({ where: { id: admin.user.id }, data: { role: "STAFF" } });
      expect(
        (
          await request(app)
            .get(`${endpoint}/creation-receipts/${requestKey}`)
            .set(admin.headers)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(endpoint)
            .set(admin.headers)
            .set("Idempotency-Key", requestKey)
            .send(body)
        ).status,
      ).toBe(403);
    });
    it("rolls back receipts on rejected saves and preserves legacy unkeyed creation", async () => {
      const admin = await account("ADMIN"),
        body = { ...input(), code: `CREATE-${randomUUID()}` };
      const created = await request(app).post(endpoint).set(admin.headers).send(body);
      expect(created.status).toBe(201);
      expect(created.body.data.replayed).toBeUndefined();
      expect(
        (
          await request(app)
            .post(endpoint)
            .set(admin.headers)
            .set("Idempotency-Key", key())
            .send(body)
        ).status,
      ).toBe(409);
      expect(
        await prisma.idempotencyRecord.count({
          where: { scope: `promotion-create:${admin.user.id}` },
        }),
      ).toBe(0);
      expect(await prisma.promotion.count({ where: { code: body.code } })).toBe(1);
    });
  },
);
