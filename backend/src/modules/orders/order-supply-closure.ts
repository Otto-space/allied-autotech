import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { databaseClock } from "../../common/database/clock.js";
import { hashToken } from "../../common/security/session-tokens.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";
import type { supplyClosureSchema } from "./order-supply-exception.schemas.js";
import {
  assertNoSupplyExceptionHold,
  savedSupplyExclusions,
} from "./order-supply-exception-hold.js";
import {
  collectedPickupUnitRanges,
  remainingPickupUnitRanges,
} from "./order-pickup-units.js";
import { pickupUnitHistory } from "./order-pickup.repository.js";
import { OrdersRepository } from "./orders.repository.js";
import { orderConflict, orderStale } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";

/** Caller holds current administrator identity and actual Order locks. All money
 * has already passed independent settlement; this does not approve or move money. */
export async function recordSupplyClosure(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  order: Awaited<ReturnType<typeof lockSupplyOrder>>,
  input: z.infer<typeof supplyClosureSchema>,
  context: RequestSecurityContext,
) {
  const requestHash = orderFingerprint({ orderId: order.id, ...input });
  const prior = await tx.orderSupplyClosure.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) {
    if (
      prior.orderId !== order.id ||
      prior.requestHash !== requestHash ||
      prior.recordedByUserId !== actor.userId
    )
      throw orderConflict("This closure reference was used for different details.");
    return { closure: prior, replayed: true };
  }
  if (order.version !== input.expectedVersion) throw orderStale();
  if (order.fulfillmentMethod !== "COLLECTION" || !order.paidAt)
    throw orderConflict("Review the actual paid collection order before supply closure.");
  const supply = await assertNoSupplyExceptionHold(tx, order.id);
  if (!supply.coverage || !supply.resolutions.length)
    throw orderConflict(
      "Resolve the actual original supply refunds before financial closure.",
    );
  if (
    await tx.orderPickupClaim.count({
      where: { orderId: order.id, consumedAt: null, cancelledAt: null },
    })
  )
    throw orderConflict(
      "Reconcile the active physical pickup review before financial closure.",
    );
  const original = order.items.map((item) => ({
    orderItemId: item.id,
    quantity: item.quantity,
  }));
  const history = await pickupUnitHistory(tx, order.id);
  const excluded = await savedSupplyExclusions(tx, order.id);
  if (remainingPickupUnitRanges(original, history, excluded).length)
    throw orderConflict(
      "Actual goods are still owed. Continue their reviewed fulfilment or reconcile the affected portion.",
    );
  const collected = collectedPickupUnitRanges(original, history);
  const handedUnits = collected.reduce((sum, row) => sum + row.quantity, 0);
  if (
    (order.status === "COMPLETED" && !handedUnits) ||
    (order.status === "CANCELLED" && handedUnits)
  )
    throw orderConflict(
      "Reconcile the historical order status and actual physical handover before closure.",
    );
  const financialSnapshot = {
    version: "ORDER_SUPPLY_CLOSURE_V1",
    currency: "NGN",
    originalKobo: supply.coverage.originalKobo,
    refundedKobo: supply.coverage.refundedKobo,
    remainingKobo: supply.coverage.remainingKobo,
    supplyResolutionIds: supply.resolutions.map((row) => row.resolutionId).sort(),
    handoverIds: (
      await tx.orderPickupHandover.findMany({
        where: { orderId: order.id },
        select: { id: true },
        orderBy: { id: "asc" },
      })
    ).map((row) => row.id),
    originalUnits: original.reduce((sum, row) => sum + row.quantity, 0),
    refundedUnfulfilledUnits: excluded.reduce<number>(
      (sum, row) => sum + Number((row as { quantity: number }).quantity),
      0,
    ),
    handedUnits,
  };
  const financialReviewHash = orderFingerprint(financialSnapshot);
  if (
    await tx.orderSupplyClosure.findUnique({
      where: { orderId_financialReviewHash: { orderId: order.id, financialReviewHash } },
    })
  )
    throw orderConflict(
      "Financial closure for this actual settlement and goods history is already recorded. Refresh the order.",
    );
  const now = await databaseClock(tx);
  await releaseActiveSupplyAllocations(tx, actor.userId, order, now);
  const resultingStatus = handedUnits ? "COMPLETED" : "CANCELLED";
  const closure = await tx.orderSupplyClosure.create({
    data: {
      orderId: order.id,
      recordedByUserId: actor.userId,
      sessionId: actor.sessionId,
      orderVersion: order.version,
      originalStatus: order.status,
      resultingStatus,
      financialSnapshot,
      financialReviewHash,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      createdAt: now,
    },
  });
  await tx.orderPickupAuthorisation.updateMany({
    where: { orderId: order.id, revokedAt: null, consumedAt: null },
    data: { revokedAt: now, version: { increment: 1 } },
  });
  await tx.order.update({
    where: { id: order.id },
    data: {
      version: { increment: 1 },
      status: resultingStatus,
      ...(resultingStatus === "CANCELLED"
        ? {
            ...(order.status === "CANCELLED" ? {} : { cancelledAt: now }),
            cancellationReason:
              "Original supply refunded; no goods remain for collection",
          }
        : order.status === "COMPLETED"
          ? {}
          : { completedAt: now }),
    },
  });
  const cases = await tx.orderSupplyException.findMany({
    where: { orderId: order.id },
    select: { enquiryId: true },
    orderBy: { id: "asc" },
  });
  for (const concern of cases)
    await notifySupportTeam(tx, {
      kind: "ENQUIRY",
      id: concern.enquiryId,
      event: `supply-closure:${closure.id}`,
      title: "Supply settlement reviewed; no goods outstanding",
      actorUserId: actor.userId,
    });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "STATUS_CHANGE",
    entityType: "ORDER",
    entityId: order.id,
    oldValues: { status: order.status, version: order.version },
    newValues: {
      status: resultingStatus,
      supplyClosureId: closure.id,
      originalKobo: supply.coverage.originalKobo,
      refundedKobo: supply.coverage.refundedKobo,
      handedUnits,
      physicalHandoverCreated: false,
      stockReturned: false,
    },
    context,
  });
  return { closure, replayed: false };
}

