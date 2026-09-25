import type { Prisma } from "../../generated/prisma/client.js";
import type { PaymentCreateInput } from "./payments.schemas.js";
import { paymentTargetPending } from "./payments.errors.js";

type Target = Pick<PaymentCreateInput, "targetType" | "targetId">;
type StoredTarget = {
  orderId: string | null;
  invoiceId: string | null;
  vehicleTransactionId: string | null;
};

export function paymentTarget(payment: StoredTarget): Target | null {
  if (payment.orderId) return { targetType: "ORDER", targetId: payment.orderId };
  if (payment.invoiceId) return { targetType: "INVOICE", targetId: payment.invoiceId };
  if (payment.vehicleTransactionId)
    return { targetType: "VEHICLE_TRANSACTION", targetId: payment.vehicleTransactionId };
  return null;
}

// All intent creation, attempt creation and settlement use the same target lock.
// It must precede Payment row locks, and intentionally excludes purpose and user/key.
export async function lockTarget(tx: Prisma.TransactionClient, target: Target) {
  const key = `payment-target:${target.targetType}:${target.targetId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function lockStoredTarget(tx: Prisma.TransactionClient, id: string) {
  const payment = await tx.payment.findUnique({
    where: { id },
    select: { orderId: true, invoiceId: true, vehicleTransactionId: true },
  });
  const target = payment && paymentTarget(payment);
  if (target) await lockTarget(tx, target);
}

export async function assertNoCompetingPayment(
  tx: Prisma.TransactionClient,
  target: Target,
  currentPaymentId?: string,
) {
  const where: Prisma.PaymentWhereInput =
    target.targetType === "ORDER"
      ? { orderId: target.targetId }
      : target.targetType === "INVOICE"
        ? { invoiceId: target.targetId }
        : { vehicleTransactionId: target.targetId };
  const conflict = await tx.payment.findFirst({
    where: {
      ...where,
      ...(currentPaymentId ? { id: { not: currentPaymentId } } : {}),
      OR: [
        { status: { in: ["PROCESSING", "REQUIRES_REVIEW"] } },
        // A new intent must reuse the existing payable record through the payments UI.
        // Legacy duplicate unstarted records may compete to start one attempt safely.
        ...(!currentPaymentId
          ? [
              {
                status: "REQUIRES_PAYMENT" as const,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
            ]
          : []),
        {
          attempts: {
            some: { status: { in: ["INITIALIZED", "PENDING", "PROCESSING"] } },
          },
        },
        { status: { not: "SUCCEEDED" }, attempts: { some: { status: "SUCCESSFUL" } } },
        ...(target.targetType !== "VEHICLE_TRANSACTION"
          ? [{ status: "SUCCEEDED" as const }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (conflict) throw paymentTargetPending();
}
