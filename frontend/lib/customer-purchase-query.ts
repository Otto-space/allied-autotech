import { transactionStatuses } from "./api/vehicle-schemas";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const purchaseLabels = {
  ENQUIRY: "Enquiry",
  INSPECTION_SCHEDULED: "Inspection scheduled",
  INSPECTION_COMPLETED: "Inspection completed",
  NEGOTIATING: "Negotiating",
  PAYMENT_PENDING: "Payment pending",
  RESERVED: "Reserved",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  HANDOVER_PENDING: "Handover pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const;
export function customerPurchaseQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  const status = input.get("status");
  if (status) {
    if (transactionStatuses.some((value) => value === status))
      params.set("status", status);
    else invalid = true;
  }
  const limit = input.get("limit") ?? "20";
  params.set("limit", ["10", "20", "50"].includes(limit) ? limit : "20");
  if (!["10", "20", "50"].includes(limit)) invalid = true;
  const cursor = input.get("cursor");
  if (cursor) {
    if (uuid.test(cursor)) params.set("cursor", cursor);
    else invalid = true;
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length > 0 &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((value) => uuid.test(value))
  )
    params.set("_trail", trail.join(","));
  const api = new URLSearchParams(params);
  api.delete("_trail");
  return { params, invalid, path: `/customers/vehicle-transactions?${api}` };
}
