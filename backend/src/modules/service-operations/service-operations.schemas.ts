import { z } from "zod";

const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      "Contains invalid characters",
    );
const nullableText = (maximum: number) => cleanText(maximum).nullable().optional();
const uuid = z.uuid();
const version = z.number().int().min(0).max(2_147_483_647);
const kobo = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/, "Use integer kobo");
const dateTime = z.iso.datetime({ offset: true });
const optionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const pageFields = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;

export const serviceOperationsEmptyBodySchema = z.object({}).strict().default({});
export const serviceOperationsEmptyQuerySchema = z.object({}).strict().default({});
export const serviceParamsSchema = z.object({ serviceId: uuid }).strict();
export const bookingParamsSchema = z.object({ bookingId: uuid }).strict();
export const bookingSlotParamsSchema = z.object({ slotId: uuid }).strict();
export const quoteParamsSchema = z.object({ bookingId: uuid, quoteId: uuid }).strict();
export const workOrderParamsSchema = z
  .object({ bookingId: uuid, workOrderId: uuid })
  .strict();

export const publicServiceListQuerySchema = z
  .object({
    ...pageFields,
    pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]).optional(),
  })
  .strict();
export const adminServiceListQuerySchema = publicServiceListQuerySchema.extend({
  isActive: optionalBoolean,
});

const serviceFields = {
  name: cleanText(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: nullableText(10_000),
  shortDescription: nullableText(500),
  pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
  priceKobo: kobo.nullable(),
  currency: z.literal("NGN").default("NGN"),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(24 * 60),
  isActive: z.boolean().default(true),
} as const;
const validServicePrice = (value: {
  pricingType?: "FIXED" | "QUOTE_REQUIRED";
  priceKobo?: string | null;
}) => value.pricingType !== "FIXED" || value.priceKobo != null;
export const serviceCreateBodySchema = z
  .object(serviceFields)
  .strict()
  .refine(validServicePrice, {
    path: ["priceKobo"],
    message: "Required for fixed pricing",
  });
export const serviceUpdateBodySchema = z
  .object({
    expectedVersion: version,
    name: serviceFields.name.optional(),
    slug: serviceFields.slug.optional(),
    description: serviceFields.description,
    shortDescription: serviceFields.shortDescription,
    pricingType: serviceFields.pricingType.optional(),
    priceKobo: serviceFields.priceKobo.optional(),
    currency: z.literal("NGN").optional(),
    durationMinutes: serviceFields.durationMinutes.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "At least one change is required");

const bookingStatus = z.enum([
  "REQUESTED",
  "AWAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
]);
export const customerBookingListQuerySchema = z
  .object({ ...pageFields, status: bookingStatus.optional() })
  .strict();
export const staffBookingListQuerySchema = customerBookingListQuerySchema
  .extend({
    branchId: uuid.optional(),
    assignedStaffId: uuid.optional(),
    scheduledFrom: dateTime.optional(),
    scheduledTo: dateTime.optional(),
  })
  .superRefine((value, context) => {
    if (value.scheduledFrom === undefined || value.scheduledTo === undefined) return;
    const from = new Date(value.scheduledFrom).getTime();
    const to = new Date(value.scheduledTo).getTime();
    if (to <= from)
      context.addIssue({
        code: "custom",
        path: ["scheduledTo"],
        message: "Must follow scheduledFrom",
      });
    if (to - from > 366 * 24 * 60 * 60 * 1_000)
      context.addIssue({
        code: "custom",
        path: ["scheduledTo"],
        message: "Date range cannot exceed 366 days",
      });
  });
export const bookingCreateBodySchema = z
  .object({
    slotId: uuid,
    vehicleId: uuid.optional(),
    customerNotes: nullableText(2_000),
    policyVersion: cleanText(80),
    acceptNonRefundableDeposit: z.boolean().optional(),
  })
  .strict();
export const bookingRescheduleBodySchema = z
  .object({ slotId: uuid, expectedVersion: version })
  .strict();
export const bookingCancelBodySchema = z
  .object({ reason: cleanText(500), expectedVersion: version })
  .strict();
export const bookingAssignmentBodySchema = z
  .object({ assignedStaffId: uuid, expectedVersion: version })
  .strict();
export const bookingTransitionBodySchema = z
  .object({
    status: z.enum(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
    expectedVersion: version,
    reason: cleanText(500).optional(),
    staffNotes: nullableText(4_000),
    resourceReviewNote: cleanText(2000).optional(),
  })
  .strict();

export const bookingIdempotencyHeadersSchema = z.looseObject({
  "idempotency-key": z
    .string()
    .trim()
    .min(16)
    .max(120)
    .regex(/^[\x21-\x7E]+$/),
});
export const publicBookingSlotListQuerySchema = z
  .object({
    branchId: uuid,
    from: dateTime.optional(),
    to: dateTime.optional(),
    ...pageFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.from === undefined || value.to === undefined) return;
    if (new Date(value.to) <= new Date(value.from))
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Must follow from",
      });
  });
