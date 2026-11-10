import { expect, it } from "vitest";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
import {
  learningEligible,
  publicLearningAccess,
} from "../../src/modules/learning/learning.service.js";

it("keeps vehicle operation guidance private to current administrators without granting owner or finance authority", () => {
  const article = learningArticles.find((x) => x.id === "vehicle-operations")!;
  expect(article).toMatchObject({
    gate: "vehicle-admin",
    version: 3,
    href: "/admin/vehicles",
  });
  expect(article.steps.join(" ")).toContain("employee profile is not required");
  expect(article.steps.join(" ")).toContain("Engine / Power type");
  expect(article.steps.join(" ")).toContain("commas within an item are preserved");
  expect(article.steps.join(" ")).toContain("Choose View details");
  expect(article.steps.join(" ")).toContain("Opening an editor saves nothing");
  expect(article.steps.join(" ")).toContain(
    "updates existing listings without creating a listing or changing its status",
  );
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    for (const managed of [true, false]) {
      const access = { ...publicLearningAccess, role, managed, verified: true };
      expect(learningEligible(access, article.gate)).toBe(
        role === "ADMIN" || role === "SUPER_ADMIN",
      );
      if (role === "ADMIN") expect(learningEligible(access, "owner")).toBe(false);
      expect(learningEligible(access, "financial-policy")).toBe(false);
      expect(learningEligible({ ...access, verified: false }, article.gate)).toBe(false);
    }
  }
});
