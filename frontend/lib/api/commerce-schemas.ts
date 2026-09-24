import { z } from "zod";
export const money = z.string().regex(/^\d+$/);
export const branchRef = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
});
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
});
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  brand: z.string().nullable(),
  manufacturerPartNumber: z.string().nullable(),
  description: z.string().nullable(),
  priceKobo: money,
  compareAtPriceKobo: money.nullable(),
  currency: z.literal("NGN"),
  category: categorySchema,
  images: z.array(
    z.object({
      id: z.string().uuid(),
      url: z.string(),
      altText: z.string().nullable(),
      isPrimary: z.boolean(),
    }),
  ),
  compatibilities: z.array(
    z.object({
      id: z.string().uuid(),
      make: z.string(),
      model: z.string().nullable(),
      yearFrom: z.number().nullable(),
      yearTo: z.number().nullable(),
      notes: z.string().nullable(),
    }),
  ),
  availability: z.array(z.object({ branch: branchRef, inStock: z.boolean() })),
});
export type Product = z.infer<typeof productSchema>;
export const productPageSchema = z.object({
  items: z.array(productSchema),
  nextCursor: z.string().optional(),
});
export const parseProducts = (value: unknown) => productPageSchema.parse(value);
export const parseCategories = (value: unknown) =>
  z
    .object({ items: z.array(categorySchema), nextCursor: z.string().optional() })
    .parse(value);
export const cartSchema = z.object({
  subtotalKobo: money,
  items: z.array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number().int(),
      unitPriceKobo: money,
      lineSubtotalKobo: money,
      product: productSchema,
    }),
  ),
});
export const parseCart = (value: unknown) => cartSchema.parse(value);
export const orderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]),
  fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
  currency: z.literal("NGN"),
  subtotalKobo: money,
  discountAmountKobo: money,
  taxKobo: money.optional(),
  deliveryFeeKobo: money,
  deliveryName: z.string().nullable().optional(),
  deliveryPhone: z.string().nullable().optional(),
  deliveryAddress: z.string().nullable().optional(),
  deliveryCity: z.string().nullable().optional(),
  deliveryState: z.string().nullable().optional(),
  deliveryCountry: z.string().nullable().optional(),
  totalKobo: money,
  version: z.number().int(),
  createdAt: z.string(),
  paymentDueAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  branch: branchRef,
  items: z.array(
    z.object({
      id: z.string().uuid(),
      productId: z.string().uuid(),
      productName: z.string(),
      sku: z.string(),
      unitPriceKobo: money,
      quantity: z.number().int(),
      subtotalKobo: money,
    }),
  ),
  invoice: z
    .object({ id: z.string().uuid(), invoiceNumber: z.string(), status: z.string() })
    .nullable(),
});
export const parseOrder = (value: unknown) => orderSchema.parse(value);
// Operational consumers do not need invoice data; STAFF responses omit it.
export const operationalOrderSchema = orderSchema.omit({ invoice: true });
export const parseOperationalOrders = (value: unknown) =>
  z
    .object({ items: z.array(operationalOrderSchema), nextCursor: z.string().optional() })
    .parse(value);
export const parseOrders = (value: unknown) =>
  z
    .object({ items: z.array(orderSchema), nextCursor: z.string().optional() })
    .parse(value);
