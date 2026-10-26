import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { verifyPassword } from "../../common/security/passwords.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor, revokeAccessInvitations } from "./team-access-security.js";
import {
  workforceTemplates,
  workforceSnapshot,
  workforceDenied,
  workforceConflict,
  workforceNotFound,
} from "./workforce.policy.js";
import type {
  workforceEnrollmentSchema,
  workforceAssignmentSchema,
  workforceRevocationSchema,
  workforceDelegationSchema,
} from "./workforce.schemas.js";

export async function lockWorkforce(tx: Prisma.TransactionClient) {
  // Same lock as existing identity/access changes; always acquire before user/session locks.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('organization-access', 0))`;
}
async function authorizeChange(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  targetId: string,
  password: string,
) {
  if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role) || targetId === actor.userId)
    workforceDenied();
  await lockWorkforce(tx);
  const proof = await tx.user.findUnique({
    where: { id: actor.userId },
    select: { passwordHash: true },
  });
  if (!proof || !(await verifyPassword(proof.passwordHash, password)))
    workforceDenied("Re-enter your current password to change access");
  await lockAccessActor(tx, actor, proof.passwordHash);
  const target = await tx.user.findUnique({
    where: { id: targetId },
    select: {
      role: true,
      status: true,
      emailVerifiedAt: true,
      staffProfile: { select: { id: true } },
      workforceAccess: true,
    },
  });
  if (
    !target ||
    target.role === "CUSTOMER" ||
    target.role === "SUPER_ADMIN" ||
    !target.staffProfile
  )
    workforceDenied();
  if (actor.role !== "SUPER_ADMIN" && target.role !== "STAFF") workforceDenied();
  return target;
}
function checkVersion(current: { version: number } | null, expected: number | null) {
  if ((current?.version ?? null) !== expected) workforceConflict();
}
async function audit(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  targetId: string,
  summary: Readonly<Record<string, import("../audit/audit.types.js").AuditValue>>,
  context: RequestSecurityContext,
) {
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "UPDATE",
    entityType: "USER",
    entityId: targetId,
    newValues: summary,
    context,
  });
}
async function delegable(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  template: string,
  branchId: string,
) {
  if (actor.role === "SUPER_ADMIN") return;
  const envelope = await tx.workforceAccess.findUnique({
    where: { userId: actor.userId },
  });
  if (
    !envelope?.delegatedTemplates.includes(template) ||
    !envelope.delegatedBranchIds.includes(branchId)
  )
    workforceDenied(
      "The owner must authorize this responsibility and branch in your delegation envelope",
    );
}
export class WorkforceAccessService {
  async inspect(
    actor: AuthenticatedActor,
    userId: string,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) workforceDenied();
      // Discovery and a copied/deep-linked detail URL require the same live authority.
      if (!(await workforceSnapshot(tx, actor)).canManageAssignments) workforceDenied();
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          status: true,
          emailVerifiedAt: true,
          staffProfile: { select: { branchId: true, firstName: true, lastName: true } },
          workforceAccess: {
            include: { assignments: { orderBy: { createdAt: "desc" } } },
          },
        },
      });
      if (
        !target ||
        target.role === "CUSTOMER" ||
        (actor.role === "ADMIN" && target.role !== "STAFF")
      )
        workforceNotFound();
      if (actor.role === "ADMIN") {
        const envelope = await tx.workforceAccess.findUnique({
          where: { userId: actor.userId },
        });
        if (
          !target.staffProfile?.branchId ||
          !envelope?.delegatedBranchIds.includes(target.staffProfile.branchId)
        )
          workforceDenied();
      }
      const envelope =
        actor.role === "ADMIN"
          ? await tx.workforceAccess.findUnique({ where: { userId: actor.userId } })
          : null;
      const assignments = (target.workforceAccess?.assignments ?? []).filter(
        (a) =>
          !envelope ||
          (envelope.delegatedTemplates.includes(a.template) &&
            envelope.delegatedBranchIds.includes(a.branchId)),
      );
      const branches = await tx.branch.findMany({
        where: {
          id: {
            in: [
              ...new Set([
                ...assignments.map((a) => a.branchId),
                ...(actor.role === "SUPER_ADMIN"
                  ? (target.workforceAccess?.delegatedBranchIds ?? [])
                  : []),
                ...(envelope?.delegatedBranchIds ?? []),
              ]),
            ],
          },
        },
        select: { id: true, name: true, code: true, isActive: true },
        orderBy: { name: "asc" },
      });
      const now = new Date();
      const active = assignments.filter(
        (a) =>
          !a.revokedAt &&
          a.startsAt <= now &&
          (!a.expiresAt || a.expiresAt > now) &&
          branches.some((b) => b.id === a.branchId && b.isActive) &&
          a.template in workforceTemplates &&
          a.scope ===
            workforceTemplates[a.template as keyof typeof workforceTemplates].scope,
      );
      await audit(tx, actor, userId, { workforceAction: "ACCESS_PREVIEW" }, context);
      const manageable =
        target.id !== actor.userId &&
        target.role !== "SUPER_ADMIN" &&
        !!target.staffProfile;
      const eligible = target.status === "ACTIVE" && target.emailVerifiedAt !== null;
      const templates = Object.keys(workforceTemplates).filter(
        (t) => !envelope || envelope.delegatedTemplates.includes(t),
      );
      const branchIds =
        actor.role === "SUPER_ADMIN"
          ? null
          : branches
              .filter((b) => b.isActive && envelope?.delegatedBranchIds.includes(b.id))
              .map((b) => b.id);
      return {
        userId,
        accountLabel: target.staffProfile
          ? `${target.staffProfile.firstName} ${target.staffProfile.lastName}`.trim() ||
            target.email
          : target.email,
        branches,
        management: {
          canEnroll: actor.role === "SUPER_ADMIN" && manageable && eligible,
          canAssign:
            manageable &&
            eligible &&
            !!target.workforceAccess &&
            templates.length > 0 &&
            (branchIds === null || branchIds.length > 0),
          canRevoke: manageable && !!target.workforceAccess,
          canDelegate:
            actor.role === "SUPER_ADMIN" &&
            manageable &&
            target.role === "ADMIN" &&
            !!target.workforceAccess,
          templates,
          branchIds,
        },
        access: target.workforceAccess
          ? { ...target.workforceAccess, assignments: undefined }
          : null,
        assignments,
        activeAssignmentIds: active.map((a) => a.id),
        templates: workforceTemplates,
      };
    });
  }
  async enroll(
    actor: AuthenticatedActor,
    userId: string,
    input: z.infer<typeof workforceEnrollmentSchema>,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const target = await authorizeChange(tx, actor, userId, input.currentPassword);
      if (actor.role !== "SUPER_ADMIN")
        workforceDenied("The owner must review legacy access before enrollment");
      if (
        target.status !== "ACTIVE" ||
        !target.emailVerifiedAt ||
        input.position === "CEO_MD"
      )
        workforceDenied();
      checkVersion(target.workforceAccess, input.expectedVersion);
      const access = await tx.workforceAccess.upsert({
        where: { userId },
        create: { userId, position: input.position, updatedByUserId: actor.userId },
        update: {
          position: input.position,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      await revokeAccessInvitations(tx, userId);
      if (!target.workforceAccess)
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await audit(
        tx,
        actor,
        userId,
        {
          workforceAction: "ENROLL_OR_UPDATE_POSITION",
          position: input.position,
          reason: input.reason,
          legacyAccessReplaced: !target.workforceAccess,
          version: access.version,
        },
        context,
      );
      return access;
    });
  }
  async assign(
    actor: AuthenticatedActor,
    userId: string,
    input: z.infer<typeof workforceAssignmentSchema>,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const target = await authorizeChange(tx, actor, userId, input.currentPassword);
      if (
        target.status !== "ACTIVE" ||
        !target.emailVerifiedAt ||
        !target.workforceAccess
      )
        workforceDenied();
      checkVersion(target.workforceAccess, input.expectedVersion);
      await delegable(tx, actor, input.template, input.branchId);
      if (
        !(await tx.branch.findFirst({
          where: { id: input.branchId, isActive: true },
          select: { id: true },
        }))
      )
        workforceNotFound();
      const assignment = await tx.workforceAssignment.create({
        data: {
          userId,
          template: input.template,
          branchId: input.branchId,
          scope: workforceTemplates[input.template].scope,
          temporary: input.temporary,
          startsAt: new Date(input.startsAt),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          reason: input.reason,
          assignedByUserId: actor.userId,
        },
      });
      await tx.workforceAccess.update({
        where: { userId },
        data: { version: { increment: 1 }, updatedByUserId: actor.userId },
      });
      await audit(
        tx,
        actor,
        userId,
        {
          workforceAction: "ASSIGN",
          assignmentId: assignment.id,
          template: assignment.template,
          scope: assignment.scope,
          branchId: assignment.branchId,
          temporary: assignment.temporary,
          reason: input.reason,
        },
        context,
      );
      return assignment;
    });
  }
  async revoke(
    actor: AuthenticatedActor,
    userId: string,
    assignmentId: string,
    input: z.infer<typeof workforceRevocationSchema>,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const target = await authorizeChange(tx, actor, userId, input.currentPassword);
      checkVersion(target.workforceAccess, input.expectedVersion);
      const assignment = await tx.workforceAssignment.findFirst({
        where: { id: assignmentId, userId, revokedAt: null },
      });
      if (!assignment) workforceNotFound();
      await delegable(tx, actor, assignment.template, assignment.branchId);
      const revoked = await tx.workforceAssignment.update({
        where: { id: assignmentId },
        data: {
          revokedAt: new Date(),
          revokedByUserId: actor.userId,
          revocationReason: input.reason,
        },
      });
      await tx.workforceAccess.update({
        where: { userId },
        data: { version: { increment: 1 }, updatedByUserId: actor.userId },
      });
      await audit(
        tx,
        actor,
        userId,
        {
          workforceAction: "REVOKE",
          assignmentId,
          template: assignment.template,
          branchId: assignment.branchId,
          reason: input.reason,
        },
        context,
      );
      return revoked;
    });
  }
  async delegate(
    actor: AuthenticatedActor,
    userId: string,
    input: z.infer<typeof workforceDelegationSchema>,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction(async (tx) => {
      const target = await authorizeChange(tx, actor, userId, input.currentPassword);
      if (
        actor.role !== "SUPER_ADMIN" ||
        target.role !== "ADMIN" ||
        !target.workforceAccess
      )
        workforceDenied();
      checkVersion(target.workforceAccess, input.expectedVersion);
      if (
        (await tx.branch.count({
          where: { id: { in: [...new Set(input.branchIds)] }, isActive: true },
        })) !== new Set(input.branchIds).size
      )
        workforceNotFound();
      const access = await tx.workforceAccess.update({
        where: { userId },
        data: {
          delegatedTemplates: [
            ...new Set([
              ...input.templates,
              ...(input.allowAdminInvitations ? ["ADMIN_INVITE"] : []),
            ]),
          ],
          delegatedBranchIds: [...new Set(input.branchIds)],
          version: { increment: 1 },
          updatedByUserId: actor.userId,
        },
      });
      await audit(
        tx,
        actor,
        userId,
        {
          workforceAction: "DELEGATION",
          allowAdminInvitations: input.allowAdminInvitations,
          templates: input.templates.join(","),
          branchIds: input.branchIds.join(","),
          reason: input.reason,
        },
        context,
      );
      return access;
    });
  }
  own(actor: AuthenticatedActor) {
    return prisma.$transaction(async (tx) => {
      await lockWorkforce(tx);
      return workforceSnapshot(tx, actor);
    });
  }
}
