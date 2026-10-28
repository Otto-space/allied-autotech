import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import type { Prisma, SupportConversation } from "../../generated/prisma/client.js";
import { careBranchesFor } from "../organization/workforce-care-scope.js";
import { workforceDenied } from "../organization/workforce.policy.js";
import {
  authorizedSupportChannel,
  currentSupportChannelAccess,
  mayAssignSupportChannel,
  projectSupportChannel,
  reconcileSupportChannel,
  releaseStaleSupportCapacity,
  supportChannelCase,
  assertSupportChannelCaseAccess,
} from "./support-channel.js";
import { supportLiveAgent } from "./support-live.js";
import {
  readSupportChannelReceipt,
  cancelSupportChannelReceipt,
} from "./support-creation-receipt.js";
import {
  decodeSupportChannelCursor,
  encodeSupportChannelCursor,
  supportChannelBinding,
} from "./support-channel-cursor.js";
import {
  supportChannelCandidatesPageSchema,
  supportChannelCandidatesSchema,
  supportChannelQueuePageSchema,
  supportChannelQueueSchema,
  type supportChannelOperationSchema,
  supportChannelCancelSchema,
  type supportChannelTargetSchema,
} from "./support-channel.schemas.js";

const kindFor = (row: SupportConversation) =>
  row.enquiryId ? ("ENQUIRY" as const) : ("COMPLAINT" as const);
export function listSupportChannels(
  actor: AuthenticatedActor,
  raw: z.infer<typeof supportChannelQueueSchema>,
  context: RequestSecurityContext,
) {
  const query = supportChannelQueueSchema.parse(raw);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentSupportChannelAccess(tx, actor),
      snapshot = access.workforce;
    if (!snapshot) workforceDenied();
    const scope: Prisma.SupportConversationWhereInput[] = [];
    for (const kind of ["ENQUIRY", "COMPLAINT"] as const) {
      if (query.kind && query.kind !== kind) continue;
      const branches = careBranchesFor(snapshot, kind).filter(
        (id) => !query.branchId || id === query.branchId,
      );
      if (branches.length)
        scope.push({
          branchId: { in: branches },
          ...(kind === "ENQUIRY"
            ? { enquiryId: { not: null } }
            : { complaintId: { not: null } }),
        });
    }
    if (!scope.length) workforceDenied();
    const binding = supportChannelBinding([
      "queue",
      actor.userId,
      actor.sessionId,
      actor.role,
      snapshot.accessRevision,
      query.kind ?? null,
      query.state,
      query.branchId ?? null,
    ]);
    const after = query.cursor ? decodeSupportChannelCursor(binding, query.cursor) : null;
    if (after && !after.createdAt)
      throw new AppError({
        code: "VALIDATION_FAILED",
        statusCode: 422,
        message: "Invalid queue position",
      });
    await releaseStaleSupportCapacity(tx, actor.userId, context);
    const where: Prisma.SupportConversationWhereInput = {
      AND: [
        { OR: scope },
        {
          state:
            query.state === "ACTIVE" ? { in: ["QUEUED", "HUMAN_ACTIVE"] } : query.state,
        },
        ...(after
          ? [
              {
                OR: [
                  { createdAt: { gt: new Date(after.createdAt!) } },
                  { createdAt: new Date(after.createdAt!), id: { gt: after.id } },
                ],
              },
            ]
          : []),
      ],
    };
    const rows = await tx.supportConversation.findMany({
      where,
      take: query.limit + 1,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const current: SupportConversation[] = [];
    for (const row of rows.slice(0, query.limit)) {
      try {
        await authorizedSupportChannel(tx, access, row.id);
      } catch (error) {
        if (error instanceof AppError && [404, 409].includes(error.statusCode)) continue;
        throw error;
      }
      const reconciled = await reconcileSupportChannel(tx, row, context);
      if (
        query.state === "ACTIVE"
          ? reconciled.state !== "ENDED"
          : reconciled.state === query.state
      )
        current.push(reconciled);
    }
    // One eligibility/capacity read per branch/kind rather than one per queued row.
    const eligible = new Map<string, boolean>(),
      items = [];
    for (const row of current) {
      const kind = kindFor(row),
        key = `${row.branchId}:${kind}`;
      if (row.state === "QUEUED" && !eligible.has(key))
        eligible.set(
          key,
          !!(await supportLiveAgent(tx, {
            userId: actor.userId,
            sessionId: actor.sessionId,
            branchId: row.branchId,
            kind,
            requireCapacity: true,
          })),
        );
      items.push(await projectSupportChannel(tx, access, row, eligible.get(key)));
    }
    const last = rows.slice(0, query.limit).at(-1);
    return supportChannelQueuePageSchema.parse({
      items,
      pollAfterMs: 5000,
      ...(rows.length > query.limit && last
        ? {
            nextCursor: encodeSupportChannelCursor(binding, {
              id: last.id,
              createdAt: last.createdAt.toISOString(),
            }),
          }
        : {}),
    });
  });
}

