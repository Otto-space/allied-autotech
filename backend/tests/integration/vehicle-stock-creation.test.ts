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
const endpoint = "/api/v1/staff/vehicles",
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
  "vehicle stock creation",
  () => {
    let active: string, inactive: string;
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
              name: "Synthetic stock creation",
              address: "Synthetic",
              city: "Synthetic",
              state: "Synthetic",
              isActive,
            },
          })
        ).id;
      active = await branch(true);
      inactive = await branch(false);
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    it("creates one complete record and one audit per permitted role, with exact values and no photos/listings", async () => {
      for (const role of ["STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
        const actor = await account(role, active),
          stockNumber = ("CREATE-" + randomUUID().slice(0, 12)).toUpperCase(),
          body = {
            branchId: active,
            stockNumber: stockNumber.toLowerCase(),
            make: "Toyota",
            model: "Camry",
            year: 2022,
            condition: "USED",
            mileageKm: 0,
            trim: null,
            transmission: "AUTOMATIC",
            fuelType: "PETROL",
            bodyType: "SEDAN",
            driveType: "FWD",
            engineSize: "2.5 L",
            color: "Red",
            doors: 4,
            seats: 5,
            vin: null,
            chassisNumber: randomUUID(),
            registrationNumber: null,
            acquiredAt: "2026-10-17T10:00:00+01:00",
            ...(role !== "STAFF" ? { acquisitionCostKobo: "9999999999999999" } : {}),
          };
        const response = await request(app).post(endpoint).set(actor.headers).send(body);
        expect(response.status).toBe(201);
        expect(response.headers["cache-control"]).toBe("private, no-store");
        const row = response.body.data;
        expect(row.stockNumber).toBe(stockNumber);
        expect(row.branchId).toBe(active);
        expect(row.mileageKm).toBe(0);
        expect(row.acquiredAt).toBe("2026-10-17T09:00:00.000Z");
        expect(row.version).toBe(0);
        for (const key of ["listings", "images", "documents", "conditionReports"])
          expect(row[key]).toEqual([]);
        if (role === "STAFF") {
          expect(row).not.toHaveProperty("acquisitionCostKobo");
          expect(row).not.toHaveProperty("acquisitionCurrency");
        } else expect(row.acquisitionCostKobo).toBe("9999999999999999");
        const stored = await prisma.vehicle.findUniqueOrThrow({ where: { id: row.id } });
        expect(stored.acquisitionCostKobo).toBe(
          role === "STAFF" ? null : 9999999999999999n,
        );
        expect(
          await prisma.auditLog.count({
            where: {
              userId: actor.user.id,
              entityType: "VEHICLE",
              entityId: row.id,
              action: "CREATE",
            },
          }),
        ).toBe(1);
        const duplicate = await request(app).post(endpoint).set(actor.headers).send(body);
        expect(duplicate.status).toBe(409);
        expect(await prisma.vehicle.count({ where: { stockNumber } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { entityId: row.id } })).toBe(1);
      }
    });
    it("denies missing MFA/CSRF, Customer and foreign/inactive/unassigned Staff branches without writes", async () => {
      const staff = await account("STAFF", active),
        none = await account("STAFF"),
        old = await account("STAFF", inactive),
        customer = await account("CUSTOMER"),
        unverified = await account("ADMIN", undefined, false),
        admin = await account("ADMIN");
      const prefix = "DENY-" + randomUUID().slice(0, 10),
        body = {
          branchId: active,
          stockNumber: prefix,
          make: "Toyota",
          model: "Camry",
          year: 2022,
        };
      expect((await request(app).post(endpoint).send(body)).status).toBe(401);
      for (const actor of [none, old, customer, unverified])
        expect(
          (await request(app).post(endpoint).set(actor.headers).send(body)).status,
        ).toBe(403);
      expect(
        (
          await request(app)
            .post(endpoint)
            .set({ Cookie: admin.headers.Cookie, Origin: env.FRONTEND_URL[0]! })
            .send(body)
        ).status,
      ).toBe(403);
      for (const cost of [null, "100"]) {
        expect(
          (
            await request(app)
              .post(endpoint)
              .set(staff.headers)
              .send({ ...body, acquisitionCostKobo: cost })
          ).status,
        ).toBe(403);
      }
      expect(
        (
          await request(app)
            .post(endpoint)
            .set(staff.headers)
            .send({ ...body, branchId: inactive })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post(endpoint)
            .set(admin.headers)
            .send({ ...body, branchId: inactive })
        ).status,
      ).toBe(404);
      expect(await prisma.vehicle.count({ where: { stockNumber: prefix } })).toBe(0);
    });
    it("rejects calendar, canonical stock bounds and malformed values before persistence", async () => {
      const admin = await account("ADMIN"),
        base = {
          branchId: active,
          stockNumber: "INVALID-" + randomUUID().slice(0, 8),
          make: "Toyota",
          model: "Camry",
          year: 2022,
        };
      for (const fields of [
        { acquiredAt: "2026-02-30T10:00:00+01:00" },
        { stockNumber: "ß".repeat(25) },
        { year: 2200 },
        { mileageKm: -1 },
        { vin: "invalid" },
        { acquisitionCostKobo: "0" },
      ])
        expect(
          (
            await request(app)
              .post(endpoint)
              .set(admin.headers)
              .send({ ...base, ...fields })
          ).status,
        ).toBe(422);
      expect(
        await prisma.vehicle.count({ where: { stockNumber: base.stockNumber } }),
      ).toBe(0);
    });
  },
);
