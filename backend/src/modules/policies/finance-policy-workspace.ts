import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { assertCapability } from "./policies.service.js";

export const financeEmptyQuery = z.object({}).strict();
export const policyVersionResponse = z
  .object({
    id: z.uuid(),
    key: z.string(),
    version: z.number().int().positive(),
    approvalStatus: z.string(),
    source: z.string(),
    sourceQuestion: z.string(),
    sourceSignatory: z.string().nullable(),
    approvedByUserId: z.uuid().nullable(),
    effectiveAt: z.iso.datetime(),
    recordedAt: z.iso.datetime(),
    settings: z.unknown(),
    approvalEvidence: z.string().nullable(),
  })
  .strict();
export const financeWorkspaceResponse = z
  .object({
    evaluatedAt: z.iso.datetime(),
    current: policyVersionResponse.nullable(),
    latest: policyVersionResponse.nullable(),
    nextScheduled: policyVersionResponse.nullable(),
    history: z.array(policyVersionResponse).max(100),
  })
  .strict();

export async function readFinancePolicy(
  actor: AuthenticatedActor,
  context: RequestSecurityContext,
  historyOnly = false,
) {
  return prisma.$transaction(
    async (tx) => {
      // Authentication enforces active account and MFA; retain the owner's read exception.
      if (actor.role !== "SUPER_ADMIN")
        await assertCapability(tx, actor, "FINANCE_POLICY_APPROVE");
      const evaluatedAt = new Date();
      const history = await tx.businessPolicyVersion.findMany({
        where: { key: "finance" },
        orderBy: { version: "desc" },
        take: 100,
      });
      const [current, nextScheduled] = historyOnly
        ? [null, null]
        : await Promise.all([
            tx.businessPolicyVersion.findFirst({
              where: { key: "finance", effectiveAt: { lte: evaluatedAt } },
              orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
            }),
            tx.businessPolicyVersion.findFirst({
              where: { key: "finance", effectiveAt: { gt: evaluatedAt } },
              orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
            }),
          ]);
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "USER",
        entityId: actor.userId,
        newValues: {
          resource: historyOnly ? "FINANCE_POLICY_HISTORY" : "FINANCE_POLICY_CURRENT",
          returnedCount: history.length,
        },
        context,
      });
      return { evaluatedAt, current, nextScheduled, latest: history[0] ?? null, history };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
