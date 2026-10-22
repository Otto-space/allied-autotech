import { z } from "zod";
import { staffDirectoryQuery } from "./work-staff-directory";
export { inspectionPageParams as branchPageParams } from "./work-inspections";
const timestamp = z.iso.datetime({ offset: true });
const clean = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max)
    .refine((v) => !/[\u0000-\u001f\u007f]/u.test(v), "Remove control characters.");
export const branchCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Use 2–20 letters, numbers or hyphens.");
export const branchSchema = z
  .object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.email().nullable(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    timezone: z.string(),
    isActive: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict();
export type WorkBranch = z.infer<typeof branchSchema>;
export const branchFormSchema = z.object({
  code: branchCode,
  name: clean(120),
  address: clean(250),
  city: clean(100),
  state: clean(100),
  country: z.literal("Nigeria"),
  timezone: clean(64).refine((v) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: v }).format();
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone, such as Africa/Lagos."),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine(
      (v) => !v || (v.length >= 7 && /^\+?[0-9][0-9 ()-]*$/.test(v)),
      "Enter a valid phone number or leave it blank.",
    ),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (v) => !v || z.email().safeParse(v).success,
      "Enter a valid email or leave it blank.",
    ),
  isActive: z.boolean(),
});
export type BranchValues = z.infer<typeof branchFormSchema>;
export const branchDefaults: BranchValues = {
  code: "",
  name: "",
  address: "",
  city: "",
  state: "",
  country: "Nigeria",
  timezone: "Africa/Lagos",
  phone: "",
  email: "",
  isActive: true,
};
export function branchValues(row?: WorkBranch): BranchValues {
  if (!row) return branchDefaults;
  return {
    code: row.code,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    country: "Nigeria",
    timezone: row.timezone,
    phone: row.phone ?? "",
    email: row.email ?? "",
    isActive: row.isActive,
  };
}
export function branchBody(values: BranchValues, before?: WorkBranch) {
  const parsed = branchFormSchema.parse(values);
  const fields = {
    ...parsed,
    phone: parsed.phone || null,
    email: parsed.email.toLowerCase() || null,
  };
  const changes = Object.fromEntries(
    Object.entries(fields).filter(
      ([key, value]) => !before || before[key as keyof WorkBranch] !== value,
    ),
  );
  return before && Object.keys(changes).length
    ? { ...changes, expectedRevision: before.updatedAt }
    : changes;
}
export function verifyBranchReceipt(
  value: unknown,
  body: Record<string, unknown>,
  before?: WorkBranch,
) {
  const row = branchSchema.parse(value);
  if (
    (before &&
      (row.id !== before.id ||
        row.createdAt !== before.createdAt ||
        Date.parse(row.updatedAt) <= Date.parse(before.updatedAt))) ||
    Object.entries(body).some(
      ([key, expected]) =>
        key !== "expectedRevision" && row[key as keyof WorkBranch] !== expected,
    ) ||
    (before &&
      Object.keys(branchDefaults).some(
        (key) =>
          !(key in body) &&
          row[key as keyof WorkBranch] !== before[key as keyof WorkBranch],
      ))
  )
    throw Error("The saved branch could not be confirmed");
  return row;
}
export function branchQuery(input: URLSearchParams) {
  const source = new URLSearchParams(input);
  for (const key of ["isActive", "branch", "create"]) source.delete(key);
  const base = staffDirectoryQuery(source),
    active = input.get("isActive"),
    selected = input.get("branch"),
    create = input.get("create");
  const invalid =
    base.invalid ||
    [...input.keys()].some(
      (key) =>
        !["q", "isActive", "cursor", "_trail", "branch", "create"].includes(key) ||
        input.getAll(key).length !== 1,
    ) ||
    (active !== null && !["true", "false"].includes(active)) ||
    (selected !== null && !z.uuid().safeParse(selected).success) ||
    (create !== null && create !== "1") ||
    (!!selected && create !== null);
  const params = base.params;
  if (active !== null) params.set("isActive", active);
  if (selected) params.set("branch", selected.toLowerCase());
  if (create) params.set("create", create);
  const api = new URLSearchParams(params);
  for (const key of ["branch", "create", "_trail"]) api.delete(key);
  api.set("limit", "25");
  return {
    params,
    invalid,
    selected: invalid ? null : selected,
    creating: !invalid && create === "1",
    path: invalid ? null : `/admin/branches?${api}`,
  };
}
export function parseBranchPage(value: unknown, query = new URLSearchParams()) {
  const page = z
    .object({ items: z.array(branchSchema).max(25), nextCursor: z.uuid().optional() })
    .strict()
    .parse(value);
  const term = query.get("q")?.trim().toLowerCase();
  if (
    page.items.some(
      (row, index) =>
        (index > 0 && page.items[index - 1]!.id >= row.id) ||
        (query.has("cursor") && row.id <= query.get("cursor")!) ||
        (query.has("isActive") && row.isActive !== (query.get("isActive") === "true")) ||
        (query.has("code") && row.code !== query.get("code")) ||
        (term &&
          ![row.name, row.code, row.city, row.state].some((s) =>
            s.toLowerCase().includes(term),
          )),
    ) ||
    (page.nextCursor &&
      (page.nextCursor !== page.items.at(-1)?.id ||
        page.nextCursor === query.get("cursor")))
  )
    throw Error("Branch search scope could not be confirmed");
  return page;
}
export const branchLabels: Record<string, string> = {
  code: "Branch code",
  name: "Name",
  address: "Street address",
  city: "City",
  state: "State",
  country: "Country",
  timezone: "Appointment timezone",
  phone: "Public phone",
  email: "Public email",
  isActive: "Branch status",
};
