import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { ProductDiscoveryRepository } from "../../src/modules/catalog/product-discovery.repository.js";
import {
  productDiscoveryPageSchema,
  productFacetPageSchema,
} from "../../src/modules/catalog/product-discovery.schemas.js";

const app = createApp({ checkReadiness: async () => undefined });
const path = "/api/v1/public/catalog/products/discovery";
async function fixture() {
  const prefix = `Shop-${randomUUID().slice(0, 8)}`;
  const category = await prisma.category.create({
    data: { name: prefix, slug: prefix.toLowerCase() },
  });
  const hidden = await prisma.category.create({
    data: {
      name: `${prefix}-Hidden`,
      slug: `${prefix.toLowerCase()}-hidden`,
      isActive: false,
    },
  });
  const branch = await prisma.branch.create({
    data: { code: prefix, name: prefix, address: "Test", city: "Test", state: "Test" },
  });
  const inactiveBranch = await prisma.branch.create({
    data: {
      code: `${prefix}-OFF`,
      name: prefix,
      address: "Test",
      city: "Test",
      state: "Test",
      isActive: false,
    },
  });
  // Synthetic reviewed evidence belongs only to the isolated test database.
  // Legacy rows default to DRAFT and must not populate public fitment facets.
  const make = await prisma.vehicleMake.create({
    data: { name: `${prefix}-Make`, key: `${prefix}-make`.toLowerCase() },
  });
  const models = await Promise.all(
    ["Sedan", "Coupe"].map((name) =>
      prisma.vehicleModel.create({
        data: {
          makeId: make.id,
          name,
          key: name.toLowerCase(),
          yearFrom: 2010,
          yearTo: 2020,
          sourceReference: "Synthetic model-year fixture",
        },
      }),
    ),
  );
  const [author, reviewer] = await Promise.all(
    ["author", "reviewer"].map((role) =>
      prisma.user.create({
        data: {
          email: `${prefix}-${role}@example.test`,
          passwordHash: "unusable-test-password",
          role: "STAFF",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );
  const rows = [];
  for (let i = 0; i < 10; i++) {
    const row = await prisma.product.create({
      data: {
        categoryId: i === 9 ? hidden.id : category.id,
        name: `${prefix} ${Math.floor(i / 2)}`,
        sku: `${prefix}-${i}`.toUpperCase(),
        slug: `${prefix.toLowerCase()}-${i}`,
        priceKobo: BigInt(Math.floor(i / 2) * 1000),
        brand: `${prefix}-${i < 4 ? "Alpha" : "Beta"}`,
        productType: "AIR_FILTER",
        isActive: i !== 8,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(i / 2))),
        compatibilities: {
          create: {
            make: `${prefix}-Make`,
            model: i % 2 ? "Coupe" : "Sedan",
            yearFrom: 2010,
            yearTo: 2020,
            vehicleModelId: models[i % 2]!.id,
            reviewStatus: "APPROVED",
            safetyCritical: false,
            allVariantsConfirmed: true,
            sourceReference: "Synthetic independent technical evidence",
            evidenceNotes:
              "Isolated discovery fixture: the complete stated variant range is reviewed.",
            createdByUserId: author!.id,
            updatedByUserId: author!.id,
            reviewedByUserId: reviewer!.id,
            reviewedAt: new Date(),
            history: {
              create: {
                actorUserId: reviewer!.id,
                action: "APPROVE",
                version: 0,
                snapshot: {
                  sourceReference: "Synthetic independent technical evidence",
                  reviewStatus: "APPROVED",
                },
              },
            },
          },
        },
      },
    });
    // 0/1 have available stock, 2 is fully reserved, 3 only has stock at an inactive branch, 4..7 have no inventory.
    if (i <= 3)
      await prisma.inventory.create({
        data: {
          productId: row.id,
          branchId: i === 3 ? inactiveBranch.id : branch.id,
          quantity: 5,
          reserved: i === 2 ? 5 : 0,
        },
      });
    rows.push(row);
  }
  return { prefix, category, hidden, branch, inactiveBranch, rows };
}
async function page(query: Record<string, string | number | undefined>) {
  const res = await request(app).get(path).query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  // Validate the real public projection, not just a hand-picked subset.
  expect(JSON.stringify(res.body.data)).not.toMatch(
    /"(?:inventories|quantity|reserved|publicId|objectKey|assetToken)"/,
  );
  return productDiscoveryPageSchema.parse(res.body.data);
}
async function facets(query: Record<string, string | number | undefined>) {
  const res = await request(app).get("/api/v1/public/catalog/facets").query(query);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return productFacetPageSchema.parse(res.body.data);
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Product discovery API and database",
  () => {
    afterAll(() => prisma.$disconnect());
    it("scopes root and child categories without bypassing other filters", async () => {
      const f = await fixture();
      const child = await prisma.category.create({
        data: {
          name: `${f.prefix}-Child`,
          slug: `${f.prefix.toLowerCase()}-child`,
          parentId: f.category.id,
        },
      });
      const hiddenChild = await prisma.category.create({
        data: {
          name: `${f.prefix}-HiddenChild`,
          slug: `${f.prefix.toLowerCase()}-hidden-child`,
          parentId: f.category.id,
          isActive: false,
        },
      });
      await prisma.product.update({
        where: { id: f.rows[0]!.id },
        data: { categoryId: child.id },
      });
      await prisma.product.update({
        where: { id: f.rows[1]!.id },
        data: { categoryId: hiddenChild.id },
      });
      expect((await page({ categoryId: f.category.id })).totalMatches).toBe(7);
      expect((await page({ parentCategoryId: f.category.id })).totalMatches).toBe(7);
      const exact = await page({ parentCategoryId: f.category.id, categoryId: child.id });
      expect(exact.items.map((row) => row.id)).toEqual([f.rows[0]!.id]);
      expect(
        (await page({ parentCategoryId: f.hidden.id, categoryId: child.id }))
          .totalMatches,
      ).toBe(0);
      expect(
        (
          await page({
            parentCategoryId: f.category.id,
            categoryId: child.id,
            search: "NoSuchProduct",
          })
        ).totalMatches,
      ).toBe(0);
      expect(
        (await page({ categoryId: f.category.id, availability: "in_stock" }))
          .totalMatches,
      ).toBe(1);
      const brands = await facets({ field: "brand", categoryId: f.category.id });
      expect(brands.items).toHaveLength(2);
      const categories = await request(app)
        .get("/api/v1/public/catalog/categories")
        .query({ parentId: f.category.id, search: `${f.prefix}-C` });
      expect(categories.status, JSON.stringify(categories.body)).toBe(200);
      expect(categories.body.data.items.map((row: { id: string }) => row.id)).toEqual([
        child.id,
      ]);
      const roots = await request(app)
        .get("/api/v1/public/catalog/categories")
        .query({ rootOnly: true, search: f.prefix });
      expect(roots.status).toBe(200);
      expect(roots.body.data.items.map((row: { id: string }) => row.id)).toEqual([
        f.category.id,
      ]);
      await prisma.category.update({
        where: { id: f.category.id },
        data: { isActive: false },
      });
      expect((await page({ categoryId: child.id })).totalMatches).toBe(0);
      const hidden = await request(app)
        .get("/api/v1/public/catalog/categories")
        .query({ parentId: f.category.id });
      expect(hidden.body.data.items).toEqual([]);
    }, 30000);
    it.each(["newest", "name", "price_asc", "price_desc"] as const)(
      "traverses %s ties, exact totals, visibility and legacy links",
      async (sort) => {
        const f = await fixture();
        const all = await page({ categoryId: f.category.id, sort, limit: 50 });
        expect(all.items).toHaveLength(8);
        const ids: string[] = [];
        let cursor: string | undefined;
        do {
          const current = await page({
            categoryId: f.category.id,
            sort,
            cursor,
            limit: 3,
          });
          expect(current.totalMatches).toBe(8);
          ids.push(...current.items.map((i) => i.id));
          cursor = current.nextCursor;
          expect(ids.length).toBeLessThanOrEqual(8);
        } while (cursor);
        expect(ids).toEqual(all.items.map((i) => i.id));
        const legacy = await page({
          categoryId: f.category.id,
          sort,
          cursor: ids[0],
          limit: 50,
        });
        expect(legacy.items.map((i) => i.id)).toEqual(ids.slice(1));
        const oldRoute = await request(app)
          .get("/api/v1/public/catalog/products")
          .query({ categoryId: f.category.id, limit: 3, sort });
        expect(oldRoute.status).toBe(200);
        expect(oldRoute.body.data.items.map((i: { id: string }) => i.id)).toEqual(
          ids.slice(0, 3),
        );
        expect(oldRoute.body.data.nextCursor).toBe(ids[2]);
        expect((await page({ categoryId: f.hidden.id })).totalMatches).toBe(0);
      },
    );
    it("uses unreserved active-branch availability and inclusive prices including zero", async () => {
      const f = await fixture();
      const inStock = await page({ categoryId: f.category.id, availability: "in_stock" });
      expect(inStock.totalMatches).toBe(2);
      expect(new Set(inStock.items.map((i) => i.id))).toEqual(
        new Set(f.rows.slice(0, 2).map((i) => i.id)),
      );
      const unavailable = await page({
        categoryId: f.category.id,
        availability: "out_of_stock",
      });
      expect(unavailable.totalMatches).toBe(6);
      expect(
        unavailable.items.every((i) => i.availability.every((a) => !a.inStock)),
      ).toBe(true);
      expect(
        (await page({ categoryId: f.category.id, minPriceKobo: "0", maxPriceKobo: "0" }))
          .totalMatches,
      ).toBe(2);
      expect(
        (
          await page({
            categoryId: f.category.id,
            minPriceKobo: "1000",
            maxPriceKobo: "2000",
          })
        ).totalMatches,
      ).toBe(4);
      await prisma.branch.update({
        where: { id: f.branch.id },
        data: { isActive: false },
      });
      expect(
        (await page({ categoryId: f.category.id, availability: "in_stock" }))
          .totalMatches,
      ).toBe(0);
    });
    it("binds cursors to filters, sort and endpoint, and survives withdrawn reviewed anchors", async () => {
      const f = await fixture();
      const first = await page({
        categoryId: f.category.id,
        sort: "price_asc",
        limit: 2,
      });
      const anchor = first.items[1]!;
      await prisma.inventory.deleteMany({ where: { productId: anchor.id } });
      // Reviewed evidence cannot be erased through a product cascade. Withdrawal
      // must still leave a signed cursor usable and exclude the unpublished anchor.
      await expect(
        prisma.product.delete({ where: { id: anchor.id } }),
      ).rejects.toMatchObject({ code: "P2003" });
      await prisma.product.update({
        where: { id: anchor.id },
        data: { isActive: false },
      });
      const next = await page({
        categoryId: f.category.id,
        sort: "price_asc",
        limit: 3,
        cursor: first.nextCursor,
      });
      expect(next.totalMatches).toBe(7);
      expect(next.items.every((i) => !first.items.some((p) => p.id === i.id))).toBe(true);
      for (const query of [
        { sort: "newest", categoryId: f.category.id, cursor: first.nextCursor },
        { sort: "price_asc", categoryId: f.hidden.id, cursor: first.nextCursor },
        {
          sort: "price_asc",
          categoryId: f.category.id,
          availability: "in_stock",
          cursor: first.nextCursor,
        },
        {
          sort: "price_asc",
          categoryId: f.category.id,
          cursor:
            first.nextCursor!.slice(0, -1) +
            (first.nextCursor!.endsWith("a") ? "b" : "a"),
        },
        { sort: "price_asc", categoryId: f.category.id, cursor: anchor.id },
      ])
        expect((await request(app).get(path).query(query)).status).toBe(422);
      expect(
        (
          await request(app)
            .get("/api/v1/public/catalog/facets")
            .query({ field: "brand", cursor: first.nextCursor })
        ).status,
      ).toBe(422);
    });
    it("survives deletion of a synthetic anchor with no reviewed evidence or business records", async () => {
      const nonce = randomUUID();
      const category = await prisma.category.create({
        data: {
          name: "Synthetic deletable cursor fixture",
          slug: `delete-anchor-${nonce}`,
        },
      });
      await prisma.product.createMany({
        data: [0, 1].map((index) => ({
          categoryId: category.id,
          name: `Synthetic anchor ${index}`,
          sku: `DELETE-${nonce}-${index}`,
          slug: `delete-anchor-${nonce}-${index}`,
          priceKobo: 100n,
        })),
      });
      const first = await page({ categoryId: category.id, limit: 1 });
      expect(first.totalMatches).toBe(2);
      await prisma.product.delete({ where: { id: first.items[0]!.id } });
      const next = await page({
        categoryId: category.id,
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(next.totalMatches).toBe(1);
      expect(next.items).toHaveLength(1);
      expect(next.items[0]!.id).not.toBe(first.items[0]!.id);
    });
    it("searches complete category and case-folded brand/make/model options with scope and pagination", async () => {
      const f = await fixture();
      await prisma.product.update({
        where: { id: f.rows[1]!.id },
        data: { brand: `${f.prefix}-ALPHA` },
      });
      const first = await facets({ field: "brand", categoryId: f.category.id, limit: 1 });
      expect(first.items.map((i) => i.value)).toEqual([
        `${f.prefix}-alpha`.toLowerCase(),
      ]);
      const next = await facets({
        field: "brand",
        categoryId: f.category.id,
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(next.items.map((i) => i.value)).toEqual([`${f.prefix}-beta`.toLowerCase()]);
      expect(next.nextCursor).toBeUndefined();
      expect((await facets({ field: "category", search: f.prefix })).items).toEqual([
        { value: f.category.id, label: f.prefix },
      ]);
      expect(
        (await facets({ field: "make", categoryId: f.category.id })).items,
      ).toHaveLength(1);
      expect(
        (
          await facets({
            field: "model",
            categoryId: f.category.id,
            make: `${f.prefix}-make`,
          })
        ).items.map((i) => i.value),
      ).toEqual(["coupe", "sedan"]);
      expect(
        (await facets({ field: "model", categoryId: f.category.id, make: "Other" }))
          .items,
      ).toEqual([]);
      expect((await facets({ field: "brand", categoryId: f.hidden.id })).items).toEqual(
        [],
      );
      expect(
        (
          await request(app).get("/api/v1/public/catalog/facets").query({
            field: "brand",
            categoryId: f.category.id,
            search: "beta",
            cursor: first.nextCursor,
          })
        ).status,
      ).toBe(422);
      await prisma.product.updateMany({
        where: {
          categoryId: f.category.id,
          brand: { equals: `${f.prefix}-alpha`, mode: "insensitive" },
        },
        data: { isActive: false },
      });
      expect(
        (
          await facets({
            field: "brand",
            categoryId: f.category.id,
            cursor: first.nextCursor,
          })
        ).items,
      ).toEqual(next.items);
    });
    it("treats wildcard and SQL-like input literally; compatibility fields match the same row", async () => {
      const f = await fixture();
      await prisma.product.update({
        where: { id: f.rows[0]!.id },
        data: { brand: "Literal%_\\'--", name: "Literal%_\\'--" },
      });
      expect((await page({ categoryId: f.category.id, brand: "%" })).totalMatches).toBe(
        0,
      );
      expect(
        (await page({ categoryId: f.category.id, search: "%_\\'--" })).totalMatches,
      ).toBe(1);
      expect(
        (
          await facets({
            field: "brand",
            categoryId: f.category.id,
            search: "Literal%_\\'--",
          })
        ).items,
      ).toHaveLength(1);
      expect(
        (
          await page({
            categoryId: f.category.id,
            make: `${f.prefix}-MAKE`,
            model: "coupe",
            year: 2020,
          })
        ).totalMatches,
      ).toBe(4);
      expect(
        (await page({ categoryId: f.category.id, make: `${f.prefix}-Make`, year: 2021 }))
          .totalMatches,
      ).toBe(0);
      await prisma.productCompatibility.create({
        data: { productId: f.rows[0]!.id, make: "Other", model: "Different" },
      });
      expect(
        (
          await page({
            categoryId: f.category.id,
            make: `${f.prefix}-Make`,
            model: "Different",
          })
        ).totalMatches,
      ).toBe(0);
    });
    it("rejects ambiguous and unbounded public queries", async () => {
      for (const suffix of [
        "limit=51",
        "limit=0",
        "limit[]=2",
        "limit=2&limit=3",
        "year[]=2020",
        "year=2e3",
        "minPriceKobo=-1",
        "minPriceKobo=2&maxPriceKobo=1",
        "availability=true",
        "sort=random",
        "isActive=false",
        "cursor=bad",
      ]) {
        expect((await request(app).get(`${path}?${suffix}`)).status, suffix).toBe(422);
      }
      for (const suffix of [
        "field=model",
        "field=brand&make=Toyota",
        "field=category&categoryId=" + randomUUID(),
        "field=brand&limit=51",
        "field=brand&search=%00",
        "field=unknown",
      ]) {
        expect(
          (await request(app).get(`/api/v1/public/catalog/facets?${suffix}`)).status,
          suffix,
        ).toBe(422);
      }
    });
    it("keeps page and count in the same snapshot across a concurrent publication change", async () => {
      const f = await fixture();
      let changed = false;
      const db = prisma.$extends({
        query: {
          product: {
            async findMany({ args, query }) {
              const result = await query(args);
              if (!changed) {
                changed = true;
                await prisma.product.update({
                  where: { id: f.rows[0]!.id },
                  data: { isActive: false },
                });
              }
              return result;
            },
          },
        },
      });
      const result = await new ProductDiscoveryRepository(
        db as unknown as PrismaClient,
      ).products({ categoryId: f.category.id, sort: "newest", limit: 50 });
      expect(changed).toBe(true);
      expect(result.items).toHaveLength(8);
      expect(result.totalMatches).toBe(8);
      expect((await page({ categoryId: f.category.id })).totalMatches).toBe(7);
    });
    it("bounds options and exact totals across 10000 products", async () => {
      const prefix = `ShopVolume-${randomUUID().slice(0, 8)}`;
      const category = await prisma.category.create({
        data: { name: prefix, slug: prefix.toLowerCase() },
      });
      const ids = Array.from({ length: 10000 }, () => randomUUID());
      for (let offset = 0; offset < ids.length; offset += 1000)
        await prisma.product.createMany({
          data: ids.slice(offset, offset + 1000).map((id, n) => ({
            id,
            categoryId: category.id,
            name: `${prefix} ${offset + n}`,
            sku: `${prefix}-${offset + n}`,
            slug: `${prefix.toLowerCase()}-${offset + n}`,
            priceKobo: BigInt(offset + n),
            brand: `${prefix}-${String((offset + n) % 100).padStart(3, "0")}`,
          })),
        });
      const start = performance.now();
      const first = await page({
        categoryId: category.id,
        minPriceKobo: "5000",
        limit: 12,
      });
      expect(first.totalMatches).toBe(5000);
      expect(first.items).toHaveLength(12);
      const inventoryMs = performance.now() - start;
      const found: string[] = [];
      let cursor: string | undefined;
      do {
        const options = await facets({
          field: "brand",
          categoryId: category.id,
          limit: 20,
          cursor,
        });
        expect(options.items.length).toBeLessThanOrEqual(20);
        found.push(...options.items.map((i) => i.value));
        cursor = options.nextCursor;
        expect(found.length).toBeLessThanOrEqual(100);
      } while (cursor);
      expect(new Set(found).size).toBe(100);
      console.info(
        JSON.stringify({
          products: 10000,
          inventoryAndCountMs: +inventoryMs.toFixed(1),
          facetTraversalMs: +(performance.now() - start - inventoryMs).toFixed(1),
        }),
      );
    }, 60000);
  },
);
