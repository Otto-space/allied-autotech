import { z } from "zod";
import { workforceAccessSchema, type WorkforceAccess } from "../api/workforce-schemas";
import { sameWorkforceScope } from "./workforce-overview";
export { inspectionPageParams as workforceOrdersPageParams } from "./work-inspections";

export const orderStatusLabels = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;
export const fulfillmentLabels = {
  COLLECTION: "Collection",
  DELIVERY: "Delivery",
} as const;
const status = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);
const nextState = z.enum(["PROCESSING", "READY"]);
const accessSchema = workforceAccessSchema.extend({ managed: z.literal(true) });
const rowSchema = z.object({
  id: z.uuid(),
  orderNumber: z.string(),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  status,
  fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  items: z.array(
    z.object({ productName: z.string(), quantity: z.number().int().positive() }),
  ),
  availableNextStates: z.array(nextState).max(1),
});
const detailSchema = rowSchema.extend({
  confirmedAt: z.iso.datetime().nullable(),
  processingAt: z.iso.datetime().nullable(),
  readyAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  access: accessSchema,
  generatedAt: z.iso.datetime(),
});
export type WorkforceOrder = z.infer<typeof detailSchema>;
export type WorkforceOrderRow = z.infer<typeof rowSchema>;

export function workforceOrdersQuery(input: URLSearchParams) {
  const allowed = ["q", "status", "fulfillmentMethod", "cursor", "_trail", "selected"],
    params = new URLSearchParams();
  let invalid = [...input.keys()].some(
    (key) => !allowed.includes(key) || input.getAll(key).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    state = input.get("status") ?? "",
    method = input.get("fulfillmentMethod") ?? "";
  if (
    q.length > 120 ||
    [...q].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    (state && !Object.hasOwn(orderStatusLabels, state)) ||
    (method && !Object.hasOwn(fulfillmentLabels, method))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (state) params.set("status", state);
  if (method) params.set("fulfillmentMethod", method);
  for (const name of ["cursor", "selected"]) {
    const value = input.get(name);
    if (value !== null) {
      if (!z.uuid().safeParse(value).success) invalid = true;
      else params.set(name, value);
    }
  }
  const trail = input.get("_trail"),
    cursor = input.get("cursor");
  if (trail !== null) {
    const entries = trail.split(",");
    if (
      !cursor ||
      entries.length > 50 ||
      entries[0] !== "start" ||
      entries.slice(1).some((v) => !z.uuid().safeParse(v).success) ||
      entries.includes(cursor) ||
      new Set(entries).size !== entries.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.delete("selected");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/workforce/orders?${api}` };
}
export const ordersHref = (params: URLSearchParams) =>
  `/admin/workforce/orders${params.size ? `?${params}` : ""}`;
function assigned(access: WorkforceAccess, branchId: string | null, templates: string[]) {
  return access.assignments.some(
    (a) =>
      a.userId === access.userId &&
      !!branchId &&
      a.branchId === branchId &&
      templates.includes(a.template) &&
      a.scope === "BRANCH" &&
      a.revokedAt === null &&
      Date.parse(a.startsAt) <= Date.parse(access.serverTime) &&
      (a.expiresAt === null || Date.parse(a.expiresAt) > Date.parse(access.serverTime)),
  );
}
export function expectedOrderNextStates(
  row: WorkforceOrderRow,
  access: WorkforceAccess,
): ("PROCESSING" | "READY")[] {
  if (
    !access.permissions.includes("ORDERS_PREPARE") ||
    !assigned(access, row.branchId, ["OPERATIONS"]) ||
    !row.paidAt ||
    row.fulfillmentMethod !== "COLLECTION"
  )
    return [];
  return row.status === "CONFIRMED"
    ? ["PROCESSING"]
    : row.status === "PROCESSING"
      ? ["READY"]
      : [];
}
export function orderInScope(row: WorkforceOrderRow, access: WorkforceAccess) {
  return (
    access.managed &&
    access.permissions.includes("ORDERS_READ") &&
    !!row.branchId &&
    row.branch?.id === row.branchId &&
    assigned(access, row.branchId, [
      "OPERATIONS",
      "CUSTOMER_SERVICE",
      "SALES_SUPERVISOR",
    ]) &&
    JSON.stringify(row.availableNextStates) ===
      JSON.stringify(expectedOrderNextStates(row, access))
  );
}
export function parseScopedWorkforceOrders(value: unknown) {
  const data = z
    .object({
      items: z.array(rowSchema).max(25),
      nextCursor: z.uuid().optional(),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("ORDERS_READ") ||
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.items.length !== 25 || data.nextCursor !== data.items.at(-1)?.id)) ||
    data.items.some((r) => !orderInScope(r, data.access))
  )
    throw Error("Orders do not match current responsibilities");
  return data;
}
export function parseWorkforceOrder(value: unknown) {
  const row = detailSchema.parse(value);
  if (!orderInScope(row, row.access))
    throw Error("Order does not match current responsibilities");
  return row;
}
export const orderRevision = (row: WorkforceOrder) =>
  JSON.stringify([
    row.id,
    row.version,
    row.updatedAt,
    row.status,
    row.branchId,
    row.fulfillmentMethod,
    row.paidAt,
    row.items,
    row.availableNextStates,
  ]);
export type OrderChange = {
  action: "prepare";
  body: { expectedVersion: number; status: "PROCESSING" | "READY"; reason: string };
};
export function validateOrderReceipt(
  value: unknown,
  base: WorkforceOrder,
  change: OrderChange,
) {
  const row = parseWorkforceOrder(value);
  const receipt = z
    .object({
      action: z.literal("prepare"),
      actorUserId: z.uuid(),
      previousVersion: z.number().int(),
      previousStatus: status,
      reason: z.string(),
    })
    .parse(value);
  if (
    row.id !== base.id ||
    row.version !== base.version + 1 ||
    row.branchId !== base.branchId ||
    row.status !== change.body.status ||
    row.fulfillmentMethod !== "COLLECTION" ||
    row.paidAt !== base.paidAt ||
    receipt.actorUserId !== base.access.userId ||
    receipt.previousVersion !== base.version ||
    receipt.previousStatus !== base.status ||
    receipt.reason !== change.body.reason ||
    !sameWorkforceScope(base.access, row.access) ||
    !base.availableNextStates.includes(change.body.status) ||
    JSON.stringify(row.items) !== JSON.stringify(base.items) ||
    !(change.body.status === "PROCESSING" ? row.processingAt : row.readyAt)
  )
    throw Error("The preparation receipt could not be verified");
  return row;
}
