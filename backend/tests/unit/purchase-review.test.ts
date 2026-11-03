import { describe, expect, it } from "vitest";
import { qualifierKeys } from "../../src/modules/fitment/fitment.schemas.js";
import {
  assertCompleteReviewLines,
  purchasePayableFingerprint,
  verifyPurchaseFitment,
  type ReviewOrder,
  type ReviewRule,
} from "../../src/modules/orders/purchase-review.engine.js";
import {
  purchaseReviewDecisionSchema,
  purchaseReviewRequestSchema,
} from "../../src/modules/orders/purchase-review.schemas.js";

const id = (n: number) => `f7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const branchId = id(1);
const selection = {
  vehicleModelId: id(2),
  year: 2018,
  position: "Front",
  brakeSystem: "Akebono",
};
function rule(change: Partial<ReviewRule> = {}): ReviewRule {
  return {
    ...(Object.fromEntries(qualifierKeys.map((key) => [key, null])) as Record<
      (typeof qualifierKeys)[number],
      null
    >),
    id: id(3),
    version: 1,
    branchId: null,
    reviewedByUserId: id(4),
    reviewStatus: "APPROVED",
    scope: "MODEL",
    effect: "INCLUDE",
    vehicleModelId: id(2),
    yearFrom: 2016,
    yearTo: 2020,
    safetyCritical: true,
    allVariantsConfirmed: true,
    requiredQualifiers: ["position", "brakeSystem"],
    position: "front",
    brakeSystem: "Akebono",
    sourceReference: "Synthetic technical evidence for isolated tests",
    reviewedAt: new Date("2026-11-02T10:00:00Z"),
    ...change,
  };
}
const verify = (
  rules: ReviewRule[],
  selected: typeof selection | null = selection,
  productType = "BRAKE_PAD",
) => verifyPurchaseFitment({ rules, branchId, productType, selection: selected });
describe("pre-payment compatibility evidence", () => {
  it("retains the actual evidence version, source and reviewer identity", () => {
    expect(verify([rule()])).toEqual([
      {
        id: id(3),
        version: 1,
        sourceReference: "Synthetic technical evidence for isolated tests",
        reviewedByUserId: id(4),
        reviewedAt: "2026-11-02T10:00:00.000Z",
      },
    ]);
  });
  it.each([
    { reviewStatus: "PENDING" },
    { reviewStatus: "RETIRED" },
    { reviewedAt: null },
    { reviewedByUserId: null },
    { sourceReference: null },
    { sourceReference: "   " },
    { allVariantsConfirmed: false },
    { branchId: id(5) },
    { vehicleModelId: id(6) },
    { position: "rear" },
    { brakeSystem: "different" },
    { yearTo: 2017 },
    { scope: "UNIVERSAL", safetyCritical: false },
  ] satisfies Partial<ReviewRule>[])(
    "rejects insufficient/revoked/out-of-scope evidence %j",
    (change) => expect(() => verify([rule(change)])).toThrow(),
  );
  it("never lets an inclusion override a genuine exclusion", () => {
    const excluded = rule({ id: id(7), effect: "EXCLUDE" });
    expect(() => verify([rule(), excluded])).toThrow();
    expect(() => verify([excluded, rule()])).toThrow();
    expect(() =>
      verify([rule(), rule({ id: id(8), effect: "EXCLUDE", safetyCritical: false })]),
    ).toThrow();
  });
  it("allows a source-backed universal accessory without inventing a vehicle", () => {
    const universal = rule({
      scope: "UNIVERSAL",
      vehicleModelId: null,
      yearFrom: null,
      yearTo: null,
      safetyCritical: false,
      requiredQualifiers: [],
      position: null,
      brakeSystem: null,
    });
    expect(verify([universal], null, "ACCESSORY")).toHaveLength(1);
    expect(() => verify([universal], null, "BRAKE_PAD")).toThrow();
    expect(() =>
      verify([universal, rule({ effect: "EXCLUDE", id: id(8) })], null, "ACCESSORY"),
    ).toThrow();
    expect(() => verify([universal], null, "UNKNOWN")).toThrow();
  });
  it("rechecks product type instead of trusting a stale non-critical rule", () => {
    expect(() => verify([rule({ safetyCritical: false })])).toThrow();
    expect(
      verify([rule({ safetyCritical: false })], selection, "OIL_FILTER"),
    ).toHaveLength(1);
  });
  it("requires complete line coverage without duplicate or unrelated IDs", () => {
    expect(() =>
      assertCompleteReviewLines([id(10), id(11)], [id(11), id(10)]),
    ).not.toThrow();
    for (const submitted of [[id(10)], [id(10), id(10)], [id(10), id(12)], []])
      expect(() => assertCompleteReviewLines([id(10), id(11)], submitted)).toThrow();
  });
});
const order: ReviewOrder = {
  id: id(20),
  branchId,
  currency: "NGN",
  subtotalKobo: 2000n,
  discountAmountKobo: 100n,
  taxKobo: 143n,
  deliveryFeeKobo: 0n,
  totalKobo: 2043n,
  items: [1, 2].map((n) => ({
    id: id(20 + n),
    productId: id(30 + n),
    productName: `Synthetic part ${n}`,
    sku: `TEST-${n}`,
    quantity: 1,
    unitPriceKobo: 1000n,
    subtotalKobo: 1000n,
  })),
};
describe("approved offer identity", () => {
  it("is stable across database row ordering and supports exact bigint amounts", () => {
    expect(purchasePayableFingerprint(order)).toMatch(/^[a-f0-9]{64}$/);
    expect(
      purchasePayableFingerprint({ ...order, items: [...order.items].reverse() }),
    ).toBe(purchasePayableFingerprint(order));
    expect(() =>
      purchasePayableFingerprint({ ...order, totalKobo: 9000000000000000000n }),
    ).not.toThrow();
  });
  it.each([
    { branchId: id(23) },
    { currency: "USD" },
    { discountAmountKobo: 101n },
    { subtotalKobo: 2001n },
    { taxKobo: 144n },
    { deliveryFeeKobo: 1n },
    { totalKobo: 2044n },
  ])("binds the complete monetary snapshot case %#", (change) =>
    expect(purchasePayableFingerprint({ ...order, ...change })).not.toBe(
      purchasePayableFingerprint(order),
    ),
  );
  it("detects product and quantity changes even when the total is unchanged", () => {
    for (const change of [
      { productId: id(40) },
      { quantity: 2 },
      { sku: "CHANGED" },
      { productName: "Changed" },
    ])
      expect(
        purchasePayableFingerprint({
          ...order,
          items: [{ ...order.items[0]!, ...change }, order.items[1]!],
        }),
      ).not.toBe(purchasePayableFingerprint(order));
  });
});
describe("review submission boundaries", () => {
  it("accepts specifications without allowing client approval, prices or duplicate lines", () => {
    const base = {
      expectedVersion: 0,
      expectedRevision: 0,
      reason: "Synthetic customer specification",
      lines: [{ orderItemId: id(21), selection }],
    };
    expect(purchaseReviewRequestSchema.safeParse(base).success).toBe(true);
    for (const extra of [
      { decision: "APPROVED" },
      { totalKobo: "1" },
      { reviewedByUserId: id(4) },
    ])
      expect(purchaseReviewRequestSchema.safeParse({ ...base, ...extra }).success).toBe(
        false,
      );
    expect(
      purchaseReviewRequestSchema.safeParse({
        ...base,
        lines: [...base.lines, ...base.lines],
      }).success,
    ).toBe(false);
  });
  it("requires sourced evidence and a valid arrival range; declines cannot claim availability", () => {
    const approved = {
      expectedVersion: 0,
      expectedRevision: 1,
      reason: "Synthetic decision only",
      decision: "APPROVED",
      availability: [{ orderItemId: id(21), evidence: { kind: "BRANCH_STOCK" } }],
    };
    expect(purchaseReviewDecisionSchema.safeParse(approved).success).toBe(true);
    expect(
      purchaseReviewDecisionSchema.safeParse({ ...approved, availability: [] }).success,
    ).toBe(false);
    expect(
      purchaseReviewDecisionSchema.safeParse({ ...approved, decision: "DECLINED" })
        .success,
    ).toBe(false);
    expect(
      purchaseReviewDecisionSchema.safeParse({
        ...approved,
        decision: "DECLINED",
        availability: [],
      }).success,
    ).toBe(true);
    const sourced = {
      kind: "SUPPLIER",
      sourceReference: "Synthetic supplier quotation",
      availableUntil: "2026-11-04T18:00:00Z",
      expectedFrom: "2026-11-05T09:00:00Z",
      expectedTo: "2026-11-07T09:00:00Z",
    };
    const parse = (evidence: object) =>
      purchaseReviewDecisionSchema.safeParse({
        ...approved,
        availability: [{ orderItemId: id(21), evidence }],
      }).success;
    expect(parse(sourced)).toBe(true);
    expect(parse({ ...sourced, sourceReference: "yes" })).toBe(false);
    expect(parse({ ...sourced, expectedTo: "2026-11-04T09:00:00Z" })).toBe(false);
    expect(parse({ ...sourced, expectedTo: undefined })).toBe(false);
  });
});