export function supportChannelCandidates(
  actor: AuthenticatedActor,
  id: string,
  raw: z.infer<typeof supportChannelCandidatesSchema>,
) {
  const query = supportChannelCandidatesSchema.parse(raw);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentSupportChannelAccess(tx, actor),
      value = await authorizedSupportChannel(tx, access, id);
    if (!mayAssignSupportChannel(access, value.channel) || !access.workforce)
      workforceDenied();
    const binding = supportChannelBinding([
      "candidates",
      actor.userId,
      actor.sessionId,
      actor.role,
      access.workforce.accessRevision,
      id,
      value.channel.version,
    ]);
    const after = query.cursor ? decodeSupportChannelCursor(binding, query.cursor) : null;
    if (after?.createdAt)
      throw new AppError({
        code: "VALIDATION_FAILED",
        statusCode: 422,
        message: "Invalid candidate position",
      });
    const rows = await tx.staffProfile.findMany({
      where: {
        ...(after ? { id: { gt: after.id } } : {}),
        user: {
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
          role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
          supportLivePresence: {
            is: {
              branchId: value.channel.branchId,
              available: true,
              expiresAt: { gt: new Date() },
            },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userId: true,
        user: { select: { supportLivePresence: { select: { sessionId: true } } } },
      },
      take: 51,
      orderBy: { id: "asc" },
    });
    const items = [];
    let consumed = 0;
    for (const row of rows.slice(0, 50)) {
      consumed++;
      const sessionId = row.user.supportLivePresence?.sessionId;
      if (
        row.userId !== value.channel.assignedUserId &&
        sessionId &&
        (await supportLiveAgent(tx, {
          userId: row.userId,
          sessionId,
          branchId: value.channel.branchId,
          kind: value.target.kind,
          requireCapacity: true,
        }))
      )
        items.push({ staffId: row.id, name: `${row.firstName} ${row.lastName}`.trim() });
      if (items.length === query.limit) break;
    }
    const last = rows[consumed - 1];
    return supportChannelCandidatesPageSchema.parse({
      items,
      ...(rows.length > consumed && last
        ? {
            nextCursor: encodeSupportChannelCursor(binding, {
              id: last.id,
              createdAt: null,
            }),
          }
        : {}),
    });
  });
}

type ChannelAccess = Awaited<ReturnType<typeof currentSupportChannelAccess>>;
type Operation = z.infer<typeof supportChannelOperationSchema>;
function requireOperationAccess(
  access: ChannelAccess,
  action: Operation["action"],
  kind: "ENQUIRY" | "COMPLAINT",
  branchId: string,
) {
  const live =
    access.workforce &&
    careBranchesFor(access.workforce, kind, "live").includes(branchId);
  const assign =
    access.workforce &&
    careBranchesFor(access.workforce, kind, "assign").includes(branchId);
  if (action === "request" && !access.customerId) workforceDenied();
  if (action === "claim" && !live) workforceDenied();
  if (action === "transfer" && !assign) workforceDenied();
  if (action === "end" && !access.customerId && !live && !assign) workforceDenied();
}
function receiptReaders(
  tx: Prisma.TransactionClient,
  access: ChannelAccess,
  operation: Operation,
  context: RequestSecurityContext,
  expectedTarget?: z.infer<typeof supportChannelTargetSchema>,
) {
  const matches = (target: z.infer<typeof supportChannelTargetSchema>) => {
    if (
      expectedTarget &&
      (expectedTarget.id !== target.id || expectedTarget.kind !== target.kind)
    )
      throw new AppError({
        code: "IDEMPOTENCY_CONFLICT",
        statusCode: 409,
        message: "This operation belongs to a different case.",
      });
  };
  return {
    saved: async (id: string) => {
      const value = await authorizedSupportChannel(tx, access, id);
      requireOperationAccess(
        access,
        operation.action,
        value.target.kind,
        value.channel.branchId,
      );
      matches(value.target);
      return projectSupportChannel(
        tx,
        access,
        await reconcileSupportChannel(tx, value.channel, context),
      );
    },
    cancelled: async (target: z.infer<typeof supportChannelTargetSchema>) => {
      const canonical = await supportChannelCase(tx, target);
      assertSupportChannelCaseAccess(access, target, canonical);
      requireOperationAccess(access, operation.action, target.kind, canonical.branchId);
      matches(target);
    },
  };
}
export function recoverSupportChannelOperation(
  actor: AuthenticatedActor,
  operation: z.infer<typeof supportChannelOperationSchema>,
  context: RequestSecurityContext,
) {
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentSupportChannelAccess(tx, actor);
    const readers = receiptReaders(tx, access, operation, context);
    return readSupportChannelReceipt(
      tx,
      actor.userId,
      operation.action,
      operation.operationKey,
      readers.saved,
      readers.cancelled,
    );
  });
}

export function cancelSupportChannelOperation(
  actor: AuthenticatedActor,
  operation: Operation,
  raw: z.infer<typeof supportChannelCancelSchema>,
  context: RequestSecurityContext,
) {
  const { target } = supportChannelCancelSchema.parse(raw);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await currentSupportChannelAccess(tx, actor),
      canonical = await supportChannelCase(tx, target);
    assertSupportChannelCaseAccess(access, target, canonical);
    requireOperationAccess(access, operation.action, target.kind, canonical.branchId);
    const readers = receiptReaders(tx, access, operation, context, target);
    return cancelSupportChannelReceipt(
      tx,
      actor.userId,
      operation.action,
      operation.operationKey,
      target,
      readers.saved,
      readers.cancelled,
    );
  });
}
