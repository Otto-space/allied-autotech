import { describe, expect, it } from "vitest";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
describe("reviewed vehicle guidance", () => {
  it("versions the public owner-versus-inspection disclosure without granting authoring access", () => {
    const article = learningArticles.find((article) => article.id === "vehicle-enquiry")!;
    expect(article.version).toBe(4);
    expect(article.gate).toBe("public");
    expect(article.reviewedAt).toBe("2026-10-29");
    expect(article.steps.join(" ")).toContain(
      "owner-reported condition and known issues",
    );
    expect(article.steps.join(" ")).toContain("separate from a recorded inspection");
    expect(article.summary).toContain("not a reservation");
  });
});
