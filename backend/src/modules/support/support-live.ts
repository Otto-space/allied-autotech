import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { learningAccessInTransaction } from "../learning/learning.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import {
  careBranchesFor,
  type WorkforceCareKind,
} from "../organization/workforce-care-scope.js";
import {
  workforceConflict,
  workforceDenied,
  workforceNotFound,
  workforceSnapshot,
  type WorkforceSnapshot,
} from "../organization/workforce.policy.js";
import { assertSupportCustomer, assertSupportOperator } from "./support.policy.js";
import {
  supportCoverageOutcome,
  supportCoverageReceipt,
} from "./support-coverage-receipt.js";
import {
  supportCoverageOpen,
  supportCoverageScheduleSchema,
  supportCoverageSchema,
  supportCoverageUpdateSchema,
  supportLiveAvailabilitySchema,
  supportPresenceSchema,
  supportPresenceUpdateSchema,
} from "./support-live.schemas.js";

type Tx = Prisma.TransactionClient;
export const supportPresenceLeaseMs = 90_000;
const kinds = ["ENQUIRY", "COMPLAINT"] as const;
const unavailable = () =>
  new AppError({
    code: "SUPPORT_LIVE_UNAVAILABLE",
    statusCode: 503,
    message:
      "Live support is unavailable. Use the existing queued Customer Care messages.",
  });
const enabled = () => {
  if (!env.SUPPORT_LIVE_CHAT_ENABLED) throw unavailable();
};

function branches(access: WorkforceSnapshot) {
  const ids = [
    ...new Set(kinds.flatMap((kind) => careBranchesFor(access, kind, "live"))),
  ];
  return ids.map((branchId) => ({
    branchId,
    kinds: kinds.filter((kind) =>
      careBranchesFor(access, kind, "live").includes(branchId),
    ),
  }));
}
async function activeBranch(tx: Tx, branchId: string) {
  if (
    !(await tx.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true },
    }))
  )
    workforceNotFound();
}
async function coverage(tx: Tx, branchId: string) {
  const row = await tx.supportLiveCoverage.findUnique({ where: { branchId } });
  return supportCoverageSchema.parse(
    row
      ? {
          branchId,
          enabled: row.enabled,
          schedule: row.schedule,
          maxConcurrentPerAgent: row.maxConcurrentPerAgent,
          version: row.version,
        }
      : {
          branchId,
          enabled: false,
          schedule: { timezone: "Africa/Lagos", windows: [] },
          maxConcurrentPerAgent: 1,
          version: 0,
        },
  );
}
async function openCoverage(tx: Tx, branchId: string) {
  enabled();
  await activeBranch(tx, branchId);
  const row = await coverage(tx, branchId);
  if (!row.enabled || !supportCoverageOpen(row.schedule, new Date())) throw unavailable();
  return row;
}
async function operator(tx: Tx, actor: AuthenticatedActor) {
  assertSupportOperator(actor);
  // The same lock order as workforce changes prevents a duty change racing opt-in.
  await lockAccessActor(tx, actor);
  return workforceSnapshot(tx, actor);
}
async function candidateAccess(tx: Tx, actor: AuthenticatedActor) {
  try {
    return await workforceSnapshot(tx, actor);
  } catch (error) {
    // An agent may lose account access after the coarse presence read. That must
    // remove their availability, not fail the unrelated customer's session.
    if (error instanceof AppError && error.statusCode === 403) return null;
    throw error;
  }
}
async function owner(tx: Tx, actor: AuthenticatedActor) {
  if (actor.role !== "SUPER_ADMIN") workforceDenied();
  await operator(tx, actor);
}
async function leaseEnd(tx: Tx, actor: AuthenticatedActor) {
  const session = await tx.session.findUniqueOrThrow({
    where: { id: actor.sessionId },
    select: { expiresAt: true, idleExpiresAt: true },
  });
  return new Date(
    Math.min(
      Date.now() + supportPresenceLeaseMs,
      session.expiresAt.getTime(),
      session.idleExpiresAt.getTime(),
    ),
  );
}
async function presenceView(
  tx: Tx,
  actor: AuthenticatedActor,
  access: WorkforceSnapshot,
) {
  const row = await tx.supportLivePresence.findUnique({
    where: { userId: actor.userId },
  });
  return supportPresenceSchema.parse({
    enabled: env.SUPPORT_LIVE_CHAT_ENABLED,
    version: row?.version ?? 0,
    branchId: row?.branchId ?? null,
    optedIn:
      !!row?.available && row.sessionId === actor.sessionId && row.expiresAt > new Date(),
    expiresAt: row?.expiresAt.toISOString() ?? null,
    capacity: row?.capacity ?? 1,
    eligibleBranches: branches(access),
  });
}

