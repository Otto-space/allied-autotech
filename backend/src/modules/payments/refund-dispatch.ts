import type { Prisma, PrismaClient, Refund } from "../../generated/prisma/client.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import type { InitiatedRefund } from "../../providers/payments/payment-provider.port.js";

/** Dispute observation and dispatch authorization have one committed ordering. */
export async function lockRefundDispatch(
  tx: Prisma.TransactionClient,
  attemptId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refund-dispatch:${attemptId}`}, 0))`;
}

export async function claimRefundSubmission(
  database: PrismaClient,
  candidate: { id: string; paymentAttemptId: string },
) {
  return withTransactionRetry(database, async (tx) => {
    await lockRefundDispatch(tx, candidate.paymentAttemptId);
    await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
    const refund = await tx.refund.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { paymentAttempt: true },
    });
    if (
      refund.status !== "APPROVED" ||
      refund.paymentAttemptId !== candidate.paymentAttemptId ||
      refund.submissionStartedAt !== null ||
      refund.providerRefundId !== null ||
      refund.paymentAttempt.provider === "MANUAL"
    )
      return null;
    if (
      await tx.paymentDispute.count({
        where: { paymentAttemptId: refund.paymentAttemptId, status: { not: "WON" } },
      })
    ) {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "NEEDS_ATTENTION",
          providerStatus: "DISPUTE_REVIEW_REQUIRED",
          failureMessage:
            "Reconcile the dispute and any chargeback before issuing this refund",
        },
      });
      return null;
    }
    const now = new Date();
    // This marker commits before the only provider submission. It is never reset
    // by recovery, including a crash before the network request could be sent.
    return tx.refund.update({
      where: { id: refund.id },
      include: { paymentAttempt: true },
      data: {
        status: "PROCESSING",
        providerStatus: "SUBMISSION_STARTED",
        submissionStartedAt: now,
        nextReconcileAt: new Date(now.getTime() + 600_000),
      },
    });
  });
}

export async function recordRefundSubmission(
  database: PrismaClient,
  submitted: Pick<Refund, "id" | "submissionStartedAt">,
  result: InitiatedRefund,
) {
  await withTransactionRetry(database, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refund-submission-receipt:${result.providerRefundId}`}, 0))`;
    await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${submitted.id}::uuid FOR UPDATE`;
    const current = await tx.refund.findUniqueOrThrow({ where: { id: submitted.id } });
    if (current.providerRefundId === result.providerRefundId) return;
    const bound = await tx.refund.findUnique({
      where: { providerRefundId: result.providerRefundId },
      select: { id: true },
    });
    const available = bound === null;
    const ownsSubmission =
      current.submissionStartedAt?.getTime() === submitted.submissionStartedAt?.getTime();
    if (
      ownsSubmission &&
      available &&
      current.providerRefundId === null &&
      current.status === "PROCESSING"
    ) {
      await tx.refund.update({
        where: { id: current.id },
        data: {
          status: "PENDING",
          providerRefundId: result.providerRefundId,
          providerStatus: result.status,
          nextReconcileAt: new Date(Date.now() + 60_000),
        },
      });
      return;
    }
    // A response received after recovery is still evidence. Attach its identity
    // for authorized reconciliation, but never release the existing review hold.
    if (
      ownsSubmission &&
      available &&
      current.providerRefundId === null &&
      current.status === "NEEDS_ATTENTION"
    )
      await tx.refund.update({
        where: { id: current.id },
        data: { providerRefundId: result.providerRefundId },
      });
    else if (ownsSubmission && current.status === "PROCESSING")
      await tx.refund.update({
        where: { id: current.id },
        data: {
          status: "NEEDS_ATTENTION",
          providerStatus: "REFUND_SUBMISSION_IDENTITY_CONFLICT",
          nextReconcileAt: null,
          failureMessage:
            "Provider refund identity conflicts with an existing receipt; review before further action",
        },
      });
    await tx.paymentAnomaly.create({
      data: {
        refundId: current.id,
        paymentAttemptId: current.paymentAttemptId,
        type: "OTHER",
        summary:
          "Refund submission receipt arrived after its state changed; review the original provider refund",
        details: {
          source: "REFUND_SUBMISSION",
          recordedStatus: current.status,
          providerRefundId: result.providerRefundId,
          providerStatus: result.status,
        },
      },
    });
  });
}
