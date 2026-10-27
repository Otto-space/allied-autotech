import type { Prisma } from "../../generated/prisma/client.js";
import {
  branchesFor,
  workforceNotFound,
  type WorkforceSnapshot,
} from "./workforce.policy.js";

export const workforceOrderSelect = {
  id: true,
  orderNumber: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
  status: true,
  fulfillmentMethod: true,
  paidAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: { productName: true, quantity: true },
    orderBy: { id: "asc" as const },
  },
} satisfies Prisma.OrderSelect;
export const workforceOrderDetailSelect = {
  ...workforceOrderSelect,
  confirmedAt: true,
  processingAt: true,
  readyAt: true,
  completedAt: true,
  cancelledAt: true,
} satisfies Prisma.OrderSelect;

export function orderSearchFilters(q?: string): Prisma.OrderWhereInput[] {
  return (q?.split(/\s+/).filter(Boolean) ?? []).map((term) => {
    const text = {
      contains: term.replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return { OR: [{ orderNumber: text }, { items: { some: { productName: text } } }] };
  });
}
export function orderNextStates(
  row: {
    branchId: string | null;
    status: string;
    fulfillmentMethod: string;
    paidAt: Date | null;
  },
  access: WorkforceSnapshot,
): ("PROCESSING" | "READY")[] {
  if (
    !row.branchId ||
    !access.permissions.includes("ORDERS_PREPARE") ||
    !branchesFor(access, "ORDERS_PREPARE").includes(row.branchId) ||
    !row.paidAt ||
    row.fulfillmentMethod !== "COLLECTION"
  )
    return [];
  return row.status === "CONFIRMED"
    ? ["PROCESSING"]
    : row.status === "PROCESSING"
      ? ["READY"]
      : [];
}
export async function readWorkforceOrder(
  tx: Prisma.TransactionClient,
  access: WorkforceSnapshot,
  id: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id}::uuid FOR SHARE`;
  const row = await tx.order.findFirst({
    where: { id, branchId: { in: branchesFor(access, "ORDERS_READ") } },
    select: workforceOrderDetailSelect,
  });
  if (!row) workforceNotFound();
  return {
    ...row,
    availableNextStates: orderNextStates(row, access),
    access,
    generatedAt: new Date().toISOString(),
  };
}
