import type { Prisma } from "../../generated/prisma/client.js";
import { paymentConflict } from "../payments/payments.errors.js";
import {
  refundSettlementSelect,
  verifiedOrderRefundSettlement,
} from "../payments/refund-settlement-evidence.js";
import { lockSupplyOrder } from "./order-supply-exception.service.js";
import { savedSupplyRefundAmount } from "./order-supply-refund.js";
import { hasAcceptedSupplyAlternative } from "./order-supply-alternative.js";

/** Internal evidence reader, not an authorisation endpoint. Caller must establish
 * current operator/buyer scope. No resolution, hold release or stock write occurs.
 * Legacy/charges, cancelled no-capture and whole-order technical reversal require
 * their distinct reconciliation paths rather than invented partial allocation. */
export async function readSupplyRefundSettlement(
  tx: Prisma.TransactionClient,
  orderId: string,
  supplyExceptionId: string,
) {
  const order = await lockSupplyOrder(tx, orderId);
  const concern = await tx.orderSupplyException.findFirst({
    where: { id: supplyExceptionId, orderId },
  });
  if (!concern || concern.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE")
    throw paymentConflict(
      "Review the actual affected supply case and technical assessment before financial resolution.",
    );
  const choice = await tx.orderSupplyRemedyChoice.findFirst({
    where: { supplyExceptionId },
    orderBy: { orderVersion: "desc" },
  });
  if (
    !choice ||
    (choice.choice !== "REFUND_REVIEW" &&
      !(
        choice.choice === "SUITABLE_ALTERNATIVE_REVIEW" &&
        (await hasAcceptedSupplyAlternative(tx, choice.id))
      ))
  )
    throw paymentConflict(
      "Review the actual current customer remedy before settlement resolution.",
    );
  const expected = savedSupplyRefundAmount(order, concern);
  if (
    await tx.refund.count({
      where: {
        paymentAttempt: { payment: { orderId } },
        supplyRemedyChoiceId: null,
        status: { notIn: ["FAILED", "CANCELLED"] },
      },
    })
  )
    throw paymentConflict(
      "Reconcile unbound original-order refunds before attributing an affected portion.",
    );
  // SKIP LOCKED avoids waiting behind a verifier holding Refund/Attempt before
  // Order. Busy or incomplete proof remains a review state; never assume success.
  const locked = await tx.$queryRaw<
    { id: string }[]
  >`SELECT r."id" FROM "Refund" r JOIN "OrderSupplyRemedyChoice" c ON c."id"=r."supplyRemedyChoiceId" JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE c."supplyExceptionId"=${supplyExceptionId}::uuid FOR SHARE OF r,a,p SKIP LOCKED`;
  const refunds = await tx.refund.findMany({
    where: { supplyRemedyChoice: { supplyExceptionId } },
    orderBy: { id: "asc" },
    select: refundSettlementSelect,
  });
  const ids = new Set(locked.map((row) => row.id));
  if (
    refunds.some(
      (row) =>
        !ids.has(row.id) ||
        (!["FAILED", "CANCELLED"].includes(row.status) &&
          row.supplyRemedyChoiceId !== choice.id),
    )
  )
    throw paymentConflict(
      "Financial evidence is busy or belongs to an earlier remedy. Reconcile before resolving quantities.",
    );
  return {
    ...verifiedOrderRefundSettlement(orderId, expected, refunds),
    supplyExceptionId,
    choiceId: choice.id,
  };
}
