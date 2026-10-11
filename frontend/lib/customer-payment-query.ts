const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const paymentStatuses = [
  "REQUIRES_PAYMENT",
  "PROCESSING",
  "REQUIRES_REVIEW",
  "SUCCEEDED",
  "CANCELLED",
  "EXPIRED",
] as const;
export const paymentLabels = {
  REQUIRES_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  REQUIRES_REVIEW: "Needs review",
  SUCCEEDED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const;
export const paymentStatusNotes = {
  REQUIRES_PAYMENT: "Not yet confirmed",
  PROCESSING: "Check before paying again",
  REQUIRES_REVIEW: "Review pending",
  SUCCEEDED: "Payment recorded",
  CANCELLED: "Request closed",
  EXPIRED: "Request closed",
} as const;
const purposes: Record<string, string> = {
  ORDER_PAYMENT: "Order payment",
  SERVICE_INVOICE: "Service invoice payment",
  SERVICE_INVOICE_PAYMENT: "Service invoice payment",
  INVOICE_PAYMENT: "Invoice payment",
  BOOKING_DEPOSIT: "Booking payment",
  VEHICLE_RESERVATION: "Vehicle reservation",
  VEHICLE_PARTIAL_PAYMENT: "Vehicle part payment",
  VEHICLE_BALANCE_PAYMENT: "Vehicle balance",
  VEHICLE_FULL_PAYMENT: "Vehicle purchase",
};
export const paymentPurpose = (value: string) =>
  Object.hasOwn(purposes, value) ? purposes[value] : "Payment request";
export function customerPaymentQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  const status = input.get("status");
  if (status) {
    if (paymentStatuses.some((value) => value === status)) params.set("status", status);
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
  return { params, invalid, path: `/customers/payments?${api}` };
}
