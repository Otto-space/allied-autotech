import { expect, it } from "vitest";
import {
  learningArticles,
  learningGuides,
} from "../../src/modules/learning/learning.content.js";

it("versions catalogue instructions without changing public guide targets or write permissions", () => {
  const parts = learningArticles.find((item) => item.id === "parts-fitment")!;
  const vehicles = learningArticles.find((item) => item.id === "vehicle-enquiry")!;
  expect([parts.version, vehicles.version]).toEqual([3, 4]);
  for (const article of [parts, vehicles]) {
    expect(article.gate).toBe("public");
    expect(article.steps.join(" ")).toContain("Apply filters");
    expect(article.steps.join(" ")).toContain("preserves");
    expect(article.steps.join(" ")).toContain("Reset search");
  }
  const guide = learningGuides.find((item) => item.id === "parts-find")!;
  expect(guide.version).toBe(3);
  expect(guide.steps.map((step) => [step.target, step.event])).toEqual([
    ["parts-search", "input"],
    ["parts-results", "read"],
  ]);
  expect(guide.steps[1].text).toContain("never adds a live item to a cart");
});
