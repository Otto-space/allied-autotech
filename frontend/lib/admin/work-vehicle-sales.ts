import { z } from "zod";
import { staffVehicleSaleSchema } from "../api/staff-vehicle-sales-schemas";
import { customerPurchaseQuery, purchaseLabels } from "../customer-purchase-query";
import { listingSchema } from "../api/vehicle-schemas";
export { purchaseLabels };
export { inspectionPageParams as salesPageParams } from "./work-inspections";
const date = z.iso.datetime({ offset: true }),
  nullableDate = date.nullable(),
  amount = z.string().regex(/^\d{1,16}$/);
export const workVehicleSaleSchema = staffVehicleSaleSchema.extend({
  transactionNumber: z.string().min(1),
  customerName: z.string().min(1),
  version: z.number().int().nonnegative(),
  askingPriceKobo: amount,
  agreedPriceKobo: amount.nullable(),
  reservationRequiredKobo: amount.nullable(),
  createdAt: date,
  updatedAt: date.optional(),
  paidAt: nullableDate,
  reservationExpiresAt: nullableDate,
  termsAcceptedAt: nullableDate,
  handoverPendingAt: nullableDate.optional(),
  completedAt: nullableDate.optional(),
  cancelledAt: nullableDate.optional(),
  expiredAt: nullableDate.optional(),
  paidHoldStartsAt: nullableDate.optional(),
  paidHoldExpiresAt: nullableDate.optional(),
  handover: staffVehicleSaleSchema.shape.handover
    .unwrap()
    .extend({
      readyAt: nullableDate,
      completedAt: nullableDate,
      cancelledAt: nullableDate,
      odometerKm: z.number().int().nonnegative().nullable(),
      keysDelivered: z.number().int().nonnegative(),
    })
    .nullable(),
  vehicleListing: staffVehicleSaleSchema.shape.vehicleListing.extend({
    status: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "INACTIVE", "ARCHIVED"]),
    vehicle: staffVehicleSaleSchema.shape.vehicleListing.shape.vehicle.extend({
      images: listingSchema.shape.vehicle.shape.images.optional().default([]),
    }),
  }),
});
export type WorkVehicleSale = z.infer<typeof workVehicleSaleSchema>;
export function parseWorkVehicleSales(
  value: unknown,
  role: string,
  branchId?: string | null,
  params = new URLSearchParams(),
) {
  const page = z
    .object({
      items: z.array(workVehicleSaleSchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
  if (
    new Set(page.items.map((row) => row.id)).size !== page.items.length ||
    page.items.some(
      (row) =>
        (role === "STAFF" && (!branchId || row.vehicleListing.branchId !== branchId)) ||
        (params.has("branchId") &&
          row.vehicleListing.branchId !== params.get("branchId")) ||
        (params.has("status") && row.status !== params.get("status")),
    )
  )
    throw Error("Unexpected purchase scope");
  return page;
}
export function workVehicleSalesQuery(
  input: URLSearchParams,
  role: string,
  branchId?: string | null,
) {
  let invalid = false;
  const supported = ["status", "branchId", "cursor", "_trail"];
  for (const key of input.keys())
    if (!supported.includes(key) || input.getAll(key).length !== 1) invalid = true;
  const shared = new URLSearchParams(input);
  shared.delete("branchId");
  shared.set("limit", "20");
  const parsed = customerPurchaseQuery(shared),
    params = new URLSearchParams(parsed.params);
  params.delete("limit");
  invalid ||= parsed.invalid;
  const branch = input.get("branchId");
  if (branch) {
    if (!z.uuid().safeParse(branch).success || (role === "STAFF" && branch !== branchId))
      invalid = true;
    else params.set("branchId", branch);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return {
    params,
    api,
    invalid,
    path: invalid ? null : `/staff/vehicle-transactions?${api}`,
  };
}
