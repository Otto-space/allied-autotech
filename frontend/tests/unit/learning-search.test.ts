import { describe, expect, it } from "vitest";
import { catalogueSchema, type LearningCatalogue } from "@/lib/learning/contracts";
import {
  assistantArticles,
  learningResults,
  learningReturn,
} from "@/lib/learning/search";
const publicData = catalogueSchema.parse({
  accessKey: "a".repeat(64),
  audience: "public",
  contentVersion: 1,
  mode: "browse_enquiries",
  flags: { guides: true, practice: true, ai: false },
  articles: [
    {
      id: "parts",
      title: "Find a part",
      summary: "Check compatibility before enquiring.",
      prerequisites: "Use your known vehicle details.",
      steps: ["Search by part name and inspect the evidence."],
      outcome: "You know your next step.",
      recovery: "Ask the team.",
      keywords: "parts shop product fitment",
      page: "parts",
      href: "/parts",
      source: "Reviewed fixture",
      version: 2,
      status: "published",
      reviewedAt: "2026-10-26",
    },
  ],
  guides: [
    {
      id: "parts-find",
      title: "Find the right part",
      version: 2,
      articleId: "parts",
      page: "parts",
      href: "/parts",
      steps: [
        { id: "search", target: "parts-search", text: "Enter a name.", event: "input" },
      ],
    },
  ],
  scenarios: [
    {
      id: "parts-sample",
      title: "Compare sample evidence",
      objective: "Review unknown compatibility.",
      version: 1,
      articleId: "parts",
    },
  ],
});
describe("one eligible learning corpus on all surfaces", () => {
  it("searches all kinds with natural task words and curated aliases", () => {
    expect(
      learningResults(publicData, "How do I find a part?").map((x) => x.kind),
    ).toEqual(["answer", "guide", "practice"]);
    expect(learningResults(publicData, "shop fitment")).toHaveLength(3);
    expect(learningResults(publicData, "walkthrough").map((x) => x.kind)).toEqual([
      "guide",
    ]);
    expect(learningResults(publicData, "practise").map((x) => x.kind)).toEqual([
      "practice",
    ]);
    expect(learningResults(publicData, "no-such-topic")).toEqual([]);
  });
  it("does not answer from missing/ineligible content or a disabled kind", () => {
    expect(assistantArticles(publicData, "How do I find a part?")[0].id).toBe("parts");
    expect(assistantArticles(publicData, "issue a refund now")).toEqual([]);
    expect(assistantArticles(publicData, "parts quaternion rocket")).toEqual([]);
    expect(assistantArticles({ ...publicData, articles: [] }, "find part")).toEqual([]);
    const disabled: LearningCatalogue = {
      ...publicData,
      flags: { guides: false, practice: false, ai: false },
    };
    expect(learningResults(disabled, "part").map((x) => x.kind)).toEqual(["answer"]);
  });
  it("preserves bounded results state and rejects arbitrary return destinations", () => {
    expect(learningReturn(new URLSearchParams("q=part&mode=all"))).toBe(
      "/learn?q=part&mode=all",
    );
    expect(
      learningReturn(
        new URLSearchParams(
          "q=shop&mode=guide&article=parts&return=https://evil.example",
        ),
      ),
    ).toBe("/learn?q=shop&mode=guide");
    expect(learningReturn(new URLSearchParams("mode=admin&article=private"))).toBe(
      "/learn",
    );
    expect(
      new URL(
        learningReturn(new URLSearchParams({ q: "x".repeat(150) })),
        "https://example.com",
      ).searchParams.get("q"),
    ).toHaveLength(120);
  });
  it("ranks a specific task title above a broad overview mentioning the topic", () => {
    const broad = {
      ...publicData.articles[0],
      id: "home",
      title: "Choose your next step",
      keywords: "home products",
      summary: "Choose Shop to find parts or Services for care.",
    };
    const data = { ...publicData, articles: [broad, ...publicData.articles] };
    expect(assistantArticles(data, "parts").map((a) => a.id)).toEqual(["parts", "home"]);
    expect(assistantArticles(data, "how do I find a part?")[0].id).toBe("parts");
  });
});
