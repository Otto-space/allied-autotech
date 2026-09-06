import { z } from "zod";

const cleanText = (maximum: number) => z.string().trim().min(1).max(maximum);
const pageFields = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;
const optionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const quantity = z.number().int().min(1).max(1_000_000);
const note = cleanText(1_000).optional();
const referenceFields = {
  referenceType: z.enum(["ORDER", "WORK_ORDER", "CART", "MANUAL"]).optional(),
  referenceId: cleanText(120).optional(),
} as const;

export const inventoryEmptyQuerySchema = z.object({}).strict().default({});
export const inventoryEmptyBodySchema = z.object({}).strict().default({});
export const inventoryParamsSchema = z.object({ inventoryId: z.uuid() }).strict();
export const inventoryReservationParamsSchema = z
  .object({ inventoryId: z.uuid(), reservationId: z.uuid() })
  .strict();
export const idempotencyHeadersSchema = z
  .object({
    "idempotency-key": z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[\x21-\x7E]+$/, "Use visible ASCII characters"),
  })
  .passthrough();
export const inventoryListQuerySchema = z
  .object({
    ...pageFields,
    branchId: z.uuid().optional(),
    productId: z.uuid().optional(),
    lowStock: optionalBoolean,
  })
  .strict();
export const inventoryHistoryQuerySchema = z
  .object({
    ...pageFields,
    type: z
      .enum([
        "STOCK_IN",
        "SALE",
        "RESERVATION",
        "RESERVATION_RELEASE",
        "RETURN",
        "ADJUSTMENT",
        "DAMAGE",
        "RESTOCK",
      ])
      .optional(),
  })
  .strict();
export const inventoryReservationListQuerySchema = z
  .object({
    ...pageFields,
    status: z.enum(["ACTIVE", "RELEASED", "CONSUMED", "EXPIRED"]).optional(),
  })
  .strict();
export const inventoryCreateBodySchema = z
  .object({
    productId: z.uuid(),
    branchId: z.uuid(),
    reorderLevel: z.number().int().min(0).max(1_000_000).default(5),
  })
  .strict();
export const inventoryUpdateBodySchema = z
  .object({
    reorderLevel: z.number().int().min(0).max(1_000_000),
    expectedVersion: z.number().int().min(0),
  })
  .strict();
export const inventoryMovementBodySchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.enum(["STOCK_IN", "RETURN", "RESTOCK", "DAMAGE"]),
        quantity,
        note,
        ...referenceFields,
      })
      .strict(),
    z
      .object({
        type: z.literal("SALE"),
        quantity,
        reservationId: z.uuid().optional(),
        note,
        ...referenceFields,
      })
      .strict(),
    z
      .object({
        type: z.literal("ADJUSTMENT"),
        targetQuantity: z.number().int().min(0).max(1_000_000),
        note: cleanText(1_000),
        ...referenceFields,
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if ((value.referenceType === undefined) !== (value.referenceId === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["referenceId"],
        message: "Reference type and ID must be provided together",
      });
    }
  });
export const inventoryReservationBodySchema = z
  .object({
    quantity,
    customerId: z.uuid().optional(),
    expiresAt: z.iso.datetime({ offset: true }),
    ...referenceFields,
  })
  .strict()
  .superRefine((value, context) => {
    const expiresAt = new Date(value.expiresAt).getTime();
    const now = Date.now();
    if (expiresAt <= now || expiresAt > now + 7 * 24 * 60 * 60 * 1_000) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be in the future and within seven days",
      });
    }
    if ((value.referenceType === undefined) !== (value.referenceId === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["referenceId"],
        message: "Reference type and ID must be provided together",
      });
    }
  });
export const inventoryReleaseBodySchema = z.object({ note }).strict();

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type InventoryHistoryQuery = z.infer<typeof inventoryHistoryQuerySchema>;
export type InventoryReservationListQuery = z.infer<
  typeof inventoryReservationListQuerySchema
>;
export type InventoryCreateInput = z.infer<typeof inventoryCreateBodySchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateBodySchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementBodySchema>;
export type InventoryReservationInput = z.infer<typeof inventoryReservationBodySchema>;
export type InventoryReleaseInput = z.infer<typeof inventoryReleaseBodySchema>;
