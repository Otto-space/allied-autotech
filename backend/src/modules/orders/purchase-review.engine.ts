import {
  decideFitment,
  permitsNonCriticalFitment,
  type PublishedRule,
} from "../fitment/fitment.engine.js";
import { qualifierKeys, type FitmentSelection } from "../fitment/fitment.schemas.js";
import { orderConflict } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";

export type ReviewRule = PublishedRule & {
  version: number;
  branchId: string | null;
  reviewedByUserId: string | null;
};
export type ReviewOrder = {
  id: string;
  branchId: string | null;
  currency: string;
  subtotalKobo: bigint;
  discountAmountKobo: bigint;
  taxKobo: bigint;
  deliveryFeeKobo: bigint;
  totalKobo: bigint;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPriceKobo: bigint;
    subtotalKobo: bigint;
  }>;
};

// Bind the decision to immutable monetary and line snapshots, not just a total
// that could coincidentally remain unchanged after swapping products/quantities.
export function purchasePayableFingerprint(order: ReviewOrder) {
  return orderFingerprint({
    id: order.id,
    branchId: order.branchId,
    currency: order.currency,
    subtotalKobo: order.subtotalKobo.toString(),
    discountAmountKobo: order.discountAmountKobo.toString(),
    taxKobo: order.taxKobo.toString(),
    deliveryFeeKobo: order.deliveryFeeKobo.toString(),
    totalKobo: order.totalKobo.toString(),
    items: order.items
      .toSorted((a, b) => a.id.localeCompare(b.id))
      .map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        unitPriceKobo: item.unitPriceKobo.toString(),
        subtotalKobo: item.subtotalKobo.toString(),
      })),
  });
}

export function verifyPurchaseFitment(input: {
  rules: ReviewRule[];
  branchId: string;
  productType: string | null;
  selection: FitmentSelection | null;
}) {
  // Include every applicable approved exclusion. Never select a convenient
  // inclusion first or accept another branch's evidence.
  const rules = input.rules
    .filter(
      (rule) =>
        (rule.branchId === null || rule.branchId === input.branchId) &&
        !!rule.sourceReference?.trim() &&
        rule.reviewedByUserId !== null &&
        (rule.effect === "EXCLUDE" ||
          rule.safetyCritical ||
          permitsNonCriticalFitment(input.productType)) &&
        (rule.scope !== "UNIVERSAL" || input.productType?.toUpperCase() === "ACCESSORY"),
    )
    .toSorted((a, b) => a.id.localeCompare(b.id));
  let matchedRuleIds: string[];
  if (input.selection) {
    const decision = decideFitment(rules, input.selection);
    if (decision.status !== "VERIFIED_FIT")
      throw orderConflict(
        "Approved fitment evidence does not confirm these details. Request technical review before payment.",
      );
    matchedRuleIds = decision.matchedRuleIds;
  } else {
    const published = rules.filter(
      (rule) =>
        rule.reviewStatus === "APPROVED" &&
        !!rule.sourceReference?.trim() &&
        !!rule.reviewedAt &&
        rule.allVariantsConfirmed,
    );
    // Without a vehicle, a model-specific exclusion cannot be dismissed.
    if (published.some((rule) => rule.effect === "EXCLUDE"))
      throw orderConflict(
        "Supply the vehicle configuration so approved exclusions can be checked.",
      );
    const universal = published.find(
      (rule) =>
        rule.scope === "UNIVERSAL" &&
        rule.effect === "INCLUDE" &&
        !rule.safetyCritical &&
        rule.vehicleModelId === null &&
        rule.yearFrom === null &&
        rule.yearTo === null &&
        rule.requiredQualifiers.length === 0 &&
        qualifierKeys.every((key) => rule[key] === null),
    );
    if (!universal)
      throw orderConflict(
        "Vehicle details are required unless approved evidence confirms a universal accessory.",
      );
    matchedRuleIds = [universal.id];
  }
  const matched = rules.filter((rule) => matchedRuleIds.includes(rule.id));
  // Persist versions and source/reviewer identity so revocation and changed
  // evidence are detected by the payment-boundary recheck.
  return matched.map((rule) => ({
    id: rule.id,
    version: rule.version,
    sourceReference: rule.sourceReference!,
    reviewedByUserId: rule.reviewedByUserId!,
    reviewedAt: new Date(rule.reviewedAt!).toISOString(),
  }));
}

export function assertCompleteReviewLines(itemIds: string[], submittedIds: string[]) {
  if (
    new Set(itemIds).size !== itemIds.length ||
    submittedIds.length !== itemIds.length ||
    new Set(submittedIds).size !== submittedIds.length ||
    submittedIds.some((id) => !itemIds.includes(id))
  )
    throw orderConflict("Review every current order line exactly once.");
}
