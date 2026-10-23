import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { VehicleDiscoveryRepository } from "../../src/modules/vehicles/vehicle-discovery.repository.js";
import {
  vehicleDiscoveryPageSchema,
  vehicleFacetPageSchema,
} from "../../src/modules/vehicles/vehicle-discovery.schemas.js";

const app = createApp({ checkReadiness: async () => undefined });
const path = "/api/v1/public/vehicles/discovery";
async function fixture() {
  const prefix = `Discovery-${randomUUID().slice(0, 8)}`;
  const branch = await prisma.branch.create({
    data: { code: prefix, name: prefix, address: "Test", city: "Test", state: "Test" },
  });
  const rows = [];
  for (let i = 0; i < 9; i++) {
    const vehicle = await prisma.vehicle.create({
      data: {
        branchId: branch.id,
        stockNumber: `${prefix}-${i}`,
        make: `${prefix}-${i < 4 ? "Alpha" : "Beta"}`,
        model: i % 2 ? "Coupe" : "Sedan",
        year: 2020 + (i % 3),
        acquisitionCostKobo: 10n,
        mileageKm: i === 0 || i === 7 ? null : Math.floor(i / 2) * 10000,
        condition: (["USED", "NEW", "FOREIGN_USED", "LOCALLY_USED"] as const)[i % 4],
        manufactureCountryCode: i < 4 ? "DE" : "CN",
        powertrain: i === 2 ? "PHEV" : "HEV",
        fuelType: "HYBRID",
        engineCapacityCc: i < 4 ? 1800 : 2500,
        features: i < 4 ? ["Sunroof"] : [],
      },
    });
    const listing = await prisma.vehicleListing.create({
      data: {
        vehicleId: vehicle.id,
        branchId: branch.id,
        title: `${prefix} ${i}`,
        slug: `${prefix.toLowerCase()}-${i}`,
        priceKobo: BigInt(10000 + Math.floor(i / 2) * 1000),
        status: i === 8 ? "DRAFT" : "AVAILABLE",
        publishedAt: i === 8 ? null : new Date(),
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(i / 2))),
      },
    });
    rows.push({ ...listing, vehicle });
  }
  return { prefix, branch, rows };
}
const page = async (query: Record<string, string | number | undefined>) => {
  const response = await request(app).get(path).query(query);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return vehicleDiscoveryPageSchema.parse(response.body.data);
};
const facets = async (query: Record<string, string | number | undefined>) => {
  const response = await request(app).get("/api/v1/public/vehicles/facets").query(query);
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return vehicleFacetPageSchema.parse(response.body.data);
};

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Vehicle discovery API and database",
  () => {
    afterAll(() => prisma.$disconnect());
    it("keeps page and count consistent when inventory changes between the two reads", async () => {
      const { prefix, rows } = await fixture();
      let changed = false;
      const concurrent = prisma.$extends({
        query: {
          vehicleListing: {
            async findMany({ args, query }) {
              const result = await query(args);
              if (!changed) {
                changed = true;
                await prisma.vehicleListing.update({
                  where: { id: rows[0]!.id },
                  data: { status: "INACTIVE" },
                });
              }
              return result;
            },
          },
        },
      });
      const response = await new VehicleDiscoveryRepository(
        concurrent as unknown as PrismaClient,
      ).listings({ search: prefix, sort: "newest", limit: 12 });
      expect(response).toMatchObject({
        totalMatches: 8,
        items: expect.arrayContaining([expect.objectContaining({ id: rows[0]!.id })]),
      });
      expect((await page({ search: prefix })).totalMatches).toBe(7);
    });
    it("serves exact totals and bounded searchable options over 10,000 synthetic listings", async () => {
      const prefix = `Volume-${randomUUID().slice(0, 8)}`;
      const branch = await prisma.branch.create({
        data: {
          code: prefix,
          name: prefix,
          address: "Test",
          city: "Test",
          state: "Test",
        },
      });
      await prisma.$executeRaw`INSERT INTO "Vehicle" ("id", "branchId", "stockNumber", "make", "model", "year", "updatedAt")
      SELECT gen_random_uuid(), ${branch.id}::uuid, ${prefix} || '-' || n, ${prefix} || '-' || lpad((n % 100)::text, 3, '0'), 'Model-' || ((n / 100) % 20), 2000 + n % 26, now()
      FROM generate_series(1, 10000) n`;
      await prisma.$executeRaw`INSERT INTO "VehicleListing" ("id", "vehicleId", "branchId", "title", "slug", "priceKobo", "status", "publishedAt", "updatedAt")
      SELECT gen_random_uuid(), v."id", v."branchId", v."make" || ' ' || v."model", lower(v."stockNumber"), 1000000000, 'AVAILABLE', now(), now()
      FROM "Vehicle" v WHERE v."branchId" = ${branch.id}::uuid`;
      await prisma.$executeRaw`ANALYZE "Vehicle"`;
      await prisma.$executeRaw`ANALYZE "VehicleListing"`;
      const start = performance.now();
      const inventory = await page({ search: prefix, limit: 20, sort: "price_desc" });
      const inventoryMs = performance.now() - start;
      expect(inventory.items).toHaveLength(20);
      expect(inventory.totalMatches).toBe(10000);
      const optionStart = performance.now();
      const names = await facets({ field: "make", search: prefix, limit: 20 });
      expect(names.items).toHaveLength(20);
      expect(names.nextCursor).toBeDefined();
      const all: string[] = [];
      let cursor: string | undefined;
      do {
        const result = await facets({ field: "make", search: prefix, limit: 20, cursor });
        all.push(...result.items.map((item) => item.value));
        cursor = result.nextCursor;
        expect(all.length).toBeLessThanOrEqual(100);
      } while (cursor);
      expect(new Set(all).size).toBe(100);
      expect(
        (await facets({ field: "model", make: `${prefix}-000`, limit: 20 })).items,
      ).toHaveLength(20);
      process.stdout.write(
        `Vehicle discovery volume: 10000 listings; inventory/count ${inventoryMs.toFixed(1)}ms; first options + complete 100-make traversal + model options ${(performance.now() - optionStart).toFixed(1)}ms.\n`,
      );
    }, 60000);
    it.each([
      "newest",
      "price_asc",
      "price_desc",
      "year_desc",
      "year_asc",
      "mileage_asc",
      "mileage_desc",
    ] as const)(
      "traverses tied %s values completely and counts the filtered public dataset",
      async (sort) => {
        const { prefix, rows } = await fixture();
        const seen: string[] = [];
        let cursor: string | undefined;
        do {
          const response = await page({ search: prefix, sort, cursor, limit: 3 });
          expect(response.totalMatches).toBe(8);
          expect(response.items.length).toBeLessThanOrEqual(3);
          expect(JSON.stringify(response)).not.toContain("acquisitionCostKobo");
          seen.push(...response.items.map((item) => item.id));
          expect(seen.length).toBeLessThanOrEqual(8);
          cursor = response.nextCursor;
        } while (cursor);
        const expected = rows.slice(0, 8).sort((a, b) => {
          if (sort === "mileage_asc" || sort === "mileage_desc") {
            const direction = sort === "mileage_asc" ? 1 : -1;
            if (a.vehicle.mileageKm === null && b.vehicle.mileageKm !== null) return 1;
            if (b.vehicle.mileageKm === null && a.vehicle.mileageKm !== null) return -1;
            return (
              (a.vehicle.mileageKm !== null && b.vehicle.mileageKm !== null
                ? (a.vehicle.mileageKm - b.vehicle.mileageKm) * direction
                : 0) || a.id.localeCompare(b.id) * direction
            );
          }
          const primary =
            sort === "newest"
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : sort === "year_desc" || sort === "year_asc"
                ? (b.vehicle.year - a.vehicle.year) * (sort === "year_asc" ? -1 : 1)
                : Number(a.priceKobo - b.priceKobo) * (sort === "price_asc" ? 1 : -1);
          return (
            primary ||
            (sort !== "price_asc" && sort !== "year_asc"
              ? b.id.localeCompare(a.id)
              : a.id.localeCompare(b.id))
          );
        });
        expect(seen).toEqual(expected.map((row) => row.id));
        expect(
          (await page({ search: prefix, make: `${prefix}-Alpha`, minPriceKobo: "11000" }))
            .totalMatches,
        ).toBe(2);
        const legacy = await request(app)
          .get("/api/v1/public/vehicles")
          .query({ search: prefix, limit: 2 });
        expect(legacy.status).toBe(200);
        expect(legacy.body.data.nextCursor).toMatch(/^[0-9a-f-]{36}$/);
        expect(
          (await page({ search: prefix, limit: 2, cursor: legacy.body.data.nextCursor }))
            .items,
        ).toHaveLength(2);
      },
    );
    it("filters real attributes before counting/paging and keeps legacy unknown values distinct", async () => {
      const { prefix, rows } = await fixture();
      for (const condition of ["NEW", "FOREIGN_USED", "LOCALLY_USED", "USED"]) {
        const result = await page({ search: prefix, condition, limit: 1 });
        expect(result.totalMatches).toBe(2);
        expect(result.items[0]!.vehicle.condition).toBe(condition);
      }
      expect(
        (await page({ search: prefix, manufactureRegion: "EUROPE" })).totalMatches,
      ).toBe(4);
      expect(
        (await page({ search: prefix, manufactureCountryCode: "CN" })).totalMatches,
      ).toBe(4);
      expect(
        (await page({ search: prefix, powertrain: "PHEV" })).items.map((r) => r.id),
      ).toEqual([rows[2]!.id]);
      expect(
        (await page({ search: prefix, fuelType: "HYBRID", powertrain: "HEV" }))
          .totalMatches,
      ).toBe(7);
      expect(
        (
          await page({
            search: prefix,
            minEngineCapacityCc: 2000,
            maxEngineCapacityCc: 2500,
          })
        ).totalMatches,
      ).toBe(4);
      expect(
        (await page({ search: prefix, feature: "Sunroof", maxMileageKm: 10000 }))
          .totalMatches,
      ).toBe(3);
      expect(
        (await page({ search: prefix, minYear: 2021, maxYear: 2021 })).totalMatches,
      ).toBe(3);
      const first = await page({ search: prefix, manufactureRegion: "EUROPE", limit: 1 });
      expect(
        (
          await request(app).get(path).query({
            search: prefix,
            manufactureCountryCode: "CN",
            cursor: first.nextCursor,
          })
        ).status,
      ).toBe(422);
      for (const invalid of [
        { manufactureCountryCode: "ZZ" },
        { manufactureCountryCode: "CN", manufactureRegion: "EUROPE" },
        { minYear: 2025, maxYear: 2018 },
        { minMileageKm: -1 },
        { powertrain: "HYBRID" },
        { model: "Sedan" },
      ]) {
        expect((await request(app).get(path).query(invalid)).status).toBe(422);
      }
    });
    it("continues after its anchor is removed and binds cursors to sort and filters", async () => {
      const { prefix } = await fixture();
      const first = await page({ search: prefix, limit: 2 });
      await prisma.vehicleListing.delete({ where: { id: first.items[1]!.id } });
      const second = await page({ search: prefix, cursor: first.nextCursor, limit: 2 });
      expect(second.totalMatches).toBe(7);
      expect(second.items).toHaveLength(2);
      expect(
        second.items.some((item) => first.items.some((prior) => prior.id === item.id)),
      ).toBe(false);
      for (const query of [{ search: prefix, sort: "price_asc" }, { search: "other" }]) {
        const response = await request(app)
          .get(path)
          .query({ ...query, cursor: first.nextCursor });
        expect(response.status).toBe(422);
      }
      const altered =
        first.nextCursor!.slice(0, -1) + (first.nextCursor!.endsWith("0") ? "1" : "0");
      expect(
        (await request(app).get(path).query({ search: prefix, cursor: altered })).status,
      ).toBe(422);
    });
    it("paginates case-folded visible options and restricts models to the chosen make", async () => {
      const { prefix, branch, rows } = await fixture();
      await prisma.vehicle.update({
        where: { id: rows[0]!.vehicleId },
        data: { make: `${prefix}-ALPHA`, model: "sedan" },
      });
      await prisma.vehicle.update({
        where: { id: rows[8]!.vehicleId },
        data: { make: `${prefix}-Hidden` },
      });
      const first = await facets({ field: "make", search: prefix, limit: 1 });
      expect(first.items).toHaveLength(1);
      expect(first.items[0]!.value).toBe(`${prefix}-alpha`.toLowerCase());
      const second = await facets({
        field: "make",
        search: prefix,
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(second.items.map((item) => item.value)).toEqual([
        `${prefix}-beta`.toLowerCase(),
      ]);
      expect(second.nextCursor).toBeUndefined();
      const models = await facets({
        field: "model",
        make: `${prefix}-alpha`,
        search: "se",
      });
      expect(models.items.map((item) => item.value)).toEqual(["sedan"]);
      expect(
        (await facets({ field: "model", make: `${prefix}-beta`, search: "unmatched" }))
          .items,
      ).toEqual([]);
      expect(
        (
          await request(app)
            .get("/api/v1/public/vehicles/facets")
            .query({ field: "make", search: "other", cursor: first.nextCursor })
        ).status,
      ).toBe(422);
      await prisma.vehicleListing.updateMany({
        where: {
          branchId: branch.id,
          vehicle: { make: { equals: `${prefix}-alpha`, mode: "insensitive" } },
        },
        data: { status: "INACTIVE" },
      });
      expect(
        (
          await facets({ field: "make", search: prefix, cursor: first.nextCursor })
        ).items.map((item) => item.value),
      ).toEqual([`${prefix}-beta`.toLowerCase()]);
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
      expect((await facets({ field: "make", search: prefix })).items).toEqual([]);
      expect(await page({ search: prefix })).toEqual({ items: [], totalMatches: 0 });
    });
    it("treats facet search wildcard characters literally", async () => {
      const { prefix, rows } = await fixture();
      await prisma.vehicle.update({
        where: { id: rows[0]!.vehicleId },
        data: { make: `${prefix}%_special` },
      });
      const result = await facets({ field: "make", search: `${prefix}%_` });
      expect(result.items.map((item) => item.value)).toEqual([
        `${prefix}%_special`.toLowerCase(),
      ]);
      expect((await page({ make: `${prefix}%_special` })).totalMatches).toBe(1);
      expect((await page({ make: `${prefix}%` })).totalMatches).toBe(0);
      expect((await page({ search: `${prefix}%_` })).totalMatches).toBe(1);
    });
    it("rejects unsupported fields, malformed cursors, oversized or repeated limits and invalid model relationships", async () => {
      for (const query of [
        "status=DRAFT",
        "limit=51",
        "limit=1&limit=2",
        "cursor=bad",
        "year[]=2020",
        "minPriceKobo=200&maxPriceKobo=100",
      ])
        expect((await request(app).get(`${path}?${query}`)).status).toBe(422);
      for (const query of [
        "field=model",
        "field=make&make=Toyota",
        "field=vin",
        "field=make&limit=51",
        "field=make&limit=1&limit=2",
      ])
        expect(
          (await request(app).get(`/api/v1/public/vehicles/facets?${query}`)).status,
        ).toBe(422);
    });
  },
);
