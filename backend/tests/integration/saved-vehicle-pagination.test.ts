import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { savedVehiclePageSchema } from "../../src/modules/vehicles/saved-vehicle.schemas.js";
import { testOwner } from "../helpers/owner.js";

const path = "/api/v1/customers/saved-vehicles/page";
const app = createApp({ checkReadiness: async () => undefined });
async function account(role: Exclude<UserRole, "SUPER_ADMIN"> = "CUSTOMER") {
  const user = await prisma.user.create({
    data: {
      email: `saved-page-${randomUUID()}@example.test`,
      passwordHash: "unusable-test-password",
      role,
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Saved", lastName: "Paging", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  return { user, cookie: await session(user.id, role), customerId: user.profile!.id };
}
async function session(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 3600000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", generateOpaqueToken()),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: new Date(Date.now() - 1000),
      mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
      mfaRequired: role !== "CUSTOMER",
    },
  });
  return `${sessionCookieName}=${token}`;
}
async function fixture(count = 15) {
  const owner = await account();
  const branch = await prisma.branch.create({
    data: {
      code: `SP-${randomUUID().slice(0, 8)}`,
      name: "Saved paging",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const rows = [];
  for (let i = 0; i < count; i++) {
    const vehicle = await prisma.vehicle.create({
      data: {
        branchId: branch.id,
        stockNumber: `SP-${randomUUID()}`,
        make: "Test",
        model: "Paging",
        year: 2025,
        vin: randomUUID().replaceAll("-", "").slice(0, 17).toUpperCase(),
        acquisitionCostKobo: 1000n,
      },
    });
    const listing = await prisma.vehicleListing.create({
      data: {
        vehicleId: vehicle.id,
        branchId: branch.id,
        title: `Saved ${i}`,
        slug: `sp-${randomUUID()}`,
        priceKobo: 10000n,
        status: "AVAILABLE",
        publishedAt: new Date(),
      },
    });
    rows.push(
      await prisma.savedVehicle.create({
        data: { customerId: owner.customerId, vehicleListingId: listing.id },
      }),
    );
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  return { ...owner, branch, rows };
}
const getPage = async (cookie: string, cursor?: string, limit = 12) => {
  const response = await request(app)
    .get(path)
    .set("Cookie", cookie)
    .query({ limit, ...(cursor ? { cursor } : {}) });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return savedVehiclePageSchema.parse(response.body.data);
};

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Saved vehicles database and HTTP paging",
  () => {
    afterAll(() => prisma.$disconnect());
    it("traverses every owned visible record once, returns bounded final pages, and preserves the legacy array", async () => {
      const owner = await fixture(27);
      const stranger = await account();
      await prisma.savedVehicle.create({
        data: {
          customerId: stranger.customerId,
          vehicleListingId: owner.rows[0]!.vehicleListingId,
        },
      });
      const ids: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await getPage(owner.cookie, cursor);
        expect(page.items.length).toBeLessThanOrEqual(12);
        ids.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
        expect(++pages).toBeLessThanOrEqual(3);
        const serialized = JSON.stringify(page);
        for (const privateField of [
          "acquisitionCostKobo",
          '"vin"',
          "objectKey",
          "customerId",
          "passwordHash",
        ])
          expect(serialized).not.toContain(privateField);
      } while (cursor);
      expect(ids).toEqual(owner.rows.map((row) => row.id));
      const legacy = await request(app)
        .get("/api/v1/customers/saved-vehicles")
        .set("Cookie", owner.cookie);
      expect(legacy.status).toBe(200);
      expect(legacy.body.data.map((row: { id: string }) => row.id)).toEqual(ids);
      expect((await getPage(stranger.cookie)).items).toHaveLength(1);
      expect(await getPage((await account()).cookie)).toEqual({ items: [] });
    });
    it("continues after deletion of the prior anchor and rejects another customer's or modified cursor", async () => {
      const owner = await fixture(5);
      const first = await getPage(owner.cookie, undefined, 2);
      await prisma.savedVehicle.delete({ where: { id: first.items[1]!.id } });
      const second = await getPage(owner.cookie, first.nextCursor, 2);
      expect(second.items.map((item) => item.id)).toEqual(
        owner.rows.slice(2, 4).map((row) => row.id),
      );
      const other = await account();
      for (const [cookie, cursor] of [
        [other.cookie, first.nextCursor!],
        [owner.cookie, `${randomUUID()}${first.nextCursor!.slice(36)}`],
      ]) {
        const response = await request(app)
          .get(path)
          .set("Cookie", cookie!)
          .query({ cursor });
        expect(response.status).toBe(422);
        expect(response.body.error.code).toBe("VALIDATION_FAILED");
        expect(response.body.data).toBeUndefined();
      }
      // Previously issued cursors survive their anchor's deletion and can reach an empty tail.
      await prisma.savedVehicle.deleteMany({
        where: { customerId: owner.customerId, id: { gt: first.items[1]!.id } },
      });
      expect(await getPage(owner.cookie, first.nextCursor)).toEqual({ items: [] });
    });
    it("rechecks listing and branch visibility without requiring the cursor anchor to remain public", async () => {
      const owner = await fixture(6);
      const first = await getPage(owner.cookie, undefined, 2);
      await prisma.vehicleListing.updateMany({
        where: { id: { in: owner.rows.slice(1, 4).map((row) => row.vehicleListingId) } },
        data: { status: "INACTIVE" },
      });
      const next = await getPage(owner.cookie, first.nextCursor);
      expect(next.items.map((item) => item.id)).toEqual(
        owner.rows.slice(4).map((row) => row.id),
      );
      await prisma.branch.update({
        where: { id: owner.branch.id },
        data: { isActive: false },
      });
      expect(await getPage(owner.cookie, first.nextCursor)).toEqual({ items: [] });
    });
    it("enforces customer access and strict query validation at the HTTP boundary", async () => {
      expect((await request(app).get(path)).status).toBe(401);
      for (const role of ["STAFF", "ADMIN"] as const) {
        expect(
          (
            await request(app)
              .get(path)
              .set("Cookie", (await account(role)).cookie)
          ).status,
        ).toBe(403);
      }
      // Share the protected singleton owner with the other database suites.
      // A second synthetic owner would violate the production database constraint.
      const administrator = await testOwner("unusable-test-password");
      expect(
        (
          await request(app)
            .get(path)
            .set("Cookie", await session(administrator.id, "SUPER_ADMIN"))
        ).status,
      ).toBe(403);
      const owner = await account();
      for (const query of [
        "limit=0",
        "limit=51",
        "limit=1&limit=2",
        "cursor=invalid",
        "limit=",
        `customerId=${randomUUID()}`,
        "cursor[]=bad",
      ]) {
        expect(
          (await request(app).get(`${path}?${query}`).set("Cookie", owner.cookie)).status,
        ).toBe(422);
      }
      const good = await request(app).get(path).set("Cookie", owner.cookie);
      expect(good.status).toBe(200);
      expect(good.headers["cache-control"]).toContain("no-store");
    });
  },
);
