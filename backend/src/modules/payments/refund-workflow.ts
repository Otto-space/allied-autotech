import { randomUUID } from "node:crypto";
import { hashToken } from "../../common/security/session-tokens.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  approvedPolicy,
  currentPolicy,
  policySnapshot,
} from "../policies/policies.service.js";

/** Called under the capture transaction and attempt lock. No network inside this transaction. */
export async function enqueueLateOrderRefund(
  tx: Prisma.TransactionClient,
  attemptId: string,
) {
  const attempt = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const payment = await tx.payment.findUniqueOrThrow({
    where: { id: attempt.paymentId },
    include: { order: true },
  });
  if (!payment.order?.paymentDueAt || payment.order.paymentDueAt > new Date()) return;
  const policy = await approvedPolicy(tx, "order-payment");
  if (attempt.provider !== "PAYSTACK") return; // Manual money movement always requires human approval.
  const key = hashToken("refund-idempotency", `late-order:${attemptId}`);
  if (await tx.refund.findUnique({ where: { idempotencyKeyHash: key } })) return;
  const committed =
    (
      await tx.refund.aggregate({
        where: {
          paymentAttemptId: attemptId,
          status: { notIn: ["FAILED", "CANCELLED"] },
        },
        _sum: { amountKobo: true },
      })
    )._sum.amountKobo ?? 0n;
  const amount = attempt.amountKobo - committed;
  if (amount <= 0n) return;
  const refund = await tx.refund.create({
    data: {
      paymentAttemptId: attemptId,
      requestedByUserId: null,
      approvedByUserId: null,
      authorizationKind: "SYSTEM_LATE_ORDER",
      policyVersionId: policy.id,
      policySnapshot: policySnapshot(policy),
      status: "APPROVED",
      approvedAt: new Date(),
      refundNumber: `REF-LATE-${randomUUID().replaceAll("-", "")}`,
      idempotencyKeyHash: key,
      amountKobo: amount,
      currency: attempt.currency,
      reason:
        "Automatic full technical reversal of late order payment; no cancellation fee",
    },
  });
  await appendAuditEvent(tx, {
    actorUserId: null,
    action: "REFUND_APPROVED",
    entityType: "REFUND",
    entityId: refund.id,
    newValues: {
      systemActor: "late-order-reversal",
      policyVersionId: policy.id,
      amountKobo: amount.toString(),
    },
    context: { requestId: `late-refund:${refund.id}`, ipAddress: null, userAgent: null },
  });
}

/** A customer cancellation requests a refund; a separate capable human must approve it. */
export async function requestFreeCancellationRefund(
  tx: Prisma.TransactionClient,
  orderId: string,
  requesterId: string,
) {
  const attempts = await tx.paymentAttempt.findMany({
    where: { payment: { orderId }, status: "SUCCESSFUL", verificationStatus: "VERIFIED" },
    orderBy: { id: "asc" },
  });
  const policy = await currentPolicy(tx, "cancellation");
  for (const attempt of attempts) {
    await tx.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id}::uuid FOR UPDATE`;
    const key = hashToken("refund-idempotency", `free-cancellation:${attempt.id}`);
    if (await tx.refund.findUnique({ where: { idempotencyKeyHash: key } })) continue;
    const committed =
      (
        await tx.refund.aggregate({
          where: {
            paymentAttemptId: attempt.id,
            status: { notIn: ["FAILED", "CANCELLED"] },
          },
          _sum: { amountKobo: true },
        })
      )._sum.amountKobo ?? 0n;
    if (attempt.amountKobo <= committed) continue;
    const refund = await tx.refund.create({
      data: {
        paymentAttemptId: attempt.id,
        requestedByUserId: requesterId,
        refundNumber: `REF-CANCEL-${randomUUID().replaceAll("-", "")}`,
        idempotencyKeyHash: key,
        amountKobo: attempt.amountKobo - committed,
        currency: attempt.currency,
        reason: "Free pre-confirmation cancellation; separate approval required",
        policyVersionId: policy.id,
        policySnapshot: policySnapshot(policy),
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: requesterId,
      action: "REFUND_REQUESTED",
      entityType: "REFUND",
      entityId: refund.id,
      newValues: { orderId, feeKobo: "0" },
      context: {
        requestId: `cancel-refund:${refund.id}`,
        ipAddress: null,
        userAgent: null,
      },
    });
  }
}
