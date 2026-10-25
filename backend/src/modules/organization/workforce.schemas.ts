import { supportEmailDeliveryPageSchema } from "../support/customer-email.js";
export { supportDeliveryDismissSchema } from "../support/customer-email.js";
import { z } from "zod";
import { positionSchema, templateSchema } from "./workforce.policy.js";

const version = z.number().int().min(0);
const reason = z.string().trim().min(10).max(1000);
export const workforceAccountParams = z.strictObject({ userId: z.uuid() });
export const workforceAssignmentParams = workforceAccountParams.extend({
  assignmentId: z.uuid(),
});
export const workforceRecordParams = z.strictObject({ id: z.uuid() });
export const workforceEnrollmentSchema = z.strictObject({
  position: positionSchema,
  expectedVersion: version.nullable(),
  currentPassword: z.string().min(1).max(256),
  reason,
});
export const workforceAssignmentSchema = z
  .strictObject({
    template: templateSchema,
    branchId: z.uuid(),
    temporary: z.boolean(),
    startsAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    reason,
    expectedVersion: version,
    currentPassword: z.string().min(1).max(256),
  })
  .refine((v) => !v.expiresAt || new Date(v.expiresAt) > new Date(v.startsAt), {
    message: "Expiry must follow the start time",
    path: ["expiresAt"],
  });
export const workforceRevocationSchema = z.strictObject({
  expectedVersion: version,
  reason,
  currentPassword: z.string().min(1).max(256),
});
export const workforceDelegationSchema = workforceRevocationSchema.extend({
  allowAdminInvitations: z.boolean().default(false),
  templates: z.array(templateSchema).max(8),
  branchIds: z.array(z.uuid()).max(20),
});
export const workforceListSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.uuid().optional(),
});
export const workforceMessageQuerySchema = workforceListSchema
  .extend({ messageId: z.uuid().optional() })
  .refine((query) => !(query.cursor && query.messageId), {
    message: "Choose a message anchor or a page cursor",
  });
export const workforceJobsQuerySchema = workforceListSchema.extend({
  q: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) =>
        ![...value].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
      "Search cannot contain control characters",
    )
    .optional(),
  workStatus: z
    .enum([
      "DRAFT",
      "APPROVED",
      "IN_PROGRESS",
      "AWAITING_PARTS",
      "QUALITY_CHECK",
      "COMPLETED",
      "CANCELLED",
      "NOT_CREATED",
    ])
    .optional(),
});
export const workforceBookingsQuerySchema = workforceListSchema.extend({
  q: workforceJobsQuerySchema.shape.q,
  status: z
    .enum([
      "REQUESTED",
      "AWAITING_DEPOSIT",
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "NO_SHOW",
      "EXPIRED",
    ])
    .optional(),
});

export const workforceEnquiriesQuerySchema = workforceListSchema.extend({
  q: workforceJobsQuerySchema.shape.q,
  type: z
    .enum(["GENERAL", "PRODUCT", "VEHICLE", "SERVICE", "BOOKING", "QUOTATION"])
    .optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
});

export const workforceComplaintsQuerySchema = workforceListSchema.extend({
  q: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .refine(
      (value) => ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
      "Search cannot contain control characters",
    )
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
});

// No query retains the legacy unpaginated options contract. Explicit query enables paging.
export const workforceJobAssigneesQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.uuid().optional(),
  q: workforceJobsQuerySchema.shape.q,
});
export const workforceEnquiryAssigneesQuerySchema = workforceJobAssigneesQuerySchema;
export const workforceWorkSchema = z
  .strictObject({
    expectedVersion: version,
    diagnosis: z.string().trim().min(1).max(5000).optional(),
    internalNotes: z.string().trim().min(1).max(5000).optional(),
    status: z.enum(["IN_PROGRESS", "AWAITING_PARTS", "QUALITY_CHECK"]).optional(),
  })
  .refine(
    (v) =>
      v.diagnosis !== undefined ||
      v.internalNotes !== undefined ||
      v.status !== undefined,
    { message: "Provide a work update" },
  );
