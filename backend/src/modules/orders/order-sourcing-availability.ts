import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";

/** Caller holds the Order lock. Negative sourcing evidence can stop a new action;
 * it never discards a capture, changes money or grants availability approval. */
export async function assertOrderSourcingAvailable(
  tx: Prisma.TransactionClient,
  orderId: string,
  remaining?: ReadonlyMap<string, number>,
) {
  const timing = await tx.orderTimingUpdate.findFirst({
    where: { orderId },
    orderBy: { orderVersion: "desc" },
    select: { lines: true },
  });
  if (hasUnavailableSourcing(timing?.lines, remaining))
    throw orderConflict(
      "An item is recorded as unavailable. Contact Customer Care before payment or fulfilment; existing payment remains recorded.",
    );
}

export function hasUnavailableSourcing(
  lines: Prisma.JsonValue | undefined,
  remaining?: ReadonlyMap<string, number>,
) {
  return (
    Array.isArray(lines) &&
    lines.some(
      (line) =>
        line &&
        typeof line === "object" &&
        !Array.isArray(line) &&
        line["sourcingStatus"] === "UNAVAILABLE" &&
        !(
          typeof line["orderItemId"] === "string" &&
          remaining?.get(line["orderItemId"]) === 0
        ),
    )
  );
}
