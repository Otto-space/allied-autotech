import { expect, it } from "vitest";
import { learningArticles } from "../../src/modules/learning/learning.content.js";

it("keeps physical attendance guidance in existing permission gates without imposing penalties", () => {
  for (const [id, gate, version] of [
    ["booking-confirmation", "booking-confirmation", 14],
    ["assigned-findings", "jobs", 5],
    ["service-request", "public", 30],
  ] as const) {
    const article = learningArticles.find((row) => row.id === id)!;
    expect(article.gate).toBe(gate);
    expect(article.version).toBe(version);
    expect(article.steps.join(" ")).toContain("arrival");
    expect(article.steps.join(" ")).toContain("suspension");
  }
  const work = learningArticles.find((row) => row.id === "booking-confirmation")!;
  expect(work.steps.join(" ")).toContain("not an owner-approved rule");
  expect(work.steps.join(" ")).toContain(
    "does not move the appointment or displace another customer",
  );
});
