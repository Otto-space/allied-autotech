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
const endpoint = "/api/v1/staff/vehicle-inspections",
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
  "workshop inspection index",
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
              name: "Synthetic inspection workshop",
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
    async function seed(branchId = branch) {
      const vehicle = await prisma.vehicle.create({
          data: {
            branchId,
            stockNumber: "INS-" + randomUUID().slice(0, 10).toUpperCase(),
            make: "Toyota",
            model: "Camry",
            year: 2022,
            condition: "USED",
          },
        }),
        listing = await prisma.vehicleListing.create({
          data: {
            vehicleId: vehicle.id,
            branchId,
            title: "Synthetic inspection vehicle",
            slug: "ins-" + randomUUID(),
            priceKobo: 2850000000n,
            status: "DRAFT",
          },
        });
      return prisma.inspectionRequest.create({
        data: {
          vehicleListingId: listing.id,
          customerName: "Synthetic customer",
          customerPhone: "+2348000000000",
          customerEmail: "synthetic@example.test",
          preferredStartAt: new Date("2026-10-20T09:00:37.123Z"),
          preferredEndAt: new Date("2026-10-20T10:00:37.123Z"),
        },
      });
    }
    it("paginates scoped requests and preserves exact private projections without writes", async () => {
      for (let n = 0; n < 28; n++) await seed();
      await seed(other);
      await seed(old);
      const admin = await account("ADMIN", branch),
        staff = await account("STAFF", branch),
        customer = await account("CUSTOMER"),
        unverified = await account("ADMIN", branch, false);
      const first = await request(app)
        .get(endpoint)
        .query({ limit: 25, branchId: branch, status: "REQUESTED" })
        .set(admin.headers);
      expect(first.status).toBe(200);
      expect(first.headers["cache-control"]).toContain("no-store");
      expect(first.body.data.items).toHaveLength(25);
      const second = await request(app)
        .get(endpoint)
        .query({
          limit: 25,
          branchId: branch,
          status: "REQUESTED",
          cursor: first.body.data.nextCursor,
        })
        .set(admin.headers);
      expect(second.status).toBe(200);
      expect(second.body.data.items).toHaveLength(3);
      expect(second.body.data.nextCursor).toBeUndefined();
      expect(
        new Set([...first.body.data.items, ...second.body.data.items].map((r) => r.id))
          .size,
      ).toBe(28);
      for (const row of first.body.data.items) {
        expect(row.vehicleListing.branchId).toBe(branch);
        expect(row.preferredStartAt).toBe("2026-10-20T09:00:37.123Z");
        expect(row.customerEmail).toBeUndefined();
        expect(row.customerPhone).toBeUndefined();
      }
      expect(
        (
          await request(app)
            .get(endpoint)
            .query({ limit: 25, branchId: other })
            .set(staff.headers)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .get(endpoint)
            .query({ limit: 25, branchId: old })
            .set(admin.headers)
        ).body.data.items,
      ).toHaveLength(1);
      for (const headers of [customer.headers, unverified.headers])
        expect((await request(app).get(endpoint).set(headers)).status).toBe(403);
      expect((await request(app).get(endpoint)).status).toBe(401);
      expect(
        (await request(app).get(endpoint).query({ search: "Camry" }).set(admin.headers))
          .status,
      ).toBe(422);
    });
    it("uses atomic independent progress versions and current Staff self-assignment", async () => {
      const record = await seed(),
        staff = await account("STAFF", branch),
        foreign = await account("STAFF", other),
        profile = await prisma.staffProfile.findUniqueOrThrow({
          where: { userId: staff.user.id },
        }),
        path = endpoint + "/" + record.id + "/status";
      const body = {
        expectedVersion: 0,
        status: "CONFIRMED",
        scheduledStartAt: "2026-10-21T12:00:37.123+01:00",
        scheduledEndAt: "2026-10-21T13:00:37.123+01:00",
      };
      expect((await request(app).post(path).set(foreign.headers).send(body)).status).toBe(
        403,
      );
      const confirmed = await request(app).post(path).set(staff.headers).send(body);
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.data).toMatchObject({
        id: record.id,
        version: 1,
        status: "CONFIRMED",
        assignedStaffId: profile.id,
        scheduledStartAt: "2026-10-21T11:00:37.123Z",
        scheduledEndAt: "2026-10-21T12:00:37.123Z",
      });
      expect(
        (
          await request(app)
            .post(path)
            .set(staff.headers)
            .send({ expectedVersion: 0, status: "COMPLETED" })
        ).status,
      ).toBe(409);
      const done = await request(app)
        .post(path)
        .set(staff.headers)
        .send({ expectedVersion: 1, status: "COMPLETED" });
      expect(done.status).toBe(200);
      expect(done.body.data.completedAt).toBeTruthy();
      expect(done.body.data.version).toBe(2);
      expect(
        (
          await request(app)
            .post(path)
            .set(staff.headers)
            .send({ expectedVersion: 2, status: "NO_SHOW" })
        ).status,
      ).toBe(409);
      expect(
        await prisma.auditLog.count({
          where: { entityId: record.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(2);
      expect(
        await prisma.vehicleConditionReport.count({ where: { inspectionId: record.id } }),
      ).toBe(0);
    });
    it("checks Administrator assignee branch eligibility and cancellation reason", async () => {
      const record = await seed(),
        admin = await account("ADMIN", branch),
        eligible = await account("STAFF", branch),
        foreign = await account("STAFF", other),
        own = await prisma.staffProfile.findUniqueOrThrow({
          where: { userId: eligible.user.id },
        }),
        wrong = await prisma.staffProfile.findUniqueOrThrow({
          where: { userId: foreign.user.id },
        }),
        path = endpoint + "/" + record.id + "/status",
        body = {
          expectedVersion: 0,
          status: "CONFIRMED",
          scheduledStartAt: "2026-10-21T12:00:00+01:00",
          scheduledEndAt: "2026-10-21T13:00:00+01:00",
        };
      expect(
        (
          await request(app)
            .post(path)
            .set(admin.headers)
            .send({ ...body, assignedStaffId: wrong.id })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(path)
            .set(admin.headers)
            .send({ ...body, assignedStaffId: own.id })
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .post(path)
            .set(admin.headers)
            .send({ expectedVersion: 1, status: "CANCELLED" })
        ).status,
      ).toBe(422);
      const cancelled = await request(app)
        .post(path)
        .set(admin.headers)
        .send({
          expectedVersion: 1,
          status: "CANCELLED",
          reason: "Synthetic cancellation",
        });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data).toMatchObject({
        version: 2,
        status: "CANCELLED",
        cancellationReason: "Synthetic cancellation",
        assignedStaffId: own.id,
      });
      expect(cancelled.body.data.cancelledAt).toBeTruthy();
      expect(
        await prisma.auditLog.count({
          where: { entityId: record.id, action: "STATUS_CHANGE" },
        }),
      ).toBe(2);
    });
  },
);
