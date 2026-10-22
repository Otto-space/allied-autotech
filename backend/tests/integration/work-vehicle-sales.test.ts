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
const endpoint = "/api/v1/staff/vehicle-transactions",
  sessions: string[] = [];
async function account(role: UserRole, branchId?: string, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-qa-only")
      : await prisma.user.create({
          data: {
            email: `stock-creation-${randomUUID()}@example.test`,
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

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workshop sales discovery",
  () => {
    let branch: string, other: string, old: string;
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
      const make = async (active = true) =>
        (
          await prisma.branch.create({
            data: {
              code: randomUUID().slice(0, 8),
              name: "Synthetic sales workshop",
              address: "Synthetic",
              city: "Synthetic",
              state: "Synthetic",
              isActive: active,
            },
          })
        ).id;
      branch = await make();
      other = await make();
      old = await make(false);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    async function seed(branchId = branch, negotiating = false) {
      const v = await prisma.vehicle.create({
          data: {
            branchId,
            stockNumber: "SALE-" + randomUUID().slice(0, 9).toUpperCase(),
            make: "Toyota",
            model: "Camry",
            year: 2022,
            condition: "USED",
          },
        }),
        listing = await prisma.vehicleListing.create({
          data: {
            vehicleId: v.id,
            branchId,
            title: "Synthetic sales vehicle",
            slug: "sales-" + randomUUID(),
            priceKobo: 9999999999999999n,
            status: "DRAFT",
          },
        });
      return prisma.vehicleTransaction.create({
        data: {
          vehicleListingId: listing.id,
          transactionNumber: "SALE-" + randomUUID(),
          customerName: "Synthetic sales customer",
          customerPhone: "+2348000000000",
          customerEmail: "synthetic@example.test",
          askingPriceKobo: 9999999999999999n,
          agreedPriceKobo: negotiating ? 9900000000000001n : null,
          reservationRequiredKobo: negotiating ? 100000001n : null,
          status: negotiating ? "NEGOTIATING" : "ENQUIRY",
          createdAt: new Date("2026-10-17T09:00:37.123Z"),
        },
      });
    }
    it("returns stable 25+3 exact private records without domain audits", async () => {
      for (let n = 0; n < 28; n++) await seed();
      const admin = await account("ADMIN", branch),
        before = await prisma.auditLog.count({ where: { userId: admin.user.id } }),
        a = await request(app)
          .get(endpoint)
          .query({ limit: 25, branchId: branch })
          .set(admin.headers);
      expect(a.status).toBe(200);
      expect(a.headers["cache-control"]).toContain("no-store");
      expect(a.body.data.items).toHaveLength(25);
      const b = await request(app)
        .get(endpoint)
        .query({ limit: 25, branchId: branch, cursor: a.body.data.nextCursor })
        .set(admin.headers);
      expect(b.body.data.items).toHaveLength(3);
      expect(b.body.data.nextCursor).toBeUndefined();
      expect(
        new Set([...a.body.data.items, ...b.body.data.items].map((row) => row.id)).size,
      ).toBe(28);
      for (const row of a.body.data.items) {
        expect(row.askingPriceKobo).toBe("9999999999999999");
        expect(row.agreedPriceKobo).toBeNull();
        expect(row.createdAt).toBe("2026-10-17T09:00:37.123Z");
        expect(row.customerPhone).toBeUndefined();
        expect(row.customerEmail).toBeUndefined();
        expect(row.vehicleListing.vehicle.acquisitionCostKobo).toBeUndefined();
        expect(row.balanceKobo).toBeUndefined();
      }
      expect(await prisma.auditLog.count({ where: { userId: admin.user.id } })).toBe(
        before,
      );
    });
    it("combines real status/branch filters and preserves recorded negotiated values", async () => {
      const row = await seed(branch, true),
        admin = await account("ADMIN", branch),
        result = await request(app)
          .get(endpoint)
          .query({ status: "NEGOTIATING", branchId: branch, limit: 25 })
          .set(admin.headers);
      expect(result.status).toBe(200);
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.items[0]).toMatchObject({
        id: row.id,
        agreedPriceKobo: "9900000000000001",
        reservationRequiredKobo: "100000001",
      });
      expect(
        (
          await request(app)
            .get(endpoint)
            .query({ branchId: branch, status: "CANCELLED" })
            .set(admin.headers)
        ).body.data.items,
      ).toEqual([]);
      expect(
        (await request(app).get(endpoint).query({ search: "Camry" }).set(admin.headers))
          .status,
      ).toBe(422);
    });
    it("keeps Staff assignments and Admin historical reads independent", async () => {
      await seed(other);
      await seed(old);
      const staff = await account("STAFF", branch),
        inactive = await account("STAFF", old),
        admin = await account("ADMIN", branch),
        customer = await account("CUSTOMER"),
        unverified = await account("ADMIN", branch, false),
        owner = await account("SUPER_ADMIN");
      const own = await request(app)
        .get(endpoint)
        .query({ limit: 25 })
        .set(staff.headers);
      expect(own.status).toBe(200);
      expect(
        own.body.data.items.every((row) => row.vehicleListing.branchId === branch),
      ).toBe(true);
      expect(
        (await request(app).get(endpoint).query({ branchId: other }).set(staff.headers))
          .status,
      ).toBe(403);
      expect((await request(app).get(endpoint).set(inactive.headers)).status).toBe(403);
      for (const actor of [admin, owner])
        expect(
          (await request(app).get(endpoint).query({ branchId: old }).set(actor.headers))
            .body.data.items,
        ).toHaveLength(1);
      for (const actor of [customer, unverified])
        expect((await request(app).get(endpoint).set(actor.headers)).status).toBe(403);
      expect((await request(app).get(endpoint)).status).toBe(401);
    });
  },
);
