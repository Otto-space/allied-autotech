import { z } from "zod";
export const policyVersionSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  version: z.number().int().positive(),
  approvalStatus: z.string(),
  source: z.string(),
  sourceQuestion: z.string(),
  sourceSignatory: z.string().nullable(),
  approvedByUserId: z.uuid().nullable(),
  effectiveAt: z.iso.datetime({ offset: true }),
  recordedAt: z.iso.datetime({ offset: true }),
  approvalEvidence: z.string().nullable(),
  settings: z.unknown(),
});
export type PolicyVersion = z.infer<typeof policyVersionSchema>;
export const parsePolicyHistory = (value: unknown) =>
  z.array(policyVersionSchema).parse(value);
export const financeSettingsSchema = z.object({
  vatBasisPoints: z.literal(750),
  pricesIncludeVat: z.literal(false),
  rounding: z.literal("HALF_UP_MINOR_UNIT"),
  discountTreatment: z.literal("BEFORE_VAT"),
  deliveryTaxable: z.boolean(),
  invoiceName: z.string().trim().min(2).max(200),
  invoiceAddress: z.string().trim().min(10).max(500),
  paymentTerms: z.string().trim().min(10).max(1000),
  applicability: z.literal("ALL_PRODUCTS_AND_SERVICES"),
});
export const parseFinanceHistory = (value: unknown) => {
  const history = parsePolicyHistory(value);
  if (history.some((row) => row.key !== "finance"))
    throw new Error("Unexpected financial policy history");
  return history;
};
export const capacitySettingsSchema = z.object({
  dailyLimit: z.number().int().min(1).max(1000),
  openingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  opensAt: z.literal("08:00"),
  closesAt: z.literal("18:00"),
  holidays: z.array(z.iso.date()).max(366),
  timezone: z.literal("Africa/Lagos"),
});
export const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const bankRefundClockSettingsSchema = z.object({
  startEvent: z.enum(["REQUESTED", "APPROVED", "TRANSFER_RECORDED"]),
  businessDays: z.literal(10),
  countingConvention: z.literal("EXCLUDE_START_SAME_LOCAL_TIME"),
  bankingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  holidays: z.array(z.iso.date()).max(366),
  timezone: z.literal("Africa/Lagos"),
});
export const refundStartEvents = {
  REQUESTED: "Refund requested",
  APPROVED: "Refund approved",
  TRANSFER_RECORDED: "Bank transfer recorded",
} as const;
