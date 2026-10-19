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
export const workforceReplySchema = z.strictObject({
  expectedVersion: version,
  body: z.string().trim().min(1).max(5000),
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
  scheduledAt: timestamp,
  status: z.string(),
  version,
  service: z.object({ name: z.string() }),
  customer: z.object({ firstName: z.string(), lastName: z.string(), phone: z.string() }),
});
const enquiryRow = queueBase.extend({
  subject: z.string(),
  message: z.string(),
  type: z.string(),
  assignedStaffId: z.uuid().nullable(),
});
const complaintRow = queueBase.extend({
  subject: z.string(),
  description: z.string(),
  priority: z.string(),
});
const orderRow = queueBase.extend({
  orderNumber: z.string(),
  fulfillmentMethod: z.string(),
  paidAt: timestamp.nullable(),
  items: z.array(z.object({ productName: z.string(), quantity: z.number().int() })),
});
const financeRow = z.object({
  id: z.uuid(),
  paymentNumber: z.string(),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.string(),
  status: z.string(),
  createdAt: timestamp,
  succeededAt: timestamp.nullable(),
});
export function workforceResponseSchema(action: string): z.ZodType {
  switch (action) {
    case "jobAssignees":
    case "enquiryAssignees":
      return z.object({
        items: z.array(
          z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
        ),
      });
    case "own":
      return workforceOwnResponseSchema;
    case "overview":
      return z.object({
        counts: z.record(z.string(), z.number().int().min(0)),
        generatedAt: timestamp,
      });
    case "jobs":
      return pageOf(workforceJobResponseSchema);
    case "bookings":
      return pageOf(bookingRow);
    case "job":
    case "work":
    case "quality":
    case "jobAssignment":
      return workforceJobResponseSchema;
    case "enquiries":
      return pageOf(enquiryRow);
    case "complaints":
      return pageOf(complaintRow);
    case "orders":
      return pageOf(orderRow);
    case "prepare":
      return orderRow;
    case "finance":
      return pageOf(financeRow);
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
    case "complaintReply":
    case "enquiryAssignment":
      return z.object({ id: z.uuid(), version });
    default:
      throw Error(`Missing workforce response contract: ${action}`);
  }
}
