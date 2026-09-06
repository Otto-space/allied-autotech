import { randomUUID } from "node:crypto";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { BookingStatus, WorkOrderStatus } from "../../generated/prisma/enums.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  invalidServiceTransition,
  scheduleConflict,
  serviceOperationConflict,
  serviceOperationForbidden,
  serviceOperationNotFound,
  staleServiceOperation,
} from "./service-operations.errors.js";
import {
  assertCustomerActor,
  assertPrivilegedActor,
  assertServiceAdministrator,
} from "./service-operations.policy.js";
import { ServiceOperationsRepository } from "./service-operations.repository.js";
import type {
  AdminServiceListQuery,
  BookingAssignmentInput,
  BookingCancelInput,
  BookingCreateInput,
  BookingRescheduleInput,
  BookingTransitionInput,
  CustomerBookingListQuery,
  PublicServiceListQuery,
  QuoteCreateInput,
  QuoteReplaceInput,
  QuoteTransitionInput,
  ServiceCreateInput,
  ServiceLineItemInput,
  ServiceUpdateInput,
  StaffBookingListQuery,
  WorkOrderCreateInput,
  WorkOrderTransitionInput,
  WorkOrderUpdateInput,
} from "./service-operations.schemas.js";
import { page, type PricedLine } from "./service-operations.types.js";

const activeBookingStatuses: readonly BookingStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "IN_PROGRESS",
];
const bookingTransitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
const workTransitions: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_PARTS", "QUALITY_CHECK", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_CHECK: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]),
    );
  }
  return value;
}

function customerSafeBooking<
  T extends { staffNotes: unknown; workOrder: null | { internalNotes: unknown } },
>(booking: T) {
  const { staffNotes: _staffNotes, workOrder, ...safe } = booking;
  return {
    ...safe,
    workOrder:
      workOrder === null
        ? null
        : (() => {
            const { internalNotes: _internalNotes, ...safeWorkOrder } = workOrder;
            return safeWorkOrder;
          })(),
  };
}

function reference(prefix: "Q" | "WO"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}

