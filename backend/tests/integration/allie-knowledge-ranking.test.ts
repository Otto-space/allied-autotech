import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { retrievePublicKnowledge } from "../../src/modules/learning/allie.public-knowledge.js";
import { rankedPublicKnowledgeIds } from "../../src/modules/learning/allie.knowledge-ranking.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Allie catalogue candidate relevance",
  () => {
    afterAll(() => prisma.$disconnect());
    it("finds late-ID relevant records beyond 250 weaker public matches per catalogue", async () => {
      await assertIsolatedLoopbackDatabase();
      const category = await prisma.category.create({
        data: { name: "Synthetic ranking category", slug: randomUUID() },
      });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic ranking workshop",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const vehicle = await prisma.vehicle.create({
        data: {
          stockNumber: randomUUID(),
          branchId: branch.id,
          make: "Synthetic",
          model: "Test",
          year: 2020,
          acquisitionCostKobo: 1n,
        },
      });
      const ids = Array.from(
        { length: 250 },
        (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      );
      const target = "ffffffff-ffff-4fff-8fff-fffffffffff0";
      const title = "Quartz hydraulic inspection";
      await prisma.service.createMany({
        data: [
          ...ids.map((id) => ({
            id,
            name: "Generic inspection",
            slug: randomUUID(),
            pricingType: "QUOTE_REQUIRED" as const,
            description: "Inspection overview",
          })),
          {
            id: target,
            name: title,
            slug: randomUUID(),
            pricingType: "QUOTE_REQUIRED",
            description: "Includes hydraulic checks only.",
          },
        ],
      });
      await prisma.product.createMany({
        data: [
          ...ids.map((id) => ({
            id,
            name: "Generic inspection",
            slug: randomUUID(),
            sku: randomUUID(),
            categoryId: category.id,
            priceKobo: 100n,
            description: "Inspection overview",
          })),
          {
            id: target,
            name: title,
            slug: randomUUID(),
            sku: randomUUID(),
            categoryId: category.id,
            priceKobo: 12345n,
            description: "Use the specified fitment.",
          },
        ],
      });
      await prisma.vehicle.createMany({
        data: ids.map((id) => ({
          id,
          stockNumber: randomUUID(),
          branchId: branch.id,
          make: "Synthetic",
          model: "Test",
          year: 2020,
          acquisitionCostKobo: 1n,
        })),
      });
      await prisma.vehicleListing.createMany({
        data: [
          ...ids.map((id) => ({
            id,
            vehicleId: id,
            branchId: branch.id,
            title: "Generic inspection",
            slug: randomUUID(),
            priceKobo: 100n,
            status: "AVAILABLE" as const,
            publishedAt: new Date(),
            description: "Inspection overview",
          })),
          {
            id: target,
            vehicleId: vehicle.id,
            branchId: branch.id,
            title,
            slug: randomUUID(),
            priceKobo: 999999n,
            status: "AVAILABLE",
            publishedAt: new Date(),
            description: "Owner reports air conditioning does not cool.",
          },
        ],
      });
      const started = performance.now();
      for (const kind of ["service", "product", "vehicle"] as const) {
        const ranked = await prisma.$transaction((tx) =>
          rankedPublicKnowledgeIds(tx, kind, ["quartz", "hydraulic", "inspection"]),
        );
        expect(ranked).toHaveLength(12);
        expect(ranked[0]).toBe(target);
      }
      const sources = await prisma.$transaction((tx) =>
        retrievePublicKnowledge(tx, "What is the price of Quartz hydraulic inspection?"),
      );
      expect(sources.length).toBeLessThanOrEqual(36);
      for (const kind of ["service", "product", "vehicle"])
        expect(sources.some((s) => s.id === `${kind}-${target}`)).toBe(true);
      expect(sources.find((s) => s.id === `product-${target}`)?.summary).toContain(
        "NGN 123.45",
      );
      expect(sources.find((s) => s.id === `vehicle-${target}`)?.summary).toContain(
        "air conditioning does not cool",
      );
      const elapsedMs = Math.round(performance.now() - started);
      console.info(
        JSON.stringify({
          fixtureRecords: 753,
          rankAndRetrieveElapsedMs: elapsedMs,
          maximumNewSources: 36,
        }),
      );
      expect(
        await prisma.$transaction((tx) => retrievePublicKnowledge(tx, "Please can you")),
      ).toEqual([]);
      await prisma.service.update({ where: { id: target }, data: { isActive: false } });
      await prisma.product.update({ where: { id: target }, data: { isActive: false } });
      await prisma.vehicleListing.update({
        where: { id: target },
        data: { status: "DRAFT" },
      });
      const hidden = await prisma.$transaction((tx) =>
        retrievePublicKnowledge(tx, title),
      );
      expect(hidden.some((s) => s.id.endsWith(target))).toBe(false);
    });
  },
);
