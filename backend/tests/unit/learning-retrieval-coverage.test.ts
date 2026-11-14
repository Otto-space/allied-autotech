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
    expect(article.version).toBe(7);
    expect(article.gate).toBe("customer");
    expect(article.steps.join(" ")).toContain(
      "Copy it before choosing Hide code, refreshing or reloading",
    );
    expect(article.steps.join(" ")).toContain(
      "Share it privately only with your chosen collector",
    );
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
      }).articles.some((row) => row.id === article.id && row.version === 7),
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
  expect([guide.gate, guide.version]).toEqual(["admin", 11]);
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF"] as const) {
    const catalogue = learningCatalogue({
      ...publicLearningAccess,
      role,
      verified: true,
    });
    expect(catalogue.articles.some((article) => article.id === guide.id)).toBe(false);
  }
});

it("keeps actual supply settlement resolution restricted and separate from physical collection", () => {
  const source = learningArticles.find((article) => article.id === "order-sourcing")!;
  const refund = learningArticles.find((article) => article.id === "refund-work")!;
  expect([source.gate, source.version, refund.gate, refund.version]).toEqual([
    "admin",
    11,
    "refunds",
    12,
  ]);
  for (const topic of [source, refund]) {
    const content = JSON.stringify(topic);
    expect(content).toContain("Reconcile the refunded goods");
    expect(content).toContain("canonical debit");
    expect(content).toContain("does not return stock or grant collection");
    expect(content).toContain("active pickup review");
  }
});

it("explains actual remaining collection without granting payment or stock authority", () => {
  const pickup = learningArticles.find((row) => row.id === "parts-collection")!;
  const sourcing = learningArticles.find((row) => row.id === "order-sourcing")!;
  const refund = learningArticles.find((row) => row.id === "refund-work")!;
  expect([
    pickup.version,
    pickup.gate,
    sourcing.version,
    sourcing.gate,
    refund.version,
    refund.gate,
  ]).toEqual([7, "customer", 11, "admin", 12, "refunds"]);
  expect(pickup.steps.join(" ")).toContain("only the goods still owed");
  expect(sourcing.steps.join(" ")).toContain("does not restock consumed");
  expect(refund.steps.join(" ")).toContain("does not erase its historical acceptance");
  expect(refund.steps.join(" ")).toContain("separate grant and independence");
});

it("keeps no-goods financial closure distinct from invented handover and financial permission", () => {
  for (const id of ["staff-parts-collection", "order-sourcing", "refund-work"]) {
    const article = learningArticles.find((row) => row.id === id)!;
    expect(article.steps.join(" ")).toContain("financial closure");
  }
  const source = learningArticles.find((row) => row.id === "order-sourcing")!;
  expect(source.steps.join(" ")).toContain("never a fake final handover");
  expect(source.steps.join(" ")).toContain("consumed stock and original money");
  const refund = learningArticles.find((row) => row.id === "refund-work")!;
  expect(refund.steps.join(" ")).toContain("this guide grants none of those duties");
});

it("keeps cancelled-order reconciliation and unknown money distinct from unit refunds", () => {
  const source = learningArticles.find((row) => row.id === "order-sourcing")!;
  const customer = learningArticles.find((row) => row.id === "parts-collection")!;
  expect(source.steps.join(" ")).toContain("no payment attempts");
  expect(source.steps.join(" ")).toContain("observations obtained after cancellation");
  expect(
    learningArticles.find((row) => row.id === "refund-work")!.steps.join(" "),
  ).toContain("reversed or pending result remains held");
  expect(source.steps.join(" ")).toContain("invalidates clearance");
  expect(customer.steps.join(" ")).toContain("not a refund");
  expect(customer.steps.join(" ")).toContain("separate acceptance");
  for (const role of ["PUBLIC", "CUSTOMER", "STAFF"] as const)
    expect(
      learningCatalogue({ ...publicLearningAccess, role, verified: true }).articles.some(
        (row) => row.id === source.id,
      ),
    ).toBe(false);
});

it("keeps actual pre-confirmation recovery distinct from staff cancellation and broad policy approval", () => {
  const guide = learningArticles.find((row) => row.id === "refund-work")!;
  expect(guide.gate).toBe("refunds");
  expect(guide.steps.join(" ")).toContain(
    "immutable account or verified-guest cancellation audit",
  );
  expect(guide.steps.join(" ")).toContain(
    "does not approve the broader cancellation policy",
  );
  expect(guide.steps.join(" ")).toContain("A different capable operator must approve");
  const aftercare = learningArticles.find((row) => row.id === "financial-aftercare")!;
  expect(aftercare.version).toBe(6);
  expect(aftercare.steps.join(" ")).toContain(
    "A staff cancellation is not buyer consent",
  );
});
