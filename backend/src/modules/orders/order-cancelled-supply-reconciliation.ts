import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { databaseClock } from "../../common/database/clock.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import type { supplyClosureSchema } from "./order-supply-exception.schemas.js";
import { orderConflict } from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";
const money = z.string().regex(/^(0|[1-9][0-9]*)$/);
const proof = z
  .object({
    version: z.literal("ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1"),
    currency: z.literal("NGN"),
    outcome: z.enum(["NO_CAPTURE_RECORDED", "CAPTURED_FUNDS_RETURNED"]),
    originalKobo: money,
    capturedKobo: money,
    refundedKobo: money,
    remainingKobo: z.literal("0"),
    cancelledUnits: z.number().int().positive(),
    handedUnits: z.literal(0),
    supplyExceptionIds: z.array(z.uuid()).min(1),
    choiceIds: z.array(z.uuid()),
    captures: z.array(
      z.object({
        paymentId: z.uuid(),
        paymentAttemptId: z.uuid(),
        ledgerEntryId: z.uuid(),
        amountKobo: money,
      }),
    ),
    refunds: z.array(
      z.object({
        refundId: z.uuid(),
        paymentAttemptId: z.uuid(),
        ledgerEntryId: z.uuid(),
        amountKobo: money,
      }),
    ),
  })
  .strict();
/** The SQL verifier locks actual money and refuses unknown/unfinished attempts.
 * This reads current evidence; it never grants financial authority or moves money. */
export async function cancelledSupplySnapshot(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  await tx.$executeRaw`SAVEPOINT aat_cancelled_supply_review`;
  try {
    const [row] = await tx.$queryRaw<
      { snapshot: unknown }[]
    >`SELECT aat_cancelled_supply_snapshot(${orderId}::uuid) AS snapshot`;
    const current = proof.parse(row?.snapshot);
    await tx.$executeRaw`RELEASE SAVEPOINT aat_cancelled_supply_review`;
    return current;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT aat_cancelled_supply_review`;
    await tx.$executeRaw`RELEASE SAVEPOINT aat_cancelled_supply_review`;
    const failure = error as {
      code?: string;
      meta?: {
        code?: string;
        driverAdapterError?: { cause?: { originalCode?: string } };
      };
    };
    if (
      failure?.code === "P2010" &&
      (failure.meta?.code ?? failure.meta?.driverAdapterError?.cause?.originalCode) ===
        "P0001"
    )
      throw orderConflict(
        "Reconcile actual cancellation, physical goods, closed payment intents and independently verified full refunds before recording this review.",
      );
    throw error;
  }
}
export async function currentCancelledSupplyReconciliation(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const records = await tx.orderSupplyClosure.findMany({
    where: { orderId },
    orderBy: { orderVersion: "desc" },
    select: { id: true, financialSnapshot: true },
  });
  const record = records.find((row) => {
    const value = row.financialSnapshot;
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value["version"] === "ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1"
    );
  });
  if (!record) return;
  const current = await cancelledSupplySnapshot(tx, orderId);
  if (!isDeepStrictEqual(record.financialSnapshot, current))
    throw orderConflict(
      "The original cancellation or financial evidence changed. Customer Care must record its current reconciliation before continuing.",
    );
  return { id: record.id, snapshot: current };
}
export async function recordCancelledSupplyReconciliation(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  order: { id: string; version: number },
  input: z.infer<typeof supplyClosureSchema>,
  requestHash: string,
  context: RequestSecurityContext,
) {
  const financialSnapshot = await cancelledSupplySnapshot(tx, order.id);
  const financialReviewHash = orderFingerprint(financialSnapshot);
  if (
    await tx.orderSupplyClosure.findUnique({
      where: { orderId_financialReviewHash: { orderId: order.id, financialReviewHash } },
    })
  )
    throw orderConflict(
      "This cancelled-order financial review is already recorded. Refresh the order.",
    );
  const now = await databaseClock(tx);
  const closure = await tx.orderSupplyClosure.create({
    data: {
      orderId: order.id,
      recordedByUserId: actor.userId,
      sessionId: actor.sessionId,
      orderVersion: order.version,
      originalStatus: "CANCELLED",
      resultingStatus: "CANCELLED",
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
  // Preserve the actual cancellation reason/date and all original financial history.
  await tx.order.update({ where: { id: order.id }, data: { version: { increment: 1 } } });
  const cases = await tx.orderSupplyException.findMany({
    where: { orderId: order.id },
    select: { enquiryId: true },
  });
  for (const row of cases)
    await notifySupportTeam(tx, {
      kind: "ENQUIRY",
      id: row.enquiryId,
      event: `supply-closure:${closure.id}`,
      title: "Cancelled order financial evidence reviewed",
      actorUserId: actor.userId,
    });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "STATUS_CHANGE",
    entityType: "ORDER",
    entityId: order.id,
    newValues: {
      supplyClosureId: closure.id,
      outcome: financialSnapshot.outcome,
      capturedKobo: financialSnapshot.capturedKobo,
      refundedKobo: financialSnapshot.refundedKobo,
      physicalHandoverCreated: false,
      stockReturned: false,
    },
    context,
  });
  return { closure, replayed: false };
}
