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
const app = createApp({ checkReadiness: async () => undefined }),
  endpoint = "/api/v1/staff/vehicles",
  sessions: string[] = [];
async function account(role: UserRole, branchId?: string, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-qa-only")
      : await prisma.user.create({
          data: {
            email: `stock-discovery-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Stock",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Stock",
                      ...(branchId ? { branchId } : {}),
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken(),
    expiry = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  sessions.push(session.id);
  return {
    user,
    headers: { Cookie: `${sessionCookieName}=${token}`, Origin: env.FRONTEND_URL[0]! },
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "vehicle stock discovery",
  () => {
    let active: string, foreign: string, inactive: string;
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
      const branch = async (isActive: boolean) =>
        (
          await prisma.branch.create({
            data: {
              code: randomUUID().slice(0, 8),
              name: "Synthetic stock workshop",
              address: "Synthetic",
              city: "Synthetic",
              state: "Synthetic",
              isActive,
            },
          })
        ).id;
      active = await branch(true);
      foreign = await branch(true);
      inactive = await branch(false);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("combines supported filters, includes history and unlisted records, and pages 25+3 tied rows without writes", async () => {
      const admin = await account("ADMIN"),
        prefix = "STK-" + randomUUID().slice(0, 8),
        createdAt = new Date("2026-10-17T09:00:00Z");
      const data = Array.from({ length: 28 }, (_, n) => ({
        id: randomUUID(),
        branchId: n === 27 ? inactive : active,
        stockNumber: prefix + "-" + n,
        make: n % 2 ? "Lexus" : "Toyota",
        model: n % 2 ? "RX 350" : "Camry",
        year: n % 2 ? 2020 : 2022,
        mileageKm: n === 0 ? 0 : 12000,
        acquisitionCostKobo: 1234567891n,
        createdAt,
      }));
      await prisma.vehicle.createMany({ data });
      const listings = data
        .filter((_, n) => n % 3 !== 0)
        .map((row, n) => ({
          id: randomUUID(),
          vehicleId: row.id,
          branchId: row.branchId,
          title: "Synthetic stock sale " + n,
          slug: randomUUID(),
          priceKobo: n === 0 ? 9999999999999999n : 2850000000n,
          publishedAt: createdAt,
          reservedAt: n % 2 ? createdAt : null,
          status: n % 2 ? ("RESERVED" as const) : ("AVAILABLE" as const),
        }));
      await prisma.vehicleListing.createMany({ data: listings });
      await prisma.vehicleListing.create({
        data: {
          vehicleId: data[1]!.id,
          branchId: active,
          title: "Earlier archived sale",
          slug: randomUUID(),
          priceKobo: 100n,
          status: "ARCHIVED",
          archivedAt: createdAt,
        },
      });
      const ids = data.map((v) => v.id),
        snapshot = () =>
          prisma.vehicle.findMany({
            where: { id: { in: ids } },
            include: { listings: { orderBy: { id: "asc" } } },
            orderBy: { id: "asc" },
          }),
        before = await snapshot();
      const read = (q: object) =>
        request(app)
          .get(endpoint)
          .set(admin.headers)
          .query({ search: prefix, limit: 25, ...q });
      const first = await read({});
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toBe("private, no-store");
      expect(first.body.data.items).toHaveLength(25);
      expect(first.body.data.nextCursor).toBe(first.body.data.items.at(-1).id);
      const next = await read({ cursor: first.body.data.nextCursor });
      expect(next.status).toBe(200);
      expect(next.body.data.items).toHaveLength(3);
      expect(next.body.data.nextCursor).toBeUndefined();
      expect(
        [...first.body.data.items, ...next.body.data.items].map((row) => row.id),
      ).toEqual([...ids].sort().reverse());
      const filtered = await read({
        make: "toyota",
        model: "camry",
        year: 2022,
        status: "AVAILABLE",
        branchId: active,
      });
      expect(filtered.status).toBe(200);
      expect(new Set(filtered.body.data.items.map((row) => row.id))).toEqual(
        new Set(
          data
            .filter(
              (row) =>
                row.make === "Toyota" &&
                listings.some((l) => l.vehicleId === row.id && l.status === "AVAILABLE"),
            )
            .map((row) => row.id),
        ),
      );
      const unlisted = await read({ listed: "false" });
      expect(unlisted.body.data.items.every((row) => row.listings.length === 0)).toBe(
        true,
      );
      expect(unlisted.body.data.items).toHaveLength(10);
      const listed = await read({ listed: "true" });
      expect(listed.body.data.items).toHaveLength(18);
      expect(listed.body.data.items.every((row) => row.listings.length > 0)).toBe(true);
      const historic = await read({ status: "ARCHIVED" });
      expect(historic.body.data.items.map((row) => row.id)).toEqual([data[1]!.id]);
      expect(historic.body.data.items[0].listings).toHaveLength(2);
      const old = await read({ branchId: inactive });
      expect(old.body.data.items.map((row) => row.id)).toEqual([data[27]!.id]);
      expect(old.body.data.items[0].branch.isActive).toBe(false);
      const exact = await read({ search: data[1]!.stockNumber });
      expect(
        exact.body.data.items
          .find((row) => row.id === data[1]!.id)
          ?.listings.find((l) => l.priceKobo === "9999999999999999"),
      ).toBeDefined();
      expect(await snapshot()).toEqual(before);
      expect(await prisma.auditLog.count({ where: { entityId: { in: ids } } })).toBe(0);
    });
    it("matches literal percent, underscore and backslash in search and exact make/model, including VIN", async () => {
      const admin = await account("ADMIN"),
        prefix = randomUUID().slice(0, 8),
        make = prefix + "%_\\Make",
        model = "Model%_\\Rate";
      const literal = await prisma.vehicle.create({
        data: {
          branchId: active,
          stockNumber: prefix + "%_\\",
          make,
          model,
          year: 2022,
          vin: randomUUID().replaceAll("-", "").slice(0, 17).toUpperCase(),
        },
      });
      await prisma.vehicle.create({
        data: {
          branchId: active,
          stockNumber: prefix + "-OTHER",
          make: prefix + "XXYMake",
          model: "ModelXXYRate",
          year: 2022,
        },
      });
      const read = (q: object) => request(app).get(endpoint).set(admin.headers).query(q);
      for (const q of [
        { search: prefix + "%_\\" },
        { make: make.toLowerCase(), model: model.toLowerCase() },
        { search: literal.vin!.toLowerCase() },
      ]) {
        const response = await read(q);
        expect(response.status).toBe(200);
        expect(response.body.data.items.map((row) => row.id)).toEqual([literal.id]);
      }
    });
    it("enforces MFA, active assigned branch and private acquisition omission; rejects malformed queries", async () => {
      const admin = await account("ADMIN"),
        owner = await account("SUPER_ADMIN"),
        staff = await account("STAFF", active),
        other = await account("STAFF", foreign),
        old = await account("STAFF", inactive),
        none = await account("STAFF"),
        customer = await account("CUSTOMER"),
        unverified = await account("STAFF", active, false);
      const read = (actor: typeof admin, q: object = {}) =>
        request(app).get(endpoint).set(actor.headers).query(q);
      expect((await request(app).get(endpoint)).status).toBe(401);
      for (const actor of [old, none, customer, unverified])
        expect((await read(actor)).status).toBe(403);
      for (const actor of [admin, owner]) {
        const response = await read(actor, { branchId: inactive });
        expect(response.status).toBe(200);
        expect(response.body.data.items.length).toBeGreaterThan(0);
        expect(response.body.data.items[0]).toHaveProperty("acquisitionCostKobo");
      }
      const scope = await read(staff);
      expect(scope.status).toBe(200);
      expect(scope.body.data.items.length).toBeGreaterThan(0);
      for (const row of scope.body.data.items) {
        expect(row.branchId).toBe(active);
        expect(row).not.toHaveProperty("acquisitionCostKobo");
        expect(row).not.toHaveProperty("acquisitionCurrency");
      }
      expect((await read(staff, { branchId: active })).status).toBe(200);
      expect((await read(staff, { branchId: foreign })).status).toBe(403);
      expect((await read(other)).body.data.items).toEqual([]);
      for (const q of [
        { listed: "yes" },
        { listed: "false", status: "AVAILABLE" },
        { branchId: "bad" },
        { year: 2022.5 },
        { status: "OTHER" },
        { search: "x".repeat(101) },
      ])
        expect((await read(admin, q)).status).toBe(422);
      expect(
        (
          await request(app)
            .get(endpoint + "?search=a&search=b")
            .set(admin.headers)
        ).status,
      ).toBe(422);
    });
  },
);
