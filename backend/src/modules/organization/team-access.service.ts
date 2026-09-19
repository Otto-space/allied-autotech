import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { encryptIdentityPayload } from "../../common/security/mfa-encryption.js";
import { verifyPassword } from "../../common/security/passwords.js";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { identityEventTypes } from "../identity/identity.events.js";
import {
  invalidInvitation,
  organizationConflict,
  organizationResourceNotFound,
} from "./organization.errors.js";
import {
  assertAdministrator,
  assertCanInvite,
  assertPrivilegedActor,
} from "./organization.policy.js";
import { safeStaffSelect } from "./organization.repository.js";
import type {
  InvitationListQuery,
  PrivilegedInvitationAcceptInput,
  PrivilegedInvitationInput,
  StaffPromotionInput,
} from "./organization.schemas.js";
import {
  accessDenied,
  lockAccessActor,
  revokeAccessInvitations,
} from "./team-access-security.js";

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  recipientId: true,
  invitedById: true,
  createdAt: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
} satisfies Prisma.PrivilegedInvitationSelect;
type Invitation = Prisma.PrivilegedInvitationGetPayload<{
  select: typeof invitationSelect;
}>;
function invitationView(row: Invitation) {
  return {
    ...row,
    status: row.usedAt
      ? "ACCEPTED"
      : row.revokedAt
        ? "REVOKED"
        : row.expiresAt <= new Date()
          ? "EXPIRED"
          : "PENDING",
  };
}

export class TeamAccessService {
  constructor(private readonly database: PrismaClient) {}

