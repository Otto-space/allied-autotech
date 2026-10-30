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
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
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

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owner service structure import",
  () => {
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });
    const url = endpoint + "/owner-structure";
    it.each(["CUSTOMER", "STAFF"] as const)(
      "rejects %s reads and writes",
      async (role) => {
        const actor = await account(role);
        expect((await request(app).get(url).set(actor.headers)).status).toBe(403);
        expect(
          (
            await request(app)
              .post(url)
              .set(actor.headers)
              .send({ expectedRevision: "a".repeat(64) })
          ).status,
        ).toBe(403);
      },
    );
    it("requires MFA and CSRF", async () => {
      const unverified = await account("ADMIN", false);
      expect((await request(app).get(url).set(unverified.headers)).status).toBe(403);
      const admin = await account();
      expect(
        (
          await request(app)
            .post(url)
            .set({ Cookie: admin.headers.Cookie, Origin: admin.headers.Origin })
            .send({ expectedRevision: "a".repeat(64) })
        ).status,
      ).toBe(403);
    });
    it("reuses legacy identity, preserves service values and is idempotent under competing application", async () => {
      const actor = await account();
      const category = await prisma.serviceCategory.create({
        data: {
          name: "Tyre & Wheel Maintenance",
          slug: "legacy-wheel-group",
          description: "Existing authored description",
        },
      });
      const tyre = await prisma.service.create({
        data: {
          name: "Tyre Change",
          slug: "tyre-change",
          pricingType: "FIXED",
          priceKobo: 100000000n,
          currency: "NGN",
          durationMinutes: 30,
        },
      });
      const before = await request(app).get(url).set(actor.headers);
      expect(before.status).toBe(200);
      expect(before.body.data.groups).toHaveLength(8);
      expect(before.body.data.groups[0]).toMatchObject({
        id: category.id,
        slug: category.slug,
        action: "reuse",
      });
      const responses = await Promise.all(
        [0, 1].map(() =>
          request(app)
            .post(url)
            .set(actor.headers)
            .send({ expectedRevision: before.body.data.revision }),
        ),
      );
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const saved = await prisma.service.findUniqueOrThrow({ where: { id: tyre.id } });
      expect(saved).toMatchObject({
        id: tyre.id,
        slug: tyre.slug,
        priceKobo: tyre.priceKobo,
        durationMinutes: 30,
        categoryId: category.id,
        version: tyre.version + 1,
      });
      expect(
        (await prisma.serviceCategory.findUniqueOrThrow({ where: { id: category.id } }))
          .description,
      ).toBe(category.description);
      const fresh = await request(app).get(url).set(actor.headers);
      const auditWhere = {
        entityId: {
          in: [...fresh.body.data.groups.map((g: { id: string }) => g.id), tyre.id],
        },
      };
      const auditBefore = await prisma.auditLog.count({ where: auditWhere });
      const repeated = await request(app)
        .post(url)
        .set(actor.headers)
        .send({ expectedRevision: fresh.body.data.revision });
      expect(repeated.status).toBe(200);
      expect(repeated.body.data).toMatchObject({
        created: 0,
        reused: 8,
        assigned: false,
        serviceId: tyre.id,
      });
      expect(await prisma.auditLog.count({ where: auditWhere })).toBe(auditBefore);
      expect(
        await prisma.serviceCategory.count({
          where: { id: { in: repeated.body.data.categoryIds } },
        }),
      ).toBe(8);
    });
    it("rejects a stale review without partially creating groups", async () => {
      const actor = await account();
      const preview = await request(app).get(url).set(actor.headers);
      const first = preview.body.data.groups[0];
      await prisma.serviceCategory.update({
        where: { id: first.id },
        data: { description: "Changed after review", version: { increment: 1 } },
      });
      const ownWhere = {
        id: { in: preview.body.data.groups.map((g: { id: string }) => g.id) },
      };
      const count = await prisma.serviceCategory.count({ where: ownWhere });
      const response = await request(app)
        .post(url)
        .set(actor.headers)
        .send({ expectedRevision: preview.body.data.revision });
      expect(response.status).toBe(409);
      expect(await prisma.serviceCategory.count({ where: ownWhere })).toBe(count);
    });
  },
);
