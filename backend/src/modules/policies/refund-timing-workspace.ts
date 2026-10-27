import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { paymentForbidden } from "../payments/payments.errors.js";
import { financeWorkspaceResponse } from "./finance-policy-workspace.js";

export const refundTimingWorkspaceResponse = financeWorkspaceResponse;

export async function readRefundTimingPolicy(
  actor: AuthenticatedActor,
  context: RequestSecurityContext,
) {
  if (actor.role !== "SUPER_ADMIN" || actor.mfaVerifiedAt === null)
    throw paymentForbidden();
  return withTransactionRetry(
    prisma,
    async (tx) => {
      await lockAccessActor(tx, actor);
      const evaluatedAt = new Date();
      const history = await tx.businessPolicyVersion.findMany({
        where: { key: "bank_refund_clock" },
        orderBy: { version: "desc" },
        take: 100,
      });
      // Match snapshotRefundClock: highest approved version effective at request time.
      // Effective-time ordering would incorrectly show a superseded lower version.
      const current = await tx.businessPolicyVersion.findFirst({
        where: {
          key: "bank_refund_clock",
          approvalStatus: "APPROVED",
          effectiveAt: { lte: evaluatedAt },
        },
        orderBy: { version: "desc" },
      });
      const nextScheduled = await tx.businessPolicyVersion.findFirst({
        where: {
          key: "bank_refund_clock",
          approvalStatus: "APPROVED",
          effectiveAt: { gt: evaluatedAt },
          version: { gt: current?.version ?? 0 },
        },
        orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "USER",
        entityId: actor.userId,
        newValues: { resource: "REFUND_TIMING_CURRENT", returnedCount: history.length },
        context,
      });
      return { evaluatedAt, current, latest: history[0] ?? null, nextScheduled, history };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
