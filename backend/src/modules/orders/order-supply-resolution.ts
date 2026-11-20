import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { collectionDatabaseClock } from "./order-collection-hold.js";
import { pickupUnitHistory } from "./order-pickup.repository.js";
import { supplyResolvedUnitPartition } from "./order-pickup-units.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";
import type { supplyResolutionSchema } from "./order-supply-exception.schemas.js";
import { readSupplyRefundSettlement } from "./order-supply-refund-settlement.js";
import { orderConflict, orderStale } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";

/** Current administrator/order locks are established by the caller. This event
 * preserves actual settlement and disposition; it cannot return stock or create
 * collection history. Eligibility must revalidate the evidence before release. */
export async function recordSupplyResolution(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  order: Awaited<ReturnType<typeof lockSupplyOrder>>,
  input: z.infer<typeof supplyResolutionSchema>,
  context: RequestSecurityContext,
) {
  const requestHash = orderFingerprint({ orderId: order.id, ...input });
  const prior = await tx.orderSupplyResolution.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) {
    if (
      prior.orderId !== order.id ||
      prior.requestHash !== requestHash ||
      prior.recordedByUserId !== actor.userId
    )
      throw orderConflict(
        "This supply resolution reference was used for different details.",
      );
    return { resolution: prior, replayed: true };
  }
  if (order.version !== input.expectedVersion) throw orderStale();
  const concern = await tx.orderSupplyException.findFirst({
    where: { id: input.supplyExceptionId, orderId: order.id },
    include: { resolution: { select: { id: true } } },
  });
  if (!concern || concern.resolution)
    throw orderConflict("Review this order's current unresolved supply case.");
  if (
    (await tx.orderPickupClaim.count({
      where: { orderId: order.id, cancelledAt: null, consumedAt: null },
    })) ||
    (order.status === "COMPLETED" &&
      !(await tx.orderPickupHandover.count({ where: { orderId: order.id } })))
  )
    throw orderConflict(
      "Reconcile the active pickup review or missing historical handover before resolving goods.",
    );
  const settlementProof = await readSupplyRefundSettlement(tx, order.id, concern.id);
  const partition = supplyResolvedUnitPartition(
    order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
    await pickupUnitHistory(tx, order.id),
    concern.affectedLines,
  );
  const resolution = await tx.orderSupplyResolution.create({
    data: {
      orderId: order.id,
      supplyExceptionId: concern.id,
      choiceId: settlementProof.choiceId,
      recordedByUserId: actor.userId,
      sessionId: actor.sessionId,
      orderVersion: order.version,
      settlementProof,
      ...partition,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      createdAt: await collectionDatabaseClock(tx),
    },
  });
  await tx.orderPickupAuthorisation.updateMany({
    where: { orderId: order.id, revokedAt: null, consumedAt: null },
    data: { revokedAt: resolution.createdAt, version: { increment: 1 } },
  });
  await notifySupportTeam(tx, {
    kind: "ENQUIRY",
    id: concern.enquiryId,
    event: `supply-resolution:${resolution.id}`,
    title: "Supply refund and actual quantities reconciled",
    actorUserId: actor.userId,
  });
  await tx.order.update({
    where: { id: order.id },
    data: { version: { increment: 1 } },
  });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "UPDATE",
    entityType: "ORDER",
    entityId: order.id,
    newValues: {
      supplyResolutionId: resolution.id,
      supplyExceptionId: concern.id,
      amountKobo: settlementProof.amountKobo,
      unfulfilledRangeCount: partition.unfulfilledLines.length,
      previouslyHandedRangeCount: partition.previouslyHandedLines.length,
    },
    context,
  });
  return { resolution, replayed: false };
}

/** Caller holds the original order lock. A saved event is historical evidence,
 * not a permanent clearance when payment anomalies or disputes later change. */
export async function currentSupplyResolution(
  tx: Prisma.TransactionClient,
  orderId: string,
  supplyExceptionId: string,
) {
  const saved = await tx.orderSupplyResolution.findUnique({
    where: { supplyExceptionId },
    include: { supplyException: { select: { affectedLines: true } } },
  });
  if (!saved || saved.orderId !== orderId)
    throw orderConflict("Actual supply settlement and physical resolution need review.");
  const proof = await readSupplyRefundSettlement(tx, orderId, supplyExceptionId);
  if (!isDeepStrictEqual(saved.settlementProof, proof))
    throw orderConflict(
      "Supply settlement evidence changed; reconcile before fulfilment.",
    );
  const order = await lockSupplyOrder(tx, orderId);
  const partition = supplyResolvedUnitPartition(
    order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
    await pickupUnitHistory(tx, orderId),
    saved.supplyException.affectedLines,
  );
  if (
    !isDeepStrictEqual(partition.unfulfilledLines, saved.unfulfilledLines) ||
    !isDeepStrictEqual(partition.previouslyHandedLines, saved.previouslyHandedLines)
  )
    throw orderConflict("Physical supply history changed; reconcile before fulfilment.");
  return { resolutionId: saved.id, ...partition, settlementProof: proof };
}
