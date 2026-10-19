import { z } from "zod";
import { inspectionPageParams } from "./work-inspections";
export const customerDefaults = {
  search: "",
  field: "name",
  status: "",
  verified: "",
  sort: "newest",
};
const cursor = /^[A-Za-z0-9_-]{1,1024}$/;
export function customersQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    fields = ["search", "field", "status", "verified", "sort", "cursor", "_trail"];
  let invalid = false;
  for (const key of input.keys())
    if (!fields.includes(key) || input.getAll(key).length !== 1) invalid = true;
  const values = { ...customerDefaults, ...Object.fromEntries(input) },
    search = values.search.trim().replace(/\s+/gu, " ").toLowerCase();
  if (
    !["name", "email", "phone", "id"].includes(values.field) ||
    !["", "ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(values.status) ||
    !["", "true", "false"].includes(values.verified) ||
    !["newest", "oldest"].includes(values.sort)
  )
    invalid = true;
  if (
    search.length > 120 ||
    (search &&
      (values.field === "id"
        ? !z.uuid().safeParse(search).success
        : values.field === "phone"
          ? !/^\+?[0-9 ()-]+$/.test(search) || search.replace(/\D/g, "").length < 3
          : search.length < 2 || /[\u0000-\u001f\u007f]/u.test(search)))
  )
    invalid = true;
  for (const [key, value] of Object.entries({ ...values, search }))
    if (
      ["search", "field", "status", "verified", "sort"].includes(key) &&
      value &&
      value !== customerDefaults[key as keyof typeof customerDefaults]
    )
      params.set(key, value);
  const after = input.get("cursor"),
    trail = input.get("_trail");
  if (after !== null) {
    if (!cursor.test(after)) invalid = true;
    else params.set("cursor", after);
  }
  if (trail !== null) {
    const entries = trail.split(",");
    if (
      !after ||
      entries.length > 50 ||
      entries[0] !== "start" ||
      entries.slice(1).some((s) => !cursor.test(s)) ||
      entries.includes(after) ||
      new Set(entries).size !== entries.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/admin/customers?${api}` };
}
const row = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type WorkCustomer = z.infer<typeof row>;
export function parseWorkCustomers(value: unknown, params = new URLSearchParams()) {
  const data = z
    .object({
      items: z.array(row).max(25),
      nextCursor: z.string().regex(cursor).optional(),
    })
    .parse(value);
  if (
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    data.nextCursor === params.get("cursor") ||
    data.items.some(
      (r) =>
        (params.has("status") && r.status !== params.get("status")) ||
        (params.has("verified") && String(r.emailVerified) !== params.get("verified")),
    )
  )
    throw Error("Unexpected customer page");
  return data;
}
export const customerPageParams = inspectionPageParams;
