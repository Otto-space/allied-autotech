import { assertNoSupplyExceptionHold } from "./order-supply-exception-hold.js";
import { orderCollectionHold } from "./order-collection-hold.js";
import { Prisma } from "../../generated/prisma/client.js";
import { confirmedReceipt, receiptPaymentSelect } from "../billing/documents.service.js";
import { hasServiceFinancialHold } from "../billing/service-payment-plan.js";
import { assertReviewedPurchaseFulfilment } from "./purchase-review-fulfilment.js";
import { orderConflict, orderNotFound } from "./orders.errors.js";
import {
  pickupLinesSchema,
  remainingPickupQuantities,
  type PickupLine,
} from "./order-pickup.engine.js";
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
    remaining: remainingPickupQuantities(originalPickupLines(order), collected),
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
  await assertReviewedPurchaseFulfilment(tx, order.id);
  await assertNoSupplyExceptionHold(tx, order.id);
  const holds = await tx.orderAftercareRequest.findFirst({
    where: { orderId: order.id, status: { not: "REJECTED" } },
    select: { id: true },
  });
  if (holds)
    throw orderConflict(
      "An aftercare decision needs review before collection. Existing payments remain recorded.",
    );
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."settledAttemptId"=a."id" WHERE p."orderId"=${order.id}::uuid ORDER BY a."id" FOR SHARE OF a SKIP LOCKED`;
  const lockedIds = new Set(locked.map((row) => row.id));
  const payments = await tx.payment.findMany({
    where: { orderId: order.id },
    orderBy: { id: "asc" },
    select: {
      ...receiptPaymentSelect,
      anomalies: {
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        select: { status: true },
      },
      attempts: {
        select: {
          id: true,
          status: true,
          anomalies: {
            where: { status: { in: ["OPEN", "INVESTIGATING"] } },
            select: { status: true },
          },
        },
      },
      settledAttempt: {
        select: {
          ...receiptPaymentSelect.settledAttempt.select,
          id: true,
          refunds: { select: { status: true, amountKobo: true } },
          disputes: { select: { status: true } },
        },
      },
    },
  });
  if (
    hasServiceFinancialHold(payments) ||
    payments.some(
      (payment) =>
        ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"].includes(payment.status) ||
        payment.attempts.some(
          (attempt) =>
            attempt.anomalies.length > 0 ||
            (attempt.status === "SUCCESSFUL"
              ? attempt.id !== payment.settledAttempt?.id
              : !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status)),
        ) ||
        (payment.settledAttempt && !lockedIds.has(payment.settledAttempt.id)),
    )
  )
    throw orderConflict(
      "Resolve pending verification, financial adjustments or busy payment proof before collection.",
    );
  const cleared = payments.filter((payment) => payment.status === "SUCCEEDED");
  if (
    cleared.length === 0 ||
    cleared.some(
      (payment) =>
        !confirmedReceipt(payment) ||
        BigInt(confirmedReceipt(payment)!.refundedKobo) !== 0n ||
        payment.invoiceId ||
        payment.bookingId ||
        payment.vehicleTransactionId,
    ) ||
    cleared.reduce((sum, payment) => sum + payment.amountKobo, 0n) !== order.totalKobo
  )
    throw orderConflict(
      "Verified receipts must reconcile exactly to this order before collection. Ask for authorised financial review.",
    );
  const snapshot = {
    version: "ORDER_PICKUP_CLEARANCE_V1",
    orderId: order.id,
    orderVersion: order.version,
    totalKobo: order.totalKobo.toString(),
    currency: order.currency,
    payments: cleared.map((payment) => ({
      id: payment.id,
      settledAttemptId: payment.settledAttempt!.id,
      amountKobo: payment.amountKobo.toString(),
      confirmedAt: payment.succeededAt!.toISOString(),
    })),
  };
  return { snapshot, financialReviewHash: orderFingerprint(snapshot) };
}