export const workforceQualitySchema = z.strictObject({
  expectedVersion: version,
  reason,
});
export const workforceJobAssignmentSchema = z.strictObject({
  expectedVersion: version,
  staffId: z.uuid(),
  reason,
});
export const workforceOrderSchema = z.strictObject({
  expectedVersion: version,
  status: z.enum(["PROCESSING", "READY"]),
  reason,
});
export const workforceOrdersQuerySchema = workforceListSchema.extend({
  q: workforceComplaintsQuerySchema.shape.q,
  status: z
    .enum(["PENDING", "CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"])
    .optional(),
  fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]).optional(),
});
export const workforceReplySchema = z.strictObject({
  expectedVersion: version,
  body: z.string().trim().min(1).max(5000),
});
export const workforceEnquiryReplySchema = workforceReplySchema.extend({
  expectedLatestMessageId: z.uuid().nullable().optional(),
});
export const workforceComplaintReplySchema = workforceReplySchema.extend({
  expectedLatestMessageId: z.uuid().nullable().optional(),
});
export const workforceEnquiryAssignmentSchema = z.strictObject({
  expectedVersion: version,
  staffId: z.uuid(),
  reason,
});

const timestamp = z.iso.datetime({ offset: true });
export const workforceAssignmentResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  template: templateSchema,
  branchId: z.uuid(),
  scope: z.enum(["BRANCH", "ASSIGNED"]),
  temporary: z.boolean(),
  startsAt: timestamp,
  expiresAt: timestamp.nullable(),
  reason: z.string(),
  assignedByUserId: z.uuid(),
  createdAt: timestamp,
  revokedAt: timestamp.nullable(),
  revokedByUserId: z.uuid().nullable(),
  revocationReason: z.string().nullable(),
});
const accessRecord = z.object({
  userId: z.uuid(),
  position: positionSchema,
  enabledAt: timestamp,
  updatedByUserId: z.uuid(),
  version,
  delegatedTemplates: z.array(z.string()),
  delegatedBranchIds: z.array(z.uuid()),
});
export const workforceOwnResponseSchema = z.object({
  managed: z.boolean(),
  userId: z.uuid(),
  staffId: z.uuid().nullable(),
  position: positionSchema.nullable(),
  department: z.string().nullable(),
  version,
  assignments: z.array(workforceAssignmentResponseSchema),
  permissions: z.array(z.string()),
  canManageAssignments: z.boolean(),
  canInviteAdmins: z.boolean(),
  serverTime: timestamp,
});
export const workforceJobResponseSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  scheduledAt: timestamp,
  status: z.string(),
  version,
  assignedStaffId: z.uuid().nullable(),
  customerNotes: z.string().nullable(),
  service: z.object({ name: z.string() }),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  workOrder: z
    .object({
      id: z.uuid(),
      workOrderNumber: z.string(),
      status: z.string(),
      diagnosis: z.string().nullable(),
      internalNotes: z.string().nullable(),
      version,
      workedByUserIds: z.array(z.uuid()),
      qualityApprovedByUserId: z.uuid().nullable(),
      qualityApprovedAt: timestamp.nullable(),
    })
    .nullable(),
});
export const workforceJobDetailResponseSchema = workforceJobResponseSchema.extend({
  generatedAt: timestamp,
  access: workforceOwnResponseSchema,
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignedStaff: z
    .object({ id: z.uuid(), firstName: z.string(), lastName: z.string() })
    .nullable(),
});
const pageOf = (item: z.ZodType) =>
  z.object({ items: z.array(item), nextCursor: z.uuid().optional() });
