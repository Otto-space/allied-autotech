import { ServiceOperationsRepository } from "../service-operations/service-operations.repository.js";
import {
  workforceCareContactSelect,
  projectWorkforceCareContact,
  projectWorkforceEnquiryContact,
} from "./workforce-care-contact.js";
import { enquiryScope } from "./workforce-enquiry-scope.js";
import { careBranchesFor, complaintScope } from "./workforce-care-scope.js";
import type { WorkforceCareKind } from "./workforce-care-scope.js";
import {
  assignWorkforceCareCase,
  workforceCareAssignees,
} from "./workforce-care-assignment.js";
import {
  enqueueSupportCustomerUpdate,
  dismissSupportDeliveryNotices,
  supportEmailDeliveries,
} from "../support/customer-email.js";
import type { z } from "zod";
import { enqueueNotification } from "../notifications/notifications.service.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { cancelPendingReminders } from "../service-operations/service-operations.service.js";
import { lockAccessActor } from "./team-access-security.js";
import { lockWorkforce } from "./workforce-access.service.js";
import { assignmentAllows, supportedAssignmentPolicies } from "./workforce-catalogue.js";
import {
  bookingScope,
  branchesFor,
  workforceSnapshot,
  workforceConflict,
  workforceDenied,
  workforceNotFound,
  type WorkforceSnapshot,
} from "./workforce.policy.js";
import {
  enquirySearchFilters,
  latestEnquiryMessage,
  readWorkforceEnquiry,
  workforceEnquirySelect,
} from "./workforce-enquiry-workspace.js";
import {
  complaintSearchFilters,
  latestComplaintMessage,
  readWorkforceComplaint,
  workforceComplaintSelect,
} from "./workforce-complaint-workspace.js";
import type {
  workforceOrdersQuerySchema,
  workforceFinanceQuerySchema,
  workforceListSchema,
  workforceMessageQuerySchema,
  workforceJobsQuerySchema,
  workforceBookingsQuerySchema,
  workforceEnquiriesQuerySchema,
  workforceEnquiryReplySchema,
  workforceJobAssigneesQuerySchema,
  workforceWorkSchema,
  workforceQualitySchema,
  workforceJobAssignmentSchema,
  workforceOrderSchema,
  workforceComplaintsQuerySchema,
  workforceComplaintReplySchema,
  workforceEnquiryAssignmentSchema,
} from "./workforce.schemas.js";
import {
  workforceOrderSelect as orderSelect,
  orderSearchFilters,
  orderNextStates,
  readWorkforceOrder,
} from "./workforce-order-workspace.js";

import {
  financeScope,
  financeSearchFilters,
  workforceFinanceSelect,
  workforceFinanceDetailSelect,
  projectWorkforcePayment,
} from "./workforce-finance-workspace.js";

