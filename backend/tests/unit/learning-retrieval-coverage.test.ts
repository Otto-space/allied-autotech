import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
import {
  learningCatalogue,
  publicLearningAccess,
  type LearningAccess,
} from "../../src/modules/learning/learning.service.js";
import { retrieveAllieContext } from "../../src/modules/learning/allie.retrieval.js";

const responsibilities = [
  "CUSTOMER_ENQUIRIES",
  "COMPLAINTS",
  "CARE_CASE_VIEW",
  "CARE_PUBLIC_REPLY",
  "SALES_ENQUIRIES",
  "FINANCE_READ",
  "BOOKINGS_READ",
  "JOBS_READ",
  "JOBS_UPDATE",
  "JOBS_ASSIGN",
  "ORDERS_PREPARE",
];
const independent = [
  "REFUND_APPROVE",
  "REFUND_TRANSFER",
  "REFUND_CHECK",
  "DISPUTE_MANAGE",
  "PRIVACY_REVIEW",
  "FINANCE_POLICY_APPROVE",
  "BOOKING_CONFIRM",
];
const profiles: Array<[string, Partial<LearningAccess>]> = [
  ["public", {}],
  ["customer", { role: "CUSTOMER", verified: true }],
  [
    "managed worker",
    {
      role: "STAFF",
      verified: true,
      managed: true,
      position: "CEO_MD",
      canManage: true,
      permissions: responsibilities,
      independentCapabilities: independent,
      careScope: { enquiries: true, complaints: true, reply: true, assign: true },
    },
  ],
  [
    "administrator",
    { role: "ADMIN", verified: true, independentCapabilities: independent },
  ],
  [
    "owner",
    { role: "SUPER_ADMIN", verified: true, independentCapabilities: independent },
  ],
];
let flags: [boolean, boolean, boolean];
beforeEach(() => {
  flags = [
    env.HELP_LEARN_ENABLED,
    env.HELP_LEARN_GUIDES_ENABLED,
    env.HELP_LEARN_PRACTICE_ENABLED,
  ];
  env.HELP_LEARN_ENABLED =
    env.HELP_LEARN_GUIDES_ENABLED =
    env.HELP_LEARN_PRACTICE_ENABLED =
      true;
});
afterEach(() => {
  [
    env.HELP_LEARN_ENABLED,
    env.HELP_LEARN_GUIDES_ENABLED,
    env.HELP_LEARN_PRACTICE_ENABLED,
  ] = flags;
});

describe("authorised server help survives Allie retrieval", () => {
  it("keeps pickup display and clearing guidance restricted to verified customers", () => {
    const article = learningArticles.find((row) => row.id === "parts-collection")!;
    expect(article.version).toBe(3);
    expect(article.gate).toBe("customer");
    expect(article.steps.join(" ")).toContain("successful background order check");
    expect(article.steps.join(" ")).toContain("failed check or access change clears it");
    expect(
      learningCatalogue(publicLearningAccess).articles.some(
        (row) => row.id === article.id,
      ),
    ).toBe(false);
    expect(
      learningCatalogue({
        ...publicLearningAccess,
        role: "CUSTOMER",
        verified: true,
      }).articles.some((row) => row.id === article.id && row.version === 3),
    ).toBe(true);
  });
  it("keeps reminder-policy guidance and actions restricted to the owner", () => {
    for (const [name, access] of profiles.filter(([name]) => name !== "owner")) {
      const data = learningCatalogue({ ...publicLearningAccess, ...access });
      expect(
        data.articles.some((row) => row.id === "booking-reminders"),
        name,
      ).toBe(false);
      expect(
        retrieveAllieContext(data, "booking-reminders", "work").actions.some(
          (action) => action.href === "/admin/booking-capacity",
        ),
        name,
      ).toBe(false);
    }
  });
  for (const [name, access] of profiles) {
    it(`retrieves every eligible article from the ${name} catalogue`, () => {
      const data = learningCatalogue({ ...publicLearningAccess, ...access });
      for (const article of data.articles) {
        expect(article.source, article.id).toBe(article.title);
        const context = retrieveAllieContext(data, article.id, "other");
        expect(
          context.sources.map((s) => s.articleId),
          article.id,
        ).toContain(article.id);
        expect(context.actions, article.id).toContainEqual(
          expect.objectContaining({
            id: `open:${article.id}`,
            href: article.href,
            sourceId: `${article.id}@v${article.version}`,
          }),
        );
      }
    });
  }
  it("covers every published article without widening an unauthorised catalogue", () => {
    const covered = new Set(
      profiles.flatMap(([, access]) =>
        learningCatalogue({ ...publicLearningAccess, ...access }).articles.map(
          (a) => a.id,
        ),
      ),
    );
    for (const article of learningArticles.filter((a) => a.status === "published"))
      expect(covered.has(article.id), article.id).toBe(true);
    for (const role of ["PUBLIC", "CUSTOMER", "STAFF"] as const) {
      const data = learningCatalogue({ ...publicLearningAccess, role, verified: true });
      const result = retrieveAllieContext(data, "owner-service-groups", "work");
      expect(result.sources.some((s) => s.articleId === "owner-service-groups")).toBe(
        false,
      );
      expect(result.actions.some((a) => a.href === "/admin/service-categories")).toBe(
        false,
      );
    }
  });
});

it("keeps collection instructions administrative without granting release permission", () => {
  const guide = learningArticles.find((a) => a.id === "service-vehicle-collection")!;
  expect([guide.gate, guide.version]).toEqual(["admin", 1]);
  expect(guide.steps.join(" ")).toContain(
    "a technician or booking-reading responsibility alone does not authorise release",
  );
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF"] as const) {
    const catalogue = learningCatalogue({
      ...publicLearningAccess,
      role,
      verified: true,
    });
    expect(catalogue.articles.some((a) => a.id === guide.id)).toBe(false);
  }
});

it("keeps order sourcing authoring instructions out of public, customer and staff catalogues", () => {
  const guide = learningArticles.find((article) => article.id === "order-sourcing")!;
  expect([guide.gate, guide.version]).toEqual(["admin", 1]);
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF"] as const) {
    const catalogue = learningCatalogue({
      ...publicLearningAccess,
      role,
      verified: true,
    });
    expect(catalogue.articles.some((article) => article.id === guide.id)).toBe(false);
  }
});
