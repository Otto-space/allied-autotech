import { purchaseVehicleSelectionSchema } from "../api/purchase-review-schema";
import { fitmentQualifierKeys } from "../parts-fitment";
import type { PurchaseSelection } from "./suitability";

/** The URL carries a customer's choice, never a compatibility approval. */
export function cartVehicleFromSearch(search: {
  get: (key: string) => string | null;
}): PurchaseSelection | null {
  const value = purchaseVehicleSelectionSchema.safeParse({
    vehicleModelId: search.get("vehicleModelId"),
    ...(search.get("vehicleMakeId")
      ? { vehicleMakeId: search.get("vehicleMakeId") }
      : {}),
    year: Number(search.get("year")),
    ...Object.fromEntries(
      fitmentQualifierKeys.flatMap((key) => {
        const text = search.get(key)?.trim();
        return text ? [[key, text]] : [];
      }),
    ),
  });
  return value.success ? value.data : null;
}
