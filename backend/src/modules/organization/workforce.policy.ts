import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import type { Prisma } from "../../generated/prisma/client.js";

export { workforceTemplates } from "./workforce-catalogue.js";
import {
  workforceTemplates,
  definitionForAssignment,
  assignmentAllows,
  isKnownWorkforcePolicyVersion,
  isSupportedDelegationTemplate,
  type WorkforceAction,
} from "./workforce-catalogue.js";
export type { WorkforceAction } from "./workforce-catalogue.js";

export const templateSchema = z.enum(
  Object.keys(workforceTemplates) as [
    keyof typeof workforceTemplates,
    ...Array<keyof typeof workforceTemplates>,
  ],
);
export const positionSchema = z.enum(["CEO_MD", ...templateSchema.options]);
export type Template = z.infer<typeof templateSchema>;
export function workforceDenied(
  message = "This action is unavailable for your current responsibilities",
): never {
  throw new AppError({ code: "FORBIDDEN", statusCode: 403, message });
}
export function workforceConflict(
  message = "This record changed. Refresh and review it again.",
): never {
  throw new AppError({ code: "CONFLICT", statusCode: 409, message });
}
export function workforceNotFound(): never {
  throw new AppError({ code: "NOT_FOUND", statusCode: 404, message: "Record not found" });
}

export async function workforceSnapshot(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
) {
  if (actor.role === "CUSTOMER" || !actor.mfaVerifiedAt) workforceDenied();
  const now = new Date();
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: {
      status: true,
      role: true,
      emailVerifiedAt: true,
      staffProfile: { select: { id: true } },
      workforceAccess: {
        include: {
          assignments: {
            where: {
              revokedAt: null,
              startsAt: { lte: now },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              branch: { isActive: true },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.role !== actor.role ||
    !user.emailVerifiedAt
  )
    workforceDenied();
  const access = user.workforceAccess;
  const assignments = (access?.assignments ?? []).filter(
    (a) => definitionForAssignment(a) !== undefined,
  );
  const permissions = [
    ...new Set(assignments.flatMap((a) => [...definitionForAssignment(a)!.actions])),
  ].sort();
  return {
    managed: access !== null,
    userId: actor.userId,
    staffId: user.staffProfile?.id ?? null,
    position: access?.position ?? null,
    department:
      access?.position === "CEO_MD"
        ? "Strategy"
        : access && templateSchema.safeParse(access.position).success
          ? workforceTemplates[access.position as Template].department
          : null,
    version: access?.version ?? 0,
    assignments,
    permissions,
    canManageAssignments:
      actor.role === "SUPER_ADMIN" ||
      (actor.role === "ADMIN" &&
        !!access &&
        isKnownWorkforcePolicyVersion(access.delegationPolicyVersion) &&
        access.delegatedTemplates.some((template) =>
          isSupportedDelegationTemplate(template, access.delegationPolicyVersion),
        ) &&
        !!access.delegatedBranchIds.length),
    canInviteAdmins:
      actor.role === "ADMIN" &&
      !!access &&
      isKnownWorkforcePolicyVersion(access.delegationPolicyVersion) &&
      !!access?.delegatedTemplates.includes("ADMIN_INVITE") &&
      !!access.delegatedBranchIds.length,
    serverTime: now.toISOString(),
  };
}
export type WorkforceSnapshot = Awaited<ReturnType<typeof workforceSnapshot>>;

export function branchesFor(
  snapshot: WorkforceSnapshot,
  action: WorkforceAction,
): string[] {
  return [
    ...new Set(
      snapshot.assignments
        .filter((a) => assignmentAllows(a, action))
        .map((a) => a.branchId),
    ),
  ];
}
export function bookingScope(
  snapshot: WorkforceSnapshot,
  action: WorkforceAction,
): Prisma.BookingWhereInput {
  const assignments = snapshot.assignments.filter((a) => assignmentAllows(a, action));
  if (!assignments.length) workforceDenied();
  return {
    OR: assignments.map((a) => ({
      branchId: a.branchId,
      ...(a.scope === "ASSIGNED"
        ? { assignedStaffId: snapshot.staffId ?? "00000000-0000-0000-0000-000000000000" }
        : {}),
    })),
  };
}

// Personal inbox endpoints remain account-owned and do not grant operational access.
// Keep this list exact: future notification administration routes are not included.
function isPersonalNotificationPath(path: string): boolean {
  return (
    path === "/api/v1/staff/notifications" ||
    path === "/api/v1/staff/notifications/summary" ||
    path === "/api/v1/staff/notifications/attention" ||
    path === "/api/v1/staff/notifications/context" ||
    path === "/api/v1/staff/notifications/read-context" ||
    path === "/api/v1/staff/notifications/push" ||
    /^\/api\/v1\/staff\/notifications\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      path,
    ) ||
    path === "/api/v1/staff/notifications/read-all" ||
    path === "/api/v1/staff/notifications/preferences/current" ||
    /^\/api\/v1\/staff\/notifications\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?:read|unread)$/.test(
      path,
    )
  );
}

// Enrolled accounts cannot reach broad legacy APIs, even if their identity is ADMIN.
// New operational endpoints enforce actions, scopes and fields inside their transaction.
export async function enforceWorkforceBoundary(
  tx: Pick<Prisma.TransactionClient, "workforceAccess">,
  actor: AuthenticatedActor,
  originalUrl: string,
) {
  if (actor.role === "CUSTOMER" || actor.role === "SUPER_ADMIN") return;
  const access = await tx.workforceAccess.findUnique({
    where: { userId: actor.userId },
    select: { userId: true },
  });
  if (!access) return;
  let path: string;
  try {
    path = decodeURIComponent(originalUrl.split("?")[0]!)
      .replace(/\/+$/, "")
      .toLowerCase();
  } catch {
    workforceDenied();
  }
  if (
    /^\/api\/v1\/learning\/(?:catalogue|(?:articles|guides|scenarios)\/[a-z][a-z0-9-]{0,63})$/.test(
      path,
    ) ||
    path.startsWith("/api/v1/auth/") ||
    path === "/api/v1/staff/profile" ||
    isPersonalNotificationPath(path) ||
    path.startsWith("/api/v1/staff/workforce/") ||
    path.startsWith("/api/v1/staff/fitment/") ||
    path === "/api/v1/staff/workforce" ||
    path.startsWith("/api/v1/admin/workforce/")
  )
    return;
  workforceDenied("Use the workspace permitted by your current responsibilities");
}
