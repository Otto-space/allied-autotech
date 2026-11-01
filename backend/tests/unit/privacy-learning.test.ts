import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import {
  learningCatalogue,
  publicLearningAccess,
} from "../../src/modules/learning/learning.service.js";
import {
  allieSourceSet,
  retrieveAllieContext,
} from "../../src/modules/learning/allie.retrieval.js";
import type { AllieHistory } from "../../src/modules/learning/allie.contracts.js";
let enabled: boolean;
beforeEach(() => {
  enabled = env.HELP_LEARN_ENABLED;
  env.HELP_LEARN_ENABLED = true;
});
afterEach(() => {
  env.HELP_LEARN_ENABLED = enabled;
});

describe("reviewed public privacy guidance", () => {
  it("keeps legacy catalogue readers compatible without granting newer readers private content", () => {
    const current = learningCatalogue(publicLearningAccess, "", "2");
    const legacy = learningCatalogue(publicLearningAccess, "", "1");
    expect(current.articles.some((a) => a.id === "privacy-and-allie")).toBe(true);
    expect(legacy.articles).toEqual(
      current.articles.filter((a) => a.href !== "/privacy"),
    );
    expect(allieSourceSet(current)).not.toBe(allieSourceSet(legacy));
    expect(current.articles.some((a) => a.id === "privacy-work")).toBe(false);
  });
  it("finds the published notice without exposing staff privacy work", () => {
    const data = learningCatalogue(publicLearningAccess);
    const context = retrieveAllieContext(
      data,
      "How private are my Allie conversations and how can I clear them?",
      "help",
    );
    const source = context.sources.find((item) => item.articleId === "privacy-and-allie");
    expect(source).toBeDefined();
    expect(context.actions).toContainEqual(
      expect.objectContaining({
        kind: "navigate",
        href: "/privacy",
        sourceId: source!.id,
      }),
    );
    expect(source!.passage).toContain("does not promise provider deletion");
    expect(source!.passage).toContain("backups follow their own policy");
    expect(source!.passage).toContain("does not send your conversation");
    expect(context.sources.some((item) => item.articleId === "privacy-work")).toBe(false);
    expect(context.actions.some((item) => item.href === "/admin/privacy")).toBe(false);
  });
  it("invalidates prior answers when reviewed policy content changes or is withdrawn", () => {
    const data = learningCatalogue(publicLearningAccess);
    const article = data.articles.find((item) => item.id === "privacy-and-allie");
    expect(article).toBeDefined();
    const history: AllieHistory = {
      accessKey: data.accessKey,
      sourceSet: allieSourceSet(data),
      turns: [
        {
          question: "What happens to Allie history?",
          answer: "Read the current Privacy notice.",
          sourceIds: [`${article!.id}@v${article!.version}`],
        },
      ],
    };
    for (const changed of [
      {
        ...data,
        articles: data.articles.map((item) =>
          item.id === article!.id
            ? { ...item, summary: item.summary + " Reviewed update." }
            : item,
        ),
      },
      { ...data, articles: data.articles.filter((item) => item.id !== article!.id) },
    ]) {
      const next = retrieveAllieContext(changed, "Explain that again", "help", history);
      expect(next.historyReset).toBe(true);
      expect(next.history).toEqual([]);
    }
  });
});

it.each(["full", "browse_enquiries", "catalogue"] as const)(
  "uses current server release mode %s and invalidates changed help capabilities",
  (mode) => {
    const prior = [
      env.PUBLIC_LAUNCH_MODE,
      env.HELP_LEARN_GUIDES_ENABLED,
      env.HELP_LEARN_PRACTICE_ENABLED,
    ] as const;
    try {
      env.PUBLIC_LAUNCH_MODE = mode;
      env.HELP_LEARN_GUIDES_ENABLED = env.HELP_LEARN_PRACTICE_ENABLED = true;
      const data = learningCatalogue(publicLearningAccess);
      const initial = retrieveAllieContext(
        data,
        "Find a part and understand compatibility",
        "parts",
      );
      expect(initial.releaseMode).toBe(mode);
      expect(initial.actions.some((action) => action.kind === "guide")).toBe(true);
      const history: AllieHistory = {
        accessKey: data.accessKey,
        sourceSet: initial.sourceSet,
        turns: [],
      };
      env.HELP_LEARN_GUIDES_ENABLED = env.HELP_LEARN_PRACTICE_ENABLED = false;
      const restricted = retrieveAllieContext(
        learningCatalogue(publicLearningAccess),
        "Find a part and understand compatibility",
        "parts",
        history,
      );
      expect(restricted.historyReset).toBe(true);
      expect(
        restricted.actions.some((action) => ["guide", "practice"].includes(action.kind)),
      ).toBe(false);
      expect(
        restricted.sources.some((source) => source.articleId === "parts-fitment"),
      ).toBe(true);
      env.PUBLIC_LAUNCH_MODE = mode === "full" ? "browse_enquiries" : "full";
      expect(allieSourceSet(learningCatalogue(publicLearningAccess))).not.toBe(
        restricted.sourceSet,
      );
    } finally {
      [
        env.PUBLIC_LAUNCH_MODE,
        env.HELP_LEARN_GUIDES_ENABLED,
        env.HELP_LEARN_PRACTICE_ENABLED,
      ] = prior;
    }
  },
);
