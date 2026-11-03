import type { CustomerOrder } from "../api/order-payment";
import { purchaseVehicleSelectionSchema } from "../api/purchase-review-schema";
import { fitmentQualifierKeys } from "../parts-fitment";

export type PurchaseSelection = {
  vehicleMakeId?: string;
  vehicleModelId: string;
  year: number;
} & Partial<Record<(typeof fitmentQualifierKeys)[number], string>>;

// Reuse the configuration, never the previous approval, price or stock promise.
// Ambiguous configured lines for the same product need an explicit new choice.
export function reusablePurchaseSelections(
  current: CustomerOrder,
  previous: CustomerOrder,
) {
  if (
    current.id === previous.id ||
    previous.purchaseReviews[0]?.status !== "APPROVED" ||
    !previous.purchaseReviews[0]?.decidedAt
  )
    return {};
  const result: Record<string, PurchaseSelection> = {};
  for (const item of current.items) {
    if (current.items.filter((line) => line.productId === item.productId).length !== 1)
      continue;
    const matches = previous.items.filter((line) => line.productId === item.productId);
    if (matches.length !== 1) continue;
    const selection = previous.purchaseReviews[0].requirements.lines.find(
      (line) => line.orderItemId === matches[0].id,
    )?.selection;
    const parsed = purchaseVehicleSelectionSchema.safeParse(selection);
    if (parsed.success) result[item.id] = parsed.data;
  }
  return result;
}
