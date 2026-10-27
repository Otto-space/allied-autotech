import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { organizationResourceNotFound } from "../organization/organization.errors.js";
import { paymentForbidden } from "../payments/payments.errors.js";
import { financeWorkspaceResponse } from "./finance-policy-workspace.js";

export const capacityBranchParams = z.object({ branchId: z.uuid() }).strict();
export const capacityWorkspaceResponse = financeWorkspaceResponse.extend({
  branch: z
    .object({
      id: z.uuid(),
      name: z.string(),
      isActive: z.boolean(),
      updatedAt: z.iso.datetime(),
    })
    .strict(),
});

export async function readCapacityPolicy(
  actor: AuthenticatedActor,
  branchId: string,
  context: RequestSecurityContext,
) {
  if (actor.role !== "SUPER_ADMIN" || actor.mfaVerifiedAt === null)
    throw paymentForbidden();
  return withTransactionRetry(
    prisma,
    async (tx) => {
      await lockAccessActor(tx, actor);
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true, isActive: true, updatedAt: true },
      });
      if (!branch) throw organizationResourceNotFound();
      const key = `booking-capacity:${branchId}`,
        evaluatedAt = new Date();
      const history = await tx.businessPolicyVersion.findMany({
        where: { key },
        orderBy: { version: "desc" },
        take: 100,
      });
      const current = await tx.businessPolicyVersion.findFirst({
        where: { key, effectiveAt: { lte: evaluatedAt } },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
      });
      const nextScheduled = await tx.businessPolicyVersion.findFirst({
        where: { key, effectiveAt: { gt: evaluatedAt } },
        orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BRANCH",
        entityId: branchId,
        newValues: { resource: "CAPACITY_POLICY_CURRENT", returnedCount: history.length },
        context,
      });
      return {
        branch,
        evaluatedAt,
        current,
        latest: history[0] ?? null,
        nextScheduled,
        history,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
