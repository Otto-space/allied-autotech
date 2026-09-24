import { z } from "zod";
export const privacyKinds = {
  ANONYMIZATION: "Anonymize my personal information",
  DELETION: "Delete my personal information",
} as const;
export const privacyStatuses = {
  REQUESTED: "Received for review",
  UNDER_REVIEW: "Under review",
  ON_HOLD: "On hold",
  APPROVED_PENDING_POLICY: "Approved, awaiting policy",
  REJECTED: "Not approved",
} as const;
export const reviewStatuses = [
  "UNDER_REVIEW",
  "ON_HOLD",
  "APPROVED_PENDING_POLICY",
  "REJECTED",
] as const;
export const privacyRequestSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  kind: z.enum(["ANONYMIZATION", "DELETION"]),
  reason: z.string(),
  status: z.enum([
    "REQUESTED",
    "UNDER_REVIEW",
    "ON_HOLD",
    "APPROVED_PENDING_POLICY",
    "REJECTED",
  ]),
  createdAt: z.iso.datetime({ offset: true }),
  reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  reviewNote: z.string().nullable(),
});
export type PrivacyRequest = z.infer<typeof privacyRequestSchema>;
export const parsePrivacyPage = (value: unknown) =>
  z
    .object({
      items: z.array(privacyRequestSchema),
      nextCursor: z
        .uuid()
        .nullish()
        .transform((v) => v ?? undefined),
    })
    .parse(value);
export const privacyIntakeSchema = z.object({
  kind: z.enum(["ANONYMIZATION", "DELETION"]),
  reason: z.string().trim().min(10).max(2000),
});
export const privacyReviewSchema = z.object({
  status: z.enum(reviewStatuses),
  note: z.string().trim().min(10).max(2000),
});
export const holdTypes = {
  ALL: "All records",
  ACCOUNT: "Account",
  PAYMENT: "Payment",
  INVOICE: "Invoice",
  AUDIT: "Audit",
  SUPPORT: "Support",
} as const;
const recordType = z.enum(["ALL", "ACCOUNT", "PAYMENT", "INVOICE", "AUDIT", "SUPPORT"]);
export const holdInputSchema = z.object({
  userId: z.uuid(),
  recordType,
  recordId: z.uuid().optional(),
  reason: z.string().trim().min(10).max(2000),
});
export const retentionHoldSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  recordType,
  recordId: z.uuid().nullable(),
  reason: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  releasedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type RetentionHold = z.infer<typeof retentionHoldSchema>;
export const parseHolds = (value: unknown) => z.array(retentionHoldSchema).parse(value);
export const releaseReasonSchema = z.string().trim().min(20).max(2000);
export const releasedHoldSchema = z.object({ id: z.uuid() });
