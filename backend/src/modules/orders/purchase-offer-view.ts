import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { purchaseApprovalSnapshotSchema } from "./purchase-review.schemas.js";

export function safePurchaseAvailability(snapshot: unknown) {
  const parsed = purchaseApprovalSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return [];
  return parsed.data.availability.map((line) => ({
    orderItemId: line.orderItemId,
    kind: line.evidence.kind,
    ...(line.evidence.kind === "SUPPLIER"
      ? {
          expectedFrom: line.evidence.expectedFrom,
          expectedTo: line.evidence.expectedTo,
        }
      : {}),
  }));
}

/** Decorates a previously authorised order read. Never return raw decision
 * snapshots, evidence references, reviewer identities or reservation identifiers.
 * Exact immutable approved review IDs bind the extra read to the selected offer.
 */
export async function purchaseOfferReviews<T extends { id: string; status: string }>(
  database: Prisma.TransactionClient | PrismaClient,
  reviews: T[],
) {
  const ids = reviews
    .filter((review) => review.status === "APPROVED")
    .map((review) => review.id);
  const snapshots = ids.length
    ? await database.orderPurchaseReview.findMany({
        where: { id: { in: ids }, status: "APPROVED" },
        select: { id: true, decisionSnapshot: true },
      })
    : [];
  return reviews.map((review) => ({
    ...review,
    availability: safePurchaseAvailability(
      snapshots.find((row) => row.id === review.id)?.decisionSnapshot,
    ),
  }));
}
