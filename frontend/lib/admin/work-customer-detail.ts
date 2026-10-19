import { z } from "zod";
import { parseCustomerDetail } from "../api/customer-directory-schemas";
import { parseWorkCustomers, customerPageParams } from "./work-customers";
import { formatKobo } from "../format/money";
export const customerCollections = [
  "vehicles",
  "bookings",
  "quotations",
  "orders",
  "payments",
  "enquiries",
  "complaints",
] as const;
export type CustomerCollection = (typeof customerCollections)[number];
export const customerCollectionLabels: Record<CustomerCollection, string> = {
  vehicles: "Garage",
  bookings: "Bookings",
  quotations: "Quotations",
  orders: "Orders",
  payments: "Payments",
  enquiries: "Enquiries",
  complaints: "Complaints",
};
export function parseWorkCustomerDetail(value: unknown, id: string) {
  const row = parseCustomerDetail(value);
  parseWorkCustomers({ items: [row] });
  if (row.id !== id) throw Error("Unexpected customer reference");
  return row;
}
export function customerActivityQuery(input: URLSearchParams, id: string) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of input.keys())
    if (
      !["collection", "cursor", "_trail"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  const collection = input.get("collection") ?? "vehicles";
  if (!customerCollections.includes(collection as CustomerCollection)) invalid = true;
  else if (collection !== "vehicles") params.set("collection", collection);
  const cursor = input.get("cursor"),
    trail = input.get("_trail");
  if (cursor !== null) {
    if (!z.uuid().safeParse(cursor).success) invalid = true;
    else params.set("cursor", cursor);
  }
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !cursor ||
      parts.length > 50 ||
      parts[0] !== "start" ||
      parts.slice(1).some((s) => !z.uuid().safeParse(s).success) ||
      parts.includes(cursor) ||
      new Set(parts).size !== parts.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams({ limit: "25" });
  if (cursor) api.set("cursor", cursor);
  return {
    params,
    collection: collection as CustomerCollection,
    invalid,
    path: invalid ? null : `/admin/customers/${id}/${collection}?${api}`,
  };
}
const related = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  amountKobo: z
    .string()
    .regex(/^\d{1,30}$/)
    .nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
});
export type CustomerActivity = z.infer<typeof related>;
export function parseCustomerActivity(value: unknown, cursor?: string | null) {
  const data = z
    .object({ items: z.array(related).max(25), nextCursor: z.uuid().optional() })
    .parse(value);
  if (
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    (!!data.nextCursor && data.nextCursor === cursor)
  )
    throw Error("Unexpected customer activity page");
  return data;
}
export function customerActivityAmount(
  row: Pick<CustomerActivity, "amountKobo" | "currency">,
) {
  if (row.amountKobo === null) return "Not applicable";
  return row.currency === "NGN"
    ? formatKobo(row.amountKobo)
    : `${row.currency ?? "Currency not recorded"} · ${BigInt(row.amountKobo).toLocaleString("en-NG")} minor units`;
}
export function customerActivityHref(kind: CustomerCollection, id: string) {
  return kind === "orders"
    ? `/admin/orders/${id}`
    : kind === "bookings"
      ? `/admin/bookings/${id}`
      : kind === "enquiries" || kind === "complaints"
        ? `/admin/support/${kind}/${id}`
        : undefined;
}
export const customerActivityPageParams = customerPageParams;
