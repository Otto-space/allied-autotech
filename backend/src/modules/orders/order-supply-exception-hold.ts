import type { Prisma } from "../../generated/prisma/client.js";
import { orderConflict } from "./orders.errors.js";
export async function assertNoSupplyExceptionHold(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  if (
    await tx.orderSupplyException.findFirst({ where: { orderId }, select: { id: true } })
  )
    throw orderConflict(
      "A supply concern about unavailable or unsuitable goods needs Customer Care and financial review before payment or collection. Existing money remains recorded.",
    );
}
