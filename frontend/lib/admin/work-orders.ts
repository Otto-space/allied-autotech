import { z } from "zod";
import { operationalOrderSchema } from "@/lib/api/commerce-schemas";

export const orderStatusLabels = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;
export const workOrderSchema = operationalOrderSchema.extend({
  orderNumber: z.string().min(1).max(120),
  createdAt: z.iso.datetime({ offset: true }),
  paidAt: z.iso.datetime({ offset: true }).nullable(),
  version: z.number().int().nonnegative(),
});
export type WorkOrder = z.infer<typeof workOrderSchema>;
export const parseWorkOrders = (value: unknown) =>
  z
    .object({ items: z.array(workOrderSchema).max(25), nextCursor: z.uuid().optional() })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate orders",
    )
    .parse(value);

export function workOrdersQuery(input: URLSearchParams, administrator: boolean) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of [
    "orderNumber",
    "status",
    "branchId",
    "customerId",
    "cursor",
    "_trail",
  ])
    if (input.getAll(key).length > 1) invalid = true;
  const number = input.get("orderNumber")?.trim();
  if (number) {
    if (number.length > 120 || /[\u0000-\u001f\u007f]/.test(number)) invalid = true;
    else params.set("orderNumber", number);
  }
  const status = input.get("status");
  if (status) {
    if (!Object.hasOwn(orderStatusLabels, status)) invalid = true;
    else params.set("status", status);
  }
  for (const key of ["branchId", "customerId", "cursor"]) {
    const value = input.get(key);
    if (!value) continue;
    if (!z.uuid().safeParse(value).success || (key === "branchId" && !administrator))
      invalid = true;
    else params.set(key, value);
  }
  for (const [key, value] of params) api.set(key, value);
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length > 0 &&
    trail.length <= 20 &&
    trail[0] === "start" &&
    trail.slice(1).every((value) => z.uuid().safeParse(value).success)
  )
    params.set("_trail", trail.join(","));
  return { params, api, invalid, path: invalid ? null : `/staff/orders?${api}` };
}
export function orderMatchesFilters(order: WorkOrder, api: URLSearchParams) {
  return (
    (!api.has("status") || order.status === api.get("status")) &&
    (!api.has("orderNumber") || order.orderNumber === api.get("orderNumber")) &&
    (!api.has("branchId") || order.branch.id === api.get("branchId"))
  );
}
