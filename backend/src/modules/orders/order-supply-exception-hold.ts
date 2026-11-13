import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
import { currentSupplyResolution } from "./order-supply-resolution.js";
import { orderFinancialCoverage } from "./order-financial-coverage.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";

/** Historical disposition is a physical fact, not current financial clearance.
 * Callers still validate the ranges against actual original/handover quantities. */
export async function savedSupplyExclusions(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const records = await tx.orderSupplyResolution.findMany({
    where: { orderId },
    orderBy: { id: "asc" },
    select: { unfulfilledLines: true },
  });
  return records.flatMap((record) => {
    if (!Array.isArray(record.unfulfilledLines))
      throw orderConflict("Review actual supply unit history.");
    return record.unfulfilledLines;
  });
}
export async function assertNoSupplyExceptionHold(
  tx: Prisma.TransactionClient,
  orderId: string,
  mode: "PAYMENT" | "FULFILMENT" = "FULFILMENT",
) {
  const concerns = await tx.orderSupplyException.findMany({
    where: {
      OR: [
        { orderId },
        { supplyRemedyChoices: { some: { partsQuotes: { some: { orderId } } } } },
      ],
    },
    select: { id: true, orderId: true },
    orderBy: [{ orderId: "asc" }, { id: "asc" }],
  });
  if (mode === "PAYMENT" && concerns.some((row) => row.orderId === orderId))
    throw orderConflict(
      "A supply concern about unavailable or unsuitable goods needs Customer Care and financial review before payment or collection. Existing money remains recorded.",
    );
  const resolutions: Awaited<ReturnType<typeof currentSupplyResolution>>[] = [];
  const related: { orderId: string; resolutionIds: string[] }[] = [];
  let coverage: Awaited<ReturnType<typeof orderFinancialCoverage>> | undefined;
  for (const parentId of new Set(concerns.map((row) => row.orderId))) {
    // Never wait behind another order's financial verifier while holding the
    // replacement order. A busy original stays reviewable and can be retried.
    const [locked] = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Order" WHERE "id"=${parentId}::uuid FOR UPDATE SKIP LOCKED`;
    if (!locked)
      throw orderConflict("Original supply evidence is busy. Recheck before continuing.");
    const order = await lockSupplyOrder(tx, parentId);
    const current: Awaited<ReturnType<typeof currentSupplyResolution>>[] = [];
    // Reconcile every case of the original, not just the one linked to an offer.
    const all = await tx.orderSupplyException.findMany({
      where: { orderId: parentId },
      orderBy: { id: "asc" },
      select: { id: true, resolution: { select: { id: true } } },
    });
    for (const concern of all) {
      if (!concern.resolution)
        throw orderConflict(
          "A supply concern about unavailable or unsuitable goods needs Customer Care and financial review before payment or collection. Existing money remains recorded.",
        );
      current.push(await currentSupplyResolution(tx, parentId, concern.id));
    }
    const financial = await orderFinancialCoverage(
      tx,
      order,
      current.flatMap((row) => row.settlementProof.refunds),
    );
    if (parentId === orderId) {
      resolutions.push(...current);
      coverage = financial;
    } else
      related.push({
        orderId: parentId,
        resolutionIds: current.map((row) => row.resolutionId),
      });
  }
  return { resolutions, related, coverage };
}
