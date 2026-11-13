import type { SupplyOrder, SupplySummary } from "../../lib/order-supply-concerns";
export const supplyId = (n: number) =>
  `a1700000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const supplyOrder = () => ({
  id: supplyId(1),
  version: 1,
  status: "PROCESSING",
  supplyConcernCapabilityVersion: 1 as const,
  items: [{ id: supplyId(2), productName: "Synthetic original part", quantity: 3 }],
  paymentReferences: [
    { id: supplyId(6), paymentNumber: "PAY-SYNTHETIC-ORIGINAL", status: "SUCCEEDED" },
  ],
});
export function supplySummary(order: SupplyOrder = supplyOrder()): SupplySummary {
  return {
    orderId: order.id,
    orderVersion: order.version,
    choiceStatementVersion: "SUPPLY_CHOICE_20261110_V1",
    hasMore: false,
    closures: [],
    reconciliations: [],
    hasMoreReconciliations: false,
    cancelledReconciliationReviewAvailable: false,
    cancelledReconciliationPreview: null,
    hasMoreClosures: false,
    closureReviewAvailable: false,
    items: [
      {
        id: supplyId(3),
        orderId: order.id,
        enquiryId: supplyId(4),
        kind: "UNAVAILABLE",
        affectedLines: [{ orderItemId: order.items[0].id, offset: 0, quantity: 1 }],
        customerNote:
          "Synthetic supplier confirmed this affected original unit is unavailable.",
        createdAt: "2026-11-10T08:00:00Z",
        state: "CUSTOMER_CARE_REVIEW_REQUIRED",
        alternativeAccepted: false,
        financialApproval: false,
        monetaryBasis: {
          status: "SAVED_ORDER_ALLOCATION",
          feeKobo: "0",
          reviewOnly: true,
          financialApproval: false,
          amounts: {
            currency: "NGN",
            subtotalKobo: "101",
            discountKobo: "2",
            taxKobo: "8",
            totalKobo: "107",
          },
        },
        supplyRemedyChoices: [],
        hasMoreChoices: false,
      },
    ],
  };
}
export const supplyChoiceRecord = () => ({
  id: supplyId(5),
  choice: "REFUND_REVIEW" as const,
  statementVersion: "SUPPLY_CHOICE_20261110_V1" as const,
  customerNote: "Please review the exact affected original portion for a refund.",
  createdAt: "2026-11-10T09:00:00Z",
  orderVersion: 1,
  alternatives:
    [] as SupplySummary["items"][number]["supplyRemedyChoices"][number]["alternatives"],
  hasMoreAlternatives: false,
  refunds: [] as SupplySummary["items"][number]["supplyRemedyChoices"][number]["refunds"],
  hasMoreRefunds: false,
});
