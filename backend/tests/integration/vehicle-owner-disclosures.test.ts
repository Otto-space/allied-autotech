import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { vehicleCreateBodySchema } from "../../src/modules/vehicles/vehicles.schemas.js";

const app = createApp({ checkReadiness: async () => undefined });
async function account(role: "ADMIN" | "STAFF" | "CUSTOMER", branchId: string) {
  const user = await prisma.user.create({
    data: {
      email: `disclosure-${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Synthetic",
                lastName: "Disclosure",
                phone: "+2348000000000",
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Synthetic", lastName: "Disclosure", branchId },
            },
          }),
    },
  });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiresAt = new Date(Date.now() + 3600000);
  await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
    },
  });
  return {
    id: user.id,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "owner-reported vehicle disclosures",
  () => {
    afterAll(async () => {
      await prisma.$disconnect();
    });
    it("preserves unknowns, stock uniqueness, publication rules, scope, audit and public disclosure", async () => {
      const [identity] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(identity?.database).toBe(env.DB_NAME);
      expect(identity?.port).toBe(env.DB_PORT);
      if (process.env.GITHUB_ACTIONS === "true") {
        // The fresh CI service is reached through its localhost port mapping;
        // PostgreSQL reports its container-side address rather than that client alias.
        expect(env.DB_HOST).toBe("localhost");
        expect(env.DB_NAME).toBe("allied_autotech_schema_ci");
        expect(env.DB_PORT).toBe(5432);
        expect(identity?.host).toMatch(
          /^(?:127\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.|::1$)/,
        );
      } else expect(identity?.host).toBe(env.DB_HOST);
      expect(identity!.database).toMatch(/_(test|ci)$/);
      const prefix = randomUUID().slice(0, 8);
      const branch = await prisma.branch.create({
        data: {
          code: `DISC-${prefix}`,
          name: "Synthetic vehicle disclosure",
          address: "Synthetic",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const other = await prisma.branch.create({
        data: {
          code: `OTHER-${prefix}`,
          name: "Synthetic other",
          address: "Synthetic",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const admin = await account("ADMIN", branch.id),
        foreign = await account("STAFF", other.id),
        customer = await account("CUSTOMER", branch.id);
      const draft = JSON.parse(
        await readFile(
          new URL("../../data/vehicle-drafts/bmw-120i-2007.json", import.meta.url),
          "utf8",
        ),
      );
      const body = vehicleCreateBodySchema.parse({
        ...draft.vehicle,
        branchId: branch.id,
        stockNumber: `BMW-${prefix}`,
      });
      const path = "/api/v1/staff/vehicles";
      expect((await request(app).post(path).send(body)).status).toBe(401);
      expect(
        (await request(app).post(path).set(customer.headers).send(body)).status,
      ).toBe(403);
      expect((await request(app).post(path).set(foreign.headers).send(body)).status).toBe(
        403,
      );
      const created = await request(app).post(path).set(admin.headers).send(body);
      expect(created.status).toBe(201);
      const stock = created.body.data;
      expect(stock).toMatchObject({
        engineCode: "N46",
        cylinders: 4,
        mileageKm: null,
        transmission: null,
        fuelType: null,
        color: null,
        manufactureCountryCode: null,
        conditionReports: [],
        listings: [],
      });
      expect((await request(app).post(path).set(admin.headers).send(body)).status).toBe(
        409,
      );
      expect(
        await prisma.vehicle.count({ where: { stockNumber: body.stockNumber } }),
      ).toBe(1);
      const listingBody = {
        vehicleId: stock.id,
        title: "Synthetic BMW draft",
        slug: `synthetic-bmw-${prefix}`,
        priceKobo: "10000",
        description: "Synthetic test price, not an owner asking price.",
      };
      expect(
        (
          await request(app)
            .post(`${path}/listings`)
            .set(admin.headers)
            .send({ ...listingBody, priceKobo: "0" })
        ).status,
      ).toBe(422);
      const listing = await request(app)
        .post(`${path}/listings`)
        .set(admin.headers)
        .send(listingBody);
      expect(listing.status).toBe(201);
      const id = listing.body.data.id,
        publicPath = `/api/v1/public/vehicles/${id}`;
      expect((await request(app).get(publicPath)).status).toBe(404);
      expect(
        (
          await request(app)
            .post(`${path}/listings/${id}/status`)
            .set(admin.headers)
            .send({ expectedVersion: 0, status: "AVAILABLE" })
        ).status,
      ).toBe(409);
      // Direct synthetic legacy media fixture; secure managed upload is exercised by stock-media.test.ts.
      await prisma.vehicleImage.create({
        data: {
          vehicleId: stock.id,
          url: "https://example.test/synthetic.webp",
          altText: "Synthetic front view",
          isPrimary: true,
        },
      });
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
      expect(
        (
          await request(app)
            .post(`${path}/listings/${id}/status`)
            .set(admin.headers)
            .send({ expectedVersion: 0, status: "AVAILABLE" })
        ).status,
      ).toBe(409);
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: true } });
      expect(
        (
          await request(app)
            .post(`${path}/listings/${id}/status`)
            .set(admin.headers)
            .send({ expectedVersion: 0, status: "AVAILABLE" })
        ).status,
      ).toBe(200);
      const published = await request(app).get(publicPath);
      expect(published.body.data.vehicle).toMatchObject({
        ownerReportedIssues: draft.vehicle.ownerReportedIssues,
        ownerReportedCondition: draft.vehicle.ownerReportedCondition,
        mileageKm: null,
        cylinders: 4,
        engineCode: "N46",
        conditionReports: [],
      });
      expect(published.body.data.vehicle).not.toHaveProperty("vin");
      const update = {
        expectedVersion: 0,
        ownerReportedIssues: "Owner correction: AC still not working; cause unverified.",
      };
      expect(
        (
          await request(app)
            .patch(`${path}/${stock.id}`)
            .set(foreign.headers)
            .send(update)
        ).status,
      ).toBe(403);
      expect(
        (await request(app).patch(`${path}/${stock.id}`).set(admin.headers).send(update))
          .status,
      ).toBe(200);
      expect(
        (await request(app).patch(`${path}/${stock.id}`).set(admin.headers).send(update))
          .status,
      ).toBe(409);
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: stock.id, action: "UPDATE" },
      });
      expect(audit.oldValues).toMatchObject({
        ownerReportedIssues: draft.vehicle.ownerReportedIssues,
      });
      expect(audit.newValues).toMatchObject({
        ownerReportedIssues: update.ownerReportedIssues,
        version: 1,
      });
      for (const [location, included] of [
        ["port harcourt", true],
        ["rivers", true],
        ["Lagos", false],
        ["%", false],
      ] as const) {
        const response = await request(app)
          .get("/api/v1/public/vehicles/discovery")
          .query({ location, make: "BMW", search: `Synthetic BMW draft` });
        expect(response.status).toBe(200);
        expect(
          response.body.data.items.some((row: { id: string }) => row.id === id),
        ).toBe(included);
      }
      expect(
        (
          await request(app)
            .post(path)
            .set(admin.headers)
            .send({ ...body, stockNumber: `CROSS-${prefix}`, bodyType: "CROSSOVER" })
        ).status,
      ).toBe(201);
      expect(
        (
          await request(app)
            .post(path)
            .set(admin.headers)
            .send({ ...body, stockNumber: `MINI-${prefix}`, bodyType: "MINIVAN" })
        ).status,
      ).toBe(201);
      expect(
        (
          await request(app)
            .post(`${path}/listings/${id}/status`)
            .set(admin.headers)
            .send({ expectedVersion: 1, status: "INACTIVE" })
        ).status,
      ).toBe(200);
      expect((await request(app).get(publicPath)).status).toBe(404);
      const photo = await prisma.vehicleImage.findFirstOrThrow({
        where: { vehicleId: stock.id },
      });
      const race = await Promise.all([
        request(app)
          .post(`${path}/listings/${id}/status`)
          .set(admin.headers)
          .send({ expectedVersion: 2, status: "AVAILABLE" }),
        request(app)
          .delete(`${path}/${stock.id}/images/${photo.id}`)
          .set(admin.headers)
          .send({ expectedVersion: 1 }),
      ]);
      expect(race.map((response) => response.status).sort()).toEqual([200, 409]);
      const finalListing = await prisma.vehicleListing.findUniqueOrThrow({
        where: { id },
      });
      const finalPhotos = await prisma.vehicleImage.count({
        where: { vehicleId: stock.id },
      });
      expect(
        finalListing.status === "AVAILABLE" ? finalPhotos > 0 : finalPhotos === 0,
      ).toBe(true);
    });
  },
);
