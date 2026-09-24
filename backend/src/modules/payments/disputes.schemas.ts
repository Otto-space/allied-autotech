import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { paymentEvidenceUploadBodySchema } from "./payments.schemas.js";
const expected = { expectedUpdatedAt: z.iso.datetime({ offset: true }).optional() };
export const disputeListSchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    openOnly: z.enum(["true", "false"]).default("true"),
  })
  .strict();
export const disputeAssignmentSchema = z
  .object({ primaryUserId: z.uuid(), backupUserId: z.uuid(), ...expected })
  .strict()
  .refine((v) => v.primaryUserId !== v.backupUserId, "Primary and backup must differ");
export const disputeAcknowledgementSchema = z
  .object({ note: z.string().trim().min(10).max(2000), ...expected })
  .strict();
export const disputeEvidenceSchema = z
  .object({
    evidenceToken: z.string().min(20).max(8000),
    invoice: z.literal(true),
    fulfillmentOrHandoverProof: z.literal(true),
    relevantCustomerMessages: z.literal(true),
    note: z.string().trim().min(10).max(2000),
    ...expected,
  })
  .strict();
export const disputeSubmissionSchema = z
  .object({
    providerSubmissionReference: z.string().trim().min(3).max(200),
    submittedAt: z.iso.datetime(),
    note: z.string().trim().min(10).max(2000),
    ...expected,
  })
  .strict();
export const disputeActionParams = z.object({
  id: z.uuid(),
  action: z.enum([
    "assign",
    "acknowledge",
    "evidence-upload",
    "evidence",
    "evidence-access",
    "submission",
  ]),
});
export const disputeActionBodies = {
  assign: disputeAssignmentSchema,
  acknowledge: disputeAcknowledgementSchema,
  "evidence-upload": paymentEvidenceUploadBodySchema,
  evidence: disputeEvidenceSchema,
  "evidence-access": z.object({}).strict(),
  submission: disputeSubmissionSchema,
};
const operatorSelect = {
  id: true,
  email: true,
  staffProfile: { select: { firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;
function operatorLabel(
  user: Prisma.UserGetPayload<{ select: typeof operatorSelect }> | null,
) {
  return user
    ? {
        id: user.id,
        label: user.staffProfile
          ? `${user.staffProfile.firstName} ${user.staffProfile.lastName} (${user.email})`
          : user.email,
      }
    : null;
}
export const disputeRecordSelect = {
  id: true,
  paymentAttemptId: true,
  provider: true,
  providerDisputeId: true,
  status: true,
  category: true,
  amountKobo: true,
  currency: true,
  openedAt: true,
  primaryUserId: true,
  backupUserId: true,
  primaryUserIdRelation: { select: operatorSelect },
  backupUserIdRelation: { select: operatorSelect },
  responseDueAt: true,
  acknowledgedAt: true,
  acknowledgedByUserId: true,
  acknowledgementDueAt: true,
  respondedAt: true,
  resolvedAt: true,
  evidenceChecklist: true,
  providerSubmissionReference: true,
  updatedAt: true,
  evidenceObjectKey: true,
} satisfies Prisma.PaymentDisputeSelect;
export function disputeRecord(
  row: Prisma.PaymentDisputeGetPayload<{ select: typeof disputeRecordSelect }>,
) {
  const { evidenceObjectKey, primaryUserIdRelation, backupUserIdRelation, ...rest } = row;
  return {
    ...rest,
    amountKobo: row.amountKobo.toString(),
    hasEvidence: evidenceObjectKey !== null,
    primaryOperator: operatorLabel(primaryUserIdRelation),
    backupOperator: operatorLabel(backupUserIdRelation),
  };
}
const date = z.iso.datetime({ offset: true }).nullable();
export const disputeRecordSchema = z.object({
  id: z.uuid(),
  paymentAttemptId: z.uuid(),
  provider: z.enum(["PAYSTACK", "MONNIFY", "MANUAL"]),
  providerDisputeId: z.string(),
  status: z.enum([
    "AWAITING_RESPONSE",
    "UNDER_REVIEW",
    "WON",
    "LOST",
    "ACCEPTED",
    "EXPIRED",
  ]),
  category: z.enum([
    "NOT_RECOGNIZED",
    "FRAUD",
    "NOT_RECEIVED",
    "NOT_AS_DESCRIBED",
    "DUPLICATE_CHARGE",
    "REFUND_NOT_RECEIVED",
    "OTHER",
  ]),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.literal("NGN"),
  openedAt: z.iso.datetime({ offset: true }),
  primaryUserId: z.uuid().nullable(),
  backupUserId: z.uuid().nullable(),
  primaryOperator: z.object({ id: z.uuid(), label: z.string() }).nullable(),
  backupOperator: z.object({ id: z.uuid(), label: z.string() }).nullable(),
  responseDueAt: date,
  acknowledgedAt: date,
  acknowledgedByUserId: z.uuid().nullable(),
  acknowledgementDueAt: date,
  respondedAt: date,
  resolvedAt: date,
  evidenceChecklist: z.unknown().nullable(),
  providerSubmissionReference: z.string().nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
  hasEvidence: z.boolean(),
});
export const privateEvidenceUploadSchema = z.object({
  evidenceToken: z.string().min(80).max(4096),
  upload: z.object({
    method: z.literal("PUT"),
    url: z.url(),
    expiresAt: z.iso.datetime({ offset: true }),
    headers: z.record(z.string(), z.string()),
  }),
});
