import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import {
  supportBranchRequired,
  supportConflict,
  supportForbidden,
  supportNotFound,
  supportStale,
} from "./support.errors.js";
import {
  assertReviewModerator,
  assertSupportCustomer,
  assertSupportOperator,
} from "./support.policy.js";
import { SupportRepository } from "./support.repository.js";
import type {
  AssignmentInput,
  ComplaintPriorityInput,
  ComplaintTransitionInput,
  CustomerComplaintInput,
  CustomerEnquiryInput,
  CustomerReviewListQuery,
  CustomerSupportListQuery,
  EnquiryTransitionInput,
  PublicComplaintInput,
  PublicEnquiryInput,
  PublicReviewListQuery,
  ReviewCreateInput,
  ReviewModerationInput,
  StaffComplaintListQuery,
  StaffEnquiryListQuery,
  StaffReviewListQuery,
  StaffSupportMessageInput,
  SupportMessageInput,
} from "./support.schemas.js";
import { supportPage } from "./support.types.js";

type Transaction = Prisma.TransactionClient;
type EnquiryInput = PublicEnquiryInput | CustomerEnquiryInput;

const systemContext = (id: string): RequestSecurityContext => ({
  requestId: id,
  ipAddress: null,
  userAgent: null,
});

export class SupportService {
  private readonly repository: SupportRepository;

  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new SupportRepository(database);
  }

  async createPublicEnquiry(input: PublicEnquiryInput, context: RequestSecurityContext) {
    return this.database.$transaction(async (transaction) => {
      const branchId = await this.resolveEnquiryBranch(input, null, transaction);
      const enquiry = await this.repository.createPublicEnquiry(input, branchId, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: null,
        action: "CREATE",
        entityType: "ENQUIRY",
        entityId: enquiry.id,
        newValues: { type: input.type, branchId },
        context,
      });
      return enquiry;
    });
  }

  async createCustomerEnquiry(
    actor: AuthenticatedActor,
    input: CustomerEnquiryInput,
    context: RequestSecurityContext,
  ) {
    assertSupportCustomer(actor);
    return this.database.$transaction(async (transaction) => {
      const customer = await this.repository.customer(actor.userId, transaction);
      if (customer === null) throw supportNotFound();
      const branchId = await this.resolveEnquiryBranch(input, customer.id, transaction);
      const enquiry = await this.repository.createCustomerEnquiry(
        customer,
        input,
        branchId,
        transaction,
      );
      if (enquiry === null) throw supportNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "ENQUIRY",
        entityId: enquiry.id,
        newValues: { type: input.type, branchId },
        context,
      });
      return enquiry;
    });
  }

  async createPublicComplaint(input: PublicComplaintInput, context: RequestSecurityContext) {
    return this.database.$transaction(async (transaction) => {
      const branchId = await this.resolveRequestedBranch(input.branchId, null, transaction);
      const complaint = await this.repository.createPublicComplaint(
        input,
        branchId,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: null,
        action: "CREATE",
        entityType: "COMPLAINT",
        entityId: complaint.id,
        newValues: { branchId, priority: complaint.priority },
        context,
      });
      return complaint;
    });
  }

  async createCustomerComplaint(
    actor: AuthenticatedActor,
    input: CustomerComplaintInput,
    context: RequestSecurityContext,
  ) {
    assertSupportCustomer(actor);
    return this.database.$transaction(async (transaction) => {
      const customer = await this.repository.customer(actor.userId, transaction);
      if (customer === null) throw supportNotFound();
      const sourceBranch = await this.resolveComplaintSource(input, customer.id, transaction);
      const branchId = await this.resolveRequestedBranch(
        input.branchId,
        sourceBranch,
        transaction,
      );
      const complaint = await this.repository.createCustomerComplaint(
        customer,
        input,
        branchId,
        transaction,
      );
      if (complaint === null) throw supportNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "COMPLAINT",
        entityId: complaint.id,
        newValues: { branchId, priority: complaint.priority },
        context,
      });
      return complaint;
    });
  }

  publicReviews(query: PublicReviewListQuery) {
    return this.repository
      .listPublicReviews(query)
      .then((rows) => supportPage(rows, query.limit));
  }

  async customerEnquiries(actor: AuthenticatedActor, query: CustomerSupportListQuery) {
    const customer = await this.customer(actor);
    return supportPage(
      await this.repository.listCustomerEnquiries(customer.id, query),
      query.limit,
    );
  }

  async customerComplaints(actor: AuthenticatedActor, query: CustomerSupportListQuery) {
    const customer = await this.customer(actor);
    return supportPage(
      await this.repository.listCustomerComplaints(customer.id, query),
      query.limit,
    );
  }

  async customerReviews(actor: AuthenticatedActor, query: CustomerReviewListQuery) {
    const customer = await this.customer(actor);
    return supportPage(
      await this.repository.listCustomerReviews(customer.id, query),
      query.limit,
    );
  }

  async customerEnquiry(actor: AuthenticatedActor, id: string) {
    const customer = await this.customer(actor);
    const enquiry = await this.repository.customerEnquiry(customer.id, id);
    if (enquiry === null) throw supportNotFound();
    return enquiry;
  }

  async customerComplaint(actor: AuthenticatedActor, id: string) {
    const customer = await this.customer(actor);
    const complaint = await this.repository.customerComplaint(customer.id, id);
    if (complaint === null) throw supportNotFound();
    return complaint;
  }

  async addCustomerMessage(
    actor: AuthenticatedActor,
    kind: "enquiry" | "complaint",
    id: string,
    input: SupportMessageInput,
    context: RequestSecurityContext,
  ) {
    const customer = await this.customer(actor);
    return this.database.$transaction(async (transaction) => {
      const record =
        kind === "enquiry"
          ? await this.repository.customerEnquiry(customer.id, id, transaction)
          : await this.repository.customerComplaint(customer.id, id, transaction);
      if (record === null) throw supportNotFound();
      if (record.status === "CLOSED")
        throw supportConflict("Closed support records cannot receive new messages");
      const created = await this.repository.createMessage(
        kind === "enquiry" ? { enquiryId: id } : { complaintId: id },
        actor.userId,
        "CUSTOMER",
        "CUSTOMER",
        input.message,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
        entityId: id,
        newValues: { messageId: created.id },
        context,
      });
      return created;
    });
  }

  async createReview(
    actor: AuthenticatedActor,
    input: ReviewCreateInput,
    context: RequestSecurityContext,
  ) {
    const customer = await this.customer(actor);
    return this.database.$transaction(
      async (transaction) => {
        await this.assertReviewSource(customer.id, input, transaction);
        const review = await this.repository.createReview(customer.id, input, transaction);
        await appendAuditEvent(transaction, {
          actorUserId: actor.userId,
          action: "CREATE",
          entityType: "REVIEW",
          entityId: review.id,
          newValues: { targetType: input.targetType, rating: input.rating },
          context,
        });
        return review;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async staffEnquiries(
    actor: AuthenticatedActor,
    query: StaffEnquiryListQuery,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    const branchId = await this.allowedBranch(actor);
    const page = supportPage(await this.repository.listStaffEnquiries(query, branchId), query.limit);
    await this.auditPrivilegedRead(actor, "ENQUIRY", null, context);
    return page;
  }

  async staffComplaints(
    actor: AuthenticatedActor,
    query: StaffComplaintListQuery,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    const branchId = await this.allowedBranch(actor);
    const page = supportPage(
      await this.repository.listStaffComplaints(query, branchId),
      query.limit,
    );
    await this.auditPrivilegedRead(actor, "COMPLAINT", null, context);
    return page;
  }

  async staffReviews(
    actor: AuthenticatedActor,
    query: StaffReviewListQuery,
    context: RequestSecurityContext,
  ) {
    assertReviewModerator(actor);
    const page = supportPage(await this.repository.listStaffReviews(query), query.limit);
    await this.auditPrivilegedRead(actor, "REVIEW", null, context);
    return page;
  }

  async staffRecord(
    actor: AuthenticatedActor,
    kind: "enquiry" | "complaint",
    id: string,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    const record =
      kind === "enquiry"
        ? await this.repository.staffEnquiry(id)
        : await this.repository.staffComplaint(id);
    if (record === null) throw supportNotFound();
    await this.assertStaffBranch(actor, record.branchId);
    await this.auditPrivilegedRead(
      actor,
      kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
      id,
      context,
    );
    return record;
  }

  async assign(
    actor: AuthenticatedActor,
    kind: "enquiry" | "complaint",
    id: string,
    input: AssignmentInput,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const record =
        kind === "enquiry"
          ? await this.repository.staffEnquiry(id, transaction)
          : await this.repository.staffComplaint(id, transaction);
      if (record === null) throw supportNotFound();
      await this.assertStaffBranch(actor, record.branchId, transaction);
      if (record.status === "CLOSED") throw supportConflict();
      if (input.assignedStaffId !== null) {
        const assigned = await this.repository.assignableStaff(
          input.assignedStaffId,
          transaction,
        );
        if (
          assigned === null ||
          (record.branchId !== null && assigned.branchId !== record.branchId)
        )
          throw supportForbidden();
      }
      const changed =
        kind === "enquiry"
          ? await this.repository.updateEnquiry(
              id,
              input.expectedVersion,
              { assignedStaffId: input.assignedStaffId },
              transaction,
            )
          : await this.repository.updateComplaint(
              id,
              input.expectedVersion,
              { assignedStaffId: input.assignedStaffId },
              transaction,
            );
      if (changed.count !== 1) throw supportStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
        entityId: id,
        oldValues: { assignedStaffId: record.assignedStaffId, version: record.version },
        newValues: {
          assignedStaffId: input.assignedStaffId,
          version: record.version + 1,
        },
        context,
      });
      const updated =
        kind === "enquiry"
          ? await this.repository.staffEnquiry(id, transaction)
          : await this.repository.staffComplaint(id, transaction);
      if (updated === null) throw supportNotFound();
      return updated;
    });
  }

  async transitionEnquiry(
    actor: AuthenticatedActor,
    id: string,
    input: EnquiryTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const current = await this.repository.staffEnquiry(id, transaction);
      if (current === null) throw supportNotFound();
      await this.assertStaffBranch(actor, current.branchId, transaction);
      const allowed: Record<string, readonly string[]> = {
        OPEN: ["IN_PROGRESS", "RESOLVED"],
        IN_PROGRESS: ["RESOLVED"],
        RESOLVED: ["CLOSED"],
        CLOSED: [],
      };
      if (!allowed[current.status]?.includes(input.status))
        throw supportConflict("Invalid enquiry status transition");
      const now = new Date();
      const changed = await this.repository.updateEnquiry(
        id,
        input.expectedVersion,
        {
          status: input.status,
          ...(input.status === "RESOLVED" ? { resolvedAt: now } : {}),
          ...(input.status === "CLOSED" ? { closedAt: now } : {}),
        },
        transaction,
      );
      if (changed.count !== 1) throw supportStale();
      if (input.response)
        await this.repository.createMessage(
          { enquiryId: id },
          actor.userId,
          "STAFF",
          "CUSTOMER",
          input.response,
          transaction,
        );
      if (current.customer?.userId)
        await enqueueNotification(transaction, {
          userId: current.customer.userId,
          type: "ENQUIRY",
          category: "OPERATIONAL",
          title: "Your enquiry was updated",
          message: `Your enquiry is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
          deduplicationKey: `enquiry:${id}:status:${input.status}:${current.version + 1}`,
          resourceType: "ENQUIRY",
          resourceId: id,
          channels: ["EMAIL"],
        });
      await this.auditTransition(
        transaction,
        actor,
        "ENQUIRY",
        id,
        current.status,
        input.status,
        current.version,
        context,
      );
      const updated = await this.repository.staffEnquiry(id, transaction);
      if (updated === null) throw supportNotFound();
      return updated;
    });
  }

  async transitionComplaint(
    actor: AuthenticatedActor,
    id: string,
    input: ComplaintTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const current = await this.repository.staffComplaint(id, transaction);
      if (current === null) throw supportNotFound();
      await this.assertStaffBranch(actor, current.branchId, transaction);
      const allowed: Record<string, readonly string[]> = {
        OPEN: ["INVESTIGATING", "RESOLVED"],
        INVESTIGATING: ["RESOLVED"],
        RESOLVED: ["CLOSED"],
        CLOSED: [],
      };
      if (!allowed[current.status]?.includes(input.status))
        throw supportConflict("Invalid complaint status transition");
      const now = new Date();
      const changed = await this.repository.updateComplaint(
        id,
        input.expectedVersion,
        {
          status: input.status,
          ...(input.status === "RESOLVED" && input.resolution !== undefined
            ? { resolvedAt: now, resolution: input.resolution }
            : {}),
          ...(input.status === "CLOSED" ? { closedAt: now } : {}),
        },
        transaction,
      );
      if (changed.count !== 1) throw supportStale();
      if (input.resolution)
        await this.repository.createMessage(
          { complaintId: id },
          actor.userId,
          "STAFF",
          "CUSTOMER",
          input.resolution,
          transaction,
        );
      if (current.customer?.userId)
        await enqueueNotification(transaction, {
          userId: current.customer.userId,
          type: "COMPLAINT",
          category: "OPERATIONAL",
          title: "Your complaint was updated",
          message: `Your complaint is now ${input.status.toLowerCase()}.`,
          deduplicationKey: `complaint:${id}:status:${input.status}:${current.version + 1}`,
          resourceType: "COMPLAINT",
          resourceId: id,
          channels: ["EMAIL"],
        });
      await this.auditTransition(
        transaction,
        actor,
        "COMPLAINT",
        id,
        current.status,
        input.status,
        current.version,
        context,
      );
      const updated = await this.repository.staffComplaint(id, transaction);
      if (updated === null) throw supportNotFound();
      return updated;
    });
  }

  async setComplaintPriority(
    actor: AuthenticatedActor,
    id: string,
    input: ComplaintPriorityInput,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const current = await this.repository.staffComplaint(id, transaction);
      if (current === null) throw supportNotFound();
      await this.assertStaffBranch(actor, current.branchId, transaction);
      if (current.status === "CLOSED") throw supportConflict();
      const changed = await this.repository.updateComplaint(
        id,
        input.expectedVersion,
        { priority: input.priority },
        transaction,
      );
      if (changed.count !== 1) throw supportStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "COMPLAINT",
        entityId: id,
        oldValues: { priority: current.priority, version: current.version },
        newValues: { priority: input.priority, version: current.version + 1 },
        context,
      });
      const updated = await this.repository.staffComplaint(id, transaction);
      if (updated === null) throw supportNotFound();
      return updated;
    });
  }

  async addStaffMessage(
    actor: AuthenticatedActor,
    kind: "enquiry" | "complaint",
    id: string,
    input: StaffSupportMessageInput,
    context: RequestSecurityContext,
  ) {
    assertSupportOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const record =
        kind === "enquiry"
          ? await this.repository.staffEnquiry(id, transaction)
          : await this.repository.staffComplaint(id, transaction);
      if (record === null) throw supportNotFound();
      await this.assertStaffBranch(actor, record.branchId, transaction);
      if (record.status === "CLOSED") throw supportConflict();
      const created = await this.repository.createMessage(
        kind === "enquiry" ? { enquiryId: id } : { complaintId: id },
        actor.userId,
        "STAFF",
        input.visibility,
        input.message,
        transaction,
      );
      if (input.visibility === "CUSTOMER" && record.customer?.userId)
        await enqueueNotification(transaction, {
          userId: record.customer.userId,
          type: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
          category: "OPERATIONAL",
          title: kind === "enquiry" ? "New enquiry response" : "New complaint response",
          message: "A new response is available in your Allied AutoTech account.",
          deduplicationKey: `${kind}:${id}:message:${created.id}`,
          resourceType: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
          resourceId: id,
          channels: ["EMAIL"],
        });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
        entityId: id,
        newValues: { messageId: created.id, visibility: input.visibility },
        context,
      });
      return created;
    });
  }

  async moderateReview(
    actor: AuthenticatedActor,
    id: string,
    input: ReviewModerationInput,
    context: RequestSecurityContext,
  ) {
    assertReviewModerator(actor);
    return this.database.$transaction(async (transaction) => {
      const current = await this.repository.review(id, transaction);
      if (current === null) throw supportNotFound();
      if (current.status !== "PENDING") throw supportConflict("Review was already moderated");
      const changed = await this.repository.moderateReview(
        id,
        input.expectedVersion,
        input.decision,
        actor.userId,
        input.note,
        transaction,
      );
      if (changed.count !== 1) throw supportStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "REVIEW",
        entityId: id,
        oldValues: { status: current.status, version: current.version },
        newValues: { status: input.decision, version: current.version + 1 },
        context,
      });
      await enqueueNotification(transaction, {
        userId: current.customer.userId,
        type: "REVIEW",
        category: "OPERATIONAL",
        title: "Your review was moderated",
        message:
          input.decision === "APPROVED"
            ? "Your review is now published."
            : "Your review was not approved. Open your account to see the moderation note.",
        deduplicationKey: `review:${id}:moderation:${input.decision}`,
        resourceType: "REVIEW",
        resourceId: id,
        channels: ["EMAIL"],
      });
      const updated = await this.repository.review(id, transaction);
      if (updated === null) throw supportNotFound();
      const { customerId: _customerId, ...safe } = updated;
      return safe;
    });
  }

  private async customer(actor: AuthenticatedActor) {
    assertSupportCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    if (customer === null) throw supportNotFound();
    return customer;
  }

  private async resolveEnquiryBranch(
    input: EnquiryInput,
    customerId: string | null,
    transaction: Transaction,
  ) {
    let sourceBranch: string | null = null;
    if (input.type === "PRODUCT") {
      if ((await this.repository.activeProduct(input.productId, transaction)) === null)
        throw supportNotFound();
    } else if (input.type === "SERVICE") {
      if ((await this.repository.activeService(input.serviceId, transaction)) === null)
        throw supportNotFound();
    } else if (input.type === "VEHICLE") {
      const listing = await this.repository.activeListing(input.vehicleListingId, transaction);
      if (listing === null) throw supportNotFound();
      sourceBranch = listing.branchId;
    } else if (input.type === "BOOKING") {
      const booking = await this.repository.booking(input.bookingId, transaction);
      if (booking === null || booking.customerId !== customerId) throw supportNotFound();
      sourceBranch = booking.branchId;
    } else if (input.type === "QUOTATION") {
      const quote = await this.repository.quote(input.quoteId, transaction);
      if (quote === null || quote.booking.customerId !== customerId) throw supportNotFound();
      sourceBranch = quote.booking.branchId;
    }
    return this.resolveRequestedBranch(input.branchId, sourceBranch, transaction);
  }

  private async resolveComplaintSource(
    input: CustomerComplaintInput,
    customerId: string,
    transaction: Transaction,
  ): Promise<string | null> {
    if (input.bookingId) {
      const booking = await this.repository.booking(input.bookingId, transaction);
      if (booking === null || booking.customerId !== customerId) throw supportNotFound();
      return booking.branchId;
    }
    if (input.orderId) {
      const order = await this.repository.order(input.orderId, transaction);
      if (order === null || order.customerId !== customerId) throw supportNotFound();
      return order.branchId;
    }
    if (input.vehicleTransactionId) {
      const sale = await this.repository.vehicleTransaction(
        input.vehicleTransactionId,
        transaction,
      );
      if (sale === null || sale.customerId !== customerId) throw supportNotFound();
      return sale.vehicleListing.branchId;
    }
    return null;
  }

  private async resolveRequestedBranch(
    requested: string | undefined,
    source: string | null,
    transaction: Transaction,
  ): Promise<string> {
    if (source !== null) {
      if (requested !== undefined && requested !== source) throw supportNotFound();
      if ((await this.repository.activeBranch(source, transaction)) === null)
        throw supportConflict("The related branch is inactive");
      return source;
    }
    if (requested !== undefined) {
      if ((await this.repository.activeBranch(requested, transaction)) === null)
        throw supportNotFound();
      return requested;
    }
    const branches = await this.repository.activeBranches(transaction);
    if (branches.length !== 1) throw supportBranchRequired();
    return branches[0]!.id;
  }

  private async assertReviewSource(
    customerId: string,
    input: ReviewCreateInput,
    transaction: Transaction,
  ): Promise<void> {
    if (input.targetType === "BUSINESS") return;
    if (input.targetType === "SERVICE") {
      const booking = await this.repository.booking(input.bookingId, transaction);
      if (
        booking === null ||
        booking.customerId !== customerId ||
        booking.serviceId !== input.serviceId ||
        booking.status !== "COMPLETED"
      )
        throw supportConflict("A completed owned booking is required for this review");
      return;
    }
    if (input.targetType === "ORDER") {
      const order = await this.repository.order(input.orderId, transaction);
      if (order === null || order.customerId !== customerId || order.status !== "COMPLETED")
        throw supportConflict("A completed owned order is required for this review");
      return;
    }
    const sale = await this.repository.vehicleTransaction(
      input.vehicleTransactionId,
      transaction,
    );
    if (sale === null || sale.customerId !== customerId || sale.status !== "COMPLETED")
      throw supportConflict("A completed owned vehicle transaction is required for this review");
  }

  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Transaction = this.database,
  ): Promise<string | null> {
    if (actor.role !== "STAFF") return null;
    const staff = await this.repository.staff(actor.userId, client);
    if (staff?.branchId == null || staff.branch?.isActive !== true) throw supportForbidden();
    return staff.branchId;
  }

  private async assertStaffBranch(
    actor: AuthenticatedActor,
    branchId: string | null,
    client: PrismaClient | Transaction = this.database,
  ): Promise<void> {
    const allowed = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && (branchId === null || allowed !== branchId))
      throw supportForbidden();
  }

  private auditPrivilegedRead(
    actor: AuthenticatedActor,
    entityType: "ENQUIRY" | "COMPLAINT" | "REVIEW",
    entityId: string | null,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType,
        entityId,
        context,
      }),
    );
  }

  private auditTransition(
    transaction: Transaction,
    actor: AuthenticatedActor,
    entityType: "ENQUIRY" | "COMPLAINT",
    entityId: string,
    from: string,
    to: string,
    version: number,
    context: RequestSecurityContext,
  ) {
    return appendAuditEvent(transaction, {
      actorUserId: actor.userId,
      action: "STATUS_CHANGE",
      entityType,
      entityId,
      oldValues: { status: from, version },
      newValues: { status: to, version: version + 1 },
      context,
    });
  }

  async recordSystemFailure(
    entityType: "ENQUIRY" | "COMPLAINT",
    entityId: string,
    code: string,
  ): Promise<void> {
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: null,
        action: "UPDATE",
        entityType,
        entityId,
        newValues: { code },
        context: systemContext(`system:${entityId}`),
      }),
    );
  }
}

export const supportService = new SupportService();
