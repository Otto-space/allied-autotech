import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import type { Prisma, SupportConversation } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { closeCustomerContextForSupport } from "../learning/allie.conversations.js";
import { learningAccessInTransaction } from "../learning/learning.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import { careBranchesFor } from "../organization/workforce-care-scope.js";
import {
  workforceConflict,
  workforceDenied,
  workforceNotFound,
  type WorkforceSnapshot,
} from "../organization/workforce.policy.js";
import { supportChannelReceipt } from "./support-creation-receipt.js";
import {
  supportChannelActionSchema,
  supportChannelRequestSchema,
  supportChannelSchema,
  type supportChannelTargetSchema,
} from "./support-channel.schemas.js";
import { supportLiveAgent, supportLiveOperator } from "./support-live.js";

type Tx = Prisma.TransactionClient;
type Target = z.infer<typeof supportChannelTargetSchema>;
type Access = {
  actor: AuthenticatedActor;
  workforce: WorkforceSnapshot | null;
  customerId: string | null;
};
const targetFor = (row: SupportConversation): Target =>
  row.enquiryId
    ? { kind: "ENQUIRY", id: row.enquiryId }
    : { kind: "COMPLAINT", id: row.complaintId! };
async function currentAccess(tx: Tx, actor: AuthenticatedActor): Promise<Access> {
  // Shared capacity, duty changes and channel claims use the existing access lock order.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('organization-access', 0))`;
  if (actor.role !== "CUSTOMER")
    return { actor, workforce: await supportLiveOperator(tx, actor), customerId: null };
  const access = await learningAccessInTransaction(tx, actor);
  if (!access.verified) workforceDenied();
  const customer = await tx.customerProfile.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!customer) workforceNotFound();
  return { actor, workforce: null, customerId: customer.id };
}
async function record(tx: Tx, target: Target) {
  if (target.kind === "ENQUIRY")
    await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${target.id}::uuid FOR UPDATE`;
  else
    await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id"=${target.id}::uuid FOR UPDATE`;
  const select = {
    id: true,
    customerId: true,
    branchId: true,
    version: true,
    status: true,
  } as const;
  const row =
    target.kind === "ENQUIRY"
      ? await tx.enquiry.findUnique({ where: { id: target.id }, select })
      : await tx.complaint.findUnique({ where: { id: target.id }, select });
  if (!row?.branchId || !row.customerId) workforceNotFound();
  return { ...row, branchId: row.branchId, customerId: row.customerId };
}
function authorize(
  access: Access,
  target: Target,
  row: Awaited<ReturnType<typeof record>>,
) {
  if (access.customerId) {
    if (row.customerId !== access.customerId) workforceNotFound();
  } else if (
    !access.workforce ||
    !careBranchesFor(access.workforce, target.kind).includes(row.branchId)
  )
    workforceNotFound();
}
async function authorizedChannel(tx: Tx, access: Access, id: string) {
  const channel = await tx.supportConversation.findUnique({ where: { id } });
  if (!channel) workforceNotFound();
  const target = targetFor(channel),
    canonical = await record(tx, target);
  authorize(access, target, canonical);
  if (
    canonical.customerId !== channel.customerId ||
    canonical.branchId !== channel.branchId
  )
    workforceConflict(
      "The case routing changed. Refresh Customer Care before continuing.",
    );
  return { channel, canonical, target };
}
function mayAssign(access: Access, row: SupportConversation) {
  return (
    !!access.workforce &&
    careBranchesFor(access.workforce, targetFor(row).kind, "assign").includes(
      row.branchId,
    )
  );
}
function isCurrentAgent(access: Access, row: SupportConversation) {
  return (
    row.state === "HUMAN_ACTIVE" &&
    row.assignedUserId === access.actor.userId &&
    row.assignedSessionId === access.actor.sessionId &&
    !!access.workforce &&
    careBranchesFor(access.workforce, targetFor(row).kind, "live").includes(row.branchId)
  );
}
async function project(
  tx: Tx,
  access: Access,
  row: SupportConversation,
  claimAvailable?: boolean,
) {
  const latest = await tx.supportMessage.findFirst({
    where: {
      ...(row.enquiryId
        ? { enquiryId: row.enquiryId }
        : { complaintId: row.complaintId! }),
      visibility: "CUSTOMER",
      kind: { not: "INTERNAL_NOTE" },
    },
    select: { id: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const live =
    !!access.workforce &&
    careBranchesFor(access.workforce, targetFor(row).kind, "live").includes(row.branchId);
  return supportChannelSchema.parse({
    id: row.id,
    target: targetFor(row),
    branchId: row.branchId,
    state: row.state,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    queuedSince: row.state === "QUEUED" ? row.updatedAt.toISOString() : null,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    latestPublicMessageId: latest?.id ?? null,
    assignedToYou: isCurrentAgent(access, row),
    canClaim:
      row.state === "QUEUED" &&
      live &&
      (claimAvailable ??
        !!(await supportLiveAgent(tx, {
          userId: access.actor.userId,
          sessionId: access.actor.sessionId,
          branchId: row.branchId,
          kind: targetFor(row).kind,
          requireCapacity: true,
        }))),
    canTransfer: row.state === "HUMAN_ACTIVE" && mayAssign(access, row),
    canEnd:
      row.state !== "ENDED" &&
      (!!access.customerId || isCurrentAgent(access, row) || mayAssign(access, row)),
    pollAfterMs: 5000,
  });
}
async function systemEvent(
  tx: Tx,
  row: SupportConversation,
  action: string,
  body: string,
  actorUserId: string | null,
  context: RequestSecurityContext,
  reason?: string,
) {
  const target = targetFor(row),
    link =
      target.kind === "ENQUIRY" ? { enquiryId: target.id } : { complaintId: target.id };
  await tx.supportMessage.create({
    data: {
      ...link,
      authorType: "SYSTEM",
      authorUserId: null,
      visibility: "CUSTOMER",
      kind: "LEGACY",
      body,
      createdAt: new Date(),
    },
  });
  if (target.kind === "ENQUIRY")
    await tx.enquiry.update({
      where: { id: target.id },
      data: { version: { increment: 1 } },
    });
  else
    await tx.complaint.update({
      where: { id: target.id },
      data: { version: { increment: 1 } },
    });
  await appendAuditEvent(tx, {
    actorUserId,
    action: "UPDATE",
    entityType: target.kind,
    entityId: target.id,
    newValues: {
      resource: "SUPPORT_CHANNEL",
      channelId: row.id,
      channelAction: action,
      channelState: row.state,
      channelVersion: row.version,
      assignedUserId: row.assignedUserId,
      ...(reason ? { reason } : {}),
    },
    context,
  });
  if (row.state === "QUEUED")
    await notifySupportTeam(tx, {
      kind: target.kind,
      id: target.id,
      event: `support-channel:${row.id}:${row.version}`,
      title: "Customer Care conversation queued",
      ...(actorUserId ? { actorUserId } : {}),
    });
}
async function reconcile(
  tx: Tx,
  row: SupportConversation,
  context: RequestSecurityContext,
) {
  row = await tx.supportConversation.findUniqueOrThrow({ where: { id: row.id } });
  if (row.state === "ENDED") return row;
  const target = targetFor(row),
    canonical = await record(tx, target);
  if (canonical.status === "CLOSED") {
    const ended = await tx.supportConversation.update({
      where: { id: row.id },
      data: {
        state: "ENDED",
        assignedUserId: null,
        assignedSessionId: null,
        endedAt: new Date(),
        endReason: "CASE_CLOSED",
        version: { increment: 1 },
      },
    });
    await systemEvent(
      tx,
      ended,
      "CASE_CLOSED",
      "The live conversation ended because this Customer Care case is closed.",
      null,
      context,
    );
    return ended;
  }
  if (row.state !== "HUMAN_ACTIVE") return row;
  if (
    row.assignedUserId &&
    row.assignedSessionId &&
    (await supportLiveAgent(tx, {
      userId: row.assignedUserId,
      sessionId: row.assignedSessionId,
      branchId: row.branchId,
      kind: target.kind,
    }))
  )
    return row;
  const queued = await tx.supportConversation.update({
    where: { id: row.id },
    data: {
      state: "QUEUED",
      assignedUserId: null,
      assignedSessionId: null,
      claimedAt: null,
      version: { increment: 1 },
    },
  });
  await systemEvent(
    tx,
    queued,
    "REQUEUED",
    "The representative is unavailable. This conversation is queued; saved messages remain in this Customer Care case.",
    null,
    context,
  );
  return queued;
}
async function releaseStaleCapacity(
  tx: Tx,
  userId: string,
  context: RequestSecurityContext,
) {
  const rows = await tx.supportConversation.findMany({
    where: { assignedUserId: userId, state: "HUMAN_ACTIVE" },
    orderBy: { id: "asc" },
  });
  for (const row of rows) await reconcile(tx, row, context);
}

export function requestSupportChannel(
  actor: AuthenticatedActor,
  raw: z.infer<typeof supportChannelRequestSchema>,
  key: string,
  context: RequestSecurityContext,
) {
  const input = supportChannelRequestSchema.parse(raw);
  if (actor.role !== "CUSTOMER") workforceDenied();
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentAccess(tx, actor);
    const canonical = await record(tx, input.target);
    authorize(access, input.target, canonical);
    return supportChannelReceipt(
      tx,
      actor.userId,
      "request",
      key,
      input,
      async () => {
        if (
          canonical.status === "CLOSED" ||
          canonical.version !== input.expectedCaseVersion
        )
          workforceConflict();
        const where =
          input.target.kind === "ENQUIRY"
            ? { enquiryId: input.target.id }
            : { complaintId: input.target.id };
        const previous = await tx.supportConversation.findUnique({ where });
        if (
          (previous?.version ?? 0) !== input.expectedChannelVersion ||
          (previous && previous.state !== "ENDED")
        )
          workforceConflict();
        if (input.assistantContext)
          await closeCustomerContextForSupport(tx, actor, input.assistantContext);
        const channel = previous
          ? await tx.supportConversation.update({
              where: { id: previous.id },
              data: {
                state: "QUEUED",
                assignedUserId: null,
                assignedSessionId: null,
                claimedAt: null,
                endedAt: null,
                endReason: null,
                version: { increment: 1 },
              },
            })
          : await tx.supportConversation.create({
              data: {
                ...where,
                customerId: canonical.customerId,
                branchId: canonical.branchId,
                version: 1,
              },
            });
        await systemEvent(
          tx,
          channel,
          "REQUESTED",
          "A Customer Care conversation was requested. Your messages are queued until a representative joins.",
          actor.userId,
          context,
        );
        return project(tx, access, channel);
      },
      async (id) => {
        const row = await authorizedChannel(tx, access, id);
        if (row.target.kind !== input.target.kind || row.target.id !== input.target.id)
          workforceNotFound();
        return project(tx, access, await reconcile(tx, row.channel, context));
      },
    );
  });
}

export function getSupportChannel(
  actor: AuthenticatedActor,
  id: string,
  context: RequestSecurityContext,
) {
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentAccess(tx, actor),
      row = await authorizedChannel(tx, access, id);
    if (access.workforce) await releaseStaleCapacity(tx, actor.userId, context);
    return project(tx, access, await reconcile(tx, row.channel, context));
  });
}
/** Reload/reconnect discovers the channel through its owned/scoped canonical case,
 * rather than requiring a browser-held channel identifier. */