const queueBase = z.object({
  id: z.uuid(),
  status: z.string(),
  version,
  createdAt: timestamp,
});
const bookingRow = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().int().nullable(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  scheduledAt: timestamp,
  status: z.string(),
  version,
  service: z.object({ name: z.string() }),
  customer: z.object({ firstName: z.string(), lastName: z.string(), phone: z.string() }),
});
const enquiryRow = queueBase.extend({
  contact: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      customerId: z.uuid().nullable(),
    })
    .optional(),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignedStaff: z
    .object({ id: z.uuid(), firstName: z.string(), lastName: z.string() })
    .nullable(),
  updatedAt: timestamp,
  subject: z.string(),
  message: z.string(),
  type: z.string(),
  vehicleEnquiryIntent: z.enum(["LISTING", "REQUIREMENTS"]).nullable(),
  assignedStaffId: z.uuid().nullable(),
});
const enquiryMessage = z.object({
  kind: z.enum(["LEGACY", "REPLY", "INTERNAL_NOTE", "STATUS_CHANGE"]),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
  id: z.uuid(),
  authorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM"]),
  visibility: z.literal("CUSTOMER"),
  body: z.string(),
  createdAt: timestamp,
});
const enquiryReceiptBase = z.object({
  id: z.uuid(),
  version,
  branchId: z.uuid(),
  actorUserId: z.uuid(),
  generatedAt: timestamp,
  access: workforceOwnResponseSchema,
});
const complaintRow = queueBase.extend({
  contact: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      customerId: z.uuid().nullable(),
    })
    .optional(),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  updatedAt: timestamp,
  subject: z.string(),
  description: z.string(),
  priority: z.string(),
});
const orderRow = queueBase.extend({
  orderNumber: z.string(),
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]),
  fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  updatedAt: timestamp,
  paidAt: timestamp.nullable(),
  availableNextStates: z.array(z.enum(["PROCESSING", "READY"])).max(1),
  items: z.array(z.object({ productName: z.string(), quantity: z.number().int() })),
});
const orderDetail = orderRow.extend({
  confirmedAt: timestamp.nullable(),
  processingAt: timestamp.nullable(),
  readyAt: timestamp.nullable(),
  completedAt: timestamp.nullable(),
  cancelledAt: timestamp.nullable(),
  access: workforceOwnResponseSchema,
  generatedAt: timestamp,
});
const financeRow = z.object({
  id: z.uuid(),
  paymentNumber: z.string(),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum([
    "REQUIRES_PAYMENT",
    "PROCESSING",
    "REQUIRES_REVIEW",
    "SUCCEEDED",
    "CANCELLED",
    "EXPIRED",
  ]),
  purpose: z.enum([
    "ORDER_PAYMENT",
    "SERVICE_INVOICE",
    "BOOKING_DEPOSIT",
    "VEHICLE_RESERVATION",
    "VEHICLE_PARTIAL_PAYMENT",
    "VEHICLE_BALANCE_PAYMENT",
    "VEHICLE_FULL_PAYMENT",
  ]),
  createdAt: timestamp,
  succeededAt: timestamp.nullable(),
  sources: z
    .array(
      z.object({
        kind: z.enum(["ORDER", "BOOKING", "INVOICE"]),
        reference: z.string(),
        branch: z.object({ id: z.uuid(), name: z.string() }),
      }),
    )
    .min(1)
    .max(4),
});
export const workforceFinanceQuerySchema = workforceListSchema.extend({
  q: workforceJobsQuerySchema.shape.q,
  status: financeRow.shape.status.optional(),
  purpose: financeRow.shape.purpose.optional(),
});
export function workforceResponseSchema(action: string): z.ZodType {
  switch (action) {
    case "enquiryDeliveryDismiss":
    case "complaintDeliveryDismiss":
      return supportEmailDeliveryPageSchema;
    case "jobAssignees":
      return z.object({
        items: z.array(
          z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
        ),
        nextCursor: z.uuid().optional(),
        generatedAt: timestamp.optional(),
        access: workforceOwnResponseSchema.optional(),
        jobId: z.uuid().optional(),
        jobVersion: version.optional(),
        branchId: z.uuid().optional(),
      });
    case "enquiryAssignees":
      return z.object({
        items: z.array(
          z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
        ),
        nextCursor: z.uuid().optional(),
        generatedAt: timestamp.optional(),
        access: workforceOwnResponseSchema.optional(),
        enquiryId: z.uuid().optional(),
        enquiryVersion: version.optional(),
        branchId: z.uuid().optional(),
      });
    case "own":
      return workforceOwnResponseSchema;
    case "overview":
      return z.object({
        counts: z.record(z.string(), z.number().int().min(0)),
        generatedAt: timestamp,
        access: workforceOwnResponseSchema,
        branches: z.array(z.object({ id: z.uuid(), name: z.string() })),
      });
    case "jobs":
      return pageOf(workforceJobResponseSchema).extend({
        generatedAt: timestamp,
        access: workforceOwnResponseSchema,
      });
    case "booking":
      return bookingRow.extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "bookings":
      return pageOf(bookingRow).extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "job":
    case "work":
    case "quality":
    case "jobAssignment":
      return workforceJobDetailResponseSchema;
    case "enquiries":
      return pageOf(enquiryRow).extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "enquiry":
      return enquiryRow.extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
        latestMessageId: z.uuid().nullable(),
        messages: pageOf(enquiryMessage.extend({ isOwn: z.boolean() })),
        emailDeliveries: supportEmailDeliveryPageSchema,
      });
    case "complaints":
      return pageOf(complaintRow).extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "complaint":
      return complaintRow.extend({
        acknowledgedAt: timestamp.nullable(),
        acknowledgementDueAt: timestamp.nullable(),
        escalatedAt: timestamp.nullable(),
        resolution: z.string().nullable(),
        resolvedAt: timestamp.nullable(),
        closedAt: timestamp.nullable(),
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
        latestMessageId: z.uuid().nullable(),
        messages: pageOf(enquiryMessage.extend({ isOwn: z.boolean() })),
        emailDeliveries: supportEmailDeliveryPageSchema,
      });
    case "orders":
      return pageOf(orderRow).extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "order":
      return orderDetail;
    case "prepare":
      return orderDetail.extend({
        action: z.literal("prepare"),
        actorUserId: z.uuid(),
        previousVersion: version,
        previousStatus: z.enum(["CONFIRMED", "PROCESSING"]),
        reason,
      });
    case "finance":
      return pageOf(financeRow).extend({
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "financePayment":
      return financeRow.extend({
        updatedAt: timestamp,
        expiresAt: timestamp.nullable(),
        cancelledAt: timestamp.nullable(),
        expiredAt: timestamp.nullable(),
        access: workforceOwnResponseSchema,
        generatedAt: timestamp,
      });
    case "enroll":
    case "delegate":
      return accessRecord;
    case "assign":
    case "revoke":
      return workforceAssignmentResponseSchema;
    case "inspect":
      return z.object({
        userId: z.uuid(),
        accountLabel: z.string(),
        branches: z.array(
          z.object({
            id: z.uuid(),
            name: z.string(),
            code: z.string(),
            isActive: z.boolean(),
          }),
        ),
        management: z.object({
          canEnroll: z.boolean(),
          canAssign: z.boolean(),
          canRevoke: z.boolean(),
          canDelegate: z.boolean(),
          templates: z.array(templateSchema),
          branchIds: z.array(z.uuid()).nullable(),
        }),
        access: accessRecord.nullable(),
        assignments: z.array(workforceAssignmentResponseSchema),
        activeAssignmentIds: z.array(z.uuid()),
        templates: z.record(
          z.string(),
          z.object({
            label: z.string(),
            department: z.string(),
            scope: z.string(),
            actions: z.array(z.string()),
          }),
        ),
      });
    case "inviteAdmin":
      return z.object({
        delivery: z.literal("QUEUED"),
        invitation: z.object({
          id: z.uuid(),
          email: z.email(),
          role: z.literal("ADMIN"),
          recipientId: z.uuid(),
          invitedById: z.uuid(),
          createdAt: timestamp,
          expiresAt: timestamp,
          usedAt: timestamp.nullable(),
          revokedAt: timestamp.nullable(),
          status: z.string(),
        }),
      });
    case "reply":
      return enquiryReceiptBase.extend({
        action: z.literal("reply"),
        messageReceipt: enquiryMessage.extend({ enquiryId: z.uuid() }),
      });
    case "enquiryAssignment":
      return enquiryReceiptBase.extend({
        action: z.literal("assignment"),
        assignmentReceipt: z.object({
          staffId: z.uuid(),
          previousStaffId: z.uuid().nullable(),
          reason: z.string(),
        }),
      });
    case "complaintReply":
      return enquiryReceiptBase.extend({
        action: z.literal("reply"),
        messageReceipt: enquiryMessage.extend({ complaintId: z.uuid() }),
      });
    default:
      throw Error(`Missing workforce response contract: ${action}`);
  }
}
