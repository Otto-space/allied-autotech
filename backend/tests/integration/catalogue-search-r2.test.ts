import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "catalogue search revision 2",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let categoryId: string;
    let exactId: string;
    let weakId: string;
    let oilId: string;
    let corollaId: string;
    let alphabeticId: string;
    let alphabeticWeakId: string;
    const at = new Date("2026-01-01T00:00:00Z");
    const identifier = `QX/${randomUUID().slice(0, 8)}`;
    const alphabeticCode = `AX-${Array.from(randomUUID().replaceAll("-", "").slice(0, 12), (char) => String.fromCharCode(65 + parseInt(char, 16))).join("")}-A`;
    beforeAll(async () => {
      const category = await prisma.category.create({
        data: { name: "Synthetic recorded catalogue", slug: `r2-${randomUUID()}` },
      });
      categoryId = category.id;
      const create = (fields: {
        name: string;
        priceKobo?: bigint;
        description?: string;
        manufacturerPartNumber?: string;
        family?: "ENGINE_OIL";
        oilViscosityGrade?: string;
        isActive?: boolean;
        brand?: string;
      }) =>
        prisma.product.create({
          data: {
            categoryId,
            slug: `r2-${randomUUID()}`,
            sku: `R2-${randomUUID()}`,
            priceKobo: 10000n,
            createdAt: at,
            ...fields,
          },
        });
      exactId = (
        await create({
          name: "Brake assembly",
          manufacturerPartNumber: `${identifier}-A`,
          priceKobo: 20000n,
        })
      ).id;
      weakId = (
        await create({
          name: "Workshop kit",
          description: `Ask about ${identifier}-A`,
          priceKobo: 10000n,
        })
      ).id;
      await create({
        name: "Different assembly",
        manufacturerPartNumber: `${identifier}-B`,
      });
      alphabeticId = (
        await create({ name: "Cooling-fan", manufacturerPartNumber: alphabeticCode })
      ).id;
      alphabeticWeakId = (
        await create({
          name: "Alternative pack",
          description: `Ask about ${alphabeticCode}`,
        })
      ).id;
      await create({
        name: "Alternative assembly",
        manufacturerPartNumber: alphabeticCode.slice(0, -1) + "B",
      });
      await create({ name: "Brake" });
      for (let i = 0; i < 4; i++) await create({ name: `Brake pads set ${i}` });
      oilId = (
        await create({
          name: "Longlife lubricant",
          family: "ENGINE_OIL",
          brand: "Quasar",
          oilViscosityGrade: "5W-30",
        })
      ).id;
      await create({
        name: "Longlife lubricant",
        family: "ENGINE_OIL",
        brand: "Quasar",
        oilViscosityGrade: "5W-40",
      });
      await create({
        name: "Quasar engine oil 5W30",
        family: "ENGINE_OIL",
        oilViscosityGrade: "5W-30",
        isActive: false,
      });
      const branch = await prisma.branch.create({
        data: {
          code: `R2-${randomUUID().slice(0, 8)}`,
          name: "Synthetic search branch",
          address: "Test",
          city: "Test",
          state: "Test",
        },
      });
      for (const [model, status] of [
        ["Corolla", "AVAILABLE"],
        ["Camry", "AVAILABLE"],
        ["Corolla", "DRAFT"],
      ] as const) {
        const vehicle = await prisma.vehicle.create({
          data: {
            branchId: branch.id,
            stockNumber: `R2-${randomUUID().slice(0, 20)}`,
            make: "Toyota",
            model,
            year: 2018,
            condition: "FOREIGN_USED",
          },
        });
        const listing = await prisma.vehicleListing.create({
          data: {
            vehicleId: vehicle.id,
            branchId: branch.id,
            title: "Quiet road",
            slug: `r2-${randomUUID()}`,
            priceKobo: 1500000000n,
            status,
            ...(status === "AVAILABLE" ? { publishedAt: at } : {}),
          },
        });
        if (model === "Corolla" && status === "AVAILABLE") corollaId = listing.id;
      }
    });
    afterAll(() => prisma.$disconnect());
    async function products(query: Record<string, string | number | undefined>) {
      const r = await request(app)
        .get("/api/v1/public/catalog/products/discovery")
        .query({ categoryId, ...query })
        .expect(200);
      return r.body.data as {
        items: { id: string }[];
        totalMatches: number;
        nextCursor?: string;
      };
    }
    it("matches all words across make/model and keeps structured boundaries", async () => {
      const r = await request(app)
        .get("/api/v1/public/vehicles/discovery")
        .query({
          search: " Toyota   Corolla ",
          conditions: "FOREIGN_USED",
          maxPriceKobo: "1500000000",
        })
        .expect(200);
      expect(r.body.data.items.map((p: { id: string }) => p.id)).toContain(corollaId);
      expect(
        r.body.data.items.every(
          (p: { vehicle: { model: string } }) => p.vehicle.model === "Corolla",
        ),
      ).toBe(true);
      await request(app)
        .get("/api/v1/public/vehicles/discovery")
        .query({
          search: "Toyota Corolla",
          maxPriceKobo: "1499999999",
        })
        .expect(200)
        .expect((r) => expect(r.body.data.items).toEqual([]));
    });
    it("matches oil brand plus recorded grade, keeps grades distinct and applies the curated alias", async () => {
      for (const search of ["Quasar 5W30", "Quasar 5W-30"])
        expect((await products({ search })).items.map((p) => p.id)).toEqual([oilId]);
      const engine = await products({ search: "engine oil" });
      const motor = await products({ search: "motor oil" });
      expect(engine.totalMatches).toBe(2);
      expect(motor.items).toEqual(engine.items);
    });
    it("ranks exact identifiers first, preserves suffixes and lets explicit sorting override rank", async () => {
      expect(
        (await products({ search: `${identifier}-A` })).items.map((p) => p.id),
      ).toEqual([exactId, weakId]);
      expect(
        (await products({ search: `${identifier}-A`, sort: "price_asc" })).items.map(
          (p) => p.id,
        ),
      ).toEqual([weakId, exactId]);
      expect((await products({ search: identifier })).totalMatches).toBe(0);
      expect((await products({ search: "br" })).totalMatches).toBe(0);
      expect((await products({ search: "brak" })).totalMatches).toBe(6);
    });
    it("traverses equal-rank/equal-price records without omissions and rejects changed-state cursors", async () => {
      for (const sort of [undefined, "newest", "price_asc"]) {
        let cursor: string | undefined;
        const seen: string[] = [];
        do {
          const r = await products({ search: "brake", sort, limit: 1, cursor });
          seen.push(...r.items.map((p) => p.id));
          cursor = r.nextCursor;
        } while (cursor);
        expect(seen).toHaveLength(6);
        expect(new Set(seen).size).toBe(6);
      }
      const first = await products({ search: "brake", limit: 1 });
      await request(app)
        .get("/api/v1/public/catalog/products/discovery")
        .query({
          categoryId,
          search: "brake",
          sort: "newest",
          cursor: first.nextCursor,
        })
        .expect(422);
    });
    it("keeps alphabetic code punctuation/suffixes while supporting ordinary hyphenated names", async () => {
      expect((await products({ search: alphabeticCode })).items.map((p) => p.id)).toEqual(
        [alphabeticId, alphabeticWeakId],
      );
      expect((await products({ search: alphabeticCode.slice(0, -2) })).totalMatches).toBe(
        0,
      );
      for (const search of ["cooling fan", "cooling-fan"])
        expect((await products({ search })).items.map((p) => p.id)).toEqual([
          alphabeticId,
        ]);
    });
  },
);
