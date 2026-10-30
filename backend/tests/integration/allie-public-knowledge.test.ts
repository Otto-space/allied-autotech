import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import {
  publicKnowledgeRevision,
  retrievePublicKnowledge,
} from "../../src/modules/learning/allie.public-knowledge.js";
import {
  retrieveAllieContext,
  allieSourceSet,
} from "../../src/modules/learning/allie.retrieval.js";
import { answerAllie } from "../../src/modules/learning/allie.answer.js";
import type { AllieCatalogue } from "../../src/modules/learning/allie.contracts.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "canonical public Allie service knowledge",
  () => {
    afterAll(() => prisma.$disconnect());
    it("uses public product and vehicle visibility and preserves faults without private stock data", async () => {
      await assertIsolatedLoopbackDatabase();
      const name = `Catalogue${randomUUID().replaceAll("-", "")}`;
      const parent = await prisma.category.create({
        data: { name: "Test parent", slug: randomUUID() },
      });
      const category = await prisma.category.create({
        data: { name: "Test category", slug: randomUUID(), parentId: parent.id },
      });
      const product = await prisma.product.create({
        data: {
          name,
          slug: randomUUID(),
          sku: randomUUID(),
          categoryId: category.id,
          priceKobo: 98765n,
          description: "Check the specified fitment before purchase.",
        },
      });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Test workshop",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const vehicle = await prisma.vehicle.create({
        data: {
          branchId: branch.id,
          stockNumber: randomUUID(),
          make: "Test",
          model: name,
          year: 2020,
          acquisitionCostKobo: 123n,
          ownerReportedIssues: "Air conditioning does not cool.",
          ownerReportedCondition: "Owner-reported used condition",
        },
      });
      const listing = await prisma.vehicleListing.create({
        data: {
          branchId: branch.id,
          vehicleId: vehicle.id,
          title: name,
          slug: randomUUID(),
          priceKobo: 123456789n,
          status: "AVAILABLE",
          publishedAt: new Date(),
        },
      });
      const draft = await prisma.vehicleListing.create({
        data: {
          branchId: branch.id,
          vehicleId: vehicle.id,
          title: name,
          slug: randomUUID(),
          priceKobo: 999n,
          status: "DRAFT",
        },
      });
      const load = () =>
        prisma.$transaction(async (tx) => ({
          revision: await publicKnowledgeRevision(tx),
          sources: await retrievePublicKnowledge(tx, name),
        }));
      const first = await load();
      const p = first.sources.find((row) => row.id === `product-${product.id}`)!;
      const v = first.sources.find((row) => row.id === `vehicle-${listing.id}`)!;
      expect(p.summary).toContain("NGN 987.65");
      expect(p.summary).toContain("does not establish stock or compatibility");
      expect(v.summary).toContain("Air conditioning does not cool.");
      expect(v.summary).toContain("NGN 1234567.89");
      expect(JSON.stringify(v)).not.toContain("acquisitionCost");
      expect(JSON.stringify(v)).not.toContain(vehicle.stockNumber);
      expect(first.sources.some((row) => row.id.endsWith(draft.id))).toBe(false);
      const history = {
        accessKey: "a".repeat(64),
        sourceSet: "b".repeat(64),
        turns: [
          {
            question: name,
            answer: "Review the listing.",
            sourceIds: [`${p.id}@v${p.version}`, `${v.id}@v${v.version}`],
          },
        ],
      };
      const followUp = await prisma.$transaction((tx) =>
        retrievePublicKnowledge(tx, "Explain that", history),
      );
      expect(followUp.map((row) => row.id)).toEqual(expect.arrayContaining([p.id, v.id]));
      await prisma.vehicleConditionReport.create({
        data: {
          vehicleId: vehicle.id,
          summary: "Brake pads require inspection.",
          findings: { brakes: "Inspection required" },
          reportObjectKey: "private-report-object",
          reportSha256: "a".repeat(64),
          inspectedAt: new Date(),
        },
      });
      const inspected = await load();
      expect(inspected.revision).not.toBe(first.revision);
      const updated = inspected.sources.find((row) => row.id === v.id)!;
      expect(updated.summary).toContain("Brake pads require inspection.");
      expect(updated.summary).not.toContain("private-report-object");
      await prisma.category.update({
        where: { id: parent.id },
        data: { isActive: false },
      });
      const hiddenCategory = await load();
      expect(hiddenCategory.revision).not.toBe(inspected.revision);
      expect(hiddenCategory.sources.some((row) => row.id === p.id)).toBe(false);
      await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });
      const hiddenBranch = await load();
      expect(hiddenBranch.revision).not.toBe(hiddenCategory.revision);
      expect(hiddenBranch.sources.some((row) => row.id === v.id)).toBe(false);
    });

    it("retrieves exact public prices, preserves quotations and invalidates edits/unpublication", async () => {
      await assertIsolatedLoopbackDatabase();
      const name = `Knowledge${randomUUID().replaceAll("-", "")}`;
      const fixed = await prisma.service.create({
        data: {
          name,
          slug: randomUUID(),
          pricingType: "FIXED",
          priceKobo: 123456n,
          description: "Only tyre fitting is included.",
          durationMinutes: 60,
        },
      });
      const quote = await prisma.service.create({
        data: {
          name,
          slug: randomUUID(),
          pricingType: "QUOTE_REQUIRED",
          priceKobo: null,
        },
      });
      const privateRow = await prisma.service.create({
        data: {
          name,
          slug: randomUUID(),
          pricingType: "FIXED",
          priceKobo: 10n,
          isActive: false,
          description: "Private draft must never enter the context.",
        },
      });
      const load = async (): Promise<AllieCatalogue> =>
        prisma.$transaction(async (tx) => ({
          accessKey: "a".repeat(64),
          audience: "public",
          contentVersion: 1,
          mode: "full",
          flags: { ai: true, guides: false, practice: false },
          articles: [],
          guides: [],
          scenarios: [],
          knowledgeRevision: await publicKnowledgeRevision(tx),
          knowledge: await retrievePublicKnowledge(tx, name),
        }));
      const first = await load();
      expect(first.knowledge!.map((row) => row.id).sort()).toEqual(
        [`service-${fixed.id}`, `service-${quote.id}`].sort(),
      );
      expect(first.knowledge!.some((row) => row.id.includes(privateRow.id))).toBe(false);
      expect(
        first.knowledge!.find((row) => row.id.endsWith(fixed.id))!.summary,
      ).toContain("NGN 1234.56");
      expect(
        first.knowledge!.find((row) => row.id.endsWith(quote.id))!.summary,
      ).toContain("Quotation required");
      const context = retrieveAllieContext(first, name, "services");
      expect(context.sources).toHaveLength(2);
      expect(context.actions.filter((a) => a.kind === "navigate")).toHaveLength(2);
      expect(
        context.sources.every((source) => source.href.startsWith("/services/")),
      ).toBe(true);
      const history = {
        accessKey: first.accessKey,
        sourceSet: allieSourceSet(first),
        turns: [
          {
            question: name,
            answer: "See the published service.",
            sourceIds: [context.sources[0]!.id],
          },
        ],
      };
      const followUp = await prisma.$transaction((tx) =>
        retrievePublicKnowledge(tx, "Explain that", history),
      );
      expect(followUp.some((row) => row.id === context.sources[0]!.articleId)).toBe(true);
      // Real DB edit while the mocked provider is answering: the answer must never escape.
      await expect(
        answerAllie({
          question: name,
          page: "services",
          getCatalogue: load,
          provider: {
            async generate() {
              await prisma.service.update({
                where: { id: fixed.id },
                data: {
                  description: "Published description changed without a version bump.",
                },
              });
              return {
                value: {
                  kind: "answer",
                  answer: "See the published service.",
                  steps: [],
                  caveat: null,
                  sourceIds: [context.sources[0]!.id],
                  actionIds: [],
                },
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                model: "mock",
                durationMs: 0,
              };
            },
          },
        }),
      ).rejects.toMatchObject({ code: "access_changed" });
      const changed = await load();
      expect(allieSourceSet(changed)).not.toBe(allieSourceSet(first));
      expect(retrieveAllieContext(changed, name, "services", history).historyReset).toBe(
        true,
      );
      await prisma.service.update({ where: { id: fixed.id }, data: { isActive: false } });
      const unpublished = await load();
      expect(unpublished.knowledge!.some((row) => row.id.endsWith(fixed.id))).toBe(false);
      expect(allieSourceSet(unpublished)).not.toBe(allieSourceSet(changed));
    });
  },
);