export function getSupportCoverage(actor: AuthenticatedActor, branchId: string) {
  return withTransactionRetry(prisma, async (tx) => {
    await owner(tx, actor);
    await activeBranch(tx, branchId);
    return coverage(tx, branchId);
  });
}
export function updateSupportCoverage(
  actor: AuthenticatedActor,
  branchId: string,
  input: z.infer<typeof supportCoverageUpdateSchema>,
  context: RequestSecurityContext,
  operationKey?: string,
) {
  const value = supportCoverageUpdateSchema.parse(input);
  return withTransactionRetry(prisma, async (tx) => {
    await owner(tx, actor);
    await activeBranch(tx, branchId);
    if (operationKey)
      return supportCoverageReceipt(
        tx,
        actor.userId,
        branchId,
        operationKey,
        value,
        (command) => saveCoverage(tx, actor, branchId, command, context),
        () => coverage(tx, branchId),
      );
    return saveCoverage(tx, actor, branchId, value, context);
  });
}
async function saveCoverage(
  tx: Tx,
  actor: AuthenticatedActor,
  branchId: string,
  value: z.infer<typeof supportCoverageUpdateSchema>,
  context: RequestSecurityContext,
) {
  const previous = await coverage(tx, branchId);
  if (previous.version !== value.expectedVersion) workforceConflict();
  const data = {
    enabled: value.enabled,
    schedule: value.schedule,
    maxConcurrentPerAgent: value.maxConcurrentPerAgent,
    version: previous.version + 1,
    updatedByUserId: actor.userId,
  };
  await tx.supportLiveCoverage.upsert({
    where: { branchId },
    create: { branchId, ...data },
    update: data,
  });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "UPDATE",
    entityType: "BRANCH",
    entityId: branchId,
    oldValues: { ...previous, schedule: JSON.stringify(previous.schedule) },
    newValues: {
      resource: "SUPPORT_LIVE_COVERAGE",
      ...data,
      schedule: JSON.stringify(data.schedule),
      reason: value.reason,
    },
    context,
  });
  return coverage(tx, branchId);
}
export function recoverSupportCoverage(
  actor: AuthenticatedActor,
  branchId: string,
  key: string,
  cancel = false,
) {
  return withTransactionRetry(prisma, async (tx) => {
    await owner(tx, actor);
    await activeBranch(tx, branchId);
    return supportCoverageOutcome(tx, actor.userId, branchId, key, cancel, () =>
      coverage(tx, branchId),
    );
  });
}
export function getSupportPresence(actor: AuthenticatedActor) {
  return withTransactionRetry(prisma, async (tx) =>
    presenceView(tx, actor, await operator(tx, actor)),
  );
}
export function updateSupportPresence(
  actor: AuthenticatedActor,
  input: z.infer<typeof supportPresenceUpdateSchema>,
  context: RequestSecurityContext,
) {
  const value = supportPresenceUpdateSchema.parse(input);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await operator(tx, actor);
    const previous = await tx.supportLivePresence.findUnique({
      where: { userId: actor.userId },
    });
    if ((previous?.version ?? 0) !== value.expectedVersion) workforceConflict();
    if (value.available) {
      if (!branches(access).some((row) => row.branchId === value.branchId))
        workforceDenied();
      const current = await openCoverage(tx, value.branchId);
      if (value.capacity > current.maxConcurrentPerAgent)
        workforceConflict("Capacity exceeds current support coverage.");
    } else {
      // Withdrawal remains possible after responsibility/coverage removal. It cannot switch branches.
      if (!previous) return presenceView(tx, actor, access);
      if (value.branchId !== previous.branchId) workforceConflict();
    }
    const data = {
      sessionId: actor.sessionId,
      branchId: value.branchId,
      available: value.available,
      capacity: value.capacity,
      version: (previous?.version ?? 0) + 1,
      expiresAt: value.available ? await leaseEnd(tx, actor) : new Date(),
    };
    await tx.supportLivePresence.upsert({
      where: { userId: actor.userId },
      create: { userId: actor.userId, ...data },
      update: data,
    });
    await appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "UPDATE",
      entityType: "USER",
      entityId: actor.userId,
      newValues: {
        resource: "SUPPORT_LIVE_PRESENCE",
        branchId: value.branchId,
        available: value.available,
        capacity: value.capacity,
        version: data.version,
      },
      context,
    });
    return presenceView(tx, actor, access);
  });
}
export function heartbeatSupportPresence(
  actor: AuthenticatedActor,
  expectedVersion: number,
) {
  return withTransactionRetry(prisma, async (tx) => {
    const access = await operator(tx, actor);
    const row = await tx.supportLivePresence.findUnique({
      where: { userId: actor.userId },
    });
    if (
      !row ||
      row.version !== expectedVersion ||
      row.sessionId !== actor.sessionId ||
      !row.available ||
      row.expiresAt <= new Date()
    )
      workforceConflict("Availability expired or changed. Review and opt in again.");
    const current = await openCoverage(tx, row.branchId);
    if (!branches(access).some((b) => b.branchId === row.branchId)) workforceDenied();
    if (row.capacity > current.maxConcurrentPerAgent)
      workforceConflict("Coverage capacity changed. Review availability again.");
    // No revision increment: concurrent tabs may renew the same lease, never multiply seats.
    await tx.supportLivePresence.update({
      where: { userId: actor.userId },
      data: { expiresAt: await leaseEnd(tx, actor) },
    });
    return presenceView(tx, actor, access);
  });
}

