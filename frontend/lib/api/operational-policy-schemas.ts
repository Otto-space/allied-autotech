import { z } from "zod";
import { staffProfileSchema } from "./staff-booking-schemas";
export const complaintSettingsSchema = z.object({
  escalationUserId: z.uuid(),
  ordinaryBusinessDayDefinition: z.literal("ACCUMULATED_WORKING_HOURS"),
  holidays: z.array(z.iso.date()).max(100),
  holidayCalendarApproved: z.literal(true),
  urgentClassifications: z.array(z.string().trim().min(2).max(100)).min(1).max(30),
});
export const disputeSettingsSchema = z
  .object({
    primaryUserId: z.uuid(),
    backupUserId: z.uuid(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    openMinute: z.number().int().min(0).max(1438),
    closeMinute: z.number().int().min(1).max(1439),
    holidays: z.array(z.iso.date()).max(100),
  })
  .refine((v) => v.primaryUserId !== v.backupUserId, {
    path: ["backupUserId"],
    message: "Choose two different contacts.",
  })
  .refine((v) => v.openMinute < v.closeMinute, {
    path: ["closeMinute"],
    message: "Closing time must follow opening time.",
  });
export const retentionRecordTypes = {
  ACCOUNT: "Accounts",
  PAYMENT: "Payments",
  INVOICE: "Invoices",
  AUDIT: "Audit records",
  SUPPORT: "Support records",
} as const;
export const retentionDispositions = {
  REVIEW_ANONYMIZATION: "Review for anonymization",
  REVIEW_DELETION: "Review for deletion",
  RETAIN: "Retain",
} as const;
export const retentionSettingsSchema = z.object({
  destructiveExecutionEnabled: z.literal(false),
  records: z
    .array(
      z.object({
        recordType: z.enum(["ACCOUNT", "PAYMENT", "INVOICE", "AUDIT", "SUPPORT"]),
        retentionMonths: z.number().int().positive().max(1200),
        startEvent: z.string().trim().min(5).max(200),
        disposition: z.enum(["REVIEW_ANONYMIZATION", "REVIEW_DELETION", "RETAIN"]),
        legalBasis: z.string().trim().min(20).max(1000),
      }),
    )
    .min(1)
    .max(20),
});
export const operationalPolicySchemas = {
  COMPLAINTS: complaintSettingsSchema,
  DISPUTES: disputeSettingsSchema,
  RETENTION: retentionSettingsSchema,
};
export const operationalPolicyInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("COMPLAINTS"), settings: complaintSettingsSchema }),
  z.object({ kind: z.literal("DISPUTES"), settings: disputeSettingsSchema }),
  z.object({ kind: z.literal("RETENTION"), settings: retentionSettingsSchema }),
]);
export type OperationalPolicyKind = keyof typeof operationalPolicySchemas;
export const policyContactSchema = staffProfileSchema.extend({
  emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const parsePolicyContacts = (value: unknown) =>
  z
    .object({ items: z.array(policyContactSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const parsePolicyContact = (value: unknown) => policyContactSchema.parse(value);
