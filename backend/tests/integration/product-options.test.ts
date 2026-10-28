import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "scoped public product choices",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let categoryId: string;
    beforeAll(async () => {
      categoryId = (
        await prisma.category.create({
          data: { name: "Synthetic scoped options", slug: `options-${randomUUID()}` },
        })
      ).id;
      for (const [brand, grade, price, active] of [
        ["Shell", "5W-30", 100000n, true],
        ["SHELL", "5W-40", 200000n, true],
        ["Hidden brand", "0W-20", 100000n, false],
      ] as const)
        await prisma.product.create({
          data: {
            categoryId,
            name: "Synthetic engine oil",
            slug: `option-${randomUUID()}`,
            sku: `OPTION-${randomUUID()}`,
            family: "ENGINE_OIL",
            brand,
            oilViscosityGrade: grade,
            packVolumeMl: 1000,
            priceKobo: price,
            isActive: active,
          },
        });
      await prisma.product.create({
        data: {
          categoryId,
          name: "Synthetic replacement filter",
          slug: `option-${randomUUID()}`,
          sku: `OPTION-${randomUUID()}`,
          family: "REPLACEMENT_PART",
          productType: "OIL_FILTER",
          priceKobo: 100000n,
        },
      });
    });
    afterAll(() => prisma.$disconnect());
    async function options(
      field: string,
      scope: Record<string, string> = {},
      extra: Record<string, string> = {},
    ) {
      return request(app)
        .get("/api/v1/public/catalog/products/options")
        .query({
          field,
          scope: new URLSearchParams({ categoryId, ...scope }).toString(),
          ...extra,
        })
        .expect(200);
    }
    it("collapses recorded brand case variants without exposing unpublished brands or counts", async () => {
      const result = await options("brand");
      expect(result.body.data.items).toHaveLength(1);
      expect(result.body.data.items[0].value).toBe("shell");
      expect(JSON.stringify(result.body.data)).not.toMatch(
        /Hidden brand|quantity|reserved|count/,
      );
      const products = await request(app)
        .get("/api/v1/public/catalog/products/discovery")
        .query({ categoryId, brand: " shell " })
        .expect(200);
      expect(products.body.data.totalMatches).toBe(2);
      expect(JSON.stringify(products.body.data)).not.toMatch(
        /brandKey|searchCore|searchDocument|searchIdentifiers/,
      );
    });
    it("uses all applied filters while relaxing the requested facet and family dependants", async () => {
      const result = await options("oilViscosityGrade", {
        family: "ENGINE_OIL",
        brand: "SHELL",
        oilViscosityGrade: "5W-40",
        maxPriceKobo: "150000",
      });
      expect(result.body.data.items).toEqual([{ value: "5W-30", label: "5W-30" }]);
      const families = await options("family", {
        family: "ENGINE_OIL",
        oilViscosityGrade: "5W-40",
        maxPriceKobo: "150000",
      });
      expect(families.body.data.items.map((x: { value: string }) => x.value)).toEqual([
        "ENGINE_OIL",
        "REPLACEMENT_PART",
      ]);
      expect(
        (await options("packVolumeMl", { family: "ENGINE_OIL" })).body.data.items,
      ).toEqual([{ value: "1000", label: "1 L" }]);
    });
    it("binds option cursors to the actual scope and never derives choices from one result page", async () => {
      const scope = { family: "ENGINE_OIL" };
      const first = await options("oilViscosityGrade", scope, { limit: "1" });
      expect(first.body.data.nextCursor).toBeDefined();
      const second = await options("oilViscosityGrade", scope, {
        limit: "1",
        cursor: first.body.data.nextCursor,
      });
      expect(
        [...first.body.data.items, ...second.body.data.items].map(
          (x: { value: string }) => x.value,
        ),
      ).toEqual(["5W-30", "5W-40"]);
      await request(app)
        .get("/api/v1/public/catalog/products/options")
        .query({
          field: "oilViscosityGrade",
          scope: new URLSearchParams({
            categoryId,
            ...scope,
            maxPriceKobo: "150000",
          }).toString(),
          cursor: first.body.data.nextCursor,
        })
        .expect(422);
      await request(app)
        .get("/api/v1/public/catalog/products/options")
        .query({ field: "brand", scope: "categoryId=bad" })
        .expect(422);
    });
  },
);
