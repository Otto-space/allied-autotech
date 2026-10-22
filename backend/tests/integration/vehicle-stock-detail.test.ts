import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { VehiclesRepository } from "../../src/modules/vehicles/vehicles.repository.js";
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

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")("vehicle stock detail", () => {
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
    const make = async (active: boolean) =>
      (
        await prisma.branch.create({
          data: {
            code: randomUUID().slice(0, 8),
            name: "Synthetic detail branch",
            address: "Synthetic",
            city: "Synthetic",
            state: "Synthetic",
            isActive: active,
          },
        })
      ).id;
    branch = await make(true);
    other = await make(true);
    old = await make(false);
  });
  afterAll(async () => {
    await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    await prisma.$disconnect();
  });
  const seed = (branchId = branch) =>
    prisma.vehicle.create({
      data: {
        branchId,
        stockNumber: "DETAIL-" + randomUUID().slice(0, 10).toUpperCase(),
        make: "Toyota",
        model: "Camry",
        year: 2022,
        mileageKm: 0,
        acquisitionCostKobo: 9999999999999999n,
        acquiredAt: new Date("2026-10-17T09:00:37.123Z"),
      },
    });
  it("reads precise full role projections with private headers and branch/MFA boundaries", async () => {
    const vehicle = await seed(),
      admin = await account("ADMIN"),
      staff = await account("STAFF", branch),
      foreign = await account("STAFF", other),
      customer = await account("CUSTOMER"),
      unverified = await account("ADMIN", undefined, false),
      owner = await account("SUPER_ADMIN");
    for (const actor of [admin, owner, staff]) {
      const result = await request(app)
        .get(endpoint + "/" + vehicle.id)
        .set(actor.headers);
      expect(result.status).toBe(200);
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(result.body.data.id).toBe(vehicle.id);
      expect(result.body.data.acquiredAt).toBe("2026-10-17T09:00:37.123Z");
      if (actor === staff) {
        expect(result.body.data).not.toHaveProperty("acquisitionCostKobo");
        expect(result.body.data).not.toHaveProperty("acquisitionCurrency");
      } else expect(result.body.data.acquisitionCostKobo).toBe("9999999999999999");
    }
    for (const actor of [foreign, customer, unverified])
      expect(
        (
          await request(app)
            .get(endpoint + "/" + vehicle.id)
            .set(actor.headers)
        ).status,
      ).toBe(403);
    expect((await request(app).get(endpoint + "/" + vehicle.id)).status).toBe(401);
  });
  it("retains precision/cost through permitted partial edits and rejects stale or private Staff writes", async () => {
    const vehicle = await seed(),
      admin = await account("ADMIN"),
      staff = await account("STAFF", branch),
      base = endpoint + "/" + vehicle.id;
    const patch = (actor: typeof admin, body: object) =>
      request(app).patch(base).set(actor.headers).send(body);
    const first = await patch(admin, { expectedVersion: 0, color: "Red" });
    expect(first.status).toBe(200);
    expect(first.body.data.version).toBe(1);
    expect(first.body.data.acquiredAt).toBe("2026-10-17T09:00:37.123Z");
    expect((await patch(admin, { expectedVersion: 0, color: "Stale" })).status).toBe(409);
    for (const cost of [null, "100"])
      expect(
        (await patch(staff, { expectedVersion: 1, acquisitionCostKobo: cost })).status,
      ).toBe(403);
    const second = await patch(staff, { expectedVersion: 1, color: "Blue" });
    expect(second.status).toBe(200);
    expect(second.body.data).not.toHaveProperty("acquisitionCostKobo");
    const saved = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    expect(saved.acquiredAt!.toISOString()).toBe("2026-10-17T09:00:37.123Z");
    expect(saved.acquisitionCostKobo).toBe(9999999999999999n);
    expect(saved.version).toBe(2);
    expect(
      await prisma.auditLog.count({ where: { entityId: vehicle.id, action: "UPDATE" } }),
    ).toBe(2);
    const history = await seed(old);
    expect(
      (
        await request(app)
          .patch(endpoint + "/" + history.id)
          .set(admin.headers)
          .send({ expectedVersion: 0, color: "Historical blue" })
      ).status,
    ).toBe(200);
  });
  it("keeps listing/document versions independent and returns exact condition receipts", async () => {
    const vehicle = await seed(),
      admin = await account("ADMIN", branch),
      path = endpoint + "/" + vehicle.id;
    const create = await request(app)
      .post(endpoint + "/listings")
      .set(admin.headers)
      .send({
        vehicleId: vehicle.id,
        title: "Synthetic detail sale",
        slug: "detail-" + randomUUID(),
        priceKobo: "2850000000",
        description: "Exact public description",
        featured: false,
      });
    expect(create.status).toBe(201);
    const listing = create.body.data;
    expect(listing.vehicleId).toBe(vehicle.id);
    expect(listing.version).toBe(0);
    const price = await request(app)
      .post(endpoint + "/listings/" + listing.id + "/price")
      .set(admin.headers)
      .send({
        expectedVersion: 0,
        priceKobo: "9999999999999999",
        reason: "Synthetic correction",
      });
    expect(price.status).toBe(200);
    expect(price.body.data.version).toBe(1);
    expect(price.body.data.priceKobo).toBe("9999999999999999");
    expect(
      (
        await request(app)
          .patch(endpoint + "/listings/" + listing.id)
          .set(admin.headers)
          .send({ expectedVersion: 0, title: "Stale" })
      ).status,
    ).toBe(409);
    const doc = await new VehiclesRepository(prisma).addDocument(
      vehicle.id,
      {
        assetToken: "synthetic-repository-only-ticket-".repeat(3),
        type: "REGISTRATION",
        objectKey: "synthetic/detail/" + randomUUID(),
        checksum: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 4096,
        issuedAt: "2026-10-01T10:00:37.123+01:00",
        expiresAt: "2027-10-01T10:00:37.123+01:00",
      },
      prisma,
    );
    expect(doc.issuedAt?.toISOString()).toBe("2026-10-01T09:00:37.123Z");
    expect(doc.expiresAt?.toISOString()).toBe("2027-10-01T09:00:37.123Z");
    expect(doc.verifiedAt).toBeNull();
    expect(doc.rejectionReason).toBeNull();
    expect(doc).not.toHaveProperty("objectKey");
    const review = await request(app)
      .post(path + "/documents/" + doc.id + "/review")
      .set(admin.headers)
      .send({
        expectedVersion: 0,
        status: "REJECTED",
        rejectionReason: "Synthetic assessment",
      });
    expect(review.status).toBe(200);
    expect(review.body.data.id).toBe(doc.id);
    expect(review.body.data.version).toBe(1);
    expect(review.body.data.verificationStatus).toBe("REJECTED");
    expect(review.body.data.rejectionReason).toBe("Synthetic assessment");
    expect(review.body.data.verifiedAt).toBeNull();
    expect(review.body.data.issuedAt).toBe("2026-10-01T09:00:37.123Z");
    expect(review.body.data.expiresAt).toBe("2027-10-01T09:00:37.123Z");
    expect(review.body.data.createdAt).toBe(doc.createdAt.toISOString());
    expect(review.body.data.objectKey).toBeUndefined();
    expect(
      (
        await request(app)
          .post(path + "/documents/" + doc.id + "/review")
          .set(admin.headers)
          .send({ expectedVersion: 0, status: "VERIFIED" })
      ).status,
    ).toBe(409);
    const report = await request(app)
      .post(path + "/condition-reports")
      .set(admin.headers)
      .send({
        summary: "Typed public findings",
        inspectedAt: "2026-10-17T10:00:37.123+01:00",
        odometerKm: 0,
        conditionScore: 0,
        findings: { spareKey: false, reading: 0, notes: null },
      });
    expect(report.status).toBe(201);
    expect(report.body.data.inspectionId).toBeNull();
    expect(report.body.data.inspectedAt).toBe("2026-10-17T09:00:37.123Z");
    expect(report.body.data.findings).toEqual({
      spareKey: false,
      reading: 0,
      notes: null,
    });
    const current = await request(app).get(path).set(admin.headers);
    expect(current.body.data.version).toBe(0);
    expect(current.body.data.listings[0].version).toBe(1);
    expect(current.body.data.documents[0].version).toBe(1);
    expect(current.body.data.documents[0].sizeBytes).toBe("4096");
    expect(current.body.data.conditionReports[0].conditionScore).toBe(0);
    expect(
      await prisma.vehiclePriceHistory.count({ where: { vehicleListingId: listing.id } }),
    ).toBe(1);
  });
});
