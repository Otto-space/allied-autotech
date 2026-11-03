import { Prisma } from "../../generated/prisma/client.js";
import { orderConflict, orderNotFound } from "./orders.errors.js";
import {
  assertCompleteReviewLines,
  verifyPurchaseFitment,
} from "./purchase-review.engine.js";
import type { PurchaseRequirements } from "./purchase-review.schemas.js";

export const purchaseReviewOrderSelect = {
  id: true,
  customerId: true,
  guestId: true,
  branchId: true,
  status: true,
  version: true,
  paidAt: true,
  paymentDueAt: true,
  currency: true,
  subtotalKobo: true,
  discountAmountKobo: true,
  taxKobo: true,
  deliveryFeeKobo: true,
  totalKobo: true,
  policySnapshot: true,
  branch: { select: { isActive: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      sku: true,
      quantity: true,
      unitPriceKobo: true,
      subtotalKobo: true,
    },
    orderBy: { id: "asc" as const },
  },
  partsQuote: {
    select: {
      id: true,
      revision: true,
      status: true,
      expiresAt: true,
      totalKobo: true,
      productId: true,
      quantity: true,
      unitPriceKobo: true,
    },
  },
} satisfies Prisma.OrderSelect;
export type PurchaseReviewOrder = Prisma.OrderGetPayload<{
  select: typeof purchaseReviewOrderSelect;
}>;

// All requirements/decision/payment mutations share this order lock.
export async function lockPurchaseReviewOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id },
    select: purchaseReviewOrderSelect,
  });
  if (!order) throw orderNotFound();
  return order;
}

export async function loadPurchaseFitment(
  tx: Prisma.TransactionClient,
  order: PurchaseReviewOrder,
  requirements: PurchaseRequirements,
  stage: "PAYMENT" | "FULFILMENT" = "PAYMENT",
) {
  if (!order.branchId || !order.branch?.isActive || order.currency !== "NGN")
    throw orderConflict("Choose an active collection branch before review.");
  assertCompleteReviewLines(
    order.items.map((item) => item.id),
    requirements.lines.map((line) => line.orderItemId),
  );
  const productIds = [...new Set(order.items.map((item) => item.productId))].sort();
  if (!productIds.length) throw orderConflict("The order has no product lines.");
  const values = productIds.map((id) => Prisma.sql`${id}::uuid`);
  // Lock products before evidence in a consistent order. The caller must use a
  // serializable transaction: row locks alone cannot detect inserted exclusions.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(values)}) ORDER BY "id" FOR SHARE`,
  );
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ProductCompatibility" WHERE "productId" IN (${Prisma.join(values)}) ORDER BY "id" FOR SHARE`,
  );
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      isActive: true,
      currency: true,
      productType: true,
      priceKobo: true,
      category: {
        select: {
          isActive: true,
          parentId: true,
          parent: { select: { isActive: true } },
        },
      },
      compatibilities: true,
    },
  });
  const now = new Date();
  if (
    order.partsQuote &&
    (order.partsQuote.status !== "ACCEPTED" ||
      (stage === "PAYMENT" && order.partsQuote.expiresAt <= now) ||
      order.partsQuote.totalKobo !== order.totalKobo ||
      order.items.length !== 1 ||
      order.items[0]?.productId !== order.partsQuote.productId ||
      order.items[0]?.quantity !== order.partsQuote.quantity ||
      order.items[0]?.unitPriceKobo !== order.partsQuote.unitPriceKobo)
  )
    throw orderConflict(
      "The quotation expired or changed. Request a revised offer before payment.",
    );
  const results = [];
  for (const item of order.items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (
      !product?.isActive ||
      product.currency !== "NGN" ||
      !product.category.isActive ||
      (product.category.parentId && !product.category.parent?.isActive)
    )
      throw orderConflict("A product is no longer offered. Request an updated order.");
    if (
      stage === "PAYMENT" &&
      !order.partsQuote &&
      item.unitPriceKobo !== product.priceKobo
    )
      throw orderConflict(
        "A product price changed. Review an updated offer before payment.",
      );
    const line = requirements.lines.find((entry) => entry.orderItemId === item.id)!;
    if (line.selection) {
      const selected = line.selection;
      const model = await tx.vehicleModel.findFirst({
        where: {
          id: selected.vehicleModelId,
          isActive: true,
          make: { isActive: true },
          ...(selected.vehicleMakeId ? { makeId: selected.vehicleMakeId } : {}),
        },
        select: { yearFrom: true, yearTo: true },
      });
      if (!model || selected.year < model.yearFrom || selected.year > model.yearTo)
        throw orderConflict("The selected vehicle configuration needs review.");
    }
    results.push({
      orderItemId: item.id,
      productId: item.productId,
      quantity: item.quantity,
      evidence: verifyPurchaseFitment({
        rules: product.compatibilities,
        branchId: order.branchId,
        productType: product.productType,
        selection: line.selection,
      }),
    });
  }
  return results;
}
