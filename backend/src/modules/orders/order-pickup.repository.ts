import { savedSupplyExclusions } from "./order-supply-exception-hold.js";
import { orderCollectionHold } from "./order-collection-hold.js";
import { Prisma } from "../../generated/prisma/client.js";
import { orderFinancialCoverage } from "./order-financial-coverage.js";
import { remainingPickupUnitRanges } from "./order-pickup-units.js";
import { assertReviewedPurchaseFulfilment } from "./purchase-review-fulfilment.js";
import { orderConflict, orderNotFound } from "./orders.errors.js";
import { pickupLinesSchema, type PickupLine } from "./order-pickup.engine.js";
import { orderFingerprint } from "./orders.types.js";

const select = {
  id: true,
  version: true,
  status: true,
  customerId: true,
  guestId: true,
  branchId: true,
  readyAt: true,
  paidAt: true,
  fulfillmentMethod: true,
  totalKobo: true,
  currency: true,
  branch: { select: { isActive: true } },
  customer: { select: { userId: true } },
  items: {
    select: { id: true, productName: true, quantity: true },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.OrderSelect;
export type PickupOrder = Prisma.OrderGetPayload<{ select: typeof select }>;
export async function lockPickupOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id }, select });
  if (!order) throw orderNotFound();
  return order;
}
export const originalPickupLines = (order: PickupOrder) =>
  order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity }));
export async function collectedPickupTotals(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  return tx.$queryRaw<
    PickupLine[]
  >`SELECT (line->>'orderItemId')::uuid AS "orderItemId", sum((line->>'quantity')::integer)::integer AS "quantity" FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") line WHERE h."orderId"=${orderId}::uuid GROUP BY line->>'orderItemId'`;
}
/** Actual immutable physical records, ordered by the parent version, not a browser total. */
export async function pickupUnitHistory(tx: Prisma.TransactionClient, orderId: string) {
  return tx.orderPickupHandover.findMany({
    where: { orderId },
    orderBy: [{ orderVersion: "asc" }, { id: "asc" }],
    select: { lines: true, unitRanges: true },
  });
}
export async function remainingPickupLines(
  tx: Prisma.TransactionClient,
  order: PickupOrder,
) {
  const remaining = remainingPickupUnitRanges(
    originalPickupLines(order),
    await pickupUnitHistory(tx, order.id),
    await savedSupplyExclusions(tx, order.id),
  );
  const quantities = new Map<string, number>();
  for (const range of remaining)
    quantities.set(
      range.orderItemId,
      (quantities.get(range.orderItemId) ?? 0) + range.quantity,
    );
  return [...quantities].map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}
export async function pickupSummary(tx: Prisma.TransactionClient, order: PickupOrder) {
  const [collected, authorisation, history, handoverReview] = await Promise.all([
    collectedPickupTotals(tx, order.id),
    tx.orderPickupAuthorisation.findFirst({
      where: { orderId: order.id, revokedAt: null, consumedAt: null },
      select: { id: true, issuedAt: true, expiresAt: true, lines: true },
    }),
    tx.orderPickupHandover.findMany({
      where: { orderId: order.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 26,
      select: { id: true, createdAt: true, lines: true, collectorName: true },
    }),
    tx.orderPickupClaim.findFirst({
      where: { orderId: order.id, cancelledAt: null, consumedAt: null },
      select: { id: true, claimedAt: true },
    }),
  ]);
  return {
    holding: await orderCollectionHold(tx, order),
    collectionHoldCapabilityVersion: 1,
    handoverReview,
    orderId: order.id,
    version: order.version,
    status: order.status,
    legacyCompleted: order.status === "COMPLETED" && collected.length === 0,
    remaining: await remainingPickupLines(tx, order),
    authorisation: authorisation && {
      ...authorisation,
      lines: pickupLinesSchema.parse(authorisation.lines),
    },
    handovers: history
      .slice(0, 25)
      .map((row) => ({ ...row, lines: pickupLinesSchema.parse(row.lines) })),
    hasMoreHistory: history.length > 25,
  };
}

/** Caller holds the Order lock. Reuse canonical receipt proof and hold semantics;
 * lock settled attempts without waiting behind a verifier holding Attempt first. */
export async function pickupFinancialProof(
  tx: Prisma.TransactionClient,
  order: PickupOrder,
) {
  if (
    order.status !== "READY" ||
    !order.readyAt ||
    !order.paidAt ||
    order.fulfillmentMethod !== "COLLECTION" ||
    !order.branch?.isActive ||
    order.currency !== "NGN" ||
    order.totalKobo <= 0n
  )
    throw orderConflict(
      "The actual paid order must be ready at an active collection branch before pickup.",
    );
  const review = await assertReviewedPurchaseFulfilment(tx, order.id);
  const holds = await tx.orderAftercareRequest.findFirst({
    where: { orderId: order.id, status: { not: "REJECTED" } },
    select: { id: true },
  });
  if (holds)
    throw orderConflict(
      "An aftercare decision needs review before collection. Existing payments remain recorded.",
    );
  const coverage = review.supply.coverage ?? (await orderFinancialCoverage(tx, order));
  const cleared = coverage.payments;
  const snapshot = {
    version:
      review.supply.resolutions.length || review.supply.related.length
        ? "ORDER_PICKUP_CLEARANCE_V2"
        : "ORDER_PICKUP_CLEARANCE_V1",
    orderId: order.id,
    orderVersion: order.version,
    totalKobo: order.totalKobo.toString(),
    currency: order.currency,
    payments: cleared.map((payment) => ({
      id: payment.id,
      settledAttemptId: payment.settledAttemptId,
      amountKobo: payment.amountKobo,
      confirmedAt: payment.confirmedAt,
    })),
    ...(review.supply.resolutions.length || review.supply.related.length
      ? {
          coverage,
          supplyResolutions: review.supply.resolutions.map((row) => ({
            id: row.resolutionId,
            unfulfilledLines: row.unfulfilledLines,
            refunds: row.settlementProof.refunds,
          })),
          relatedSupplyResolutions: review.supply.related,
        }
      : {}),
  };
  return { snapshot, financialReviewHash: orderFingerprint(snapshot) };
}