export const staffBookingSlotListQuerySchema = z
  .object({
    branchId: uuid.optional(),
    serviceId: uuid.optional(),
    staffId: uuid.optional(),
    status: z.enum(["OPEN", "CLOSED"]).optional(),
    startsFrom: dateTime.optional(),
    startsTo: dateTime.optional(),
    ...pageFields,
  })
  .strict();
export const bookingSlotCreateBodySchema = z
  .object({ branchId: uuid, serviceId: uuid, staffId: uuid, startsAt: dateTime })
  .strict();
export const bookingSlotUpdateBodySchema = z
  .object({ expectedVersion: version, status: z.enum(["OPEN", "CLOSED"]) })
  .strict();
export const bookingDisruptionBodySchema = z
  .object({ expectedVersion: version, reason: cleanText(1_000) })
  .strict();
export const bookingDisruptionResolutionBodySchema = z.discriminatedUnion("resolution", [
  z
    .object({
      resolution: z.literal("TRANSFER"),
      slotId: uuid,
      expectedVersion: version,
    })
    .strict(),
  z.object({ resolution: z.literal("REFUND"), expectedVersion: version }).strict(),
]);

const partLine = z
  .object({
    type: z.literal("PART"),
    productId: uuid,
    quantity: z.number().int().min(1).max(10_000),
    description: cleanText(500).optional(),
  })
  .strict();
const pricedLine = z
  .object({
    type: z.enum(["LABOUR", "FEE"]),
    description: cleanText(500),
    quantity: z.number().int().min(1).max(10_000),
    unitPriceKobo: kobo,
  })
  .strict();
export const serviceLineItemSchema = z.discriminatedUnion("type", [partLine, pricedLine]);
const quoteFields = {
  items: z.array(serviceLineItemSchema).min(1).max(100),
  taxKobo: kobo
    .default("0")
    .describe(
      "Legacy compatibility field; ignored. The server calculates quotation tax from its priced subtotal.",
    ),
  notes: nullableText(4_000),
  expiresAt: dateTime,
} as const;
export const quoteCreateBodySchema = z.object(quoteFields).strict();
export const quoteReplaceBodySchema = z
  .object({ ...quoteFields, expectedRevision: version })
  .strict();
export const quoteTransitionBodySchema = z.object({ expectedRevision: version }).strict();

export const workOrderCreateBodySchema = z
  .object({
    expectedBookingVersion: version,
    diagnosis: nullableText(8_000),
    internalNotes: nullableText(8_000),
    items: z.array(serviceLineItemSchema).max(200).default([]),
  })
  .strict();
export const workOrderUpdateBodySchema = z
  .object({
    expectedVersion: version,
    diagnosis: nullableText(8_000),
    internalNotes: nullableText(8_000),
    addItems: z.array(serviceLineItemSchema).min(1).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "At least one change is required");
export const workOrderTransitionBodySchema = z
  .object({
    status: z.enum([
      "APPROVED",
      "IN_PROGRESS",
      "AWAITING_PARTS",
      "QUALITY_CHECK",
      "COMPLETED",
      "CANCELLED",
    ]),
    expectedVersion: version,
  })
  .strict();

export type PublicServiceListQuery = z.infer<typeof publicServiceListQuerySchema>;
export type AdminServiceListQuery = z.infer<typeof adminServiceListQuerySchema>;
export type ServiceCreateInput = z.infer<typeof serviceCreateBodySchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateBodySchema>;
export type CustomerBookingListQuery = z.infer<typeof customerBookingListQuerySchema>;
export type StaffBookingListQuery = z.infer<typeof staffBookingListQuerySchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateBodySchema>;
export type BookingRescheduleInput = z.infer<typeof bookingRescheduleBodySchema>;
export type BookingCancelInput = z.infer<typeof bookingCancelBodySchema>;
export type BookingAssignmentInput = z.infer<typeof bookingAssignmentBodySchema>;
export type BookingTransitionInput = z.infer<typeof bookingTransitionBodySchema>;
export type PublicBookingSlotListQuery = z.infer<typeof publicBookingSlotListQuerySchema>;
export type StaffBookingSlotListQuery = z.infer<typeof staffBookingSlotListQuerySchema>;
export type BookingSlotCreateInput = z.infer<typeof bookingSlotCreateBodySchema>;
export type BookingSlotUpdateInput = z.infer<typeof bookingSlotUpdateBodySchema>;
export type BookingDisruptionInput = z.infer<typeof bookingDisruptionBodySchema>;
export type BookingDisruptionResolutionInput = z.infer<
  typeof bookingDisruptionResolutionBodySchema
>;
export type ServiceLineItemInput = z.infer<typeof serviceLineItemSchema>;
export type QuoteCreateInput = z.infer<typeof quoteCreateBodySchema>;
export type QuoteReplaceInput = z.infer<typeof quoteReplaceBodySchema>;
export type QuoteTransitionInput = z.infer<typeof quoteTransitionBodySchema>;
export type WorkOrderCreateInput = z.infer<typeof workOrderCreateBodySchema>;
export type WorkOrderUpdateInput = z.infer<typeof workOrderUpdateBodySchema>;
export type WorkOrderTransitionInput = z.infer<typeof workOrderTransitionBodySchema>;
