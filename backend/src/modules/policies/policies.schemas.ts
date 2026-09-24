import { z } from "zod";
import { capacitySettingsSchema } from "../service-operations/booking-capacity.js";

export const capabilityListQuerySchema = z
  .object({
    userId: z.uuid(),
    activeOnly: z.enum(["true", "false"]).optional(),
  })
  .strict();

const metadata = {
  expectedVersion: z.number().int().nonnegative(),
  effectiveAt: z.iso.datetime(),
  source: z.string().trim().min(10).max(500),
  approvalEvidence: z.string().trim().min(20).max(1000),
};
export const financeSettingsSchema = z
  .object({
    vatBasisPoints: z.literal(750),
    pricesIncludeVat: z.literal(false),
    rounding: z.literal("HALF_UP_MINOR_UNIT"),
    discountTreatment: z.literal("BEFORE_VAT"),
    deliveryTaxable: z.boolean(),
    invoiceName: z.string().trim().min(2).max(200),
    invoiceAddress: z.string().trim().min(10).max(500),
    paymentTerms: z.string().trim().min(10).max(1000),
    applicability: z.literal("ALL_PRODUCTS_AND_SERVICES"),
  })
  .strict();
const deliveryAreaText = (max: number) =>
  z
    .string()
    .trim()
    .min(2)
    .max(max)
    .refine(
      (value) =>
        [...value].every(
          (character) =>
            (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
        ),
      "Use plain text without control characters",
    );
export const deliverySettingsSchema = z
  .object({
    collectionEnabled: z.literal(true),
    collectionAddress: z.literal(
      "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    ),
    zones: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,64}$/),
            label: deliveryAreaText(160),
            city: deliveryAreaText(120),
            state: deliveryAreaText(120),
            feeKobo: z.string().regex(/^\d{1,15}$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (value) => new Set(value.zones.map((zone) => zone.id)).size === value.zones.length,
    "Zone identifiers must be unique",
  );
export const publicFulfillmentOptionsSchema = z.object({
  serverTime: z.iso.datetime(),
  currency: z.literal("NGN"),
  checkoutEnabled: z.boolean(),
  collection: z.object({
    enabled: z.literal(true),
    address: z.literal(
      "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    ),
  }),
  delivery: z.discriminatedUnion("enabled", [
    z.object({
      enabled: z.literal(false),
      policyVersion: z.null(),
      zones: z.array(deliverySettingsSchema.shape.zones.element).max(0),
    }),
    z.object({
      enabled: z.literal(true),
      policyVersion: z.number().int().positive(),
      zones: deliverySettingsSchema.shape.zones,
    }),
  ]),
});
export const publishPolicyBodySchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...metadata,
      kind: z.literal("BANK_REFUND_CLOCK"),
      settings: z
        .object({
          startEvent: z.enum(["REQUESTED", "APPROVED", "TRANSFER_RECORDED"]),
          businessDays: z.literal(10),
          countingConvention: z.literal("EXCLUDE_START_SAME_LOCAL_TIME"),
          bankingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          holidays: z.array(z.iso.date()).max(366),
          timezone: z.literal("Africa/Lagos"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...metadata,
      kind: z.literal("COMPLAINTS"),
      settings: z
        .object({
          escalationUserId: z.uuid(),
          ordinaryBusinessDayDefinition: z.literal("ACCUMULATED_WORKING_HOURS"),
          holidays: z.array(z.iso.date()).max(100),
          holidayCalendarApproved: z.literal(true),
          urgentClassifications: z
            .array(z.string().trim().min(2).max(100))
            .min(1)
            .max(30),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...metadata,
      kind: z.literal("DISPUTES"),
      settings: z
        .object({
          primaryUserId: z.uuid(),
          backupUserId: z.uuid(),
          days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          openMinute: z.number().int().min(0).max(1438),
          closeMinute: z.number().int().min(1).max(1439),
          holidays: z.array(z.iso.date()).max(100),
        })
        .strict()
        .refine(
          (v) => v.primaryUserId !== v.backupUserId && v.openMinute < v.closeMinute,
          "Distinct assignees and valid working hours required",
        ),
    })
    .strict(),
  z
    .object({
      ...metadata,
      kind: z.literal("RETENTION"),
      settings: z
        .object({
          destructiveExecutionEnabled: z.literal(false),
          records: z
            .array(
              z
                .object({
                  recordType: z.enum([
                    "ACCOUNT",
                    "PAYMENT",
                    "INVOICE",
                    "AUDIT",
                    "SUPPORT",
                  ]),
                  retentionMonths: z.number().int().positive().max(1200),
                  startEvent: z.string().trim().min(5).max(200),
                  disposition: z.enum([
                    "REVIEW_ANONYMIZATION",
                    "REVIEW_DELETION",
                    "RETAIN",
                  ]),
                  legalBasis: z.string().trim().min(20).max(1000),
                })
                .strict(),
            )
            .min(1)
            .max(20),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...metadata,
      kind: z.literal("BRANCH_CAPACITY"),
      branchId: z.uuid(),
      settings: capacitySettingsSchema,
    })
    .strict(),
  z
    .object({ ...metadata, kind: z.literal("FINANCE"), settings: financeSettingsSchema })
    .strict(),
  z
    .object({
      ...metadata,
      kind: z.literal("DELIVERY"),
      settings: deliverySettingsSchema,
    })
    .strict(),
]);
export type PublishPolicyInput = z.infer<typeof publishPolicyBodySchema>;
