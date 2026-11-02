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
    version: 1,
    href: "/admin/vehicles",
  });
  expect(article.steps.join(" ")).toContain("employee profile is not required");
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
