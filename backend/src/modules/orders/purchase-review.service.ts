import { randomUUID } from "node:crypto";
import { selectionSchema } from "../fitment/fitment.schemas.js";
import { AppError } from "../../common/errors/app-error.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { approvedPolicy } from "../policies/policies.service.js";
import { orderConflict, orderStale, checkoutStockUnavailable } from "./orders.errors.js";
import { OrdersRepository } from "./orders.repository.js";
import { orderFingerprint } from "./orders.types.js";
import {
  assertCompleteReviewLines,
  purchasePayableFingerprint,
} from "./purchase-review.engine.js";
import {
  loadPurchaseFitment,
  lockPurchaseReviewOrder,
  type PurchaseReviewOrder,
} from "./purchase-review.repository.js";
import {
  purchaseRequirementsSchema,
  purchaseApprovalSnapshotSchema,
  type PurchaseReviewRequest,
  type PurchaseReviewDecision,
} from "./purchase-review.schemas.js";

// These transaction helpers are not authorisation entry points. Callers must
// authenticate the buyer/operator, enforce current scope, lock the Order and use
// a serializable transaction before calling them.
export async function assertReviewCanChange(
  tx: Prisma.TransactionClient,
  order: PurchaseReviewOrder,
) {
  if (order.status !== "PENDING" || order.paidAt)
    throw orderConflict(
      "Only an unpaid, unstarted order can receive a new purchase review.",
    );
  const payment = await tx.payment.findFirst({
    where: { orderId: order.id, status: { notIn: ["CANCELLED", "EXPIRED"] } },
    select: { id: true },
  });
  // An issued provider URL can still capture. Never release its stock or replace
  // its offer while payment status remains uncertain, even after a browser timeout.
  const uncertain = await tx.paymentAttempt.findFirst({
    where: {
      payment: { orderId: order.id },
      status: { notIn: ["FAILED", "ABANDONED", "CANCELLED"] },
    },
    select: { id: true },
  });
  if (payment || uncertain)
    throw orderConflict(
      "Resolve the existing payment before changing the purchase offer.",
    );
}

