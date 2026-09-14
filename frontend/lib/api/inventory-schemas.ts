import { z } from "zod";
import { branchRef, money } from "./commerce-schemas";
export const inventorySchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int(),
  reserved: z.number().int(),
  available: z.number().int(),
  reorderLevel: z.number().int(),
  version: z.number().int(),
  updatedAt: z.string(),
  branch: branchRef.extend({ isActive: z.boolean() }),
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    sku: z.string(),
    priceKobo: money,
    currency: z.literal("NGN"),
    isActive: z.boolean(),
    category: z.object({
      id: z.string().uuid(),
      name: z.string(),
      isActive: z.boolean(),
    }),
  }),
});
export type Inventory = z.infer<typeof inventorySchema>;
export const parseInventory = (value: unknown) => inventorySchema.parse(value);
export const parseInventories = (value: unknown) =>
  z
    .object({ items: z.array(inventorySchema), nextCursor: z.string().optional() })
    .parse(value);
export const inventoryReservationSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int(),
  status: z.enum(["ACTIVE", "RELEASED", "CONSUMED", "EXPIRED"]),
  expiresAt: z.string(),
  releasedAt: z.string().nullable(),
  consumedAt: z.string().nullable(),
  expiredAt: z.string().nullable(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAt: z.string(),
  customer: z.object({ id: z.string().uuid() }).nullable(),
});
export type InventoryReservation = z.infer<typeof inventoryReservationSchema>;
export const parseInventoryReservations = (value: unknown) =>
  z
    .object({
      items: z.array(inventoryReservationSchema),
      nextCursor: z.string().optional(),
    })
    .parse(value);
export const inventoryHistorySchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  quantityDelta: z.number().int(),
  reservedDelta: z.number().int(),
  quantityBefore: z.number().int(),
  quantityAfter: z.number().int(),
  reservedBefore: z.number().int(),
  reservedAfter: z.number().int(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  performedBy: z.object({ id: z.string().uuid(), role: z.string() }).nullable(),
});
export const parseInventoryHistory = (value: unknown) =>
  z
    .object({ items: z.array(inventoryHistorySchema), nextCursor: z.string().optional() })
    .parse(value);
