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
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";

const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
const endpoint = "/api/v1/staff/vehicles";
async function account(role: UserRole, branchId?: string, verified = true) {
  const user = await prisma.user.create({
    data: {
      email: `vehicle-operator-${randomUUID()}@example.test`,
      passwordHash: "unusable-fixture-only",
      role,
      emailVerifiedAt: new Date(),
      ...(branchId
        ? {
            staffProfile: {
              create: { firstName: "Synthetic", lastName: "Operator", branchId },
            },
          }
        : {}),
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
  "vehicle operations without an employee profile",
  () => {
    let branch: string, other: string;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      // This suite provisions the one protected owner only in its fresh database.
      expect(env.DB_NAME).toMatch(/^allied_vehicle_operator(?:_[a-f0-9]{12})?_ci$/);
      expect(await prisma.user.count()).toBe(0);
      for (const key of ["branch", "other"]) {
        const row = await prisma.branch.create({
          data: {
            code: randomUUID().slice(0, 8),
            name: "Synthetic operator workshop",
            address: "Isolated test only",
            city: "Port Harcourt",
            state: "Rivers",
          },
        });
        if (key === "branch") branch = row.id;
        else other = row.id;
      }
    });
    afterAll(() => prisma.$disconnect());

    for (const role of ["SUPER_ADMIN", "ADMIN"] as const) {
      it(`${role} creates and edits stock/listings/prices and reviews documents with its real user actor`, async () => {
        const actor = await account(role);
        if (role === "ADMIN") {
          const owner = await prisma.user.findFirstOrThrow({
            where: { role: "SUPER_ADMIN" },
          });
          await prisma.workforceAccess.create({
            data: {
              userId: actor.user.id,
              position: "OPERATIONS_SUPERVISOR",
              updatedByUserId: owner.id,
            },
          });
          expect(
            (
              await request(app)
                .get("/api/v1/admin/policies/delivery/current")
                .set(actor.headers)
            ).status,
          ).toBe(403);
          expect(
            (
              await request(app)
                .get("/api/v1/staff/finance-policy/current")
                .set(actor.headers)
            ).status,
          ).toBe(403);
        }
        const session = await request(app).get("/api/v1/auth/session").set(actor.headers);
        expect(session.status).toBe(200);
        expect(session.body.data.workforceManaged).toBe(false);
        expect(
          await prisma.staffProfile.findUnique({ where: { userId: actor.user.id } }),
        ).toBeNull();
        const create = await request(app)
          .post(endpoint)
          .set(actor.headers)
          .send({
            branchId: branch,
            stockNumber: "OP-" + randomUUID().slice(0, 10),
            make: "Toyota",
            model: "Camry",
            year: 2022,
            mileageKm: 0,
            acquisitionCostKobo: "5000000000",
          });
        expect(create.status, JSON.stringify(create.body)).toBe(201);
        const vehicle = create.body.data;
        const edit = await request(app)
          .patch(endpoint + "/" + vehicle.id)
          .set(actor.headers)
          .send({ expectedVersion: 0, color: "Blue", acquisitionCostKobo: "5100000000" });
        expect(edit.status, JSON.stringify(edit.body)).toBe(200);
        expect(edit.body.data).toMatchObject({
          color: "Blue",
          acquisitionCostKobo: "5100000000",
          version: 1,
        });
        const createdListing = await request(app)
          .post(endpoint + "/listings")
          .set(actor.headers)
          .send({
            vehicleId: vehicle.id,
            title: "Synthetic operator listing",
            slug: "operator-" + randomUUID(),
            priceKobo: "5500000000",
          });
        expect(createdListing.status, JSON.stringify(createdListing.body)).toBe(201);
        const listing = createdListing.body.data;
        expect(listing).toMatchObject({
          priceKobo: "5500000000",
          status: "DRAFT",
          version: 0,
        });
        const content = await request(app)
          .patch(endpoint + "/listings/" + listing.id)
          .set(actor.headers)
          .send({ expectedVersion: 0, title: "Reviewed synthetic vehicle" });
        expect(content.status).toBe(200);
        const price = await request(app)
          .post(endpoint + "/listings/" + listing.id + "/price")
          .set(actor.headers)
          .send({
            expectedVersion: 1,
            priceKobo: "5600000000",
            reason: "Synthetic authorised correction",
          });
        expect(price.status, JSON.stringify(price.body)).toBe(200);
        expect(price.body.data).toMatchObject({ priceKobo: "5600000000", version: 2 });
        const history = await prisma.vehiclePriceHistory.findMany({
          where: { vehicleListingId: listing.id },
        });
        expect(history).toHaveLength(1);
        expect(history[0]).toMatchObject({
          changedByUserId: actor.user.id,
          changedByStaffId: null,
          oldPriceKobo: 5500000000n,
          newPriceKobo: 5600000000n,
        });
        expect(
          await prisma.staffProfile.findUnique({ where: { userId: actor.user.id } }),
        ).toBeNull();
        await expect(
          prisma.vehiclePriceHistory.update({
            where: { id: history[0]!.id },
            data: { reason: "Overwrite forbidden" },
          }),
        ).rejects.toThrow();
        await expect(
          prisma.vehiclePriceHistory.create({
            data: {
              vehicleListingId: listing.id,
              oldPriceKobo: 5600000000n,
              newPriceKobo: 5700000000n,
            },
          }),
        ).rejects.toThrow();
        const document = await prisma.vehicleDocument.create({
          data: {
            vehicleId: vehicle.id,
            type: "REGISTRATION",
            objectKey: "synthetic/operator/" + randomUUID(),
            checksumSha256: "a".repeat(64),
            mimeType: "application/pdf",
            sizeBytes: 100n,
          },
        });
        const reviewed = await request(app)
          .post(endpoint + "/" + vehicle.id + "/documents/" + document.id + "/review")
          .set(actor.headers)
          .send({ expectedVersion: 0, status: "VERIFIED" });
        expect(reviewed.status, JSON.stringify(reviewed.body)).toBe(200);
        expect(
          await prisma.vehicleDocument.findUnique({ where: { id: document.id } }),
        ).toMatchObject({
          reviewedByUserId: actor.user.id,
          reviewedByStaffId: null,
          verificationStatus: "VERIFIED",
          version: 1,
        });
        await expect(
          prisma.vehicleDocument.update({
            where: { id: document.id },
            data: { reviewedByUserId: null, reviewedByStaffId: null },
          }),
        ).rejects.toThrow();
        const stale = await request(app)
          .post(endpoint + "/listings/" + listing.id + "/price")
          .set(actor.headers)
          .send({ expectedVersion: 1, priceKobo: "5700000000", reason: "Stale write" });
        expect(stale.status).toBe(409);
        expect(
          await prisma.vehiclePriceHistory.count({
            where: { vehicleListingId: listing.id },
          }),
        ).toBe(1);
        for (const status of ["RESERVED", "SOLD", "ARCHIVED"] as const) {
          await prisma.vehicleListing.update({
            where: { id: listing.id },
            data: {
              status,
              ...(status === "RESERVED"
                ? { reservedAt: new Date() }
                : status === "SOLD"
                  ? { soldAt: new Date() }
                  : { archivedAt: new Date() }),
            },
          });
          expect(
            (
              await request(app)
                .post(endpoint + "/listings/" + listing.id + "/price")
                .set(actor.headers)
                .send({
                  expectedVersion: 2,
                  priceKobo: "5700000000",
                  reason: "Committed listing",
                })
            ).status,
          ).toBe(409);
        }
      });
    }

    it("preserves staff attribution, branch scope, MFA/session checks and atomic price history", async () => {
      const staff = await account("STAFF", branch),
        foreign = await account("STAFF", other),
        weak = await account("ADMIN", undefined, false),
        customer = await account("CUSTOMER");
      const vehicle = await prisma.vehicle.create({
        data: {
          branchId: branch,
          stockNumber: "STAFF-" + randomUUID().slice(0, 20),
          make: "Toyota",
          model: "Camry",
          year: 2022,
        },
      });
      const listing = await prisma.vehicleListing.create({
        data: {
          vehicleId: vehicle.id,
          branchId: branch,
          title: "Synthetic scoped vehicle",
          slug: "scoped-" + randomUUID(),
          priceKobo: 10000n,
        },
      });
      const path = endpoint + "/listings/" + listing.id + "/price",
        body = { expectedVersion: 0, priceKobo: "11000", reason: "Synthetic price" };
      for (const actor of [foreign, weak, customer])
        expect((await request(app).post(path).set(actor.headers).send(body)).status).toBe(
          403,
        );
      expect((await request(app).post(path).send(body)).status).toBe(401);
      expect(
        (
          await request(app)
            .post(path)
            .set(staff.headers)
            .send({ ...body, changedByUserId: customer.user.id })
        ).status,
      ).toBe(422);
      const changes = await Promise.all(
        ["11000", "12000"].map((priceKobo) =>
          request(app)
            .post(path)
            .set(staff.headers)
            .send({ ...body, priceKobo }),
        ),
      );
      expect(changes.map((x) => x.status).sort()).toEqual([200, 409]);
      const profile = await prisma.staffProfile.findUniqueOrThrow({
        where: { userId: staff.user.id },
      });
      const history = await prisma.vehiclePriceHistory.findMany({
        where: { vehicleListingId: listing.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        changedByStaffId: profile.id,
        changedByUserId: staff.user.id,
        oldPriceKobo: 10000n,
      });
      const legacy = await prisma.vehiclePriceHistory.create({
        data: {
          vehicleListingId: listing.id,
          changedByStaffId: profile.id,
          oldPriceKobo: 9000n,
          newPriceKobo: 10000n,
          reason: "Preserved legacy fixture",
        },
      });
      expect(legacy.changedByUserId).toBeNull();
      await prisma.session.update({
        where: { id: staff.session.id },
        data: { revokedAt: new Date() },
      });
      expect(
        (
          await request(app)
            .post(path)
            .set(staff.headers)
            .send({ ...body, expectedVersion: 1, priceKobo: "13000" })
        ).status,
      ).toBe(401);
      expect(
        await prisma.vehiclePriceHistory.count({
          where: { vehicleListingId: listing.id },
        }),
      ).toBe(2);
    });
  },
);
