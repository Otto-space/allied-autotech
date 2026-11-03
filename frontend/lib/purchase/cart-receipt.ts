import type { CustomerOrder } from "../api/order-payment";
import { purchaseVehicleSelectionSchema } from "../api/purchase-review-schema";
import type { PurchaseSelection } from "./suitability";

/** A vehicle edit is new work even when the product and quantity are unchanged. */
export function cartLineMatchesOrder(
  order: CustomerOrder,
  row: {
    productId: string;
    quantity: number;
    vehicleSelection?: PurchaseSelection | null;
  },
) {
  return order.items.some((item) => {
    if (item.productId !== row.productId || item.quantity !== row.quantity) return false;
    const saved =
      order.purchaseReviews[0]?.requirements.lines.find(
        (line) => line.orderItemId === item.id,
      )?.selection ?? null;
    return (
      JSON.stringify(purchaseVehicleSelectionSchema.nullable().parse(saved)) ===
      JSON.stringify(
        purchaseVehicleSelectionSchema.nullable().parse(row.vehicleSelection ?? null),
      )
    );
  });
}
