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
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")("promotion discovery", () => {
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
  it("searches configured name/code with combined filters and stable tied-date paging", async () => {
    const admin = await account("ADMIN"),
      prefix = "DISC-" + randomUUID().slice(0, 8),
      createdAt = new Date("2026-10-17T09:00:00Z");
    const rows = Array.from({ length: 28 }, (_, n) => ({
      id: randomUUID(),
      name: prefix + " Offer " + n,
      code: prefix + "-CODE-" + n,
      discountType: n % 3 === 0 ? ("FIXED_AMOUNT" as const) : ("PERCENTAGE" as const),
      percentageBasisPoints: n % 3 === 0 ? null : 1234,
      fixedAmountKobo: n % 3 === 0 ? 250000n : null,
      isActive: n % 2 === 0,
      startsAt: new Date("2026-10-17T09:00:37.100Z"),
      endsAt: new Date("2026-11-30T09:00:37.200Z"),
      createdAt,
    }));
    await prisma.promotion.createMany({ data: rows });
    const read = (query: object) =>
      request(app).get(endpoint).set(admin.headers).query(query);
    const first = await read({ search: prefix.toLowerCase(), limit: 25 });
    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("private, no-store");
    expect(first.body.data.items).toHaveLength(25);
    const next = await read({
      search: prefix,
      cursor: first.body.data.nextCursor,
      limit: 25,
    });
    expect(next.body.data.items).toHaveLength(3);
    expect(next.body.data.nextCursor).toBeUndefined();
    expect(
      [...first.body.data.items, ...next.body.data.items].map((row) => row.id),
    ).toEqual(
      rows
        .map((row) => row.id)
        .sort()
        .reverse(),
    );
    const filtered = await read({
      search: prefix,
      isActive: "true",
      discountType: "PERCENTAGE",
    });
    expect(new Set(filtered.body.data.items.map((row) => row.id))).toEqual(
      new Set(
        rows
          .filter((row) => row.isActive && row.discountType === "PERCENTAGE")
          .map((row) => row.id),
      ),
    );
    expect(
      (await read({ search: prefix + "-code-17" })).body.data.items.map((row) => row.id),
    ).toEqual([rows[17]!.id]);
    expect(first.body.data.items[0]).toHaveProperty(
      "startsAt",
      "2026-10-17T09:00:37.100Z",
    );
    expect(first.body.data.items[0]).not.toHaveProperty("redemptionCount");
    expect(
      await prisma.auditLog.count({
        where: { entityId: { in: rows.map((row) => row.id) } },
      }),
    ).toBe(0);
    expect(
      await prisma.promotionUsage.count({
        where: { promotionId: { in: rows.map((row) => row.id) } },
      }),
    ).toBe(0);
  });
  it("treats percent, underscore and backslash as literal name/code text", async () => {
    const admin = await account("ADMIN"),
      prefix = randomUUID(),
      base = {
        discountType: "PERCENTAGE" as const,
        percentageBasisPoints: 1000,
        startsAt: new Date("2026-10-17T09:00:00Z"),
        endsAt: new Date("2026-11-30T09:00:00Z"),
      };
    const literal = await prisma.promotion.create({
      data: { ...base, name: prefix + " 10%_offer\\literal", code: prefix + "-%_\\CODE" },
    });
    await prisma.promotion.create({
      data: { ...base, name: prefix + " 10XXofferXliteral", code: prefix + "-OTHER" },
    });
    const read = (search: string) =>
      request(app).get(endpoint).set(admin.headers).query({ search });
    expect((await read("%_\\")).body.data.items.map((row) => row.id)).toEqual([
      literal.id,
    ]);
    expect(
      (await read(prefix + " 10%_offer\\literal")).body.data.items.map((row) => row.id),
    ).toEqual([literal.id]);
    expect(
      (await read((prefix + "-%_\\code").toLowerCase())).body.data.items.map(
        (row) => row.id,
      ),
    ).toEqual([literal.id]);
  });
  it("requires administrator MFA and rejects invalid or repeated query values", async () => {
    const admin = await account("ADMIN"),
      owner = await account("SUPER_ADMIN"),
      staff = await account("STAFF"),
      customer = await account("CUSTOMER"),
      unverified = await account("ADMIN", undefined, false);
    expect((await request(app).get(endpoint)).status).toBe(401);
    for (const actor of [staff, customer, unverified])
      expect((await request(app).get(endpoint).set(actor.headers)).status).toBe(403);
    expect((await request(app).get(endpoint).set(owner.headers)).status).toBe(200);
    for (const query of [
      { search: " " },
      { search: "x".repeat(161) },
      { search: "a\u0001b" },
      { discountType: "OTHER" },
      { isActive: "yes" },
    ])
      expect(
        (await request(app).get(endpoint).set(admin.headers).query(query)).status,
      ).toBe(422);
    expect(
      (
        await request(app)
          .get(endpoint + "?search=a&search=b")
          .set(admin.headers)
      ).status,
    ).toBe(422);
  });
});
