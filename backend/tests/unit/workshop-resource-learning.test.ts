import { expect, it } from "vitest";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
import {
  learningEligible,
  publicLearningAccess,
  type LearningAccess,
} from "../../src/modules/learning/learning.service.js";
it("keeps resource-authoring instructions server-side, owner-only and draft pending publication", () => {
  const article = learningArticles.find((a) => a.id === "workshop-resource-plan")!;
  expect(article).toMatchObject({
    version: 1,
    gate: "owner",
    status: "draft",
    href: "/admin/booking-resources",
  });
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    const access: LearningAccess = {
      ...publicLearningAccess,
      role,
      verified: true,
      managed: true,
      position: "CEO_MD",
      canManage: true,
      permissions: ["JOBS_UPDATE", "BOOKINGS_READ"],
      independentCapabilities: ["BOOKING_CONFIRM"],
    };
    expect(learningEligible(access, article.gate)).toBe(role === "SUPER_ADMIN");
    if (role === "SUPER_ADMIN")
      expect(learningEligible({ ...access, verified: false }, article.gate)).toBe(false);
  }
  const text = article.steps.join(" ");
  for (const phrase of [
    "explicitly assess",
    "around breaks",
    "do not resubmit",
    "newer version alone does not prove",
    "contains no approval body",
    "does not approve another version",
  ])
    expect(text).toContain(phrase);
});
it("versions appointment guidance without granting resource approval to ordinary bookers", () => {
  const article = learningArticles.find((a) => a.id === "booking-confirmation")!;
  expect(article).toMatchObject({
    version: 12,
    gate: "booking-confirmation",
    href: "/admin/workforce/bookings",
  });
  expect(article.steps.join(" ")).toContain(
    "The authorised owner uses Workshop resources",
  );
  expect(article.steps.join(" ")).toContain(
    "does not reserve equipment or grant anyone work permission",
  );
});

it("keeps recorded-work guidance restricted without claiming estimate expiry releases capacity", () => {
  const a = learningArticles.find((a) => a.id === "booking-confirmation")!;
  expect(a.steps.join(" ")).toContain("older booking still says Confirmed");
  expect(a.steps.join(" ")).toContain("record the actual outcome");
  expect(a.gate).toBe("booking-confirmation");
});

it("grounds running-work reviews in explicit scope, physical units and truthful estimates", () => {
  const a = learningArticles.find((a) => a.id === "booking-confirmation")!;
  expect(a.gate).toBe("booking-confirmation");
  for (const text of [
    "Review remaining work",
    "booking-reading responsibility",
    "additional units genuinely needed",
    "never displaced",
    "physical-unit names",
    "financial records remain unchanged",
  ])
    expect(a.steps.join(" ")).toContain(text);
  const customer = learningArticles.find((a) => a.id === "service-request")!;
  expect(customer.steps.join(" ")).toContain(
    "remaining-work estimate with its review time",
  );
});
