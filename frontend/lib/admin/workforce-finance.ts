import { z } from "zod";
import { workforceAccessSchema, type WorkforceAccess } from "../api/workforce-schemas";
export { inspectionPageParams as workforceFinancePageParams } from "./work-inspections";
export const paymentStatusLabels = {
  REQUIRES_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  REQUIRES_REVIEW: "Requires review",
  SUCCEEDED: "Succeeded",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
} as const;
export const paymentPurposeLabels = {
  ORDER_PAYMENT: "Order payment",
  SERVICE_INVOICE: "Service invoice",
  BOOKING_DEPOSIT: "Booking deposit",
  VEHICLE_RESERVATION: "Vehicle reservation",
  VEHICLE_PARTIAL_PAYMENT: "Vehicle partial payment",
  VEHICLE_BALANCE_PAYMENT: "Vehicle balance payment",
  VEHICLE_FULL_PAYMENT: "Vehicle full payment",
} as const;
export const paymentSourceLabels = {
  ORDER: "Order",
  BOOKING: "Booking",
  INVOICE: "Invoice",
} as const;
const rowSchema = z.object({
  id: z.uuid(),
  paymentNumber: z.string(),
  amountKobo: z.string().regex(/^\d{1,19}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(
    Object.keys(paymentStatusLabels) as [
      keyof typeof paymentStatusLabels,
      ...Array<keyof typeof paymentStatusLabels>,
    ],
  ),
  purpose: z.enum(
    Object.keys(paymentPurposeLabels) as [
      keyof typeof paymentPurposeLabels,
      ...Array<keyof typeof paymentPurposeLabels>,
    ],
  ),
  createdAt: z.iso.datetime(),
  succeededAt: z.iso.datetime().nullable(),
  sources: z
    .array(
      z.object({
        kind: z.enum(["ORDER", "BOOKING", "INVOICE"]),
        reference: z.string(),
        branch: z.object({ id: z.uuid(), name: z.string() }),
      }),
    )
    .min(1)
    .max(4),
});
const accessSchema = workforceAccessSchema.extend({ managed: z.literal(true) });
const detailSchema = rowSchema.extend({
  updatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  expiredAt: z.iso.datetime().nullable(),
  access: accessSchema,
  generatedAt: z.iso.datetime(),
});
export type WorkforcePaymentRow = z.infer<typeof rowSchema>;
export function workforceFinanceQuery(input: URLSearchParams) {
  const allowed = ["q", "status", "purpose", "cursor", "_trail", "selected"],
    params = new URLSearchParams();
  let invalid = [...input.keys()].some(
    (key) => !allowed.includes(key) || input.getAll(key).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    state = input.get("status") ?? "",
    method = input.get("purpose") ?? "";
  if (
    q.length > 120 ||
    [...q].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    (state && !Object.hasOwn(paymentStatusLabels, state)) ||
    (method && !Object.hasOwn(paymentPurposeLabels, method))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (state) params.set("status", state);
  if (method) params.set("purpose", method);
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
  return { params, invalid, path: invalid ? null : `/staff/workforce/finance?${api}` };
}
export const financeHref = (params: URLSearchParams) =>
  `/admin/workforce/finance${params.size ? `?${params}` : ""}`;

function paymentInScope(row: WorkforcePaymentRow, access: WorkforceAccess) {
  return (
    access.permissions.includes("FINANCE_READ") &&
    row.sources.every((source) =>
      access.assignments.some(
        (a) =>
          a.userId === access.userId &&
          a.template === "ACCOUNTANT" &&
          a.branchId === source.branch.id &&
          a.scope === "BRANCH" &&
          a.revokedAt === null &&
          Date.parse(a.startsAt) <= Date.parse(access.serverTime) &&
          (a.expiresAt === null ||
            Date.parse(a.expiresAt) > Date.parse(access.serverTime)),
      ),
    )
  );
}
export function parseScopedWorkforceFinance(value: unknown) {
  const data = z
    .object({
      items: z.array(rowSchema).max(25),
      nextCursor: z.uuid().optional(),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("FINANCE_READ") ||
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.items.length !== 25 || data.nextCursor !== data.items.at(-1)?.id)) ||
    data.items.some((row) => !paymentInScope(row, data.access))
  )
    throw Error("Payments do not match current responsibility scope");
  return data;
}
export function parseWorkforcePayment(value: unknown) {
  const row = detailSchema.parse(value);
  if (!paymentInScope(row, row.access))
    throw Error("Payment does not match current responsibility scope");
  return row;
}
export function workforcePaymentAmount(amountKobo: string, currency: string) {
  const value = BigInt(amountKobo);
  return `${currency} ${(value / BigInt(100)).toLocaleString("en-NG")}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
}
