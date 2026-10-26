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
  workforceAccessPreviewSchema,
} from "./workforce.schemas.js";
import {
  currentWorkforceTemplateVersion,
  definitionForAssignment,
  isKnownWorkforcePolicyVersion,
  isSupportedDelegationTemplate,
  workforceTemplateVersions,
  type WorkforceAction,
} from "./workforce-catalogue.js";
import {
  effectiveWorkforceGrants,
  workforceGrantChanges,
  accessPreviewFingerprint,
  type GrantVisibility,
  type GrantAssignment,
} from "./workforce-effective-access.js";

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
      staffProfile: { select: { id: true, branchId: true } },
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
  if (actor.role !== "SUPER_ADMIN") {
    if (target.role !== "STAFF") workforceDenied();
    const envelope = await tx.workforceAccess.findUnique({
      where: { userId: actor.userId },
      select: { delegatedBranchIds: true, delegationPolicyVersion: true },
    });
    if (
      !target.staffProfile.branchId ||
      !envelope ||
      !isKnownWorkforcePolicyVersion(envelope.delegationPolicyVersion) ||
      !envelope?.delegatedBranchIds.includes(target.staffProfile.branchId)
    )
      workforceDenied("This staff account is outside your permitted management branches");
  }
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
  reviewedPolicyVersion?: number,
) {
  if (actor.role === "SUPER_ADMIN") return;
  const envelope = await tx.workforceAccess.findUnique({
    where: { userId: actor.userId },
  });
  if (
    !envelope ||
    !isKnownWorkforcePolicyVersion(envelope.delegationPolicyVersion) ||
    !isSupportedDelegationTemplate(template, envelope.delegationPolicyVersion) ||
    !envelope.delegatedTemplates.includes(template) ||
    !envelope.delegatedBranchIds.includes(branchId) ||
    (reviewedPolicyVersion !== undefined &&
      envelope.delegationPolicyVersion !== reviewedPolicyVersion)
  )
    workforceDenied(
      "The owner must authorize this responsibility and branch in your delegation envelope",
    );
}
function visibilityFor(
  actor: AuthenticatedActor,
  target: { status: string; emailVerifiedAt: Date | null },
  envelope: { delegatedTemplates: string[]; delegationPolicyVersion: number } | null,
  branches: GrantVisibility["branches"],
  assignments: readonly { id: string }[],
): GrantVisibility {
  const capabilities = actor.role === "SUPER_ADMIN" ? null : new Set<WorkforceAction>();
  const maximumScopes = new Map<WorkforceAction, "BRANCH" | "ASSIGNED">();
  if (
    capabilities &&
    envelope &&
    isKnownWorkforcePolicyVersion(envelope.delegationPolicyVersion)
  ) {
    const definitions =
      workforceTemplateVersions[
        envelope.delegationPolicyVersion as keyof typeof workforceTemplateVersions
      ];
    for (const template of envelope.delegatedTemplates) {
      const definition = Object.hasOwn(definitions, template)
        ? definitions[template as keyof typeof definitions]
        : undefined;
      if (!definition) continue;
      for (const action of definition.actions) {
        capabilities.add(action);
        if (maximumScopes.get(action) !== "BRANCH")
          maximumScopes.set(action, definition.scope);
      }
    }
  }
  return {
    branches,
    capabilities,
    ...(capabilities ? { maximumScopes } : {}),
    visibleAssignmentIds: new Set(assignments.map((a) => a.id)),
    eligible: target.status === "ACTIVE" && target.emailVerifiedAt !== null,
  };
}
export class WorkforceAccessService {
  async inspect(
    actor: AuthenticatedActor,
    userId: string,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction((tx) => this.inspectWithin(tx, actor, userId, context));
  }
  private async inspectWithin(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    userId: string,
    context: RequestSecurityContext,
    auditRead = true,
  ) {
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
        definitionForAssignment(a) !== undefined,
    );
    if (auditRead)
      await audit(tx, actor, userId, { workforceAction: "ACCESS_PREVIEW" }, context);
    const manageable =
      target.id !== actor.userId &&
      target.role !== "SUPER_ADMIN" &&
      !!target.staffProfile;
    const eligible = target.status === "ACTIVE" && target.emailVerifiedAt !== null;
    const templates = Object.keys(workforceTemplates).filter(
      (t) =>
        !envelope ||
        (envelope.delegationPolicyVersion === currentWorkforceTemplateVersion &&
          envelope.delegatedTemplates.includes(t)),
    );
    const branchIds =
      actor.role === "SUPER_ADMIN"
        ? null
        : branches
            .filter((b) => b.isActive && envelope?.delegatedBranchIds.includes(b.id))
            .map((b) => b.id);
    const grantVisibility = visibilityFor(actor, target, envelope, branches, assignments);
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
        delegationCapabilities:
          grantVisibility.capabilities === null
            ? null
            : [...grantVisibility.maximumScopes!.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([capability, scope]) => ({ capability, scope })),
      },
      access: target.workforceAccess
        ? { ...target.workforceAccess, assignments: undefined }
        : null,
      assignments,
      activeAssignmentIds: eligible ? active.map((a) => a.id) : [],
      effectiveAccess: {
        baseline: !eligible
          ? ("INACTIVE" as const)
          : target.role === "SUPER_ADMIN"
            ? ("OWNER" as const)
            : target.workforceAccess
              ? ("MANAGED" as const)
              : ("LEGACY" as const),
        visibility: envelope ? ("DELEGATED" as const) : ("FULL" as const),
        evaluatedAt: now.toISOString(),
        grants: effectiveWorkforceGrants(
          target.workforceAccess?.assignments ?? [],
          grantVisibility,
          now,
        ),
        responsibilityGrantsOnly: true as const,
      },
      assignmentDefinitions: Object.fromEntries(
        assignments.map((a) => [a.id, definitionForAssignment(a) ?? null]),
      ),
      templatesVersion: currentWorkforceTemplateVersion,
      templates: workforceTemplates,
    };
  }
  private async previewWithin(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    userId: string,
    input: z.infer<typeof workforceAccessPreviewSchema>,
    context: RequestSecurityContext,
  ) {
    const view = await this.inspectWithin(tx, actor, userId, context, false);
    if (
      !(input.operation === "assign"
        ? view.management.canAssign
        : view.management.canRevoke)
    )
      workforceDenied();
    checkVersion(view.access, input.expectedVersion);
    const target = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        status: true,
        emailVerifiedAt: true,
        workforceAccess: { include: { assignments: true } },
      },
    });
    const envelope =
      actor.role === "ADMIN"
        ? await tx.workforceAccess.findUnique({ where: { userId: actor.userId } })
        : null;
    const visibility = visibilityFor(
      actor,
      target,
      envelope,
      [...view.branches],
      view.assignments,
    );
    const all = target.workforceAccess?.assignments ?? [];
    const now = new Date();
    let at = now;
    let after: GrantAssignment[] = all;
    const proposedId = "proposed-responsibility";
    if (input.operation === "assign") {
      if (!view.management.canAssign) workforceDenied();
      if (input.expectedTemplateVersion !== currentWorkforceTemplateVersion)
        workforceConflict(
          "The responsibility definition changed. Refresh and review it again.",
        );
      await delegable(
        tx,
        actor,
        input.template,
        input.branchId,
        input.expectedTemplateVersion,
      );
      const branch = await tx.branch.findFirst({
        where: { id: input.branchId, isActive: true },
        select: { id: true, name: true, isActive: true },
      });
      if (!branch) workforceNotFound();
      if (!visibility.branches.some((b) => b.id === branch.id))
        visibility.branches = [...visibility.branches, branch];
      at = new Date(Math.max(now.getTime(), Date.parse(input.startsAt)));
      after = [
        ...all,
        {
          id: proposedId,
          template: input.template,
          templateVersion: currentWorkforceTemplateVersion,
          scope: workforceTemplates[input.template].scope,
          branchId: input.branchId,
          startsAt: new Date(input.startsAt),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          revokedAt: null,
        },
      ];
    } else {
      if (!view.management.canRevoke) workforceDenied();
      const assignment = view.assignments.find(
        (a) => a.id === input.assignmentId && !a.revokedAt,
      );
      if (!assignment) workforceNotFound();
      await delegable(tx, actor, assignment.template, assignment.branchId);
      after = all.filter((a) => a.id !== input.assignmentId);
    }
    const changes = workforceGrantChanges(
      effectiveWorkforceGrants(all, visibility, at),
      effectiveWorkforceGrants(after, visibility, at, proposedId),
    );
    const stable = {
      userId,
      expectedVersion: input.expectedVersion,
      operation: input.operation,
      input,
      visibility: view.effectiveAccess.visibility,
      ...changes,
      responsibilityGrantsOnly: true as const,
    };
    return {
      ...changes,
      userId,
      expectedVersion: input.expectedVersion,
      operation: input.operation,
      visibility: view.effectiveAccess.visibility,
      responsibilityGrantsOnly: true as const,
      evaluatedAt: at.toISOString(),
      scheduled: at > now,
      fingerprint: accessPreviewFingerprint(stable),
    };
  }
  preview(
    actor: AuthenticatedActor,
    userId: string,
    input: z.infer<typeof workforceAccessPreviewSchema>,
    context: RequestSecurityContext,
  ) {
    return prisma.$transaction((tx) =>
      this.previewWithin(tx, actor, userId, input, context),
    );
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
        create: {
          userId,
          position: input.position,
          updatedByUserId: actor.userId,
          delegationPolicyVersion: currentWorkforceTemplateVersion,
        },
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
      if (input.expectedTemplateVersion !== currentWorkforceTemplateVersion)
        workforceConflict(
          "The responsibility definition changed. Refresh and review its current capabilities before assigning it.",
        );
      await delegable(
        tx,
        actor,
        input.template,
        input.branchId,
        currentWorkforceTemplateVersion,
      );
      if (
        !(await tx.branch.findFirst({
          where: { id: input.branchId, isActive: true },
          select: { id: true },
        }))
      )
        workforceNotFound();
      if (input.expectedAccessPreview) {
        const preview = await this.previewWithin(
          tx,
          actor,
          userId,
          {
            operation: "assign",
            expectedVersion: input.expectedVersion,
            expectedTemplateVersion: input.expectedTemplateVersion,
            template: input.template,
            branchId: input.branchId,
            startsAt: input.startsAt,
            expiresAt: input.expiresAt,
          },
          context,
        );
        if (preview.fingerprint !== input.expectedAccessPreview)
          workforceConflict("Effective access changed. Review the access preview again.");
      }
      const assignment = await tx.workforceAssignment.create({
        data: {
          userId,
          template: input.template,
          templateVersion: currentWorkforceTemplateVersion,
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
          templateVersion: assignment.templateVersion,
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
      if (input.expectedAccessPreview) {
        const preview = await this.previewWithin(
          tx,
          actor,
          userId,
          { operation: "revoke", expectedVersion: input.expectedVersion, assignmentId },
          context,
        );
        if (preview.fingerprint !== input.expectedAccessPreview)
          workforceConflict("Effective access changed. Review the access preview again.");
      }
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
          templateVersion: assignment.templateVersion,
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
      if (input.expectedPolicyVersion !== currentWorkforceTemplateVersion)
        workforceConflict(
          "The responsibility catalogue changed. Refresh and review the delegation's current capabilities.",
        );
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
          delegationPolicyVersion: currentWorkforceTemplateVersion,
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
          delegationPolicyVersion: currentWorkforceTemplateVersion,
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
