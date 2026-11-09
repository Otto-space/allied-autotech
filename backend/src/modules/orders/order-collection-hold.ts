import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
import { isDeepStrictEqual } from "node:util";
import { collectionHoldPolicy, collectionHoldClock } from "./order-collection-clock.js";
import type { PickupOrder } from "./order-pickup.repository.js";
export function assertCollectionHoldPolicySnapshot(snapshot: unknown) {
  if (!isDeepStrictEqual(snapshot, collectionHoldPolicy))
    throw orderConflict(
      "The saved holding policy needs authorised review; no replacement deadline was calculated.",
    );
}
export async function orderCollectionHold(
  tx: Prisma.TransactionClient,
  order: Pick<PickupOrder, "id" | "readyAt" | "status">,
  now = new Date(),
) {
  const notice = order.readyAt
    ? await tx.orderCollectionEvent.findFirst({
        where: { orderId: order.id, readyAt: order.readyAt, kind: "NOTIFIED" },
        orderBy: [{ orderVersion: "asc" }, { id: "asc" }],
        select: { id: true, createdAt: true, policySnapshot: true },
      })
    : null;
  if (notice) assertCollectionHoldPolicySnapshot(notice.policySnapshot);
  const clock = collectionHoldClock({
    readyAt: order.readyAt,
    notifiedAt: notice?.createdAt ?? null,
    now,
  });
  const extension = notice
    ? await tx.orderCollectionEvent.findFirst({
        where: {
          orderId: order.id,
          readyAt: order.readyAt!,
          kind: "EXTENDED",
          noticeId: notice.id,
        },
        orderBy: [{ collectByDate: "desc" }, { createdAt: "desc" }],
        select: { collectByDate: true, createdAt: true },
      })
    : null;
  const date =
    extension?.collectByDate?.toISOString().slice(0, 10) ?? clock.collectByDate;
  const latestAttempt = order.readyAt
    ? await tx.orderCollectionEvent.findFirst({
        where: {
          orderId: order.id,
          readyAt: order.readyAt,
          kind: { in: ["NOTIFIED", "NOTIFICATION_FAILED"] },
        },
        orderBy: [{ orderVersion: "desc" }, { id: "desc" }],
        select: { kind: true, createdAt: true },
      })
    : null;
  const localToday = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
  return {
    policy: clock.policy,
    noticeId: notice?.id ?? null,
    notifiedAt: notice?.createdAt ?? null,
    originalCollectByDate: clock.collectByDate,
    collectByDate: date,
    extendedAt: extension?.createdAt ?? null,
    state:
      order.status === "COMPLETED"
        ? ("COLLECTED" as const)
        : !date
          ? ("PENDING" as const)
          : localToday > date
            ? ("OVERDUE" as const)
            : ("HOLDING" as const),
    pendingReason: clock.state === "PENDING" ? clock.reason : null,
    latestNotificationAttempt: latestAttempt,
  };
}
