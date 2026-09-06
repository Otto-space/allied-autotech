import { z } from "zod";
const uuid = z.uuid();
const clean = (max: number) => z.string().trim().min(1).max(max);
const version = z.number().int().min(0).max(2_147_483_647);
const kobo = z.string().regex(/^[1-9][0-9]{0,15}$/, "Use positive integer kobo");
const transactionStatuses = [
  "ENQUIRY",
  "INSPECTION_SCHEDULED",
  "INSPECTION_COMPLETED",
  "NEGOTIATING",
  "PAYMENT_PENDING",
  "RESERVED",
  "PARTIALLY_PAID",
  "PAID",
  "HANDOVER_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
const inspectionStatuses = [
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "RESCHEDULED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const vehicleSalesEmptySchema = z.object({}).strict();
export const inspectionParamsSchema = z.object({ inspectionId: uuid }).strict();
export const transactionParamsSchema = z.object({ transactionId: uuid }).strict();
export const handoverParamsSchema = z
  .object({ transactionId: uuid, handoverId: uuid })
  .strict();
export const idempotencyHeadersSchema = z
  .object({ "idempotency-key": z.string().trim().min(16).max(200) })
  .passthrough();
export const customerInspectionListQuerySchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(inspectionStatuses).optional(),
  })
  .strict();
export const staffInspectionListQuerySchema =
  customerInspectionListQuerySchema.safeExtend({ branchId: uuid.optional() });
export const inspectionCreateBodySchema = z
  .object({
    vehicleListingId: uuid,
    preferredStartAt: z.iso.datetime({ offset: true }),
    preferredEndAt: z.iso.datetime({ offset: true }).optional(),
    notes: clean(2000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.preferredEndAt === undefined ||
      new Date(value.preferredEndAt) > new Date(value.preferredStartAt),
    { path: ["preferredEndAt"], message: "Must follow preferredStartAt" },
  );
export const inspectionTransitionBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum(["CONFIRMED", "COMPLETED", "RESCHEDULED", "CANCELLED", "NO_SHOW"]),
    assignedStaffId: uuid.optional(),
    scheduledStartAt: z.iso.datetime({ offset: true }).optional(),
    scheduledEndAt: z.iso.datetime({ offset: true }).optional(),
    reason: clean(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ["CONFIRMED", "RESCHEDULED"].includes(value.status) &&
      (value.scheduledStartAt === undefined || value.scheduledEndAt === undefined)
    )
      context.addIssue({
        code: "custom",
        path: ["scheduledStartAt"],
        message: "A complete schedule is required",
      });
    if (
      value.scheduledStartAt !== undefined &&
      value.scheduledEndAt !== undefined &&
      new Date(value.scheduledEndAt) <= new Date(value.scheduledStartAt)
    )
      context.addIssue({
        code: "custom",
        path: ["scheduledEndAt"],
        message: "Must follow scheduledStartAt",
      });
    if (value.status === "CANCELLED" && value.reason === undefined)
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Cancellation reason is required",
      });
  });
export const transactionCreateBodySchema = z
  .object({ vehicleListingId: uuid, sourceInspectionId: uuid.optional() })
  .strict();
export const customerTransactionListQuerySchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(transactionStatuses).optional(),
  })
  .strict();
export const staffTransactionListQuerySchema =
  customerTransactionListQuerySchema.safeExtend({ branchId: uuid.optional() });
export const negotiationBodySchema = z
  .object({
    expectedVersion: version,
    agreedPriceKobo: kobo,
    reservationRequiredKobo: kobo.nullable().optional(),
    notes: clean(2000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.reservationRequiredKobo == null ||
      BigInt(value.reservationRequiredKobo) <= BigInt(value.agreedPriceKobo),
    {
      path: ["reservationRequiredKobo"],
      message: "Cannot exceed the agreed price",
    },
  );
export const reservationBodySchema = z
  .object({
    expectedVersion: version,
    termsVersion: clean(40),
    termsAccepted: z.literal(true),
  })
  .strict();
export const transactionTransitionBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum([
      "INSPECTION_SCHEDULED",
      "INSPECTION_COMPLETED",
      "NEGOTIATING",
      "PAYMENT_PENDING",
      "CANCELLED",
    ]),
    reason: clean(1000).optional(),
  })
  .strict();
export const expireReservationsBodySchema = z
  .object({ limit: z.number().int().min(1).max(100).default(25) })
  .strict();
export const handoverCreateBodySchema = z
  .object({
    recipientName: clean(160),
    recipientPhone: z
      .string()
      .trim()
      .regex(/^\+?[1-9][0-9]{7,14}$/),
    odometerKm: z.number().int().min(0).max(10_000_000),
    keysDelivered: z.number().int().min(0).max(20),
    assetToken: z.string().min(40).max(4096).optional(),
  })
  .strict();
export const handoverTransitionBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum(["READY", "COMPLETED", "CANCELLED"]),
  })
  .strict();

export type CustomerInspectionListQuery = z.infer<
  typeof customerInspectionListQuerySchema
>;
export type StaffInspectionListQuery = z.infer<typeof staffInspectionListQuerySchema>;
export type InspectionCreateInput = z.infer<typeof inspectionCreateBodySchema>;
export type InspectionTransitionInput = z.infer<typeof inspectionTransitionBodySchema>;
export type TransactionCreateInput = z.infer<typeof transactionCreateBodySchema>;
export type CustomerTransactionListQuery = z.infer<
  typeof customerTransactionListQuerySchema
>;
export type StaffTransactionListQuery = z.infer<typeof staffTransactionListQuerySchema>;
export type NegotiationInput = z.infer<typeof negotiationBodySchema>;
export type ReservationInput = z.infer<typeof reservationBodySchema>;
export type TransactionTransitionInput =
  | z.infer<typeof transactionTransitionBodySchema>
  | { expectedVersion: number; status: "EXPIRED"; reason: string };
export type ExpireReservationsInput = z.infer<typeof expireReservationsBodySchema>;
export type HandoverCreateInput = z.infer<typeof handoverCreateBodySchema>;
export type HandoverTransitionInput = z.infer<typeof handoverTransitionBodySchema>;