export async function recordPurchaseRequirements(
  tx: Prisma.TransactionClient,
  order: PurchaseReviewOrder,
  input: PurchaseReviewRequest,
  actorUserId: string | null,
  context: RequestSecurityContext,
) {
  await assertReviewCanChange(tx, order);
  if (order.version !== input.expectedVersion) throw orderStale();
  const latest = await tx.orderPurchaseReview.findFirst({
    where: { orderId: order.id },
    orderBy: { revision: "desc" },
  });
  if ((latest?.revision ?? 0) !== input.expectedRevision) throw orderStale();
  const requirements = purchaseRequirementsSchema.parse({ lines: input.lines });
  assertCompleteReviewLines(
    order.items.map((item) => item.id),
    requirements.lines.map((line) => line.orderItemId),
  );
  // Existing holds must be released with the existing inventory ledger helper by
  // the authorised caller, not silently deleted here.
  if (
    await tx.inventoryReservation.count({
      where: { referenceType: "ORDER", referenceId: order.id, status: "ACTIVE" },
    })
  )
    throw orderConflict(
      "Release the previous unpaid offer's stock hold through the inventory ledger before reopening review.",
    );
  const review = await tx.orderPurchaseReview.create({
    data: {
      orderId: order.id,
      revision: input.expectedRevision + 1,
      requirements,
    },
  });
  const updated = await tx.order.updateMany({
    where: {
      id: order.id,
      version: input.expectedVersion,
      status: "PENDING",
      paidAt: null,
    },
    data: { paymentDueAt: null, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw orderStale();
  await appendAuditEvent(tx, {
    actorUserId,
    action: "UPDATE",
    entityType: "ORDER",
    entityId: order.id,
    newValues: {
      purchaseReviewId: review.id,
      revision: review.revision,
      status: "REQUESTED",
      reason: input.reason,
    },
    context,
  });
  return review;
}

export async function decidePurchaseReview(
  tx: Prisma.TransactionClient,
  order: PurchaseReviewOrder,
  input: PurchaseReviewDecision,
  actorUserId: string | null,
  context: RequestSecurityContext,
  decisionMode: "HUMAN" | "AUTOMATIC" = "HUMAN",
) {
  if (
    (decisionMode === "HUMAN") !== (actorUserId !== null) ||
    (decisionMode === "AUTOMATIC" && input.decision !== "APPROVED")
  )
    throw orderConflict("A decision must retain its actual human or automatic origin.");
  await assertReviewCanChange(tx, order);
  if (order.version !== input.expectedVersion) throw orderStale();
  const review = await tx.orderPurchaseReview.findFirst({
    where: { orderId: order.id },
    orderBy: { revision: "desc" },
  });
  if (
    !review ||
    review.revision !== input.expectedRevision ||
    review.status !== "REQUESTED"
  )
    throw orderStale();
  const now = new Date();
  let approval:
    | {
        decisionSnapshot: Prisma.InputJsonObject;
        payableFingerprint: string;
        expiresAt: Date;
      }
    | undefined;
  if (input.decision === "APPROVED") {
    if (
      await tx.inventoryReservation.count({
        where: { referenceType: "ORDER", referenceId: order.id, status: "ACTIVE" },
      })
    )
      throw orderConflict(
        "This order already has a stock hold. Review it before approving another offer.",
      );
    const requirements = purchaseRequirementsSchema.parse(review.requirements);
    const fitment = await loadPurchaseFitment(tx, order, requirements);
    assertCompleteReviewLines(
      order.items.map((item) => item.id),
      input.availability.map((line) => line.orderItemId),
    );
    const timing = await approvedPolicy(tx, "order-payment");
    const settings = timing.settings;
    if (
      !settings ||
      typeof settings !== "object" ||
      Array.isArray(settings) ||
      settings["windowMinutes"] !== 30
    )
      throw orderConflict("The approved purchase payment window needs policy review.");
    const validUntil = [now.getTime() + 30 * 60000];
    if (order.partsQuote) validUntil.push(order.partsQuote.expiresAt.getTime());
    const availability: Array<{
      orderItemId: string;
      evidence: Record<string, string | number>;
    }> = [];
    for (const line of input.availability) {
      if (line.evidence.kind === "SUPPLIER") {
        if (
          !order.partsQuote ||
          new Date(line.evidence.availableUntil) <= now ||
          new Date(line.evidence.expectedTo) <= now
        )
          throw orderConflict(
            "Record current supplier evidence and arrival estimates against the accepted quotation before payment.",
          );
        validUntil.push(new Date(line.evidence.availableUntil).getTime());
        availability.push({ orderItemId: line.orderItemId, evidence: line.evidence });
      }
    }
    const expiresAt = new Date(Math.min(...validUntil));
    if (expiresAt <= now)
      throw orderConflict("This offer has expired. Request current availability.");
    const repository = new OrdersRepository();
    const branchLines = input.availability.filter(
      (line) => line.evidence.kind === "BRANCH_STOCK",
    );
    const productIds = order.items
      .filter((item) => branchLines.some((line) => line.orderItemId === item.id))
      .map((item) => item.productId)
      .sort();
    const inventories = productIds.length
      ? await repository.lockInventories(order.branchId!, productIds, tx)
      : [];
    // Aggregate by product: future orders may contain distinct configured lines
    // for one product. Two lines must never each reserve the same last unit.
    const needed = new Map<string, number>();
    const reservationByInventory = new Map<string, string>();
    for (const line of branchLines) {
      const item = order.items.find((entry) => entry.id === line.orderItemId)!;
      needed.set(item.productId, (needed.get(item.productId) ?? 0) + item.quantity);
    }
    for (const [productId, quantity] of needed) {
      const inventory = inventories.find((entry) => entry.productId === productId);
      if (
        !inventory ||
        inventory.quantity - inventory.reserved < quantity ||
        !inventory.branch.isActive
      )
        throw checkoutStockUnavailable();
      const changed = await repository.updateInventory(
        inventory.id,
        inventory.version,
        inventory.quantity,
        inventory.reserved + quantity,
        tx,
      );
      if (changed.count !== 1) throw orderStale();
      const reservationId = randomUUID();
      await tx.inventoryReservation.create({
        data: {
          id: reservationId,
          inventoryId: inventory.id,
          customerId: order.customerId,
          quantity,
          expiresAt,
          idempotencyKey: hashToken(
            "order-reservation",
            `review:${review.id}:${inventory.id}`,
          ),
          requestHash: orderFingerprint({ reviewId: review.id, productId, quantity }),
          referenceType: "ORDER",
          referenceId: order.id,
        },
      });
      reservationByInventory.set(inventory.id, reservationId);
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          performedById: actorUserId,
          type: "RESERVATION",
          quantityDelta: 0,
          reservedDelta: quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: inventory.quantity,
          reservedBefore: inventory.reserved,
          reservedAfter: inventory.reserved + quantity,
          idempotencyKey: hashToken(
            "order-inventory",
            `review:${review.id}:${inventory.id}`,
          ),
          requestHash: orderFingerprint({ reviewId: review.id, quantity }),
          referenceType: "ORDER",
          referenceId: order.id,
        },
      });
    }
    for (const line of branchLines) {
      const item = order.items.find((entry) => entry.id === line.orderItemId)!;
      const inventory = inventories.find((entry) => entry.productId === item.productId)!;
      const reservationId = reservationByInventory.get(inventory.id)!;
      availability.push({
        orderItemId: item.id,
        evidence: {
          kind: "BRANCH_STOCK",
          inventoryId: inventory.id,
          reservationId,
          quantity: item.quantity,
        },
      });
    }
    const snapshot = purchaseApprovalSnapshotSchema.parse({
      version: 1,
      fitment,
      availability,
    });
    approval = {
      decisionSnapshot: snapshot,
      payableFingerprint: purchasePayableFingerprint(order),
      expiresAt,
    };
  }
  const decided = await tx.orderPurchaseReview.update({
    where: { id: review.id },
    data: {
      status: input.decision,
      reason: input.reason,
      decidedByUserId: actorUserId,
      decisionMode,
      decidedAt: now,
      ...approval,
    },
  });
  const changed = await tx.order.updateMany({
    where: {
      id: order.id,
      version: input.expectedVersion,
      status: "PENDING",
      paidAt: null,
    },
    data: { paymentDueAt: approval?.expiresAt ?? null, version: { increment: 1 } },
  });
  if (changed.count !== 1) throw orderStale();
  await appendAuditEvent(tx, {
    actorUserId,
    action: "UPDATE",
    entityType: "ORDER",
    entityId: order.id,
    newValues: {
      purchaseReviewId: review.id,
      revision: review.revision,
      status: input.decision,
      decisionMode,
      reason: input.reason,
    },
    context,
  });
  return decided;
}

