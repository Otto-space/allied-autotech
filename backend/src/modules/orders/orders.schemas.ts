import { z } from "zod";
import { cartItemBodySchema } from "../catalog/catalog.schemas.js";

const uuid = z.uuid();
const version = z.number().int().min(0).max(2_147_483_647);
const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every(
          (character) =>
            (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
        ),
      "Contains invalid characters",
    );
const pageFields = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;
const orderStatus = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

export const ordersEmptyQuerySchema = z.object({}).strict().default({});
export const orderParamsSchema = z.object({ orderId: uuid }).strict();
export const orderIdempotencyHeadersSchema = z.looseObject({
  "idempotency-key": z
    .string()
    .trim()
    .min(8)
    .max(120)
    .regex(/^[\x21-\x7E]+$/, "Use visible ASCII characters"),
});

export const checkoutBodySchema = z
  .object({
    branchId: uuid,
    fulfillmentMethod: z.literal("COLLECTION").default("COLLECTION"),
    promotionCode: cleanText(80)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict()
  .describe(
    "New orders are collection only. Delivery and delivery contact fields are not accepted.",
  );

export const customerOrderListQuerySchema = z
  .object({ ...pageFields, status: orderStatus.optional() })
  .strict();

// The same line-quantity and 200-line invoice-document bounds apply to guests.
// Only product IDs/quantities are client data; prices, totals and buyer identity
// are resolved again from authoritative records inside checkout.
export const guestCheckoutBodySchema = checkoutBodySchema
  .extend({
    contact: z
      .object({
        name: cleanText(400),
        phone: cleanText(32).refine(
          (v) => /^\+?[0-9 ()-]{7,32}$/.test(v),
          "Enter a contact phone number",
        ),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            productId: uuid.transform((value) => value.toLowerCase()),
            quantity: cartItemBodySchema.shape.quantity,
            vehicleSelection: cartItemBodySchema.shape.vehicleSelection,
          })
          .strict(),
      )
      .min(1)
      .max(200)
      .refine(
        (items) => new Set(items.map((item) => item.productId)).size === items.length,
        "Combine quantities for each product",
      ),
  })
  .strict();
export const staffOrderListQuerySchema = z
  .object({
    ...pageFields,
    orderNumber: cleanText(120)
      .describe(
        "Exact, case-sensitive full order number; restricted to authorized branches",
      )
      .optional(),
    branchId: uuid.optional(),
    customerId: uuid.optional(),
    status: orderStatus.optional(),
  })
  .strict();
export const customerOrderCancelBodySchema = z
  .object({ expectedVersion: version, reason: cleanText(500) })
  .strict();
export const orderTransitionBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum(["CONFIRMED", "PROCESSING", "READY", "COMPLETED", "CANCELLED"]),
    reason: cleanText(500).optional(),
  })
  .strict();
export const expireOrdersBodySchema = z
  .object({ limit: z.number().int().min(1).max(100).default(50) })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutBodySchema>;
export type GuestCheckoutInput = z.infer<typeof guestCheckoutBodySchema>;
export type CustomerOrderListQuery = z.infer<typeof customerOrderListQuerySchema>;
export type StaffOrderListQuery = z.infer<typeof staffOrderListQuerySchema>;
export type CustomerOrderCancelInput = z.infer<typeof customerOrderCancelBodySchema>;
export type OrderTransitionInput = z.infer<typeof orderTransitionBodySchema>;
export type ExpireOrdersInput = z.infer<typeof expireOrdersBodySchema>;
