import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { UserStatus } from "../../generated/prisma/enums.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  organizationConflict,
  organizationResourceNotFound,
} from "./organization.errors.js";
import {
  assertAdministrator,
  assertCanChangeRole,
  assertCanManagePrivilegedUser,
  assertPrivilegedActor,
} from "./organization.policy.js";
import { TeamAccessService } from "./team-access.service.js";
import { lockAccessActor, revokeAccessInvitations } from "./team-access-security.js";
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

  invite(
    actor: AuthenticatedActor,
    input: PrivilegedInvitationInput,
    context: RequestSecurityContext,
  ) {
    return new TeamAccessService(this.database).invite(actor, input, context);
  }
  acceptInvitation(
    actor: AuthenticatedActor,
    input: PrivilegedInvitationAcceptInput,
    context: RequestSecurityContext,
  ) {
    return new TeamAccessService(this.database).accept(actor, input, context);
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
      await lockAccessActor(transaction, actor);
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
      await revokeAccessInvitations(transaction, staffUserId);
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
      await lockAccessActor(transaction, actor);
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
      await revokeAccessInvitations(transaction, staffUserId);
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
      await lockAccessActor(transaction, actor);
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
      await revokeAccessInvitations(transaction, staffUserId);
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
