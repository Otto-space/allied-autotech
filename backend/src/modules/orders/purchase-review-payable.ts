import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";
import {
  assertCompleteReviewLines,
  purchasePayableFingerprint,
} from "./purchase-review.engine.js";
import {
  lockPurchaseReviewOrder,
  loadPurchaseFitment,
} from "./purchase-review.repository.js";
import {
  purchaseApprovalSnapshotSchema,
  purchaseRequirementsSchema,
} from "./purchase-review.schemas.js";

/** Called within the same serializable transaction as intent/attempt validation.
 * Never use this to discard a verified provider capture: settlement must still
 * record received money and hold fulfilment if evidence changed after issuance.
 */
export async function assertReviewedPurchasePayable(
  tx: Prisma.TransactionClient,
  id: string,
  now = new Date(),
) {
  const order = await lockPurchaseReviewOrder(tx, id);
  if (
    order.status !== "PENDING" ||
    order.paidAt ||
    !order.paymentDueAt ||
    order.paymentDueAt <= now
  )
    throw orderConflict("This order is not currently payable. Review its latest status.");
  const review = await tx.orderPurchaseReview.findFirst({
    where: { orderId: id },
    orderBy: { revision: "desc" },
  });
  if (
    !review ||
    review.status !== "APPROVED" ||
    !review.expiresAt ||
    review.expiresAt <= now ||
    review.expiresAt.getTime() !== order.paymentDueAt.getTime() ||
    review.payableFingerprint !== purchasePayableFingerprint(order)
  )
    throw orderConflict(
      "Final compatibility and availability review is required before payment.",
    );
  const requirements = purchaseRequirementsSchema.parse(review.requirements);
  const snapshot = purchaseApprovalSnapshotSchema.parse(review.decisionSnapshot);
  const currentFitment = await loadPurchaseFitment(tx, order, requirements);
  if (orderFingerprint(currentFitment) !== orderFingerprint(snapshot.fitment))
    throw orderConflict(
      "Compatibility evidence changed. Request a fresh review before payment.",
    );
  assertCompleteReviewLines(
    order.items.map((item) => item.id),
    snapshot.availability.map((entry) => entry.orderItemId),
  );
  const availability = snapshot.availability.toSorted((left, right) => {
    const leftKey =
      left.evidence.kind === "BRANCH_STOCK"
        ? left.evidence.inventoryId
        : left.orderItemId;
    const rightKey =
      right.evidence.kind === "BRANCH_STOCK"
        ? right.evidence.inventoryId
        : right.orderItemId;
    return leftKey.localeCompare(rightKey);
  });
  for (const line of availability) {
    const item = order.items.find((entry) => entry.id === line.orderItemId)!;
    const evidence = line.evidence;
    if (evidence.kind === "SUPPLIER") {
      if (
        !order.partsQuote ||
        new Date(evidence.availableUntil) <= now ||
        new Date(evidence.expectedTo) <= now
      )
        throw orderConflict("Supplier availability needs review before payment.");
      continue;
    }
    await tx.$queryRaw`SELECT "id" FROM "Inventory" WHERE "id" = ${evidence.inventoryId}::uuid FOR UPDATE`;
    const reservation = await tx.inventoryReservation.findFirst({
      where: {
        id: evidence.reservationId,
        inventoryId: evidence.inventoryId,
        referenceType: "ORDER",
        referenceId: id,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      select: { quantity: true },
    });
    const inventory = await tx.inventory.findUnique({
      where: { id: evidence.inventoryId },
      select: { quantity: true, reserved: true, productId: true, branchId: true },
    });
    if (
      !reservation ||
      !inventory ||
      inventory.productId !== item.productId ||
      inventory.branchId !== order.branchId ||
      reservation.quantity !== item.quantity ||
      evidence.quantity !== item.quantity ||
      inventory.reserved < item.quantity ||
      inventory.quantity < inventory.reserved
    )
      throw orderConflict(
        "The stock hold changed or expired. Request a fresh availability review.",
      );
  }
  return { order, review };
}
