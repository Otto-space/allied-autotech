import { z } from "zod";
import { invoiceSchema } from "@/lib/api/invoice-schemas";
import { inspectionPageParams } from "./work-inspections";
const uuid = z.uuid(),
  date = z.iso.datetime({ offset: true });
const branch = z
  .object({ id: uuid, code: z.string().min(1), name: z.string().min(1) })
  .strict();
export const invoiceSourceType = z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]);
export type InvoiceSourceType = z.infer<typeof invoiceSourceType>;
export const invoiceSourceLabels = {
  ORDER: "Parts order",
  BOOKING: "Workshop booking",
  VEHICLE_TRANSACTION: "Vehicle purchase",
};
export const invoiceStatusLabels = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PAID: "Paid",
  VOID: "Void",
};
const sourceSchema = z
  .object({
    id: uuid,
    sourceType: invoiceSourceType,
    reference: z.string().min(1),
    label: z.string().min(1),
    branch: branch.nullable(),
    createdAt: date,
    updatedAt: date,
  })
  .strict();
export type InvoiceSource = z.infer<typeof sourceSchema>;
const schema = invoiceSchema
  .extend({
    invoiceNumber: z.string().min(1),
    version: z.number().int().nonnegative(),
    issuedAt: date.nullable(),
    dueAt: date.nullable(),
    paidAt: date.nullable(),
    voidedAt: date.nullable(),
    createdAt: date,
    updatedAt: date,
    order: z
      .object({
        id: uuid,
        orderNumber: z.string().min(1),
        status: z.string().min(1),
        branch: branch.nullable(),
      })
      .strict()
      .nullable(),
    booking: z
      .object({ id: uuid, status: z.string().min(1), branch: branch.nullable() })
      .strict()
      .nullable(),
    vehicleTransaction: z
      .object({
        id: uuid,
        transactionNumber: z.string().min(1),
        status: z.string().min(1),
        vehicleListing: z.object({ branch }).strict(),
      })
      .strict()
      .nullable(),
    payments: z.array(
      z
        .object({
          id: uuid,
          paymentNumber: z.string().min(1),
          status: z.string().min(1),
          amountKobo: z.string().regex(/^\d+$/),
          currency: z.literal("NGN"),
          succeededAt: date.nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type WorkInvoice = z.infer<typeof schema>;
export function invoiceSource(v: WorkInvoice) {
  if (v.order)
    return {
      kind: "ORDER" as const,
      id: v.order.id,
      reference: v.order.orderNumber,
      branch: v.order.branch,
      href: `/admin/orders/${v.order.id}`,
    };
  if (v.booking)
    return {
      kind: "BOOKING" as const,
      id: v.booking.id,
      reference: "Workshop booking",
      branch: v.booking.branch,
      href: `/admin/bookings/${v.booking.id}`,
    };
  if (v.vehicleTransaction)
    return {
      kind: "VEHICLE_TRANSACTION" as const,
      id: v.vehicleTransaction.id,
      reference: v.vehicleTransaction.transactionNumber,
      branch: v.vehicleTransaction.vehicleListing.branch,
      href: `/admin/vehicle-sales/${v.vehicleTransaction.id}`,
    };
  throw Error("Invoice source is unavailable");
}
export function parseWorkInvoice(value: unknown) {
  const v = schema.parse(value);
  if (
    [v.order, v.booking, v.vehicleTransaction].filter(Boolean).length !== 1 ||
    BigInt(v.subtotalKobo) + BigInt(v.taxKobo) - BigInt(v.depositCreditKobo) !==
      BigInt(v.totalKobo) ||
    new Set(v.payments.map((p) => p.id)).size !== v.payments.length
  )
    throw Error("Invoice facts could not be confirmed");
  return v;
}
export function invoiceQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  const allowed = [
    "invoiceNumber",
    "status",
    "branchId",
    "customerId",
    "sourceType",
    "sourceId",
    "cursor",
    "_trail",
    "expanded",
    "create",
    "filters",
  ];
  for (const key of input.keys())
    if (!allowed.includes(key) || input.getAll(key).length > 1) invalid = true;
  for (const key of allowed) {
    const raw = input.get(key);
    if (raw === null) continue;
    const v = raw.trim();
    const valid =
      key === "invoiceNumber"
        ? v.length > 0 && v.length <= 50 && !/[\x00-\x1f\x7f]/.test(v)
        : key === "status"
          ? Object.hasOwn(invoiceStatusLabels, v)
          : key === "sourceType"
            ? invoiceSourceType.safeParse(v).success
            : ["create", "filters"].includes(key)
              ? v === "1"
              : key === "_trail"
                ? true
                : uuid.safeParse(v).success;
    if (!valid) invalid = true;
    else
      params.set(
        key,
        ["branchId", "customerId", "sourceId", "cursor", "expanded"].includes(key)
          ? v.toLowerCase()
          : v,
      );
  }
  if (params.has("sourceId") && !params.has("sourceType")) invalid = true;
  const trail = params.get("_trail")?.split(",");
  if (
    trail &&
    (!params.has("cursor") ||
      trail[0] !== "start" ||
      trail.length > 50 ||
      trail.slice(1).some((v) => !uuid.safeParse(v).success) ||
      new Set(trail).size !== trail.length ||
      trail.includes(params.get("cursor")!))
  )
    invalid = true;
  const api = new URLSearchParams(params);
  for (const key of ["_trail", "expanded", "create", "filters"]) api.delete(key);
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/invoices?${api}` };
}
export const invoicePageParams = inspectionPageParams;
function page<T extends { id: string; createdAt: string }>(
  value: unknown,
  parse: (v: unknown) => T,
  cursor: string | null,
) {
  const p = z
      .object({ items: z.array(z.unknown()).max(25), nextCursor: uuid.nullish() })
      .strict()
      .parse(value),
    items = p.items.map(parse);
  if (
    new Set(items.map((v) => v.id)).size !== items.length ||
    (p.nextCursor && (p.nextCursor !== items.at(-1)?.id || p.nextCursor === cursor)) ||
    items.some(
      (v, i) =>
        i > 0 &&
        (Date.parse(items[i - 1].createdAt) < Date.parse(v.createdAt) ||
          (items[i - 1].createdAt === v.createdAt &&
            items[i - 1].id.localeCompare(v.id) <= 0)),
    )
  )
    throw Error("Invoice page could not be confirmed");
  return { items, nextCursor: p.nextCursor ?? undefined };
}
export function parseWorkInvoices(value: unknown, params: URLSearchParams) {
  const p = page(value, parseWorkInvoice, params.get("cursor"));
  if (
    p.items.some((v) => {
      const source = invoiceSource(v);
      return (
        (params.has("status") && v.status !== params.get("status")) ||
        (params.has("invoiceNumber") &&
          v.invoiceNumber !== params.get("invoiceNumber")) ||
        (params.has("sourceType") && source.kind !== params.get("sourceType")) ||
        (params.has("sourceId") && source.id !== params.get("sourceId")) ||
        (params.has("branchId") && source.branch?.id !== params.get("branchId"))
      );
    })
  )
    throw Error("Invoice filter scope could not be confirmed");
  return p;
}
export function parseInvoiceSources(
  value: unknown,
  kind: InvoiceSourceType,
  sourceId?: string,
  cursor: string | null = null,
) {
  const p = page(value, (v) => sourceSchema.parse(v), cursor);
  if (
    p.items.some((v) => v.sourceType !== kind || (sourceId && v.id !== sourceId)) ||
    (sourceId && (p.items.length > 1 || p.nextCursor))
  )
    throw Error("Invoice source scope could not be confirmed");
  return p;
}
export type InvoiceCreateBody = {
  sourceType: InvoiceSourceType;
  sourceId: string;
  dueAt?: string;
};
export function confirmInvoiceDraft(
  value: unknown,
  body: InvoiceCreateBody,
  source: InvoiceSource,
) {
  const v = parseWorkInvoice(value),
    s = invoiceSource(v);
  if (
    s.kind !== body.sourceType ||
    s.id !== body.sourceId ||
    s.branch?.id !== source.branch?.id ||
    (s.kind !== "BOOKING" && s.reference !== source.reference) ||
    (v.dueAt ? Date.parse(v.dueAt) : null) !==
      (body.dueAt ? Date.parse(body.dueAt) : null) ||
    v.status !== "DRAFT" ||
    v.version !== 0 ||
    v.issuedAt ||
    v.paidAt ||
    v.voidedAt ||
    v.payments.length
  )
    throw Error("Created invoice could not be confirmed");
  return v;
}
