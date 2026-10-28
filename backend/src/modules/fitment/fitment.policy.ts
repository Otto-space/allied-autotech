import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  branchesFor,
  workforceDenied,
  workforceSnapshot,
} from "../organization/workforce.policy.js";

export async function fitmentAccess(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
) {
  const snapshot = await workforceSnapshot(tx, actor);
  const authorBranches = branchesFor(snapshot, "FITMENT_AUTHOR");
  const reviewBranches = branchesFor(snapshot, "FITMENT_REVIEW");
  const globalAuthor =
    actor.role === "SUPER_ADMIN" || (actor.role === "ADMIN" && !snapshot.managed);
  const globalReviewer = actor.role === "SUPER_ADMIN";
  return {
    canAuthor: globalAuthor || authorBranches.length > 0,
    canReview: globalReviewer || reviewBranches.length > 0,
    globalAuthor,
    globalReviewer,
    authorBranches: [...new Set(authorBranches)],
    reviewBranches: [...new Set(reviewBranches)],
    branches: [...new Set([...authorBranches, ...reviewBranches])],
  };
}
export type FitmentAccess = Awaited<ReturnType<typeof fitmentAccess>>;
export function requireFitmentAccess(
  access: FitmentAccess,
  action: "read" | "author" | "review",
) {
  if (
    action === "read"
      ? !access.canAuthor && !access.canReview
      : action === "author"
        ? !access.canAuthor
        : !access.canReview
  )
    workforceDenied();
}
export function fitmentProductScope(access: FitmentAccess): Prisma.ProductWhereInput {
  return access.globalAuthor || access.globalReviewer
    ? {}
    : {
        inventories: {
          some: { branchId: { in: access.branches }, branch: { isActive: true } },
        },
      };
}
export function fitmentRuleScope(
  access: FitmentAccess,
  action: "read" | "author" | "review" = "read",
): Prisma.ProductCompatibilityWhereInput {
  if (
    (action === "read" && (access.globalAuthor || access.globalReviewer)) ||
    (action === "author" && access.globalAuthor) ||
    (action === "review" && access.globalReviewer)
  )
    return {};
  return {
    branchId: {
      in:
        action === "author"
          ? access.authorBranches
          : action === "review"
            ? access.reviewBranches
            : access.branches,
    },
    product: fitmentProductScope(access),
  };
}