export const jobSelect = {
  id: true,
  branchId: true,
  scheduledAt: true,
  status: true,
  version: true,
  assignedStaffId: true,
  customerNotes: true,
  customerConcern: true,
  service: { select: { id: true, name: true } },
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
const jobDetailSelect = {
  ...jobSelect,
  branch: { select: { id: true, name: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BookingSelect;
async function changedJob(
  tx: Prisma.TransactionClient,
  access: WorkforceSnapshot,
  id: string,
) {
  const row = await tx.booking.findUniqueOrThrow({
    where: { id },
    select: jobDetailSelect,
  });
  return { ...row, access, generatedAt: new Date().toISOString() };
}
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

async function audit(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  context: RequestSecurityContext,
  entityType: "BOOKING" | "WORK_ORDER" | "ORDER" | "ENQUIRY" | "COMPLAINT" | "PAYMENT",
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
        access.permissions.includes("CARE_CASE_VIEW") ||
        access.permissions.includes("SALES_ENQUIRIES")
      )
        counts["enquiries"] = await tx.enquiry.count({
          where: {
            AND: [enquiryScope(access), { status: { notIn: ["RESOLVED", "CLOSED"] } }],
          },
        });
      if (careBranchesFor(access, "COMPLAINT").length)
        counts["complaints"] = await tx.complaint.count({
          where: {
            ...complaintScope(access),
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
      const branches = await tx.branch.findMany({
        where: { id: { in: [...new Set(access.assignments.map((a) => a.branchId))] } },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return { counts, generatedAt: new Date().toISOString(), access, branches };
    });
  }
  jobs(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceJobsQuerySchema>,
    context: RequestSecurityContext,
    technical = true,
  ) {
    return this.run(actor, async (tx, access) => {
      const scope = bookingScope(access, technical ? "JOBS_READ" : "BOOKINGS_READ");
      const paging = pagination(query);
      const filters: Prisma.BookingWhereInput[] = [];
      if (technical && query.q) {
        const contains = query.q.replace(/[\\%_]/g, "\\$&");
        const text = { contains, mode: "insensitive" as const };
        filters.push({
          OR: [
            { service: { name: text } },
            { customerConcern: text },
            { workOrder: { is: { workOrderNumber: text } } },
            {
              vehicle: {
                is: {
                  OR: [{ make: text }, { model: text }, { registrationNumber: text }],
                },
              },
            },
          ],
        });
      }
      if (technical && query.workStatus)
        filters.push({
          workOrder:
            query.workStatus === "NOT_CREATED"
              ? { is: null }
              : { is: { status: query.workStatus } },
        });
      const rows = await tx.booking.findMany({
        ...paging,
        where: { AND: [scope, paging.where ?? {}, ...filters] },
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
      const result = page(rows, query.limit);
      return technical
        ? { ...result, generatedAt: new Date().toISOString(), access }
        : result;
    });
  }
  bookings(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceBookingsQuerySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const scope = bookingScope(access, "BOOKINGS_READ"),
        paging = pagination(query);
      const filters: Prisma.BookingWhereInput[] = [];
      for (const term of query.q?.split(/\s+/).filter(Boolean) ?? []) {
        const text = {
          contains: term.replace(/[\\%_]/g, "\\$&"),
          mode: "insensitive" as const,
        };
        filters.push({
          OR: [
            { service: { name: text } },
            { customerConcern: text },
            {
              customer: {
                OR: [{ firstName: text }, { lastName: text }, { phone: text }],
              },
            },
            {
              vehicle: {
                is: {
                  OR: [{ make: text }, { model: text }, { registrationNumber: text }],
                },
              },
            },
          ],
        });
      }
      if (query.status) filters.push({ status: query.status });
      const rows = await tx.booking.findMany({
        ...paging,
        where: { AND: [scope, paging.where ?? {}, ...filters] },
        select: {
          id: true,
          branchId: true,
          scheduledAt: true,
          status: true,
          version: true,
          service: { select: { name: true } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
          branch: { select: { id: true, name: true } },
          vehicle: {
            select: { make: true, model: true, year: true, registrationNumber: true },
          },
        },
      });
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        null,
        {
          workforceAction: "BOOKINGS_LIST",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return {
        ...page(rows, query.limit),
        access,
        generatedAt: new Date().toISOString(),
      };
    });
  }
  booking(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      const row = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "BOOKINGS_READ")] },
        select: {
          id: true,
          branchId: true,
          scheduledAt: true,
          status: true,
          version: true,
          customerConcern: true,
          alternativeStartsAt: true,
          alternativeReason: true,
          alternativeVersion: true,
          service: { select: { name: true, durationMinutes: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
          confirmedAt: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          branch: { select: { id: true, name: true } },
          vehicle: {
            select: { make: true, model: true, year: true, registrationNumber: true },
          },
        },
      });
      if (!row) workforceNotFound();
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        id,
        { workforceAction: "BOOKING_DETAIL" },
        true,
      );
      return { ...row, access, generatedAt: new Date().toISOString() };
    });
  }
  job(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      const row = await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "JOBS_READ")] },
        select: jobDetailSelect,
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
      return { ...row, access, generatedAt: new Date().toISOString() };
    });
  }
  assignees(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
    kind: "jobs" | "enquiries",
    query?: z.infer<typeof workforceJobAssigneesQuerySchema>,
  ) {
    if (kind === "enquiries")
      return this.careAssignees(actor, id, context, "ENQUIRY", query);
    return this.run(actor, async (tx, access) => {
      const branches = branchesFor(access, "JOBS_ASSIGN");
      if (!branches.length) workforceDenied();
      const record = await tx.booking.findFirst({
        where: { id, branchId: { in: branches } },
        select: { branchId: true, version: true },
      });
      if (!record?.branchId) workforceNotFound();
      const paginated = query && Object.keys(query).length > 0;
      const limit = query?.limit ?? 25;
      const nameTerms = paginated
        ? (query.q ?? "")
            .split(/\s+/)
            .filter(Boolean)
            .map((term) => term.replace(/[\\%_]/g, "\\$&"))
        : [];
      const now = new Date();
      const pairs = supportedAssignmentPolicies().filter((pair) =>
        assignmentAllows(pair, "JOBS_UPDATE"),
      );
      const items = await tx.staffProfile.findMany({
        where: {
          ...(paginated
            ? {
                AND: [
                  ...(query.cursor ? [{ id: { gt: query.cursor } }] : []),
                  ...nameTerms.map((term) => ({
                    OR: [
                      { firstName: { contains: term, mode: "insensitive" as const } },
                      { lastName: { contains: term, mode: "insensitive" as const } },
                    ],
                  })),
                ],
              }
            : {}),
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
        orderBy: paginated ? [{ id: "asc" }] : [{ firstName: "asc" }, { id: "asc" }],
        take: paginated ? limit + 1 : 100,
      });
      await audit(
        tx,
        actor,
        context,
        "BOOKING",
        id,
        {
          workforceAction: "ASSIGNEE_OPTIONS",
          resultCount: paginated ? Math.min(items.length, limit) : items.length,
        },
        true,
      );
      return paginated
        ? {
            ...page(items, limit),
            access,
            generatedAt: new Date().toISOString(),
            jobId: id,
            jobVersion: record.version,
            branchId: record.branchId,
          }
        : { items };
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
      return changedJob(tx, access, id);
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
      return changedJob(tx, access, id);
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
      let classification:
        { serviceId: string; quotedPriceKobo: bigint | null } | undefined;
      let duration: number | undefined;
      if (!booking.service) {
        if (booking.status !== "REQUESTED" || !input.serviceId)
          workforceConflict(
            "Choose a published service before assigning this concern request",
          );
        await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${input.serviceId}::uuid FOR SHARE`;
        const service = await tx.service.findFirst({
          where: { id: input.serviceId, isActive: true, currency: "NGN" },
          select: { id: true, durationMinutes: true, pricingType: true, priceKobo: true },
        });
        if (!service || !service.durationMinutes)
          workforceConflict("Choose a published service with a configured duration");
        duration = service.durationMinutes;
        classification = {
          serviceId: service.id,
          quotedPriceKobo: service.pricingType === "FIXED" ? service.priceKobo : null,
        };
      } else if (input.serviceId && input.serviceId !== booking.service.id) {
        workforceConflict("The service cannot be changed during technician assignment");
      }
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
      if (duration !== undefined) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${input.staffId}`}, 0))`;
        if (
          await new ServiceOperationsRepository().hasScheduleConflict(
            input.staffId,
            booking.scheduledAt,
            new Date(booking.scheduledAt.getTime() + duration * 60000),
            id,
            tx,
          )
        )
          workforceConflict("This technician has another appointment at that time");
      }
      const current = await workforceSnapshot(tx, actor);
      if (
        !(await tx.booking.findFirst({
          where: { AND: [{ id }, bookingScope(current, "JOBS_ASSIGN")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      const currentTechnician = await workforceSnapshot(tx, {
        ...actor,
        userId: technician.userId,
        role: targetUser.role,
      });
      if (!branchesFor(currentTechnician, "JOBS_UPDATE").includes(booking.branchId))
        workforceDenied();
      await tx.booking.update({
        where: { id },
        data: {
          assignedStaffId: input.staffId,
          ...classification,
          version: { increment: 1 },
        },
      });
      await audit(tx, actor, context, "BOOKING", id, {
        workforceAction: "JOB_ASSIGNED",
        staffId: input.staffId,
        previousStaffId: booking.assignedStaffId,
        ...(classification ? { serviceId: classification.serviceId } : {}),
        reason: input.reason,
      });
      if (technician.userId !== actor.userId && booking.assignedStaffId !== input.staffId)
        await enqueueNotification(tx, {
          userId: technician.userId,
          type: "WORK_ORDER",
          category: "OPERATIONAL",
          title: "Workshop job assigned to you",
          message:
            "A workshop job has been assigned to you. Open the update to review the work.",
          resourceType: "WORKFORCE_JOB",
          resourceId: id,
          deduplicationKey: `job-assigned:${id}:${input.expectedVersion + 1}`,
          channels: [],
        });
      const result = await changedJob(tx, current, id);
      // Responsibility expiry can advance while audit/notification writes await I/O.
      // Recheck both participants before committing the assignment and its receipt.
      const finalAccess = await workforceSnapshot(tx, actor);
      if (
        !(await tx.booking.findFirst({
          where: { AND: [{ id }, bookingScope(finalAccess, "JOBS_ASSIGN")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      const finalTechnician = await workforceSnapshot(tx, {
        ...actor,
        userId: technician.userId,
        role: targetUser.role,
      });
      if (!branchesFor(finalTechnician, "JOBS_UPDATE").includes(booking.branchId))
        workforceDenied();
      return { ...result, access: finalAccess };
    });
  }
  enquiries(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceEnquiriesQuerySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const paging = pagination(query);
      const rows = await tx.enquiry.findMany({
        ...paging,
        where: {
          AND: [
            enquiryScope(access),
            paging.where ?? {},
            ...enquirySearchFilters(query.q),
            ...(query.type ? [{ type: query.type }] : []),
            ...(query.status ? [{ status: query.status }] : []),
          ],
        },
        select: {
          ...workforceEnquirySelect,
          ...(careBranchesFor(access, "ENQUIRY").length
            ? workforceCareContactSelect
            : {}),
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
      const current = await workforceSnapshot(tx, actor);
      const visible = await tx.enquiry.findMany({
        where: {
          AND: [{ id: { in: rows.map((row) => row.id) } }, enquiryScope(current)],
        },
        select: { id: true },
      });
      // Do not return a partially authorised page or a misleading next cursor
      // when a responsibility expires during the query/audit work.
      if (visible.length !== rows.length) workforceConflict();
      return {
        ...page(
          rows.map((row) => projectWorkforceEnquiryContact(row, current)),
          query.limit,
        ),
        access: current,
        generatedAt: new Date().toISOString(),
      };
    });
  }
  enquiry(
    actor: AuthenticatedActor,
    id: string,
    query: z.infer<typeof workforceMessageQuerySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const result = await readWorkforceEnquiry(tx, actor, access, id, query);
      await audit(
        tx,
        actor,
        context,
        "ENQUIRY",
        id,
        {
          workforceAction: "ENQUIRY_DETAIL",
          resultCount: result.messages.items.length,
        },
        true,
      );
      return {
        ...result,
        emailDeliveries: await supportEmailDeliveries(tx, id, actor.userId),
      };
    });
  }
  complaints(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceComplaintsQuerySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const paging = pagination(query);
      const rows = await tx.complaint.findMany({
        ...paging,
        where: {
          AND: [
            complaintScope(access),
            paging.where ?? {},
            ...(query.priority ? [{ priority: query.priority }] : []),
            ...(query.status ? [{ status: query.status }] : []),
            ...complaintSearchFilters(query.q),
          ],
        },
        select: { ...workforceComplaintSelect, ...workforceCareContactSelect },
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
      const current = await workforceSnapshot(tx, actor);
      const visible = await tx.complaint.findMany({
        where: {
          AND: [{ id: { in: rows.map((row) => row.id) } }, complaintScope(current)],
        },
        select: { id: true },
      });
      if (visible.length !== rows.length) workforceConflict();
      return {
        ...page(rows.map(projectWorkforceCareContact), query.limit),
        access: current,
        generatedAt: new Date().toISOString(),
      };
    });
  }
  complaint(
    actor: AuthenticatedActor,
    id: string,
    query: z.infer<typeof workforceMessageQuerySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      const result = await readWorkforceComplaint(tx, actor, access, id, query);
      await audit(
        tx,
        actor,
        context,
        "COMPLAINT",
        id,
        {
          workforceAction: "COMPLAINT_DETAIL",
          resultCount: result.messages.items.length,
        },
        true,
      );
      return {
        ...result,
        emailDeliveries: await supportEmailDeliveries(tx, id, actor.userId),
      };
    });
  }
  dismissDeliveryNotices(
    actor: AuthenticatedActor,
    kind: "enquiries" | "complaints",
    id: string,
    body: unknown,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (!careBranchesFor(access, kind === "enquiries" ? "ENQUIRY" : "COMPLAINT").length)
        workforceDenied();
      if (kind === "enquiries")
        await readWorkforceEnquiry(tx, actor, access, id, { limit: 20 });
      else {
        await readWorkforceComplaint(tx, actor, access, id, {
          limit: 20,
        });
      }
      const page = await dismissSupportDeliveryNotices(tx, actor.userId, id, body);
      await audit(
        tx,
        actor,
        context,
        kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
        id,
        { workforceAction: "DISMISS_OWN_DELIVERY_NOTICES" },
      );
      return page;
    });
  }
  reply(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceEnquiryReplySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (
        !(await tx.enquiry.findFirst({
          where: { AND: [{ id }, enquiryScope(access, "reply")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await workforceSnapshot(tx, actor);
      const row = await tx.enquiry.findFirst({
        where: { AND: [{ id }, enquiryScope(current, "reply")] },
        select: {
          id: true,
          branchId: true,
          version: true,
          status: true,
          email: true,
          customer: { select: { userId: true } },
        },
      });
      if (!row?.branchId) workforceNotFound();
      if (
        row.version !== input.expectedVersion ||
        ["RESOLVED", "CLOSED"].includes(row.status)
      )
        workforceConflict();
      if (
        input.expectedLatestMessageId !== undefined &&
        (await latestEnquiryMessage(tx, id))?.id !==
          (input.expectedLatestMessageId ?? undefined)
      )
        workforceConflict(
          "The conversation changed. Refresh and review the latest messages.",
        );
      const updated = await tx.enquiry.updateMany({
        where: { id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) workforceConflict();
      const created = await tx.supportMessage.create({
        data: {
          enquiryId: id,
          authorUserId: actor.userId,
          kind: "REPLY",
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: input.body,
        },
      });
      await enqueueSupportCustomerUpdate(tx, {
        kind: "enquiry",
        record: row,
        messageId: created.id,
        response: input.body,
      });
      await audit(tx, actor, context, "ENQUIRY", id, {
        workforceAction: "REPLY",
        messageId: created.id,
      });
      const finalAccess = await workforceSnapshot(tx, actor);
      if (
        !(await tx.enquiry.findFirst({
          where: { AND: [{ id }, enquiryScope(finalAccess, "reply")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      return {
        id,
        version: input.expectedVersion + 1,
        branchId: row.branchId,
        action: "reply" as const,
        actorUserId: actor.userId,
        access: finalAccess,
        generatedAt: new Date().toISOString(),
        messageReceipt: {
          id: created.id,
          enquiryId: id,
          body: created.body,
          kind: created.kind,
          fromStatus: created.fromStatus,
          toStatus: created.toStatus,
          authorType: created.authorType,
          visibility: created.visibility,
          createdAt: created.createdAt,
        },
      };
    });
  }
  complaintReply(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceComplaintReplySchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, async (tx, access) => {
      if (
        !(await tx.complaint.findFirst({
          where: { AND: [{ id }, complaintScope(access, "reply")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      await tx.$queryRaw`SELECT "id" FROM "Complaint" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const current = await workforceSnapshot(tx, actor);
      const row = await tx.complaint.findFirst({
        where: { AND: [{ id }, complaintScope(current, "reply")] },
        select: {
          id: true,
          branchId: true,
          version: true,
          status: true,
          email: true,
          customer: { select: { userId: true } },
        },
      });
      if (!row?.branchId) workforceNotFound();
      if (
        row.version !== input.expectedVersion ||
        ["RESOLVED", "CLOSED"].includes(row.status)
      )
        workforceConflict();
      if (
        input.expectedLatestMessageId !== undefined &&
        (await latestComplaintMessage(tx, id))?.id !==
          (input.expectedLatestMessageId ?? undefined)
      )
        workforceConflict(
          "The conversation changed. Refresh and review the latest messages.",
        );
      const changed = await tx.complaint.updateMany({
        where: { id, version: input.expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) workforceConflict();
      const created = await tx.supportMessage.create({
        data: {
          complaintId: id,
          authorUserId: actor.userId,
          kind: "REPLY",
          authorType: "STAFF",
          visibility: "CUSTOMER",
          body: input.body,
        },
      });
      await enqueueSupportCustomerUpdate(tx, {
        kind: "complaint",
        record: row,
        messageId: created.id,
        response: input.body,
      });
      await audit(tx, actor, context, "COMPLAINT", id, {
        workforceAction: "REPLY",
        messageId: created.id,
      });
      const finalAccess = await workforceSnapshot(tx, actor);
      if (
        !(await tx.complaint.findFirst({
          where: { AND: [{ id }, complaintScope(finalAccess, "reply")] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      return {
        id,
        version: input.expectedVersion + 1,
        branchId: row.branchId,
        action: "reply" as const,
        actorUserId: actor.userId,
        access: finalAccess,
        generatedAt: new Date().toISOString(),
        messageReceipt: {
          id: created.id,
          complaintId: id,
          body: created.body,
          kind: created.kind,
          fromStatus: created.fromStatus,
          toStatus: created.toStatus,
          authorType: created.authorType,
          visibility: created.visibility,
          createdAt: created.createdAt,
        },
      };
    });
  }
  assignEnquiry(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceEnquiryAssignmentSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, (tx, access) =>
      assignWorkforceCareCase(tx, actor, access, "ENQUIRY", id, input, context),
    );
  }
  assignComplaint(
    actor: AuthenticatedActor,
    id: string,
    input: z.infer<typeof workforceEnquiryAssignmentSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, (tx, access) =>
      assignWorkforceCareCase(tx, actor, access, "COMPLAINT", id, input, context),
    );
  }
  careAssignees(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
    kind: WorkforceCareKind,
    query?: z.infer<typeof workforceJobAssigneesQuerySchema>,
  ) {
    return this.run(actor, (tx, access) =>
      workforceCareAssignees(tx, actor, access, kind, id, context, query),
    );
  }

  orders(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceOrdersQuerySchema>,
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
            ...(query.status ? [{ status: query.status }] : []),
            ...(query.fulfillmentMethod
              ? [{ fulfillmentMethod: query.fulfillmentMethod }]
              : []),
            ...orderSearchFilters(query.q),
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
      return {
        ...page(
          rows.map((row) => ({
            ...row,
            availableNextStates: orderNextStates(row, access),
          })),
          query.limit,
        ),
        access,
        generatedAt: new Date().toISOString(),
      };
    });
  }
  order(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("ORDERS_READ")) workforceDenied();
      const row = await readWorkforceOrder(tx, access, id);
      await audit(
        tx,
        actor,
        context,
        "ORDER",
        id,
        { workforceAction: "ORDER_CURRENT", resultCount: 1 },
        true,
      );
      return row;
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
      // Serialize preparation with other order writers before checking branch/state/payment.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id}::uuid FOR UPDATE`;
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
      return {
        ...(await readWorkforceOrder(tx, access, id)),
        action: "prepare" as const,
        actorUserId: actor.userId,
        previousVersion: row.version,
        previousStatus: row.status,
        reason: input.reason,
      };
    });
  }
  finance(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceFinanceQuerySchema>,
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
            financeScope(branchIds),
            paging.where ?? {},
            ...(query.status ? [{ status: query.status }] : []),
            ...(query.purpose ? [{ purpose: query.purpose }] : []),
            ...financeSearchFilters(branchIds, query.q),
          ],
        },
        select: workforceFinanceSelect,
      });
      await audit(
        tx,
        actor,
        context,
        "PAYMENT",
        null,
        {
          workforceAction: "FINANCE_READ",
          resultCount: Math.min(rows.length, query.limit),
        },
        true,
      );
      return {
        ...page(
          rows.map((row) => projectWorkforcePayment(row, branchIds)),
          query.limit,
        ),
        access,
        generatedAt: new Date().toISOString(),
      };
    });
  }
  financePayment(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return this.run(actor, async (tx, access) => {
      if (!access.permissions.includes("FINANCE_READ")) workforceDenied();
      const branchIds = branchesFor(access, "FINANCE_READ");
      await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${id}::uuid FOR SHARE`;
      const row = await tx.payment.findFirst({
        where: { id, ...financeScope(branchIds) },
        select: workforceFinanceDetailSelect,
      });
      if (!row) workforceNotFound();
      const result = projectWorkforcePayment(row, branchIds);
      await audit(
        tx,
        actor,
        context,
        "PAYMENT",
        id,
        { workforceAction: "FINANCE_CURRENT", resultCount: 1 },
        true,
      );
      return { ...result, access, generatedAt: new Date().toISOString() };
    });
  }
}
