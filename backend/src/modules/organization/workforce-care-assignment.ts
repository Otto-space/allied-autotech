import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import {
  assignmentAllows,
  supportedAssignmentPolicies,
  type WorkforceAction,
} from "./workforce-catalogue.js";
import { complaintScope, type WorkforceCareKind } from "./workforce-care-scope.js";
import { enquiryScope } from "./workforce-enquiry-scope.js";
import {
  workforceSnapshot,
  workforceConflict,
  workforceDenied,
  workforceNotFound,
  type WorkforceSnapshot,
} from "./workforce.policy.js";

const select = {
  id: true,
  branchId: true,
  version: true,
  status: true,
  assignedStaffId: true,
} as const;
async function recordFor(
  tx: Prisma.TransactionClient,
  access: WorkforceSnapshot,
  kind: WorkforceCareKind,
  id: string,
) {
  if (kind === "ENQUIRY") {
    const row = await tx.enquiry.findFirst({
      where: { AND: [{ id }, enquiryScope(access, "assign")] },
      select: { ...select, type: true },
    });
    if (!row?.branchId) workforceNotFound();
    return { ...row, branchId: row.branchId };
  }
  const row = await tx.complaint.findFirst({
    where: { AND: [{ id }, complaintScope(access, "assign")] },
    select,
  });
  if (!row?.branchId) workforceNotFound();
  return { ...row, branchId: row.branchId, type: null };
}
async function lockRecord(
  tx: Prisma.TransactionClient,
  kind: WorkforceCareKind,
  id: string,
  write: boolean,
) {
  if (kind === "ENQUIRY") {
    if (write)
      await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${id}::uuid FOR UPDATE`;
    else await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id"=${id}::uuid FOR SHARE`;
  } else {
    if (write)
      await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id"=${id}::uuid FOR UPDATE`;
    else
      await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id"=${id}::uuid FOR SHARE`;
  }
}
function eligibleHandler(
  kind: WorkforceCareKind,
  row: Awaited<ReturnType<typeof recordFor>>,
): Prisma.StaffProfileWhereInput {
  const now = new Date();
  const active = (action: WorkforceAction): Prisma.WorkforceAssignmentWhereInput => ({
    branchId: row.branchId,
    branch: { isActive: true },
    revokedAt: null,
    startsAt: { lte: now },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      {
        OR: supportedAssignmentPolicies().filter((pair) =>
          assignmentAllows(pair, action),
        ),
      },
    ],
  });
  const some = (action: WorkforceAction): Prisma.WorkforceAccessWhereInput => ({
    assignments: { some: active(action) },
  });
  return {
    user: {
      role: { in: ["STAFF", "ADMIN"] },
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
      workforceAccess: {
        is: {
          OR: [
            some(kind === "ENQUIRY" ? "CUSTOMER_ENQUIRIES" : "COMPLAINTS"),
            { AND: [some("CARE_CASE_VIEW"), some("CARE_PUBLIC_REPLY")] },
            // Assigned Sales scope is evaluated for the proposed assignment. Requiring
            // the cashier to own this record already would make assignment impossible.
            ...(kind === "ENQUIRY" &&
            row.type &&
            ["PRODUCT", "VEHICLE"].includes(row.type)
              ? [some("SALES_ENQUIRIES")]
              : []),
          ],
        },
      },
    },
  };
}