export function findSupportChannel(
  actor: AuthenticatedActor,
  target: Target,
  context: RequestSecurityContext,
) {
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentAccess(tx, actor),
      canonical = await record(tx, target);
    authorize(access, target, canonical);
    const where =
      target.kind === "ENQUIRY" ? { enquiryId: target.id } : { complaintId: target.id };
    const row = await tx.supportConversation.findUnique({ where });
    if (!row) {
      const latest = await tx.supportMessage.findFirst({
        where: {
          ...(target.kind === "ENQUIRY"
            ? { enquiryId: target.id }
            : { complaintId: target.id }),
          visibility: "CUSTOMER",
          kind: { not: "INTERNAL_NOTE" },
        },
        select: { id: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return {
        channel: null,
        caseVersion: canonical.version,
        latestPublicMessageId: latest?.id ?? null,
      };
    }
    if (row.customerId !== canonical.customerId || row.branchId !== canonical.branchId)
      workforceConflict();
    if (access.workforce) await releaseStaleCapacity(tx, actor.userId, context);
    const channel = await reconcile(tx, row, context);
    const projection = await project(tx, access, channel);
    return {
      channel: projection,
      caseVersion: (await record(tx, target)).version,
      latestPublicMessageId: projection.latestPublicMessageId,
    };
  });
}
export function actOnSupportChannel(
  actor: AuthenticatedActor,
  id: string,
  raw: z.infer<typeof supportChannelActionSchema>,
  key: string,
  context: RequestSecurityContext,
) {
  const input = supportChannelActionSchema.parse(raw);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentAccess(tx, actor),
      existing = await authorizedChannel(tx, access, id);
    // Authorization is rechecked even for a reference-only replay.
    if (
      input.action === "claim" &&
      (!access.workforce ||
        !careBranchesFor(access.workforce, existing.target.kind, "live").includes(
          existing.channel.branchId,
        ))
    )
      workforceDenied();
    if (input.action === "transfer" && !mayAssign(access, existing.channel))
      workforceDenied();
    if (
      input.action === "end" &&
      !access.customerId &&
      !mayAssign(access, existing.channel) &&
      (!access.workforce ||
        !careBranchesFor(access.workforce, existing.target.kind, "live").includes(
          existing.channel.branchId,
        ))
    )
      workforceDenied();
    return supportChannelReceipt(
      tx,
      actor.userId,
      input.action,
      key,
      { channelId: id, ...input },
      async () => {
        if (
          input.action === "end" &&
          !access.customerId &&
          !mayAssign(access, existing.channel) &&
          !isCurrentAgent(access, existing.channel)
        )
          workforceDenied();
        const current = await reconcile(tx, existing.channel, context);
        if (current.version !== input.expectedVersion || current.state === "ENDED")
          workforceConflict();
        let next: SupportConversation;
        if (input.action === "claim") {
          if (current.state !== "QUEUED" || existing.canonical.status === "CLOSED")
            workforceConflict();
          await releaseStaleCapacity(tx, actor.userId, context);
          const available = await supportLiveAgent(tx, {
            userId: actor.userId,
            sessionId: actor.sessionId,
            branchId: current.branchId,
            kind: existing.target.kind,
            requireCapacity: true,
          });
          if (!available)
            throw new AppError({
              code: "SUPPORT_LIVE_UNAVAILABLE",
              statusCode: 503,
              message:
                "Current availability or capacity is insufficient. The conversation remains queued.",
            });
          next = await tx.supportConversation.update({
            where: { id },
            data: {
              state: "HUMAN_ACTIVE",
              assignedUserId: actor.userId,
              assignedSessionId: actor.sessionId,
              claimedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await systemEvent(
            tx,
            next,
            "CLAIMED",
            "A Customer Care representative joined this conversation.",
            actor.userId,
            context,
          );
        } else if (input.action === "transfer") {
          if (current.state !== "HUMAN_ACTIVE") workforceConflict();
          const staff = await tx.staffProfile.findUnique({
            where: { id: input.targetStaffId },
            select: { userId: true },
          });
          const presence = staff
            ? await tx.supportLivePresence.findUnique({
                where: { userId: staff.userId },
                select: { sessionId: true },
              })
            : null;
          if (!staff || !presence || staff.userId === current.assignedUserId)
            workforceConflict(
              "Choose another currently available eligible representative.",
            );
          await releaseStaleCapacity(tx, staff.userId, context);
          if (
            !(await supportLiveAgent(tx, {
              userId: staff.userId,
              sessionId: presence.sessionId,
              branchId: current.branchId,
              kind: existing.target.kind,
              requireCapacity: true,
            }))
          )
            workforceConflict(
              "The selected representative is no longer available in this branch.",
            );
          next = await tx.supportConversation.update({
            where: { id },
            data: {
              assignedUserId: staff.userId,
              assignedSessionId: presence.sessionId,
              claimedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await systemEvent(
            tx,
            next,
            "TRANSFERRED",
            "This conversation was transferred to another Customer Care representative.",
            actor.userId,
            context,
            input.reason,
          );
        } else {
          next = await tx.supportConversation.update({
            where: { id },
            data: {
              state: "ENDED",
              assignedUserId: null,
              assignedSessionId: null,
              endedAt: new Date(),
              endReason: "EXPLICIT_END",
              version: { increment: 1 },
            },
          });
          await systemEvent(
            tx,
            next,
            "ENDED",
            "This live conversation ended. Your case history and ordinary Customer Care follow-up remain available.",
            actor.userId,
            context,
          );
        }
        return project(tx, access, next);
      },
      async (channelId) => {
        if (channelId !== id) workforceNotFound();
        const row = await authorizedChannel(tx, access, channelId);
        return project(tx, access, await reconcile(tx, row.channel, context));
      },
    );
  });
}

// Internal adapters share these exact ownership/policy/lifecycle projections.
export {
  record as supportChannelCase,
  authorize as assertSupportChannelCaseAccess,
  currentAccess as currentSupportChannelAccess,
  authorizedChannel as authorizedSupportChannel,
  mayAssign as mayAssignSupportChannel,
  project as projectSupportChannel,
  reconcile as reconcileSupportChannel,
  releaseStaleCapacity as releaseStaleSupportCapacity,
};
