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

it("versions reversal guidance without granting live lookups or writes", () => {
  const guidance = learningArticles.find((item) => item.id === "no-live-lookup")!;
  expect(guidance.version).toBe(3);
  expect(guidance.gate).toBe("public");
  expect(guidance.summary).toContain("does not look up");
  expect(guidance.steps.join(" ")).toContain("do not pay again");
  expect(guidance.steps.join(" ")).toContain("does not prove a refund");
});

it("keeps concern guidance conditional on the real intake form and preserves pending confirmation", () => {
  const article = learningArticles.find((item) => item.id === "service-request")!;
  expect(article.version).toBe(10);
  expect(article.steps.join(" ")).toContain("Its verified name and link are included");
  expect(article.steps.join(" ")).toContain("not an individual priced service");
  expect(article.steps.join(" ")).toContain("no individual services listed yet");
  expect(article.steps.join(" ")).toContain("Declining keeps your existing appointment");
  expect(article.steps.join(" ")).toContain("still needs workshop confirmation");
  expect(article.steps.join(" ")).toContain(
    "update your account and do not submit the booking",
  );
  expect(article.steps.join(" ")).toContain(
    "does not confirm the visit, approve a quotation or charge you",
  );
  expect(article.gate).toBe("public");
  expect(article.steps.join(" ")).toContain("If your booking form offers");
  expect(article.steps.join(" ")).toContain(
    "no service price or confirmed time is implied",
  );
});

it("keeps reviewed contact facts public without promising workshop hours or sending messages", () => {
  const article = learningArticles.find((item) => item.id === "business-contact")!;
  expect(article.gate).toBe("public");
  expect(article.href).toBe("/contact");
  expect(article.summary).toBe(
    "Allied AutoTech is at 133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria.",
  );
  expect(article.steps.join(" ")).toContain("not confirmation of workshop availability");
  expect(article.steps.join(" ")).toContain("does not send a message");
  expect(article.steps.join(" ")).not.toMatch(/2348136075567|08136075567/);
  expect(article.source).toContain("frontend/lib/business.ts");
});