/** Release only actual ACTIVE holds. Consumed goods and stock quantity never move.
 * Existing reservation quantities and journals remain immutable historical facts. */
async function releaseActiveSupplyAllocations(
  tx: Prisma.TransactionClient,
  userId: string,
  order: Awaited<ReturnType<typeof lockSupplyOrder>>,
  now: Date,
) {
  const orderId = order.id,
    branchId = order.branchId;
  const repository = new OrdersRepository();
  const rows = await repository.reservations(orderId, ["ACTIVE"], tx);
  const inventories = await repository.lockInventoryIds(
    rows.map((row) => row.inventoryId),
    tx,
  );
  const original = new Map<string, number>();
  for (const item of order.items)
    original.set(item.productId, (original.get(item.productId) ?? 0) + item.quantity);
  for (const inventory of inventories) {
    const held = rows
      .filter((row) => row.inventoryId === inventory.id)
      .reduce((sum, row) => sum + row.quantity, 0);
    if (
      !original.has(inventory.productId) ||
      held > (original.get(inventory.productId) ?? 0)
    )
      throw orderConflict("Review actual original stock allocations before closure.");
  }
  for (const row of rows) {
    const inventory = inventories.find((item) => item.id === row.inventoryId);
    if (
      !inventory ||
      inventory.branchId !== branchId ||
      inventory.reserved < row.quantity
    )
      throw orderConflict("Review the actual reserved stock before financial closure.");
    const next = inventory.reserved - row.quantity;
    if (
      (
        await repository.updateInventory(
          inventory.id,
          inventory.version,
          inventory.quantity,
          next,
          tx,
        )
      ).count !== 1 ||
      (await repository.transitionReservation(row.id, "ACTIVE", "RELEASED", now, tx))
        .count !== 1
    )
      throw orderStale();
    await tx.inventoryTransaction.create({
      data: {
        inventoryId: inventory.id,
        performedById: userId,
        type: "RESERVATION_RELEASE",
        quantityDelta: 0,
        reservedDelta: -row.quantity,
        quantityBefore: inventory.quantity,
        quantityAfter: inventory.quantity,
        reservedBefore: inventory.reserved,
        reservedAfter: next,
        idempotencyKey: hashToken(
          "order-inventory",
          `${orderId}:${row.id}:supply-closure-release`,
        ),
        requestHash: orderFingerprint({
          orderId,
          reservationId: row.id,
          action: "SUPPLY_CLOSURE_RELEASE",
        }),
        referenceType: "ORDER",
        referenceId: orderId,
      },
    });
    inventory.reserved = next;
    inventory.version++;
  }
}
