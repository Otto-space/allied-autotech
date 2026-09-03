import { randomUUID } from "node:crypto";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { encryptIdentityPayload } from "../../common/security/mfa-encryption.js";
import { hashPassword } from "../../common/security/passwords.js";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { UserStatus } from "../../generated/prisma/enums.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { identityEventTypes } from "../identity/identity.events.js";
import {
  invalidInvitation,
  organizationConflict,
  organizationResourceNotFound,
} from "./organization.errors.js";
import {
  assertAdministrator,
  assertCanChangeRole,
  assertCanInvite,
  assertCanManagePrivilegedUser,
  assertPrivilegedActor,
} from "./organization.policy.js";
import { OrganizationRepository } from "./organization.repository.js";
import type {
  AdminBranchListQuery,
  BranchCreateInput,
  BranchUpdateInput,
  PrivilegedInvitationAcceptInput,
  PrivilegedInvitationInput,
  PublicBranchListQuery,
  StaffListQuery,
  StaffRoleInput,
} from "./organization.schemas.js";

function invitationLink(rawToken: string): string {
  const url = new URL(env.FRONTEND_PRIVILEGED_INVITATION_URL);
  url.hash = `token=${encodeURIComponent(rawToken)}`;
  return url.toString();
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function page<T extends { id: string }>(rows: readonly T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : [...rows];
  const last = items.at(-1);
  return {
    items,
    ...(hasMore && last !== undefined ? { nextCursor: last.id } : {}),
  };
}

export class OrganizationService {
  private readonly repository: OrganizationRepository;

  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new OrganizationRepository(database);
  }

  async publicBranches(query: PublicBranchListQuery) {
    if (query.cursor !== undefined) {
      const cursor = await this.repository.branch(query.cursor, true);
      if (cursor === null) throw organizationResourceNotFound();
    }
    return page(await this.repository.listPublicBranches(query), query.limit);
  }

  async publicBranch(branchId: string) {
    const branch = await this.repository.branch(branchId, true);
    if (branch === null) throw organizationResourceNotFound();
    return branch;
  }

  async ownStaffProfile(actor: AuthenticatedActor, context: RequestSecurityContext) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const staff = await this.repository.staff(actor.userId, transaction);
      if (staff === null) throw organizationResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "STAFF_PROFILE",
        entityId: staff.staffProfile?.id ?? staff.id,
        context,
      });
      return staff;
    });
  }

  async branches(
    actor: AuthenticatedActor,
    query: AdminBranchListQuery,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    if (query.cursor !== undefined) {
      const cursor = await this.repository.branch(query.cursor, false);
      if (cursor === null) throw organizationResourceNotFound();
    }
    return this.database.$transaction(async (transaction) => {
      const result = page(
        await this.repository.listBranches(query, transaction),
        query.limit,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BRANCH",
        entityId: null,
        newValues: { resultCount: result.items.length },
        context,
      });
      return result;
    });
  }

  async branch(
    actor: AuthenticatedActor,
    branchId: string,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const branch = await this.repository.branch(branchId, false, transaction);
      if (branch === null) throw organizationResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BRANCH",
        entityId: branch.id,
        context,
      });
      return branch;
    });
  }

  async createBranch(
    actor: AuthenticatedActor,
    input: BranchCreateInput,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const branch = await this.repository.createBranch(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "BRANCH",
        entityId: branch.id,
        newValues: { code: branch.code, active: branch.isActive },
        context,
      });
      return branch;
    });
  }

  async updateBranch(
    actor: AuthenticatedActor,
    branchId: string,
    input: BranchUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${branchId}`}, 0))`;
      const existing = await this.repository.branch(branchId, false, transaction);
      if (existing === null) throw organizationResourceNotFound();
      if (input.isActive === false && existing.isActive) {
        const assigned = await this.repository.countActiveAssignedStaff(
          branchId,
          transaction,
        );
        if (assigned > 0) {
          throw organizationConflict(
            "Reassign or deactivate active branch staff before deactivating this branch",
          );
        }
      }
      const branch = await this.repository.updateBranch(branchId, input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "BRANCH",
        entityId: branch.id,
        oldValues: { active: existing.isActive },
        newValues: {
          active: branch.isActive,
          changedFields: Object.keys(input).sort().join(","),
        },
        context,
      });
      return branch;
    });
  }

  async invite(
    actor: AuthenticatedActor,
    input: PrivilegedInvitationInput,
    context: RequestSecurityContext,
  ): Promise<void> {
    assertCanInvite(actor, input.role);
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken("privileged-invitation", rawToken);
    const expiresAt = new Date(
      Date.now() + env.PRIVILEGED_INVITATION_TTL_SECONDS * 1_000,
    );

    await this.database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privileged-invitation:${input.email}`}, 0))`;
        const existingUser = await transaction.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        });
        if (existingUser !== null) {
          throw organizationConflict("An account already exists for this email address");
        }

        const branchId: string | null =
          input.role === "STAFF" && typeof input.branchId === "string"
            ? input.branchId
            : null;
        if (input.role === "STAFF") {
          if (typeof branchId !== "string") throw organizationResourceNotFound();
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${branchId}`}, 0))`;
          const branch = await this.repository.branch(branchId, true, transaction);
          if (branch === null) throw organizationResourceNotFound();
        }

        await transaction.privilegedInvitation.updateMany({
          where: { email: input.email, usedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const invitation = await transaction.privilegedInvitation.create({
          data: {
            email: input.email,
            role: input.role,
            branchId,
            tokenHash,
            expiresAt,
            invitedById: actor.userId,
          },
          select: { id: true },
        });
        await transaction.outboxEvent.create({
          data: {
            eventId: randomUUID(),
            aggregateType: "PrivilegedInvitation",
            aggregateId: invitation.id,
            eventType: identityEventTypes.privilegedInvitationEmailRequested,
            payload: asJson({
              encrypted: encryptIdentityPayload({
                template: "privileged-invitation",
                to: input.email,
                link: invitationLink(rawToken),
              }),
            }),
          },
        });
        await appendAuditEvent(transaction, {
          actorUserId: actor.userId,
          action: "INVITATION_CREATED",
          entityType: "PRIVILEGED_INVITATION",
          entityId: invitation.id,
          newValues: { role: input.role, branchId },
          context,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async acceptInvitation(
    input: PrivilegedInvitationAcceptInput,
    context: RequestSecurityContext,
  ): Promise<void> {
    const tokenHash = hashToken("privileged-invitation", input.token);
    const passwordHash = await hashPassword(input.password);
    await this.database.$transaction(
      async (transaction) => {
        const now = new Date();
        const invitation = await transaction.privilegedInvitation.findFirst({
          where: {
            tokenHash,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          select: { id: true, email: true, role: true, branchId: true },
        });
        if (invitation === null) throw invalidInvitation();

        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privileged-invitation:${invitation.email}`}, 0))`;
        if (invitation.role === "STAFF") {
          if (invitation.branchId === null) throw invalidInvitation();
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${invitation.branchId}`}, 0))`;
          const activeBranch = await this.repository.branch(
            invitation.branchId,
            true,
            transaction,
          );
          if (activeBranch === null) throw invalidInvitation();
        }

        const consumed = await transaction.privilegedInvitation.updateMany({
          where: {
            id: invitation.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) throw invalidInvitation();

        const user = await transaction.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            role: invitation.role,
            status: "ACTIVE",
            emailVerifiedAt: now,
            staffProfile: {
              create: {
                firstName: input.firstName,
                lastName: input.lastName,
                branchId: invitation.branchId,
                ...(input.phone === undefined ? {} : { phone: input.phone }),
                ...(input.jobTitle === undefined ? {} : { jobTitle: input.jobTitle }),
              },
            },
          },
          select: { id: true },
        });
        await appendAuditEvent(transaction, {
          actorUserId: user.id,
          action: "INVITATION_ACCEPTED",
          entityType: "PRIVILEGED_INVITATION",
          entityId: invitation.id,
          newValues: {
            userId: user.id,
            role: invitation.role,
            branchId: invitation.branchId,
            mfaEnrollmentRequired: true,
          },
          context,
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async staffMembers(
    actor: AuthenticatedActor,
    query: StaffListQuery,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    if (query.cursor !== undefined) {
      const cursor = await this.repository.staff(query.cursor);
      if (cursor === null) throw organizationResourceNotFound();
    }
    return this.database.$transaction(async (transaction) => {
      const result = page(
        await this.repository.listStaff(query, transaction),
        query.limit,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "STAFF_PROFILE",
        entityId: null,
        newValues: { resultCount: result.items.length },
        context,
      });
      return result;
    });
  }

  async staffMember(
    actor: AuthenticatedActor,
    staffUserId: string,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const staff = await this.repository.staff(staffUserId, transaction);
      if (staff === null) throw organizationResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "STAFF_PROFILE",
        entityId: staff.staffProfile?.id ?? staff.id,
        context,
      });
      return staff;
    });
  }

  async changeStatus(
    actor: AuthenticatedActor,
    staffUserId: string,
    status: UserStatus,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff:${staffUserId}`}, 0))`;
      const existing = await this.repository.staff(staffUserId, transaction);
      if (existing === null) throw organizationResourceNotFound();
      assertCanManagePrivilegedUser(actor, staffUserId, existing.role);
      if (existing.status === status) throw organizationConflict();
      const updated = await transaction.user.update({
        where: { id: staffUserId },
        data: { status },
        select: { id: true, status: true },
      });
      await transaction.session.updateMany({
        where: { userId: staffUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action:
          status === "SUSPENDED"
            ? "ACCOUNT_SUSPENDED"
            : status === "DEACTIVATED"
              ? "ACCOUNT_DEACTIVATED"
              : "STATUS_CHANGE",
        entityType: "USER",
        entityId: staffUserId,
        oldValues: { status: existing.status },
        newValues: { status },
        context,
      });
      return updated;
    });
  }

  async assignBranch(
    actor: AuthenticatedActor,
    staffUserId: string,
    branchId: string,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff:${staffUserId}`}, 0))`;
      const existing = await this.repository.staff(staffUserId, transaction);
      if (existing === null || existing.staffProfile === null) {
        throw organizationResourceNotFound();
      }
      assertCanManagePrivilegedUser(actor, staffUserId, existing.role);
      if (existing.role !== "STAFF") throw organizationConflict();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${branchId}`}, 0))`;
      const branch = await this.repository.branch(branchId, true, transaction);
      if (branch === null) throw organizationResourceNotFound();
      if (existing.staffProfile.branchId === branchId) throw organizationConflict();
      const profile = await transaction.staffProfile.update({
        where: { userId: staffUserId },
        data: { branchId },
        select: { id: true, branchId: true },
      });
      await transaction.session.updateMany({
        where: { userId: staffUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "BRANCH_ASSIGNED",
        entityType: "STAFF_PROFILE",
        entityId: profile.id,
        oldValues: { branchId: existing.staffProfile.branchId },
        newValues: { branchId },
        context,
      });
      return profile;
    });
  }

  async changeRole(
    actor: AuthenticatedActor,
    staffUserId: string,
    input: StaffRoleInput,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff:${staffUserId}`}, 0))`;
      const existing = await this.repository.staff(staffUserId, transaction);
      if (existing === null || existing.staffProfile === null) {
        throw organizationResourceNotFound();
      }
      assertCanChangeRole(actor, staffUserId, existing.role, input.role);
      if (existing.role === input.role) throw organizationConflict();

      const nextBranchId = input.role === "STAFF" ? input.branchId : null;
      if (input.role === "STAFF") {
        if (nextBranchId === null) throw organizationResourceNotFound();
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${nextBranchId}`}, 0))`;
        const branch = await this.repository.branch(nextBranchId, true, transaction);
        if (branch === null) throw organizationResourceNotFound();
      }
      await transaction.user.update({
        where: { id: staffUserId },
        data: { role: input.role },
      });
      await transaction.staffProfile.update({
        where: { userId: staffUserId },
        data: { branchId: nextBranchId },
      });
      await transaction.session.updateMany({
        where: { userId: staffUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "ROLE_CHANGE",
        entityType: "USER",
        entityId: staffUserId,
        oldValues: { role: existing.role, branchId: existing.staffProfile.branchId },
        newValues: { role: input.role, branchId: nextBranchId },
        context,
      });
      return this.repository.staff(staffUserId, transaction);
    });
  }
}

export const organizationService = new OrganizationService();