  private async proof(actor: AuthenticatedActor, password: string) {
    const user = await this.database.user.findUnique({
      where: { id: actor.userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(user?.passwordHash, password)) || !user) accessDenied();
    return user.passwordHash;
  }

  async search(
    actor: AuthenticatedActor,
    email: string,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    return this.database.$transaction(async (tx) => {
      const items = await tx.user.findMany({
        where: {
          email,
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
          role: { in: ["CUSTOMER", "STAFF"] },
        },
        select: {
          id: true,
          email: true,
          role: true,
          profile: { select: { firstName: true, lastName: true } },
          staffProfile: { select: { firstName: true, lastName: true, branchId: true } },
        },
        take: 1,
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "USER",
        entityId: null,
        newValues: { resultCount: items.length },
        context,
      });
      return { items };
    });
  }

  async promote(
    actor: AuthenticatedActor,
    input: StaffPromotionInput,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    const proof = await this.proof(actor, input.currentPassword);
    return this.database.$transaction(async (tx) => {
      await lockAccessActor(tx, actor, proof);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.customerUserId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({
        where: { id: input.customerUserId },
        select: {
          id: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          profile: { select: { firstName: true, lastName: true, phone: true } },
        },
      });
      if (
        !user ||
        user.role !== "CUSTOMER" ||
        user.status !== "ACTIVE" ||
        !user.emailVerifiedAt ||
        !user.profile
      )
        throw organizationConflict("An active verified customer account is required");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch:${input.branchId}`}, 0))`;
      if (
        !(await tx.branch.findFirst({
          where: { id: input.branchId, isActive: true },
          select: { id: true },
        }))
      )
        throw organizationResourceNotFound();
      await tx.user.update({ where: { id: user.id }, data: { role: "STAFF" } });
      await tx.staffProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...user.profile, branchId: input.branchId },
        update: { ...user.profile, branchId: input.branchId },
      });
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await revokeAccessInvitations(tx, user.id);
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "ROLE_CHANGE",
        entityType: "USER",
        entityId: user.id,
        oldValues: { role: "CUSTOMER" },
        newValues: { role: "STAFF", branchId: input.branchId },
        context,
      });
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: safeStaffSelect,
      });
    });
  }

  async invite(
    actor: AuthenticatedActor,
    input: PrivilegedInvitationInput,
    context: RequestSecurityContext,
  ) {
    assertCanInvite(actor, input.role);
    const proof = await this.proof(actor, input.currentPassword);
    const token = generateOpaqueToken();
    return this.database.$transaction(async (tx) => {
      await lockAccessActor(tx, actor, proof);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "email" = ${input.email}::citext FOR UPDATE`;
      const recipient = await tx.user.findUnique({
        where: { email: input.email },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          staffProfile: { select: { branch: { select: { isActive: true } } } },
        },
      });
      if (
        !recipient ||
        recipient.id === actor.userId ||
        recipient.role !== "STAFF" ||
        recipient.status !== "ACTIVE" ||
        !recipient.emailVerifiedAt ||
        recipient.staffProfile?.branch?.isActive !== true
      )
        throw organizationConflict(
          "An active verified staff account in an active branch is required",
        );
      await tx.privilegedInvitation.updateMany({
        where: { recipientId: recipient.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invitation = await tx.privilegedInvitation.create({
        data: {
          email: recipient.email,
          role: "ADMIN",
          recipientId: recipient.id,
          invitedById: actor.userId,
          tokenHash: hashToken("privileged-invitation", token),
          expiresAt: new Date(Date.now() + env.PRIVILEGED_INVITATION_TTL_SECONDS * 1000),
        },
        select: invitationSelect,
      });
      const url = new URL(env.FRONTEND_PRIVILEGED_INVITATION_URL);
      url.hash = `token=${encodeURIComponent(token)}`;
      await tx.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "PrivilegedInvitation",
          aggregateId: invitation.id,
          eventType: identityEventTypes.privilegedInvitationEmailRequested,
          payload: {
            encrypted: encryptIdentityPayload({
              template: "privileged-invitation",
              to: recipient.email,
              link: url.toString(),
            }),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "INVITATION_CREATED",
        entityType: "PRIVILEGED_INVITATION",
        entityId: invitation.id,
        newValues: { role: "ADMIN", recipientId: recipient.id },
        context,
      });
      return { invitation: invitationView(invitation), delivery: "QUEUED" as const };
    });
  }

  async accept(
    actor: AuthenticatedActor,
    input: PrivilegedInvitationAcceptInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    if (actor.role !== "STAFF") throw invalidInvitation();
    const proof = await this.proof(actor, input.currentPassword);
    return this.database.$transaction(async (tx) => {
      await lockAccessActor(tx, actor, proof);
      const now = new Date();
      const invitation = await tx.privilegedInvitation.findFirst({
        where: {
          tokenHash: hashToken("privileged-invitation", input.token),
          recipientId: actor.userId,
          role: "ADMIN",
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: invitationSelect,
      });
      if (!invitation) throw invalidInvitation();
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${invitation.invitedById}::uuid FOR UPDATE`;
      const inviter = await tx.user.findUnique({
        where: { id: invitation.invitedById },
        select: { role: true, status: true, emailVerifiedAt: true },
      });
      const recipient = await tx.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: {
          email: true,
          staffProfile: {
            select: { branchId: true, branch: { select: { isActive: true } } },
          },
        },
      });
      if (
        !inviter ||
        inviter.status !== "ACTIVE" ||
        !inviter.emailVerifiedAt ||
        !["ADMIN", "SUPER_ADMIN"].includes(inviter.role) ||
        recipient.email !== invitation.email ||
        recipient.staffProfile?.branch?.isActive !== true
      )
        throw invalidInvitation();
      const consumed = await tx.privilegedInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw invalidInvitation();
      await tx.user.update({ where: { id: actor.userId }, data: { role: "ADMIN" } });
      await tx.staffProfile.update({
        where: { userId: actor.userId },
        data: { branchId: null },
      });
      await tx.session.updateMany({
        where: { userId: actor.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "INVITATION_ACCEPTED",
        entityType: "PRIVILEGED_INVITATION",
        entityId: invitation.id,
        newValues: { userId: actor.userId, role: "ADMIN" },
        context,
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "ROLE_CHANGE",
        entityType: "USER",
        entityId: actor.userId,
        oldValues: { role: "STAFF", branchId: recipient.staffProfile.branchId },
        newValues: { role: "ADMIN", invitationId: invitation.id, branchId: null },
        context,
      });
      return { role: "ADMIN" as const, signInRequired: true };
    });
  }

  async list(
    actor: AuthenticatedActor,
    query: InvitationListQuery,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    const now = new Date();
    const status: Prisma.PrivilegedInvitationWhereInput =
      query.status === "ACCEPTED"
        ? { usedAt: { not: null } }
        : query.status === "REVOKED"
          ? { usedAt: null, revokedAt: { not: null } }
          : query.status === "PENDING"
            ? { usedAt: null, revokedAt: null, expiresAt: { gt: now } }
            : query.status === "EXPIRED"
              ? { usedAt: null, revokedAt: null, expiresAt: { lte: now } }
              : {};
    return this.database.$transaction(async (tx) => {
      const rows = await tx.privilegedInvitation.findMany({
        where: {
          ...status,
          ...(actor.role === "SUPER_ADMIN" ? {} : { invitedById: actor.userId }),
        },
        select: invitationSelect,
        orderBy: { id: "asc" },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, query.limit).map(invitationView);
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "PRIVILEGED_INVITATION",
        entityId: null,
        newValues: { resultCount: items.length },
        context,
      });
      return {
        items,
        ...(rows.length > query.limit ? { nextCursor: items.at(-1)!.id } : {}),
      };
    });
  }

  async revoke(
    actor: AuthenticatedActor,
    id: string,
    password: string,
    context: RequestSecurityContext,
  ) {
    assertAdministrator(actor);
    const proof = await this.proof(actor, password);
    return this.database.$transaction(async (tx) => {
      await lockAccessActor(tx, actor, proof);
      const invitation = await tx.privilegedInvitation.findFirst({
        where: {
          id,
          ...(actor.role === "SUPER_ADMIN" ? {} : { invitedById: actor.userId }),
        },
        select: invitationSelect,
      });
      if (!invitation) throw organizationResourceNotFound();
      if (invitation.usedAt || invitation.revokedAt) throw organizationConflict();
      const updated = await tx.privilegedInvitation.update({
        where: { id },
        data: { revokedAt: new Date() },
        select: invitationSelect,
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "PRIVILEGED_INVITATION",
        entityId: id,
        newValues: { revoked: true },
        context,
      });
      return invitationView(updated);
    });
  }
}
