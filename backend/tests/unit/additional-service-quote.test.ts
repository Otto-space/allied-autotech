import { expect, it } from "vitest";
import {
  quoteCreateBodySchema,
  quoteDecisionBodySchema,
  quoteReplaceBodySchema,
} from "../../src/modules/service-operations/service-operations.schemas.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";
const base = {
  items: [
    {
      type: "LABOUR",
      description: "Synthetic additional check",
      quantity: 1,
      unitPriceKobo: "5000",
    },
  ],
  expiresAt: "2027-01-01T10:00:00Z",
};
it("accepts explicit reviewed additional-work intent without accepting a client-chosen original invoice", () => {
  const additionalWork = {
    expectedBookingVersion: 3,
    reason: "Customer-visible additional scope",
  };
  expect(quoteCreateBodySchema.parse({ ...base, additionalWork }).additionalWork).toEqual(
    additionalWork,
  );
  expect(
    quoteCreateBodySchema.safeParse({
      ...base,
      additionalWork: {
        ...additionalWork,
        originalInvoiceId: "a7000000-0000-4000-8000-000000000001",
      },
    }).success,
  ).toBe(false);
  expect(quoteCreateBodySchema.parse(base).additionalWork).toBeUndefined();
});
it.each(["", "   ", "Unsafe\u0000reason", "x".repeat(1001)])(
  "rejects an invalid reason %#",
  (reason) => {
    expect(
      quoteCreateBodySchema.safeParse({
        ...base,
        additionalWork: { expectedBookingVersion: 0, reason },
      }).success,
    ).toBe(false);
  },
);
it.each([-1, 0.5, 2147483648])(
  "rejects an invalid booking review version %s",
  (expectedBookingVersion) => {
    expect(
      quoteCreateBodySchema.safeParse({
        ...base,
        additionalWork: { expectedBookingVersion, reason: "Valid synthetic reason" },
      }).success,
    ).toBe(false);
  },
);
it("permits a reviewed reason on a replacement draft without changing its original association", () => {
  expect(
    quoteReplaceBodySchema.safeParse({
      ...base,
      expectedRevision: 2,
      amendmentReason: "New reviewed reason",
    }).success,
  ).toBe(true);
  expect(
    quoteReplaceBodySchema.safeParse({
      ...base,
      expectedRevision: 2,
      additionalWork: {
        expectedBookingVersion: 1,
        reason: "Cannot rebind a replacement",
      },
    }).success,
  ).toBe(false);
});
it("keeps versioned guidance truthful and permission gated", () => {
  const customer = learningArticles.find((row) => row.id === "service-request")!;
  const finance = learningArticles.find((row) => row.id === "financial-policy-work")!;
  expect([customer.version, customer.gate, customer.steps.length]).toEqual([
    35,
    "public",
    12,
  ]);
  expect([finance.version, finance.gate]).toEqual([9, "financial-policy"]);
  expect(customer.steps.join(" ")).toContain(
    "acceptance does not replace an earlier invoice or make a payment",
  );
  expect(finance.steps.join(" ")).toContain("include only the new items");
});

it("validates explicit additional-work agreement independently of staff transitions", () => {
  const body = {
    expectedRevision: 1,
    acceptedAdditionalWork: {
      invoiceNumber: "INV-QA",
      quoteVersion: 2,
      reason: "Reviewed additional scope",
    },
  };
  expect(quoteDecisionBodySchema.parse(body)).toEqual(body);
  expect(quoteDecisionBodySchema.parse({ expectedRevision: 1 })).toEqual({
    expectedRevision: 1,
  });
  for (const patch of [
    { quoteVersion: 0 },
    { invoiceNumber: "" },
    { reason: "" },
    { customerUserId: "untrusted" },
  ]) {
    expect(
      quoteDecisionBodySchema.safeParse({
        ...body,
        acceptedAdditionalWork: { ...body.acceptedAdditionalWork, ...patch },
      }).success,
    ).toBe(false);
  }
});
