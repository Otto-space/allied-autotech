import { remainingPickupUnitRanges } from "./order-pickup-units.js";
import { pickupUnitHistory } from "./order-pickup.repository.js";
import { assertNoSupplyExceptionHold } from "./order-supply-exception-hold.js";
import { assertOrderSourcingAvailable } from "./order-sourcing-availability.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";
import { purchasePayableFingerprint } from "./purchase-review.engine.js";
import {
  loadPurchaseFitment,
  lockPurchaseReviewOrder,
} from "./purchase-review.repository.js";
import {
  purchaseApprovalSnapshotSchema,
  purchaseRequirementsSchema,
  purchaseReviewPaymentBindingSchema,
} from "./purchase-review.schemas.js";

/** Post-payment fulfilment is not a second payment eligibility check. Preserve
 * paid prices and accepted quotation terms, but stop unsuitable fulfilment when
 * current technical evidence no longer supports the approved configuration.
 * Historical paid orders remain explicitly historical, never backdated reviews.
 */
export async function assertReviewedPurchaseFulfilment(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const order = await lockPurchaseReviewOrder(tx, id);
  const supply = await assertNoSupplyExceptionHold(tx, id);
  const quantities = new Map(order.items.map((item) => [item.id, item.quantity]));
  if (supply.resolutions.length) {
    for (const key of quantities.keys()) quantities.set(key, 0);
    const physical = remainingPickupUnitRanges(
      order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
      await pickupUnitHistory(tx, id),
      supply.resolutions.flatMap((row) => row.unfulfilledLines),
    );
    for (const range of physical)
      quantities.set(
        range.orderItemId,
        (quantities.get(range.orderItemId) ?? 0) + range.quantity,
      );
    if (!physical.length)
      throw orderConflict(
        "No goods remain to fulfil. Review financial closure rather than recording a handover.",
      );
  }
  await assertOrderSourcingAvailable(tx, id, quantities);
  const review = await tx.orderPurchaseReview.findFirst({
    where: { orderId: id },
    orderBy: { revision: "desc" },
  });
  const snapshot = order.policySnapshot;
  const workflow =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot["purchaseWorkflow"]
      : undefined;
  const revised =
    workflow &&
    typeof workflow === "object" &&
    !Array.isArray(workflow) &&
    workflow["version"] === 2;
  if (!review && !revised)
    return {
      legacy: true as const,
      sourced: false,
      supply,
      quantities,
      items: order.items,
    };
  if (
    !order.paidAt ||
    !review ||
    review.status !== "APPROVED" ||
    !review.decidedAt ||
    review.payableFingerprint !== purchasePayableFingerprint(order)
  )
    throw orderConflict(
      "This paid order needs technical review before fulfilment. Payment records have been retained.",
    );
  const payment = await tx.payment.findFirst({
    where: { orderId: id, status: "SUCCEEDED", settledAttemptId: { not: null } },
    select: { policySnapshot: true, createdAt: true, amountKobo: true, currency: true },
  });
  const paymentPolicy = payment?.policySnapshot;
  const binding = purchaseReviewPaymentBindingSchema.safeParse(
    paymentPolicy && typeof paymentPolicy === "object" && !Array.isArray(paymentPolicy)
      ? paymentPolicy["purchaseReview"]
      : undefined,
  );
  if (
    !payment ||
    !binding.success ||
    binding.data.id !== review.id ||
    binding.data.revision !== review.revision ||
    binding.data.payableFingerprint !== review.payableFingerprint ||
    payment.createdAt < review.decidedAt ||
    payment.amountKobo !== order.totalKobo ||
    payment.currency !== order.currency
  )
    throw orderConflict(
      "The paid order and approved offer need reconciliation before fulfilment.",
    );
  const approved = purchaseApprovalSnapshotSchema.parse(review.decisionSnapshot);
  const current = await loadPurchaseFitment(
    tx,
    order,
    purchaseRequirementsSchema.parse(review.requirements),
    "FULFILMENT",
    supply.resolutions.length ? quantities : undefined,
  );
  const expected = approved.fitment
    .filter((line) => quantities.get(line.orderItemId) !== 0)
    .map((line) => ({
      ...line,
      quantity: quantities.get(line.orderItemId) ?? line.quantity,
    }));
  if (orderFingerprint(current) !== orderFingerprint(expected))
    throw orderConflict(
      "Compatibility evidence changed after payment. Hold fulfilment for technical review; payment remains recorded.",
    );
  return {
    legacy: false as const,
    sourced: approved.availability.some(
      (line) =>
        quantities.get(line.orderItemId) !== 0 && line.evidence.kind === "SUPPLIER",
    ),
    supply,
    quantities,
    items: order.items,
  };
}
