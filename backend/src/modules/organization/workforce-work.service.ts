import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { cancelPendingReminders } from "../service-operations/service-operations.service.js";
import { lockAccessActor } from "./team-access-security.js";
import { lockWorkforce } from "./workforce-access.service.js";
import {
  bookingScope,
  branchesFor,
  workforceSnapshot,
  workforceConflict,
  workforceDenied,
  workforceNotFound,
  type WorkforceSnapshot,
} from "./workforce.policy.js";
import type {
  workforceListSchema,
  workforceWorkSchema,
  workforceQualitySchema,
  workforceJobAssignmentSchema,
  workforceOrderSchema,
  workforceReplySchema,
  workforceEnquiryAssignmentSchema,
} from "./workforce.schemas.js";

export const jobSelect = {
  id: true,
  branchId: true,
  scheduledAt: true,
  status: true,
  version: true,
  assignedStaffId: true,
  customerNotes: true,
  service: { select: { name: true } },
  vehicle: { select: { make: true, model: true, year: true, registrationNumber: true } },
  workOrder: {
    select: {
      id: true,
      workOrderNumber: true,
      status: true,
      diagnosis: true,
      internalNotes: true,
      version: true,
      workedByUserIds: true,
      qualityApprovedByUserId: true,
      qualityApprovedAt: true,
    },
  },
} satisfies Prisma.BookingSelect;
const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  fulfillmentMethod: true,
  paidAt: true,
  version: true,
  createdAt: true,
  items: { select: { productName: true, quantity: true } },
} satisfies Prisma.OrderSelect;
function page<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  return { items, ...(rows.length > limit ? { nextCursor: items.at(-1)!.id } : {}) };
}
function pagination(query: z.infer<typeof workforceListSchema>) {
  return {
    take: query.limit + 1,
    orderBy: { id: "asc" as const },
    ...(query.cursor ? { where: { id: { gt: query.cursor } } } : {}),
  };
}
function enquiryScope(snapshot: WorkforceSnapshot): Prisma.EnquiryWhereInput {
  const assignments = snapshot.assignments.filter((a) =>
    ["CUSTOMER_SERVICE", "SALES_SUPERVISOR", "SALES_CASHIER"].includes(a.template),
  );
  if (!assignments.length) workforceDenied();
  return {
    OR: assignments.map((a) => ({
      branchId: a.branchId,
      ...(a.template === "CUSTOMER_SERVICE"
        ? {}
        : { type: { in: ["PRODUCT", "VEHICLE"] as ("PRODUCT" | "VEHICLE")[] } }),
      ...(a.scope === "ASSIGNED"
        ? { assignedStaffId: snapshot.staffId ?? "00000000-0000-0000-0000-000000000000" }
        : {}),
    })),
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  context: RequestSecurityContext,
  entityType: "BOOKING" | "WORK_ORDER" | "ORDER" | "ENQUIRY" | "COMPLAINT",
  id: string | null,
  change: Readonly<Record<string, import("../audit/audit.types.js").AuditValue>>,
  read = false,
) {
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: read ? "READ" : "UPDATE",
    entityType,
    entityId: id,
    newValues: change,
    context,
  });
}
export class WorkforceWorkService {
  private run<T>(
    actor: AuthenticatedActor,
    work: (tx: Prisma.TransactionClient, access: WorkforceSnapshot) => Promise<T>,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const snapshot = await workforceSnapshot(tx, actor);
      if (!snapshot.managed)
        workforceDenied(
          "This account has not been enrolled in responsibility-based access",
        );
      return work(tx, snapshot);
    });
  }
  overview(actor: AuthenticatedActor, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      const counts: Record<string, number> = {};
      if (access.permissions.includes("JOBS_READ"))
        counts["jobs"] = await tx.booking.count({
          where: bookingScope(access, "JOBS_READ"),
        });
      if (access.permissions.includes("BOOKINGS_READ"))
        counts["bookings"] = await tx.booking.count({
          where: bookingScope(access, "BOOKINGS_READ"),
        });
      if (
        access.permissions.includes("CUSTOMER_ENQUIRIES") ||
        access.permissions.includes("SALES_ENQUIRIES")
      )
        counts["enquiries"] = await tx.enquiry.count({
          where: {
            AND: [enquiryScope(access), { status: { notIn: ["RESOLVED", "CLOSED"] } }],
          },
        });
      if (access.permissions.includes("COMPLAINTS"))
        counts["complaints"] = await tx.complaint.count({
          where: {
            branchId: { in: branchesFor(access, "COMPLAINTS") },
            status: { notIn: ["RESOLVED", "CLOSED"] },
          },
        });
      if (access.permissions.includes("ORDERS_READ"))
        counts["orders"] = await tx.order.count({
          where: { branchId: { in: branchesFor(access, "ORDERS_READ") } },
        });
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        null,
        { workforceAction: "OVERVIEW", permittedCounters: Object.keys(counts).join(",") },
        true,
      );
      return { counts, generatedAt: new Date().toISOString() };
    });
  }
  jobs(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceListSchema>,
    context: RequestSecurityContext,
    technical = true,
  ) {
    return this.run(actor, async (tx, access) => {
      const scope = bookingScope(access, technical ? "JOBS_READ" : "BOOKINGS_READ");
      const paging = pagination(query);
      const rows = await tx.booking.findMany({
        ...paging,
        where: { AND: [scope, paging.where ?? {}] },
        select: technical
          ? jobSelect
          : {
              id: true,
              scheduledAt: true,
              status: true,
              version: true,
              service: { select: { name: true } },
              customer: { select: { firstName: true, lastName: true, phone: true } },
            },
      });
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        null,
        {
          workforceAction: technical ? "JOBS_LIST" : "BOOKINGS_LIST",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return page(rows, query.limit);
    });
  }
  job(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      const row = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "JOBS_READ")] },
        select: jobSelect,
      });
      if (!row) workforceNotFound();
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        id,
        { workforceAction: "JOB_DETAIL" },
        true,
      );
      return row;
    });
  }
  assignees(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
    kind: "jobs" | "enquiries",
  ) {
    return this.run(actor, async (tx, access) => {
      const branches = branchesFor(
        access,
        kind === "jobs" ? "JOBS_ASSIGN" : "ENQUIRIES_ASSIGN",
      );
      if (!branches.length) workforceDenied();
      const record =
        kind === "jobs"
          ? await tx.booking.findFirst({
              where: { id, branchId: { in: branches } },
              select: { branchId: true },
            })
          : await tx.enquiry.findFirst({
              where: {
                id,
                branchId: { in: branches },
                type: { in: ["PRODUCT", "VEHICLE"] },
              },
              select: { branchId: true },
            });
      if (!record?.branchId) workforceNotFound();
      const now = new Date();
      const pairs =
        kind === "jobs"
          ? [
              { template: "MECHANICAL_TECHNICIAN", scope: "ASSIGNED" },
              { template: "ELECTRICAL_TECHNICIAN", scope: "ASSIGNED" },
              { template: "WORKSHOP_LEAD", scope: "BRANCH" },
            ]
          : [
              { template: "SALES_CASHIER", scope: "ASSIGNED" },
              { template: "SALES_SUPERVISOR", scope: "BRANCH" },
            ];
      const items = await tx.staffProfile.findMany({
        where: {
          user: {
            role: { in: ["STAFF", "ADMIN"] },
            status: "ACTIVE",
            emailVerifiedAt: { not: null },
            workforceAccess: {
              assignments: {
                some: {
                  branchId: record.branchId,
                  branch: { isActive: true },
                  revokedAt: null,
                  startsAt: { lte: now },
                  AND: [
                    { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                    { OR: pairs },
                  ],
                },
              },
            },
          },
        },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { id: "asc" }],
        take: 100,
      });
      await audit(
        tx,
        actor,
        context,
        kind === "jobs" ? "BOOKING" : "ENQUIRY",
        id,
        { workforceAction: "ASSIGNEE_OPTIONS", resultCount: items.length },
        true,
      );
      return { items };
    });
  }
  work(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceWorkSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "JOBS_UPDATE")] },
        select: jobSelect,
      });
      if (!booking?.workOrder) workforceNotFound();
      const work = booking.workOrder;
      if (work.version !== input.expectedVersion) workforceConflict();
      if (
        !["CONFIRMED", "IN_PROGRESS"].includes(booking.status) ||
        !["APPROVED", "IN_PROGRESS", "AWAITING_PARTS"].includes(work.status)
      )
        workforceConflict(
          "This job is not open for technical work. Ask the workshop lead to review it.",
        );
      const transitions: Record<string, readonly string[]> = {
        APPROVED: ["IN_PROGRESS"],
        IN_PROGRESS: ["AWAITING_PARTS", "QUALITY_CHECK"],
        AWAITING_PARTS: ["IN_PROGRESS"],
      };
      if (input.status && !transitions[work.status]?.includes(input.status))
        workforceConflict("The requested work transition is unavailable");
      const now = new Date();
      const updated = await tx.workOrder.updateMany({
        where: { id: work.id, version: input.expectedVersion, status: work.status },
        data: {
          ...(input.diagnosis === undefined ? {} : { diagnosis: input.diagnosis }),
          ...(input.internalNotes === undefined
            ? {}
            : { internalNotes: input.internalNotes }),
          ...(input.status ? { status: input.status } : {}),
          ...(input.status === "IN_PROGRESS" ? { startedAt: now } : {}),
          workedByUserIds: [...new Set([...work.workedByUserIds, actor.userId])],
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) workforceConflict();
      if (input.status === "IN_PROGRESS" && booking.status === "CONFIRMED")
        await tx.booking.update({
          where: { id },
          data: { status: "IN_PROGRESS", startedAt: now, version: { increment: 1 } },
        });
      await audit(tx, actor, context, "WORK_ORDER", work.id, {
        workforceAction: "TECHNICAL_UPDATE",
        status: input.status ?? work.status,
        changedFields: Object.keys(input)
          .filter((k) => k !== "expectedVersion")
          .join(","),
      });
      return tx.booking.findUniqueOrThrow({ where: { id }, select: jobSelect });
    });
  }
  quality(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceQualitySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "QUALITY_APPROVE")] },
        select: jobSelect,
      });
      if (!booking?.workOrder) workforceNotFound();
      const work = booking.workOrder;
      // Unattributed legacy work requires a separately reviewed migration, not guessed authorship.
      if (
        !work.workedByUserIds.length ||
        work.workedByUserIds.includes(actor.userId) ||
        booking.assignedStaffId === access.staffId
      )
        workforceDenied(
          "An independent authorized reviewer is required; self-review is unavailable",
        );
      if (
        work.version !== input.expectedVersion ||
        work.status !== "QUALITY_CHECK" ||
        booking.status !== "IN_PROGRESS"
      )
        workforceConflict();
      const now = new Date();
      const changed = await tx.workOrder.updateMany({
        where: { id: work.id, version: input.expectedVersion, status: "QUALITY_CHECK" },
        data: {
          status: "COMPLETED",
          qualityApprovedByUserId: actor.userId,
          qualityApprovedAt: now,
          completedAt: now,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) workforceConflict();
      await tx.booking.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: now, version: { increment: 1 } },
      });
      await cancelPendingReminders(tx, id);
      await audit(tx, actor, context, "WORK_ORDER", work.id, {
        workforceAction: "QUALITY_APPROVED",
        reason: input.reason,
      });
      return tx.booking.findUniqueOrThrow({ where: { id }, select: jobSelect });
    });
  }
  assign(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceJobAssignmentSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "JOBS_ASSIGN")] },
        select: jobSelect,
      });
      if (!booking) workforceNotFound();
      if (
        booking.version !== input.expectedVersion ||
        !["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"].includes(
          booking.status,
        )
      )
        workforceConflict();
      const technician = await tx.staffProfile.findFirst({
        where: {
          id: input.staffId,
          user: { status: "ACTIVE", emailVerifiedAt: { not: null } },
        },
        select: { userId: true },
      });
      if (!technician) workforceNotFound();
      const targetUser = await tx.user.findUniqueOrThrow({
        where: { id: technician.userId },
        select: { role: true },
      });
      const technicianAccess = await workforceSnapshot(tx, {
        ...actor,
        userId: technician.userId,
        role: targetUser.role,
      });
      if (
        !booking.branchId ||
        !branchesFor(technicianAccess, "JOBS_UPDATE").includes(booking.branchId)
      )
        workforceDenied("Select an active technician with work access in this branch");
      await tx.booking.update({
        where: { id },
        data: { assignedStaffId: input.staffId, version: { increment: 1 } },
      });
      await audit(tx, actor, context, "BOOKING", id, {
        workforceAction: "JOB_ASSIGNED",
        staffId: input.staffId,
        previousStaffId: booking.assignedStaffId,
        reason: input.reason,
      });
      return tx.booking.findUniqueOrThrow({ where: { id }, select: jobSelect });
    });
  }
  enquiries(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceListSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const paging = pagination(query);
      const rows = await tx.enquiry.findMany({
        ...paging,
        where: { AND: [enquiryScope(access), paging.where ?? {}] },
        select: {
          id: true,
          subject: true,
          message: true,
          type: true,
          status: true,
          version: true,
          assignedStaffId: true,
          createdAt: true,
        },
      });
      await audit(
        tx,
        actor,
        context,
        "ENQUIRY",
        null,
        {
          workforceAction: "ENQUIRIES_LIST",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return page(rows, query.limit);
    });
  }
  complaints(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceListSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("COMPLAINTS")) workforceDenied();
      const paging = pagination(query);
      const rows = await tx.complaint.findMany({
        ...paging,
        where: {
          AND: [
            { branchId: { in: branchesFor(access, "COMPLAINTS") } },
            paging.where ?? {},
          ],
        },
        select: {
          id: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          version: true,
          createdAt: true,
        },
      });
      await audit(
        tx,
        actor,
        context,
        "COMPLAINT",
        null,
        {
          workforceAction: "COMPLAINTS_LIST",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return page(rows, query.limit);
    });
  }
  reply(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceReplySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const row = await tx.enquiry.findFirst({
        where: { AND: [{ id }, enquiryScope(access)] },
        select: { id: true, version: true, status: true },
      });
      if (!row) workforceNotFound();
      if (
        row.version !== input.expectedVersion ||
        ["RESOLVED", "CLOSED"].includes(row.status)
      )
        workforceConflict();
      const updated = await tx.enquiry.updateMany({
        where: { id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) workforceConflict();
      await tx.supportMessage.create({
        data: {
          enquiryId: id,
          authorUserId: actor.userId,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: input.body,
        },
      });
      await audit(tx, actor, context, "ENQUIRY", id, { workforceAction: "REPLY" });
      return { id, version: input.expectedVersion + 1 };
    });
  }
  complaintReply(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceReplySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("COMPLAINTS")) workforceDenied();
      const row = await tx.complaint.findFirst({
        where: { id, branchId: { in: branchesFor(access, "COMPLAINTS") } },
        select: { id: true, version: true, status: true },
      });
      if (!row) workforceNotFound();
      if (
        row.version !== input.expectedVersion ||
        ["RESOLVED", "CLOSED"].includes(row.status)
      )
        workforceConflict();
      const changed = await tx.complaint.updateMany({
        where: { id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) workforceConflict();
      await tx.supportMessage.create({
        data: {
          complaintId: id,
          authorUserId: actor.userId,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: input.body,
        },
      });
      await audit(tx, actor, context, "COMPLAINT", id, { workforceAction: "REPLY" });
      return { id, version: input.expectedVersion + 1 };
    });
  }
  assignEnquiry(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceEnquiryAssignmentSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("ENQUIRIES_ASSIGN")) workforceDenied();
      const row = await tx.enquiry.findFirst({
        where: {
          id,
          branchId: { in: branchesFor(access, "ENQUIRIES_ASSIGN") },
          type: { in: ["PRODUCT", "VEHICLE"] },
        },
        select: {
          id: true,
          branchId: true,
          version: true,
          status: true,
          assignedStaffId: true,
        },
      });
      if (!row) workforceNotFound();
      if (
        row.version !== input.expectedVersion ||
        ["RESOLVED", "CLOSED"].includes(row.status)
      )
        workforceConflict();
      const target = await tx.staffProfile.findFirst({
        where: {
          id: input.staffId,
          user: { status: "ACTIVE", emailVerifiedAt: { not: null } },
        },
        select: { userId: true, user: { select: { role: true } } },
      });
      if (!target) workforceNotFound();
      const targetAccess = await workforceSnapshot(tx, {
        ...actor,
        userId: target.userId,
        role: target.user.role,
      });
      if (
        !row.branchId ||
        !branchesFor(targetAccess, "SALES_ENQUIRIES").includes(row.branchId)
      )
        workforceDenied();
      const changed = await tx.enquiry.updateMany({
        where: { id, version: input.expectedVersion },
        data: { assignedStaffId: input.staffId, version: { increment: 1 } },
      });
      if (changed.count !== 1) workforceConflict();
      await audit(tx, actor, context, "ENQUIRY", id, {
        workforceAction: "ENQUIRY_ASSIGNED",
        staffId: input.staffId,
        previousStaffId: row.assignedStaffId,
        reason: input.reason,
      });
      return { id, version: input.expectedVersion + 1 };
    });
  }
  orders(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceListSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("ORDERS_READ")) workforceDenied();
      const paging = pagination(query);
      const rows = await tx.order.findMany({
        ...paging,
        where: {
          AND: [
            { branchId: { in: branchesFor(access, "ORDERS_READ") } },
            paging.where ?? {},
          ],
        },
        select: orderSelect,
      });
      await audit(
        tx,
        actor,
        context,
        "ORDER",
        null,
        {
          workforceAction: "ORDERS_LIST",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return page(rows, query.limit);
    });
  }
  prepare(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceOrderSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("ORDERS_PREPARE")) workforceDenied();
      const row = await tx.order.findFirst({
        where: { id, branchId: { in: branchesFor(access, "ORDERS_PREPARE") } },
        select: orderSelect,
      });
      if (!row) workforceNotFound();
      const from = input.status === "PROCESSING" ? "CONFIRMED" : "PROCESSING";
      if (
        row.version !== input.expectedVersion ||
        row.status !== from ||
        !row.paidAt ||
        row.fulfillmentMethod !== "COLLECTION"
      )
        workforceConflict(
          "Only paid collection orders in the preceding fulfillment state can advance",
        );
      const changed = await tx.order.updateMany({
        where: {
          id,
          version: input.expectedVersion,
          status: from,
          paidAt: { not: null },
        },
        data: {
          status: input.status,
          ...(input.status === "PROCESSING"
            ? { processingAt: new Date() }
            : { readyAt: new Date() }),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) workforceConflict();
      await audit(tx, actor, context, "ORDER", id, {
        workforceAction: "PREPARE_COLLECTION",
        status: input.status,
        reason: input.reason,
      });
      return tx.order.findUniqueOrThrow({ where: { id }, select: orderSelect });
    });
  }
  finance(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceListSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("FINANCE_READ")) workforceDenied();
      const branchIds = branchesFor(access, "FINANCE_READ"),
        paging = pagination(query);
      const rows = await tx.payment.findMany({
        ...paging,
        where: {
          AND: [
            {
              OR: [
                { order: { branchId: { in: branchIds } } },
                { booking: { branchId: { in: branchIds } } },
                {
                  invoice: {
                    OR: [
                      { order: { branchId: { in: branchIds } } },
                      { booking: { branchId: { in: branchIds } } },
                    ],
                  },
                },
              ],
            },
            paging.where ?? {},
          ],
        },
        select: {
          id: true,
          paymentNumber: true,
          amountKobo: true,
          currency: true,
          status: true,
          createdAt: true,
          succeededAt: true,
        },
      });
      await audit(
        tx,
        actor,
        context,
        "ORDER",
        null,
        {
          workforceAction: "FINANCE_READ",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return page(
        rows.map((r) => ({ ...r, amountKobo: r.amountKobo.toString() })),
        query.limit,
      );
    });
  }
}
