import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { paymentForbidden } from "../payments/payments.errors.js";
import { financeWorkspaceResponse } from "./finance-policy-workspace.js";

// The version envelope is common to policy kinds; selection remains retention-specific.
export const retentionWorkspaceResponse = financeWorkspaceResponse;

export async function readRetentionPolicy(
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
        where: { key: "retention" },
        orderBy: { version: "desc" },
        take: 100,
      });
      const current = await tx.businessPolicyVersion.findFirst({
        where: { key: "retention", effectiveAt: { lte: evaluatedAt } },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
      });
      const nextScheduled = await tx.businessPolicyVersion.findFirst({
        where: { key: "retention", effectiveAt: { gt: evaluatedAt } },
        orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "USER",
        entityId: actor.userId,
        newValues: {
          resource: "RETENTION_POLICY_CURRENT",
          returnedCount: history.length,
        },
        context,
      });
      return { evaluatedAt, current, latest: history[0] ?? null, nextScheduled, history };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