export async function workforceCareAssignees(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  access: WorkforceSnapshot,
  kind: WorkforceCareKind,
  id: string,
  context: RequestSecurityContext,
  query?: {
    limit?: number | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
  },
) {
  await recordFor(tx, access, kind, id);
  await lockRecord(tx, kind, id, false);
  const current = await workforceSnapshot(tx, actor),
    row = await recordFor(tx, current, kind, id);
  const paginated = !!query && Object.keys(query).length > 0,
    limit = query?.limit ?? 25;
  const where: Prisma.StaffProfileWhereInput = {
    AND: [
      eligibleHandler(kind, row),
      ...(query?.q
        ?.split(/\s+/)
        .filter(Boolean)
        .map((term) => {
          const text = {
            contains: term.replace(/[\\%_]/g, "\\$&"),
            mode: "insensitive" as const,
          };
          return { OR: [{ firstName: text }, { lastName: text }] };
        }) ?? []),
    ],
  };
  if (
    query?.cursor &&
    !(await tx.staffProfile.findFirst({
      where: { AND: [where, { id: query.cursor }] },
      select: { id: true },
    }))
  )
    workforceNotFound();
  const rows = await tx.staffProfile.findMany({
    where: { AND: [where, ...(query?.cursor ? [{ id: { gt: query.cursor } }] : [])] },
    select: { id: true, firstName: true, lastName: true },
    take: paginated ? limit + 1 : 100,
    orderBy: paginated ? [{ id: "asc" }] : [{ firstName: "asc" }, { id: "asc" }],
  });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "READ",
    entityType: kind,
    entityId: id,
    newValues: {
      workforceAction: `${kind}_ASSIGNEES`,
      resultCount: Math.min(rows.length, paginated ? limit : 100),
    },
    context,
  });
  const finalAccess = await workforceSnapshot(tx, actor);
  await recordFor(tx, finalAccess, kind, id);
  const currentOptions = await tx.staffProfile.count({
    where: { AND: [{ id: { in: rows.map((r) => r.id) } }, eligibleHandler(kind, row)] },
  });
  if (currentOptions !== rows.length) workforceConflict();
  const items = rows.slice(0, paginated ? limit : 100);
  return paginated
    ? {
        items,
        ...(rows.length > limit ? { nextCursor: items.at(-1)!.id } : {}),
        access: finalAccess,
        generatedAt: new Date().toISOString(),
        branchId: row.branchId,
        ...(kind === "ENQUIRY"
          ? { enquiryId: id, enquiryVersion: row.version }
          : { complaintId: id, complaintVersion: row.version }),
      }
    : { items };
}

export async function assignWorkforceCareCase(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  access: WorkforceSnapshot,
  kind: WorkforceCareKind,
  id: string,
  input: { expectedVersion: number; staffId: string; reason: string },
  context: RequestSecurityContext,
) {
  await recordFor(tx, access, kind, id);
  await lockRecord(tx, kind, id, true);
  const current = await workforceSnapshot(tx, actor),
    row = await recordFor(tx, current, kind, id);
  if (
    row.version !== input.expectedVersion ||
    ["RESOLVED", "CLOSED"].includes(row.status)
  )
    workforceConflict();
  if (
    !(await tx.staffProfile.findFirst({
      where: {
        id: input.staffId,
        user: {
          role: { in: ["STAFF", "ADMIN"] },
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
        },
      },
      select: { id: true },
    }))
  )
    workforceNotFound();
  if (
    !(await tx.staffProfile.findFirst({
      where: { AND: [{ id: input.staffId }, eligibleHandler(kind, row)] },
      select: { id: true },
    }))
  )
    workforceDenied();
  const change = {
    where: { id, version: input.expectedVersion },
    data: { assignedStaffId: input.staffId, version: { increment: 1 } },
  };
  const updated =
    kind === "ENQUIRY"
      ? await tx.enquiry.updateMany(change)
      : await tx.complaint.updateMany(change);
  if (updated.count !== 1) workforceConflict();
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "UPDATE",
    entityType: kind,
    entityId: id,
    newValues: {
      workforceAction: `${kind}_ASSIGNED`,
      staffId: input.staffId,
      previousStaffId: row.assignedStaffId,
      reason: input.reason,
    },
    context,
  });
  if (row.assignedStaffId !== input.staffId)
    await notifySupportTeam(tx, {
      kind,
      id,
      event: `${kind === "ENQUIRY" ? "assigned" : "complaint-assigned"}:${id}:${input.expectedVersion + 1}`,
      title: "Support conversation assigned to you",
      actorUserId: actor.userId,
      assignedOnly: true,
    });
  const finalAccess = await workforceSnapshot(tx, actor);
  await recordFor(tx, finalAccess, kind, id);
  if (
    !(await tx.staffProfile.findFirst({
      where: { AND: [{ id: input.staffId }, eligibleHandler(kind, row)] },
      select: { id: true },
    }))
  )
    workforceDenied();
  return {
    id,
    version: input.expectedVersion + 1,
    branchId: row.branchId,
    action: "assignment" as const,
    actorUserId: actor.userId,
    access: finalAccess,
    generatedAt: new Date().toISOString(),
    assignmentReceipt: {
      staffId: input.staffId,
      previousStaffId: row.assignedStaffId,
      reason: input.reason,
    },
  };
}