export class ServiceOperationsService {
  private readonly repository: ServiceOperationsRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new ServiceOperationsRepository(database);
  }

  async publicServices(query: PublicServiceListQuery) {
    return jsonSafe(page(await this.repository.listServices(query, true), query.limit));
  }

  async publicService(id: string) {
    const service = await this.repository.service(id, true);
    if (service === null) throw serviceOperationNotFound();
    return jsonSafe(service);
  }

  async adminServices(actor: AuthenticatedActor, query: AdminServiceListQuery) {
    assertServiceAdministrator(actor);
    return jsonSafe(page(await this.repository.listServices(query, false), query.limit));
  }

  async createService(
    actor: AuthenticatedActor,
    input: ServiceCreateInput,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      const service = await this.repository.createService(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "SERVICE",
        entityId: service.id,
        newValues: {
          pricingType: service.pricingType,
          active: service.isActive,
          currency: service.currency,
        },
        context,
      });
      return jsonSafe(service);
    });
  }

  async updateService(
    actor: AuthenticatedActor,
    id: string,
    input: ServiceUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service:${id}`}, 0))`;
      const existing = await this.repository.service(id, false, transaction);
      if (existing === null) throw serviceOperationNotFound();
      const nextPricing = input.pricingType ?? existing.pricingType;
      const nextPrice =
        input.priceKobo === undefined
          ? existing.priceKobo
          : input.priceKobo === null
            ? null
            : BigInt(input.priceKobo);
      if (nextPricing === "FIXED" && nextPrice === null)
        throw serviceOperationConflict("Fixed-price services require a price");
      if (input.isActive === false && existing.isActive) {
        const active = await transaction.booking.count({
          where: { serviceId: id, status: { in: [...activeBookingStatuses] } },
        });
        if (active > 0)
          throw serviceOperationConflict(
            "Active bookings must be resolved before deactivating this service",
          );
      }
      const updated = await this.repository.updateService(id, input, transaction);
      if (updated.count !== 1) throw staleServiceOperation();
      const service = await this.repository.service(id, false, transaction);
      if (service === null) throw serviceOperationNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "SERVICE",
        entityId: id,
        oldValues: { version: existing.version, active: existing.isActive },
        newValues: {
          version: service.version,
          active: service.isActive,
          changedFields: Object.keys(input)
            .filter((key) => key !== "expectedVersion")
            .sort()
            .join(","),
        },
        context,
      });
      return jsonSafe(service);
    });
  }

  async customerBookings(actor: AuthenticatedActor, query: CustomerBookingListQuery) {
    assertCustomerActor(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw serviceOperationForbidden();
    const result = page(
      await this.repository.listCustomerBookings(profile.id, query),
      query.limit,
    );
    return jsonSafe({ ...result, items: result.items.map(customerSafeBooking) });
  }

  async customerBooking(actor: AuthenticatedActor, id: string) {
    assertCustomerActor(actor);
    const booking = await this.ownedCustomerBooking(actor.userId, id);
    return jsonSafe(customerSafeBooking(booking));
  }

  async createBooking(
    actor: AuthenticatedActor,
    input: BookingCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() <= Date.now())
      throw serviceOperationConflict("Bookings must be scheduled in the future");
    return this.database.$transaction(async (transaction) => {
      const profile = await this.repository.customerProfile(actor.userId, transaction);
      if (profile === null) throw serviceOperationForbidden();
      const [branch, service] = await Promise.all([
        this.repository.branch(input.branchId, transaction),
        this.repository.service(input.serviceId, true, transaction),
      ]);
      if (branch === null || service === null) throw serviceOperationNotFound();
      if (service.durationMinutes === null)
        throw serviceOperationConflict(
          "This service is not available for online booking",
        );
      if (
        input.vehicleId !== undefined &&
        (await this.repository.ownedVehicle(profile.id, input.vehicleId, transaction)) ===
          null
      )
        throw serviceOperationNotFound();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${profile.id}`}, 0))`;
      const end = new Date(scheduledAt.getTime() + service.durationMinutes * 60_000);
      if (
        await this.repository.hasCustomerScheduleConflict(
          profile.id,
          scheduledAt,
          end,
          null,
          transaction,
        )
      )
        throw scheduleConflict();
      const booking = await this.repository.createBooking(profile.id, input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "BOOKING",
        entityId: booking.id,
        newValues: {
          branchId: input.branchId,
          serviceId: input.serviceId,
          status: booking.status,
          scheduledAt: booking.scheduledAt.toISOString(),
        },
        context,
      });
      return jsonSafe(customerSafeBooking(booking));
    });
  }

  async rescheduleBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    const scheduledAt = new Date(input.scheduledAt);
    if (scheduledAt.getTime() <= Date.now())
      throw serviceOperationConflict("Bookings must be scheduled in the future");
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (booking.status !== "REQUESTED") throw invalidServiceTransition();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
      const duration = booking.service.durationMinutes;
      if (duration === null)
        throw serviceOperationConflict(
          "Service duration must be configured before rescheduling",
        );
      const end = new Date(scheduledAt.getTime() + duration * 60_000);
      if (
        await this.repository.hasCustomerScheduleConflict(
          booking.customerId,
          scheduledAt,
          end,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        { scheduledAt },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(customerSafeBooking(updated));
    });
  }

  async cancelBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingCancelInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (!bookingTransitions[booking.status].includes("CANCELLED"))
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        { status: "CANCELLED", cancellationReason: input.reason, cancelledAt: now },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(customerSafeBooking(updated));
    });
  }

  async staffBookings(actor: AuthenticatedActor, query: StaffBookingListQuery) {
    assertPrivilegedActor(actor);
    const profile = await this.repository.staffProfile(actor.userId);
    if (profile === null) throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null || profile.branch?.isActive !== true)
    )
      throw serviceOperationForbidden();
    return jsonSafe(
      page(
        await this.repository.listStaffBookings(
          query,
          actor.role === "STAFF" ? profile.branchId : null,
        ),
        query.limit,
      ),
    );
  }

  async staffBooking(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    const booking = await this.authorizedStaffBooking(actor, id);
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BOOKING",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return jsonSafe(booking);
  }

  async assignBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAssignmentInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        id,
        transaction,
        false,
      );
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${input.assignedStaffId}`}, 0))`;
      if (!activeBookingStatuses.includes(booking.status))
        throw invalidServiceTransition();
      const target = await this.repository.assignableStaff(
        input.assignedStaffId,
        transaction,
      );
      if (
        target === null ||
        target.branchId === null ||
        booking.branchId === null ||
        target.branchId !== booking.branchId
      )
        throw serviceOperationForbidden();
      const actorProfile = await this.repository.staffProfile(actor.userId, transaction);
      if (actor.role === "STAFF" && actorProfile?.id !== target.id)
        throw serviceOperationForbidden();
      const duration = booking.service.durationMinutes;
      if (duration === null)
        throw serviceOperationConflict(
          "Service duration must be configured before assignment",
        );
      const end = new Date(booking.scheduledAt.getTime() + duration * 60_000);
      if (
        await this.repository.hasScheduleConflict(
          target.id,
          booking.scheduledAt,
          end,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        { assignedStaffId: target.id },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(updated);
    });
  }

  async transitionBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(actor, id, transaction);
      if (!bookingTransitions[booking.status].includes(input.status))
        throw invalidServiceTransition();
      if (input.status === "CONFIRMED") {
        if (booking.assignedStaffId === null || booking.service.durationMinutes === null)
          throw serviceOperationConflict(
            "Assign an available staff member before confirmation",
          );
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${booking.assignedStaffId}`}, 0))`;
        const end = new Date(
          booking.scheduledAt.getTime() + booking.service.durationMinutes * 60_000,
        );
        if (
          await this.repository.hasScheduleConflict(
            booking.assignedStaffId,
            booking.scheduledAt,
            end,
            booking.id,
            transaction,
          )
        )
          throw scheduleConflict();
      }
      if (input.status === "CANCELLED" && input.reason === undefined)
        throw serviceOperationConflict("A cancellation reason is required");
      const now = new Date();
      const timestamps: Prisma.BookingUncheckedUpdateManyInput = {
        status: input.status,
        ...(input.staffNotes === undefined ? {} : { staffNotes: input.staffNotes }),
        ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
        ...(input.status === "IN_PROGRESS" ? { startedAt: now } : {}),
        ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
        ...(input.status === "CANCELLED"
          ? { cancelledAt: now, cancellationReason: input.reason! }
          : {}),
      };
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        timestamps,
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(updated);
    });
  }

  async createQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    input: QuoteCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      if (!activeBookingStatuses.includes(booking.status))
        throw invalidServiceTransition();
      const staff = await this.repository.staffProfile(actor.userId, transaction);
      if (staff === null) throw serviceOperationForbidden();
      const expiresAt = this.futureExpiry(input.expiresAt);
      const lines = await this.priceLines(input.items, transaction);
      const latest = await this.repository.latestQuoteVersion(bookingId, transaction);
      const quote = await this.repository.createQuote(
        bookingId,
        staff.id,
        reference("Q"),
        (latest._max.version ?? 0) + 1,
        lines,
        BigInt(input.taxKobo),
        input.notes,
        expiresAt,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "QUOTE",
        entityId: quote.id,
        newValues: {
          bookingId,
          version: quote.version,
          revision: quote.revision,
          totalKobo: quote.totalKobo.toString(),
        },
        context,
      });
      return jsonSafe(quote);
    });
  }

  async replaceQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteReplaceInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (quote.status !== "DRAFT") throw invalidServiceTransition();
      const staff = await this.repository.staffProfile(actor.userId, transaction);
      if (staff === null) throw serviceOperationForbidden();
      const lines = await this.priceLines(input.items, transaction);
      const latest = await this.repository.latestQuoteVersion(bookingId, transaction);
      const updated = await this.repository.reviseQuote(
        quoteId,
        input.expectedRevision,
        bookingId,
        staff.id,
        reference("Q"),
        (latest._max.version ?? quote.version) + 1,
        lines,
        BigInt(input.taxKobo),
        input.notes,
        this.futureExpiry(input.expiresAt),
        transaction,
      );
      if (updated === null) throw staleServiceOperation();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "QUOTE",
        entityId: updated.id,
        oldValues: { supersededQuoteId: quote.id, version: quote.version },
        newValues: {
          version: updated.version,
          revision: updated.revision,
          totalKobo: updated.totalKobo.toString(),
        },
        context,
      });
      return jsonSafe(updated);
    });
  }

  async issueQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        quote.status !== "DRAFT" ||
        quote.items.length === 0 ||
        quote.expiresAt === null ||
        quote.expiresAt <= new Date()
      )
        throw invalidServiceTransition();
      const now = new Date();
      await this.repository.voidOtherIssuedQuotes(bookingId, quoteId, now, transaction);
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        ["DRAFT"],
        { status: "ISSUED", issuedAt: now },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  async voidQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.staffQuoteTransition(actor, bookingId, quoteId, input, "VOID", context);
  }

  async expireQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.staffQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "EXPIRED",
      context,
    );
  }

  async acceptQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.customerQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "ACCEPTED",
      context,
    );
  }

  async rejectQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.customerQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "REJECTED",
      context,
    );
  }

  async createWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    input: WorkOrderCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      if (booking.status !== "CONFIRMED" || booking.workOrder !== null)
        throw invalidServiceTransition();
      if (booking.version !== input.expectedBookingVersion) throw staleServiceOperation();
      const lines = await this.priceLines(input.items, transaction);
      const workOrder = await this.repository.createWorkOrder(
        bookingId,
        reference("WO"),
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "WORK_ORDER",
        entityId: workOrder.id,
        newValues: {
          bookingId,
          status: workOrder.status,
          itemCount: workOrder.items.length,
        },
        context,
      });
      return jsonSafe(workOrder);
    });
  }

  async updateWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    workOrderId: string,
    input: WorkOrderUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const existing = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (existing === null) throw serviceOperationNotFound();
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED")
        throw invalidServiceTransition();
      const lines =
        input.addItems === undefined
          ? undefined
          : await this.priceLines(input.addItems, transaction);
      const updated = await this.repository.updateWorkOrder(
        workOrderId,
        input.expectedVersion,
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
      if (updated === null) throw staleServiceOperation();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "WORK_ORDER",
        entityId: workOrderId,
        oldValues: { version: existing.version },
        newValues: { version: updated.version, itemCount: updated.items.length },
        context,
      });
      return jsonSafe(updated);
    });
  }

  async transitionWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    workOrderId: string,
    input: WorkOrderTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      const workOrder = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (workOrder === null) throw serviceOperationNotFound();
      if (!workTransitions[workOrder.status].includes(input.status))
        throw invalidServiceTransition();
      if (input.status === "APPROVED" && booking.status !== "CONFIRMED")
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.transitionWorkOrder(
        workOrderId,
        input.expectedVersion,
        [workOrder.status],
        {
          status: input.status,
          ...(input.status === "APPROVED" ? { openedAt: now } : {}),
          ...(input.status === "IN_PROGRESS" && workOrder.startedAt === null
            ? { startedAt: now }
            : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          ...(input.status === "CANCELLED" ? { cancelledAt: now } : {}),
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      if (input.status === "IN_PROGRESS" && booking.status === "CONFIRMED") {
        const changed = await this.repository.updateBooking(
          booking.id,
          booking.version,
          { status: "IN_PROGRESS", startedAt: now },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
      }
      if (input.status === "COMPLETED" && booking.status === "IN_PROGRESS") {
        const changed = await this.repository.updateBooking(
          booking.id,
          booking.version,
          { status: "COMPLETED", completedAt: now },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
      }
      const updated = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (updated === null) throw serviceOperationNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "WORK_ORDER",
        entityId: workOrderId,
        oldValues: { status: workOrder.status, version: workOrder.version },
        newValues: { status: updated.status, version: updated.version },
        context,
      });
      return jsonSafe(updated);
    });
  }

  private async ownedCustomerBooking(userId: string, id: string) {
    const [profile, booking] = await Promise.all([
      this.repository.customerProfile(userId),
      this.repository.booking(id),
    ]);
    if (profile === null || booking === null || booking.customerId !== profile.id)
      throw serviceOperationNotFound();
    return booking;
  }

  private async lockOwnedCustomerBooking(
    userId: string,
    id: string,
    transaction: Prisma.TransactionClient,
  ) {
    const profile = await this.repository.customerProfile(userId, transaction);
    const booking = await this.repository.lockBooking(id, transaction);
    if (profile === null || booking === null || booking.customerId !== profile.id)
      throw serviceOperationNotFound();
    return booking;
  }

  private async authorizedStaffBooking(actor: AuthenticatedActor, id: string) {
    assertPrivilegedActor(actor);
    const [profile, booking] = await Promise.all([
      this.repository.staffProfile(actor.userId),
      this.repository.booking(id),
    ]);
    if (profile === null || booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null ||
        booking.branchId === null ||
        profile.branchId !== booking.branchId)
    )
      throw serviceOperationForbidden();
    return booking;
  }

  private async lockAuthorizedStaffBooking(
    actor: AuthenticatedActor,
    id: string,
    transaction: Prisma.TransactionClient,
    requireAssignment = true,
  ) {
    const profile = await this.repository.staffProfile(actor.userId, transaction);
    const booking = await this.repository.lockBooking(id, transaction);
    if (profile === null || booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null ||
        booking.branchId === null ||
        profile.branchId !== booking.branchId)
    )
      throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      requireAssignment &&
      booking.assignedStaffId !== profile.id
    )
      throw serviceOperationForbidden();
    return booking;
  }

  private async priceLines(
    inputs: readonly ServiceLineItemInput[],
    transaction: Prisma.TransactionClient,
  ): Promise<PricedLine[]> {
    const productIds = [
      ...new Set(
        inputs.flatMap((line) => (line.type === "PART" ? [line.productId] : [])),
      ),
    ].sort();
    const products = await this.repository.products(productIds, transaction);
    if (products.length !== productIds.length) throw serviceOperationNotFound();
    const byId = new Map(products.map((product) => [product.id, product]));
    return inputs.map((line) => {
      const product = line.type === "PART" ? byId.get(line.productId) : undefined;
      if (line.type === "PART" && product === undefined) throw serviceOperationNotFound();
      const unitPriceKobo =
        line.type === "PART" ? product!.priceKobo : BigInt(line.unitPriceKobo);
      return {
        type: line.type,
        productId: line.type === "PART" ? line.productId : null,
        description:
          line.type === "PART" ? (line.description ?? product!.name) : line.description,
        quantity: line.quantity,
        unitPriceKobo,
        subtotalKobo: unitPriceKobo * BigInt(line.quantity),
      };
    });
  }

  private futureExpiry(value: string): Date {
    const expiresAt = new Date(value);
    if (expiresAt.getTime() <= Date.now())
      throw serviceOperationConflict("Quote expiry must be in the future");
    return expiresAt;
  }

  private async staffQuoteTransition(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    target: "VOID" | "EXPIRED",
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        target === "EXPIRED" &&
        (quote.expiresAt === null || quote.expiresAt > new Date())
      )
        throw invalidServiceTransition();
      const from =
        target === "VOID"
          ? quote.status === "DRAFT"
            ? (["DRAFT"] as const)
            : (["ISSUED"] as const)
          : (["ISSUED"] as const);
      if (!from.includes(quote.status as never)) throw invalidServiceTransition();
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        from,
        target === "VOID" ? { status: target, voidedAt: new Date() } : { status: target },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  private async customerQuoteTransition(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    target: "ACCEPTED" | "REJECTED",
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(
        actor.userId,
        bookingId,
        transaction,
      );
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        quote.status !== "ISSUED" ||
        quote.expiresAt === null ||
        quote.expiresAt <= new Date()
      )
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        ["ISSUED"],
        target === "ACCEPTED"
          ? { status: target, acceptedAt: now }
          : { status: target, rejectedAt: now },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      if (target === "ACCEPTED") {
        const changed = await this.repository.updateBooking(
          bookingId,
          booking.version,
          { quotedPriceKobo: quote.totalKobo },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
      }
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  private async auditBooking(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    oldBooking: {
      id: string;
      status: BookingStatus;
      version: number;
      assignedStaffId: string | null;
      scheduledAt: Date;
    },
    updated: {
      status: BookingStatus;
      version: number;
      assignedStaffId: string | null;
      scheduledAt: Date;
    },
    context: RequestSecurityContext,
  ) {
    await appendAuditEvent(transaction, {
      actorUserId: actor.userId,
      action: oldBooking.status === updated.status ? "UPDATE" : "STATUS_CHANGE",
      entityType: "BOOKING",
      entityId: oldBooking.id,
      oldValues: {
        status: oldBooking.status,
        version: oldBooking.version,
        assignedStaffId: oldBooking.assignedStaffId,
        scheduledAt: oldBooking.scheduledAt.toISOString(),
      },
      newValues: {
        status: updated.status,
        version: updated.version,
        assignedStaffId: updated.assignedStaffId,
        scheduledAt: updated.scheduledAt.toISOString(),
      },
      context,
    });
  }

  private async auditQuote(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    oldQuote: { id: string; status: string; revision: number },
    updated: { status: string; revision: number },
    context: RequestSecurityContext,
  ) {
    await appendAuditEvent(transaction, {
      actorUserId: actor.userId,
      action: "STATUS_CHANGE",
      entityType: "QUOTE",
      entityId: oldQuote.id,
      oldValues: { status: oldQuote.status, revision: oldQuote.revision },
      newValues: { status: updated.status, revision: updated.revision },
      context,
    });
  }
}

export const serviceOperationsService = new ServiceOperationsService();
