import { z } from "zod";
import { purchaseVehicleSelectionSchema } from "../api/purchase-review-schema";
import type { PurchaseSelection } from "./suitability";

export const PURCHASE_CART_CHANGED = "aat:purchase-cart-changed";
const storageKey = "aat:purchase-cart:1";
export const purchaseCartSchema = z
  .array(
    z
      .object({
        productId: z.uuid().transform((v) => v.toLowerCase()),
        quantity: z.number().int().min(1).max(1000),
        vehicleSelection: purchaseVehicleSelectionSchema.nullable().optional(),
      })
      .strict(),
  )
  .max(200)
  .refine((rows) => new Set(rows.map((row) => row.productId)).size === rows.length);
export type PurchaseCart = z.infer<typeof purchaseCartSchema>;
export function readPurchaseCart(): PurchaseCart {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return [];
  const result = purchaseCartSchema.safeParse(JSON.parse(raw));
  if (!result.success)
    throw Error("This cart could not be read. Clear it and choose your products again.");
  return result.data;
}
export function writePurchaseCart(rows: PurchaseCart) {
  const checked = purchaseCartSchema.parse(rows);
  localStorage.setItem(storageKey, JSON.stringify(checked));
  window.dispatchEvent(new Event(PURCHASE_CART_CHANGED));
}
export function setPurchaseCartItem(
  productId: string,
  quantity: number,
  vehicleSelection?: PurchaseSelection | null,
) {
  const rows = readPurchaseCart().filter(
    (row) => row.productId !== productId.toLowerCase(),
  );
  writePurchaseCart([
    ...rows,
    {
      productId,
      quantity,
      ...(vehicleSelection !== undefined ? { vehicleSelection } : {}),
    },
  ]);
}
export function clearPurchaseCart() {
  localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(PURCHASE_CART_CHANGED));
}