/** Eligibility only. This foundation deliberately leaves the customer on queued Care
 * until the separately verified channel lifecycle and transport have been delivered. */
export function customerSupportAvailability(
  actor: AuthenticatedActor,
  branchId: string,
  kind: WorkforceCareKind,
) {
  assertSupportCustomer(actor);
  return withTransactionRetry(prisma, async (tx) => {
    const access = await learningAccessInTransaction(tx, actor);
    if (!access.verified) workforceDenied();
    await activeBranch(tx, branchId);
    const result = (state: z.infer<typeof supportLiveAvailabilitySchema>["state"]) =>
      supportLiveAvailabilitySchema.parse({
        branchId,
        kind,
        state,
        checkedAt: new Date().toISOString(),
        channel: "queued_customer_care",
      });
    if (!env.SUPPORT_LIVE_CHAT_ENABLED) return result("disabled");
    const current = await coverage(tx, branchId);
    if (!current.enabled) return result("unavailable");
    if (
      !supportCoverageOpen(
        supportCoverageScheduleSchema.parse(current.schedule),
        new Date(),
      )
    )
      return result("after_hours");
    // Keyset scan avoids truncating an otherwise eligible agent after stale rows.
    let cursor: string | undefined;
    for (;;) {
      const now = new Date();
      const rows = await tx.supportLivePresence.findMany({
        where: {
          branchId,
          available: true,
          expiresAt: { gt: now },
          ...(cursor ? { userId: { gt: cursor } } : {}),
          user: {
            status: "ACTIVE",
            emailVerifiedAt: { not: null },
            role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
          },
          session: {
            revokedAt: null,
            expiresAt: { gt: now },
            idleExpiresAt: { gt: now },
            mfaVerifiedAt: { not: null },
          },
        },
        select: {
          userId: true,
          sessionId: true,
          capacity: true,
          user: { select: { role: true } },
          session: { select: { userId: true, mfaVerifiedAt: true } },
        },
        take: 50,
        orderBy: { userId: "asc" },
      });
      for (const row of rows) {
        if (row.session.userId !== row.userId) continue;
        const candidate = await candidateAccess(tx, {
          userId: row.userId,
          sessionId: row.sessionId,
          role: row.user.role,
          email: "",
          mfaRequired: true,
          mfaVerifiedAt: row.session.mfaVerifiedAt,
        });
        if (!candidate || !careBranchesFor(candidate, kind, "live").includes(branchId))
          continue;
        const active = await tx.supportConversation.count({
          where: { assignedUserId: row.userId, state: "HUMAN_ACTIVE" },
        });
        if (active < Math.min(row.capacity, current.maxConcurrentPerAgent))
          return result("available");
      }
      if (rows.length < 50) return result("unavailable");
      cursor = rows.at(-1)!.userId;
    }
  });
}

/** Shared transactional policy for channel assignment; no role-name live bypass. */
export async function supportLiveAgent(
  tx: Tx,
  input: {
    userId: string;
    sessionId: string;
    branchId: string;
    kind: WorkforceCareKind;
    requireCapacity?: boolean;
  },
) {
  if (!env.SUPPORT_LIVE_CHAT_ENABLED) return null;
  const now = new Date();
  const presence = await tx.supportLivePresence.findFirst({
    where: {
      userId: input.userId,
      sessionId: input.sessionId,
      branchId: input.branchId,
      available: true,
      expiresAt: { gt: now },
      branch: { isActive: true },
      user: {
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
      },
      session: {
        userId: input.userId,
        revokedAt: null,
        mfaVerifiedAt: { not: null },
        expiresAt: { gt: now },
        idleExpiresAt: { gt: now },
      },
    },
    include: {
      user: { select: { role: true } },
      session: { select: { mfaVerifiedAt: true } },
    },
  });
  if (!presence) return null;
  const current = await coverage(tx, input.branchId);
  if (!current.enabled || !supportCoverageOpen(current.schedule, now)) return null;
  const access = await candidateAccess(tx, {
    userId: input.userId,
    sessionId: input.sessionId,
    role: presence.user.role,
    email: "",
    mfaRequired: true,
    mfaVerifiedAt: presence.session.mfaVerifiedAt,
  });
  if (!access || !careBranchesFor(access, input.kind, "live").includes(input.branchId))
    return null;
  if (input.requireCapacity) {
    const active = await tx.supportConversation.count({
      where: { assignedUserId: input.userId, state: "HUMAN_ACTIVE" },
    });
    if (active >= Math.min(presence.capacity, current.maxConcurrentPerAgent)) return null;
  }
  return { access, sessionId: presence.sessionId };
}
export { operator as supportLiveOperator };
