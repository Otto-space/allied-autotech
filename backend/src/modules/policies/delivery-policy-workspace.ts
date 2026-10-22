import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { paymentForbidden } from "../payments/payments.errors.js";
import { financeWorkspaceResponse } from "./finance-policy-workspace.js";
import { publicFulfillmentOptions } from "./policies.service.js";

export const deliveryWorkspaceResponse = financeWorkspaceResponse.extend({
  availability: z
    .object({ checkoutEnabled: z.boolean(), deliveryEnabled: z.boolean() })
    .strict(),
});
export async function readDeliveryPolicy(
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
        where: { key: "delivery" },
        orderBy: { version: "desc" },
        take: 100,
      });
      const current = await tx.businessPolicyVersion.findFirst({
        where: { key: "delivery", effectiveAt: { lte: evaluatedAt } },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
      });
      const nextScheduled = await tx.businessPolicyVersion.findFirst({
        where: { key: "delivery", effectiveAt: { gt: evaluatedAt } },
        orderBy: [{ effectiveAt: "asc" }, { version: "desc" }],
      });
      const options = await publicFulfillmentOptions(tx, evaluatedAt);
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "USER",
        entityId: actor.userId,
        newValues: { resource: "DELIVERY_POLICY_CURRENT", returnedCount: history.length },
        context,
      });
      return {
        evaluatedAt,
        current,
        nextScheduled,
        latest: history[0] ?? null,
        history,
        availability: {
          checkoutEnabled: options.checkoutEnabled,
          deliveryEnabled: options.delivery.enabled,
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
