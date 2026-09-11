import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  CustomerComplaintInput,
  CustomerEnquiryInput,
  CustomerReviewListQuery,
  CustomerSupportListQuery,
  PublicComplaintInput,
  PublicEnquiryInput,
  PublicReviewListQuery,
  ReviewCreateInput,
  StaffComplaintListQuery,
  StaffEnquiryListQuery,
  StaffReviewListQuery,
  SupportMessageListQuery,
} from "./support.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const messageSelect = {
  id: true,
  authorType: true,
  visibility: true,
  body: true,
  createdAt: true,
} satisfies Prisma.SupportMessageSelect;

const enquiryBaseSelect = {
  id: true,
  branchId: true,
  type: true,
  status: true,
  subject: true,
  message: true,
  productId: true,
  serviceId: true,
  bookingId: true,
  quoteId: true,
  vehicleListingId: true,
  assignedStaffId: true,
  resolvedAt: true,
  closedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EnquirySelect;

const complaintBaseSelect = {
  id: true,
  branchId: true,
  bookingId: true,
  orderId: true,
  vehicleTransactionId: true,
  assignedStaffId: true,
  priority: true,
  status: true,
  subject: true,
  description: true,
  resolution: true,
  resolvedAt: true,
  closedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ComplaintSelect;

const reviewBaseSelect = {
  id: true,
  targetType: true,
  productId: true,
  orderItemId: true,
  serviceId: true,
  bookingId: true,
  orderId: true,
  vehicleTransactionId: true,
  rating: true,
  title: true,
  comment: true,
  status: true,
  moderationNote: true,
  moderatedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, name: true, slug: true } },
  service: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ReviewSelect;

export class SupportRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  customer(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        user: { select: { email: true } },
      },
    });
  }

  staff(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { id: true, branchId: true, branch: { select: { isActive: true } } },
    });
  }

  activeBranches(client: DatabaseClient = this.database) {
    return client.branch.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2,
    });
  }

  activeBranch(id: string, client: DatabaseClient = this.database) {
    return client.branch.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }

  assignableStaff(id: string, client: DatabaseClient) {
    return client.staffProfile.findFirst({
      where: {
        id,
        user: { status: "ACTIVE", role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } },
      },
      select: { id: true, branchId: true },
    });
  }

  activeProduct(id: string, client: DatabaseClient) {
    return client.product.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }

  activeService(id: string, client: DatabaseClient) {
    return client.service.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }

  activeListing(id: string, client: DatabaseClient) {
    return client.vehicleListing.findFirst({
      where: { id, status: "AVAILABLE", branch: { isActive: true } },
      select: { id: true, branchId: true },
    });
  }

  booking(id: string, client: DatabaseClient) {
    return client.booking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        serviceId: true,
        branchId: true,
        status: true,
      },
    });
  }

  quote(id: string, client: DatabaseClient) {
    return client.serviceQuote.findUnique({
      where: { id },
      select: {
        id: true,
        booking: { select: { customerId: true, branchId: true } },
      },
    });
  }

  order(id: string, client: DatabaseClient) {
    return client.order.findUnique({
      where: { id },
      select: { id: true, customerId: true, branchId: true, status: true },
    });
  }

  orderItem(id: string, client: DatabaseClient) {
    return client.orderItem.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        order: { select: { customerId: true, status: true } },
      },
    });
  }

  vehicleTransaction(id: string, client: DatabaseClient) {
    return client.vehicleTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        vehicleListing: { select: { branchId: true } },
      },
    });
  }

  createPublicEnquiry(
    input: PublicEnquiryInput,
    branchId: string,
    client: DatabaseClient,
  ) {
    return client.enquiry.create({
      data: {
        branchId,
        type: input.type,
        subject: input.subject,
        message: input.message,
        name: input.name,
        email: input.email,
        ...(input.phone === undefined ? {} : { phone: input.phone }),
        ...(input.type === "PRODUCT" ? { productId: input.productId } : {}),
        ...(input.type === "SERVICE" ? { serviceId: input.serviceId } : {}),
        ...(input.type === "VEHICLE" ? { vehicleListingId: input.vehicleListingId } : {}),
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  createCustomerEnquiry(
    customer: Awaited<ReturnType<SupportRepository["customer"]>>,
    input: CustomerEnquiryInput,
    branchId: string,
    client: DatabaseClient,
  ) {
    if (customer === null) return null;
    return client.enquiry.create({
      data: {
        customerId: customer.id,
        branchId,
        type: input.type,
        subject: input.subject,
        message: input.message,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.user.email,
        phone: customer.phone,
        ...(input.type === "PRODUCT" ? { productId: input.productId } : {}),
        ...(input.type === "SERVICE" ? { serviceId: input.serviceId } : {}),
        ...(input.type === "VEHICLE" ? { vehicleListingId: input.vehicleListingId } : {}),
        ...(input.type === "BOOKING" ? { bookingId: input.bookingId } : {}),
        ...(input.type === "QUOTATION" ? { quoteId: input.quoteId } : {}),
      },
      select: enquiryBaseSelect,
    });
  }

  createPublicComplaint(
    input: PublicComplaintInput,
    branchId: string,
    client: DatabaseClient,
  ) {
    return client.complaint.create({
      data: {
        branchId,
        subject: input.subject,
        description: input.description,
        name: input.name,
        email: input.email,
        ...(input.phone === undefined ? {} : { phone: input.phone }),
      },
      select: { id: true, status: true, priority: true, createdAt: true },
    });
  }

  createCustomerComplaint(
    customer: Awaited<ReturnType<SupportRepository["customer"]>>,
    input: CustomerComplaintInput,
    branchId: string,
    client: DatabaseClient,
  ) {
    if (customer === null) return null;
    return client.complaint.create({
      data: {
        customerId: customer.id,
        branchId,
        subject: input.subject,
        description: input.description,
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.user.email,
        phone: customer.phone,
        ...(input.bookingId === undefined ? {} : { bookingId: input.bookingId }),
        ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
        ...(input.vehicleTransactionId === undefined
          ? {}
          : { vehicleTransactionId: input.vehicleTransactionId }),
      },
      select: complaintBaseSelect,
    });
  }

  listCustomerEnquiries(customerId: string, query: CustomerSupportListQuery) {
    const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
    return this.database.enquiry.findMany({
      where: {
        customerId,
        ...(query.status && statuses.includes(query.status as (typeof statuses)[number])
          ? { status: query.status as (typeof statuses)[number] }
          : {}),
      },
      select: enquiryBaseSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  listCustomerComplaints(customerId: string, query: CustomerSupportListQuery) {
    const statuses = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"] as const;
    return this.database.complaint.findMany({
      where: {
        customerId,
        ...(query.status && statuses.includes(query.status as (typeof statuses)[number])
          ? { status: query.status as (typeof statuses)[number] }
          : {}),
      },
      select: complaintBaseSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  customerEnquiry(
    customerId: string,
    id: string,
    client: DatabaseClient = this.database,
  ) {
    return client.enquiry.findFirst({
      where: { id, customerId },
      select: {
        ...enquiryBaseSelect,
        messages: {
          where: { visibility: "CUSTOMER" },
          select: messageSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 200,
        },
      },
    });
  }

  customerComplaint(
    customerId: string,
    id: string,
    client: DatabaseClient = this.database,
  ) {
    return client.complaint.findFirst({
      where: { id, customerId },
      select: {
        ...complaintBaseSelect,
        messages: {
          where: { visibility: "CUSTOMER" },
          select: messageSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 200,
        },
      },
    });
  }

  customerThread(
    customerId: string,
    kind: "enquiry" | "complaint",
    id: string,
    client: DatabaseClient = this.database,
  ) {
    return kind === "enquiry"
      ? client.enquiry.findFirst({
          where: { id, customerId },
          select: {
            id: true,
            status: true,
            assignedStaffId: true,
          },
        })
      : client.complaint.findFirst({
          where: { id, customerId },
          select: {
            id: true,
            status: true,
            assignedStaffId: true,
          },
        });
  }

  staffThread(
    kind: "enquiry" | "complaint",
    id: string,
    client: DatabaseClient = this.database,
  ) {
    return kind === "enquiry"
      ? client.enquiry.findUnique({
          where: { id },
          select: { id: true, branchId: true, status: true },
        })
      : client.complaint.findUnique({
          where: { id },
          select: { id: true, branchId: true, status: true },
        });
  }

  async listMessages(
    kind: "enquiry" | "complaint",
    id: string,
    query: SupportMessageListQuery,
    customerVisibleOnly: boolean,
  ) {
    const target = kind === "enquiry" ? { enquiryId: id } : { complaintId: id };
    if (query.cursor) {
      const cursor = await this.database.supportMessage.findFirst({
        where: {
          id: query.cursor,
          ...target,
          ...(customerVisibleOnly ? { visibility: "CUSTOMER" as const } : {}),
        },
        select: { id: true },
      });
      if (cursor === null) return null;
    }
    return this.database.supportMessage.findMany({
      where: {
        ...target,
        ...(customerVisibleOnly ? { visibility: "CUSTOMER" as const } : {}),
      },
      select: messageSelect,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  listStaffEnquiries(query: StaffEnquiryListQuery, branchId: string | null) {
    return this.database.enquiry.findMany({
      where: {
        ...(branchId ? { branchId } : query.branchId ? { branchId: query.branchId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      },
      select: {
        ...enquiryBaseSelect,
        name: true,
        email: true,
        phone: true,
        customerId: true,
        customer: { select: { userId: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  listStaffComplaints(query: StaffComplaintListQuery, branchId: string | null) {
    return this.database.complaint.findMany({
      where: {
        ...(branchId ? { branchId } : query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assignedStaffId ? { assignedStaffId: query.assignedStaffId } : {}),
      },
      select: {
        ...complaintBaseSelect,
        name: true,
        email: true,
        phone: true,
        customerId: true,
        customer: { select: { userId: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  staffEnquiry(id: string, client: DatabaseClient = this.database) {
    return client.enquiry.findUnique({
      where: { id },
      select: {
        ...enquiryBaseSelect,
        name: true,
        email: true,
        phone: true,
        customerId: true,
        customer: { select: { userId: true } },
        messages: {
          select: messageSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 500,
        },
      },
    });
  }

  staffComplaint(id: string, client: DatabaseClient = this.database) {
    return client.complaint.findUnique({
      where: { id },
      select: {
        ...complaintBaseSelect,
        name: true,
        email: true,
        phone: true,
        customerId: true,
        customer: { select: { userId: true } },
        messages: {
          select: messageSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 500,
        },
      },
    });
  }

  createMessage(
    target: { enquiryId: string } | { complaintId: string },
    authorUserId: string,
    authorType: "CUSTOMER" | "STAFF",
    visibility: "CUSTOMER" | "INTERNAL",
    body: string,
    client: DatabaseClient,
  ) {
    return client.supportMessage.create({
      data: { ...target, authorUserId, authorType, visibility, body },
      select: messageSelect,
    });
  }

  updateEnquiry(
    id: string,
    expectedVersion: number,
    data: Prisma.EnquiryUncheckedUpdateManyInput,
    client: DatabaseClient,
  ) {
    return client.enquiry.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
  }

  updateComplaint(
    id: string,
    expectedVersion: number,
    data: Prisma.ComplaintUncheckedUpdateManyInput,
    client: DatabaseClient,
  ) {
    return client.complaint.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
  }

  listPublicReviews(query: PublicReviewListQuery) {
    return this.database.review.findMany({
      where: {
        status: "APPROVED",
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      },
      select: {
        id: true,
        targetType: true,
        rating: true,
        title: true,
        comment: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true } },
        service: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  listCustomerReviews(customerId: string, query: CustomerReviewListQuery) {
    return this.database.review.findMany({
      where: { customerId, ...(query.status ? { status: query.status } : {}) },
      select: reviewBaseSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  listStaffReviews(query: StaffReviewListQuery) {
    return this.database.review.findMany({
      where: {
        status: query.status,
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      select: {
        ...reviewBaseSelect,
        customer: { select: { firstName: true, lastName: true } },
        product: { select: { id: true, name: true, slug: true } },
        orderItem: { select: { id: true, orderId: true } },
        order: { select: { orderNumber: true } },
        booking: { select: { id: true, completedAt: true } },
        vehicleTransaction: { select: { transactionNumber: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  createReview(customerId: string, input: ReviewCreateInput, client: DatabaseClient) {
    return client.review.create({
      data: {
        customerId,
        targetType: input.targetType,
        rating: input.rating,
        ...(input.title === undefined ? {} : { title: input.title }),
        comment: input.comment,
        ...(input.targetType === "PRODUCT"
          ? { productId: input.productId, orderItemId: input.orderItemId }
          : {}),
        ...(input.targetType === "SERVICE"
          ? { serviceId: input.serviceId, bookingId: input.bookingId }
          : {}),
        ...(input.targetType === "ORDER" ? { orderId: input.orderId } : {}),
        ...(input.targetType === "VEHICLE_TRANSACTION"
          ? { vehicleTransactionId: input.vehicleTransactionId }
          : {}),
      },
      select: { id: true },
    });
  }

  review(id: string, client: DatabaseClient = this.database) {
    return client.review.findUnique({
      where: { id },
      select: {
        ...reviewBaseSelect,
        customerId: true,
        customer: { select: { userId: true } },
      },
    });
  }

  reviewForModeration(id: string, client: DatabaseClient) {
    return client.review.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        customer: { select: { userId: true } },
      },
    });
  }

  moderateReview(
    id: string,
    expectedVersion: number,
    status: "APPROVED" | "REJECTED",
    moderatorUserId: string,
    note: string | undefined,
    client: DatabaseClient,
  ) {
    return client.review.updateMany({
      where: { id, version: expectedVersion, status: "PENDING" },
      data: {
        status,
        moderatedByUserId: moderatorUserId,
        moderatedAt: new Date(),
        ...(note === undefined ? {} : { moderationNote: note }),
        version: { increment: 1 },
      },
    });
  }
}
