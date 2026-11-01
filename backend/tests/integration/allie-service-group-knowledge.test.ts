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
import type {
  AllieCatalogue,
  AllieHistory,
} from "../../src/modules/learning/allie.contracts.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "canonical Allie service groups",
  () => {
    afterAll(() => prisma.$disconnect());
    it("retrieves relevant active empty groups before the limit and rejects unpublished group history", async () => {
      await assertIsolatedLoopbackDatabase();
      const word = "Group" + randomUUID().replaceAll("-", "").slice(0, 20);
      await prisma.serviceCategory.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          id: `00000000-0000-4000-8000-${String(i + 700).padStart(12, "0")}`,
          name: "General workshop area",
          slug: randomUUID(),
          description: word,
        })),
      });
      const group = await prisma.serviceCategory.create({
        data: {
          id: "ffffffff-ffff-4fff-8fff-fffffffffff9",
          name: word,
          slug: randomUUID(),
          description: "Engine diagnosis and repair enquiries.",
        },
      });
      const hidden = await prisma.serviceCategory.create({
        data: {
          name: word,
          slug: randomUUID(),
          isActive: false,
          description: "Private draft group",
        },
      });
      const load = async (
        question = word,
        history?: AllieHistory,
      ): Promise<AllieCatalogue> =>
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
          knowledge: await retrievePublicKnowledge(tx, question, history),
        }));
      const first = await load(),
        source = first.knowledge!.find((x) => x.id === `service-group-${group.id}`)!;
      expect(source).toBeDefined();
      expect(
        first.knowledge!.filter((x) => x.id.startsWith("service-group-")),
      ).toHaveLength(12);
      expect(first.knowledge!.some((x) => x.id.endsWith(hidden.id))).toBe(false);
      expect(source.summary).toContain("not an individual priced service");
      expect(source.summary).toContain("No group price, appointment availability");
      expect(source.href).toBe(`/services?categoryId=${group.id}#service-catalogue`);
      const context = retrieveAllieContext(first, word, "services");
      expect(context.sources.some((x) => x.articleId === source.id)).toBe(true);
      const history: AllieHistory = {
        accessKey: first.accessKey,
        sourceSet: allieSourceSet(first),
        turns: [
          {
            question: word,
            answer: "Read this service group.",
            sourceIds: [`${source.id}@v${source.version}`],
          },
        ],
      };
      expect(
        (await load("Explain that", history)).knowledge!.some((x) => x.id === source.id),
      ).toBe(true);
      await prisma.serviceCategory.update({
        where: { id: group.id },
        data: { description: "Updated workshop work area without a version bump." },
      });
      const changed = await load();
      expect(allieSourceSet(changed)).not.toBe(allieSourceSet(first));
      expect(changed.knowledge!.find((x) => x.id === source.id)!.contentHash).not.toBe(
        source.contentHash,
      );
      expect(retrieveAllieContext(changed, word, "services", history).historyReset).toBe(
        true,
      );
      await expect(
        answerAllie({
          question: word,
          page: "services",
          getCatalogue: () => load(),
          provider: {
            async generate() {
              await prisma.serviceCategory.update({
                where: { id: group.id },
                data: { isActive: false },
              });
              return {
                value: {
                  kind: "answer",
                  answer: "Read the group description.",
                  steps: [],
                  caveat: null,
                  sourceIds: [`${source.id}@v${source.version}`],
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
      expect(
        (await load("Explain that", history)).knowledge!.some((x) => x.id === source.id),
      ).toBe(false);
      const tampered = {
        ...first,
        knowledge: [
          { ...source, href: `/services?categoryId=${hidden.id}#service-catalogue` },
        ],
      };
      expect(retrieveAllieContext(tampered, word, "services").sources).toHaveLength(0);
    });
  },
);