/** Reuse approved technical evidence; never manufacture a human approval.
 * Caller owns/locks the order in a serializable transaction. Uncertain fitment
 * or insufficient branch stock leaves the saved request available for staff.
 */
export async function tryAutomaticPurchaseReview(
  tx: Prisma.TransactionClient,
  orderId: string,
  context: RequestSecurityContext,
) {
  const order = await lockPurchaseReviewOrder(tx, orderId);
  const review = await tx.orderPurchaseReview.findFirst({
    where: { orderId },
    orderBy: { revision: "desc" },
  });
  if (!review || review.status !== "REQUESTED") return false;
  const requirements = purchaseRequirementsSchema.parse(review.requirements);
  try {
    await loadPurchaseFitment(tx, order, requirements);
  } catch (error) {
    // Validation conflicts do not abort PostgreSQL. Database/unknown failures
    // must propagate so transaction retry and error handling remain effective.
    if (error instanceof AppError && error.statusCode === 409) return false;
    throw error;
  }
  const needed = new Map<string, number>();
  for (const item of order.items)
    needed.set(item.productId, (needed.get(item.productId) ?? 0) + item.quantity);
  const inventories = await new OrdersRepository().lockInventories(
    order.branchId!,
    [...needed.keys()].sort(),
    tx,
  );
  for (const [productId, quantity] of needed) {
    const stock = inventories.find((entry) => entry.productId === productId);
    if (!stock || !stock.branch.isActive || stock.quantity - stock.reserved < quantity)
      return false;
  }
  await decidePurchaseReview(
    tx,
    order,
    {
      expectedVersion: order.version,
      expectedRevision: review.revision,
      decision: "APPROVED",
      reason:
        "Automatic match against current approved suitability evidence and reserved branch stock",
      availability: order.items.map((item) => ({
        orderItemId: item.id,
        evidence: { kind: "BRANCH_STOCK" as const },
      })),
    },
    null,
    context,
    "AUTOMATIC",
  );
  return true;
}

export async function tryAutomaticNewPurchase(
  tx: Prisma.TransactionClient,
  orderId: string,
  actorUserId: string | null,
  context: RequestSecurityContext,
  selections: ReadonlyArray<{ productId: string; vehicleSelection?: unknown }> = [],
) {
  const order = await lockPurchaseReviewOrder(tx, orderId);
  const requirements = {
    lines: order.items.map((item) => ({
      orderItemId: item.id,
      selection: selectionSchema
        .nullable()
        .parse(
          selections.find((line) => line.productId === item.productId)
            ?.vehicleSelection ?? null,
        ),
    })),
  };
  // No vehicle selection is assumed. Only approved genuinely universal accessories
  // qualify here; vehicle-specific parts use the buyer's supplied configuration.
  try {
    if (!requirements.lines.some((line) => line.selection))
      await loadPurchaseFitment(tx, order, requirements);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) return false;
    throw error;
  }
  await recordPurchaseRequirements(
    tx,
    order,
    {
      ...requirements,
      expectedVersion: order.version,
      expectedRevision: 0,
      reason:
        "Checkout supplied the chosen vehicle for current suitability and stock checks",
    },
    actorUserId,
    context,
  );
  return tryAutomaticPurchaseReview(tx, orderId, context);
}
