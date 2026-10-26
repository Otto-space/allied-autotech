import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { workforceConflict } from "./workforce.policy.js";

/** Call under the organization-access and account locks, in the role transaction.
 * Management delegation is role-dependent; operational/independent financial grants
 * remain individually scoped and valid for both Staff and Admin. Never erase history.
 */
export async function reconcileWorkforceRoleChange(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    actorUserId: string;
    reason?: string | undefined;
    expectedVersion?: number | null | undefined;
    requireReviewedVersion: boolean;
  },
) {
  const access = await tx.workforceAccess.findUnique({ where: { userId: input.userId } });
  if (input.requireReviewedVersion) {
    if (
      (access && input.expectedVersion !== access.version) ||
      (!access && input.expectedVersion != null)
    )
      workforceConflict(
        "Responsibilities changed or were not reviewed. Refresh the account and review the role change together with its responsibilities.",
      );
    if (access && !input.reason)
      throw new AppError({
        code: "VALIDATION_FAILED",
        statusCode: 422,
        message:
          "A reason is required when changing an enrolled workforce account's role.",
      });
  }
  if (!access)
    return { templates: [] as string[], branches: [] as string[], version: null };
  const next = await tx.workforceAccess.update({
    where: { userId: input.userId },
    data: {
      delegatedTemplates: [],
      delegatedBranchIds: [],
      version: { increment: 1 },
      updatedByUserId: input.actorUserId,
    },
  });
  return {
    templates: access.delegatedTemplates,
    branches: access.delegatedBranchIds,
    version: next.version,
  };
}
