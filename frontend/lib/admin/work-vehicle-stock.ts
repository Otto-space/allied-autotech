import { z } from "zod";
import {
  listingStatuses,
  staffListingSchema,
  staffVehicleSchema,
} from "../api/staff-vehicle-schemas";
import { isStockPreviewUrl } from "../media";
export const stockStatusLabels = {
  DRAFT: "Draft",
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
} as const;
export const stockFilterSchema = z
  .object({
    search: z.string().trim().max(100),
    make: z.string().trim().max(80),
    model: z.string().trim().max(80),
    year: z.union([
      z.literal(""),
      z
        .string()
        .regex(/^\d{4}$/, "Enter a four-digit year.")
        .refine(
          (v) => Number(v) >= 1886 && Number(v) <= 2200,
          "Enter a year from 1886 to 2200.",
        ),
    ]),
    status: z.enum(["", ...listingStatuses, "LISTED", "UNLISTED"]),
    branchId: z.union([z.literal(""), z.uuid()]),
  })
  .refine(
    (v) =>
      [v.search, v.make, v.model].every((s) =>
        Array.from(s).every((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127),
      ),
    { path: ["search"], message: "Use printable filter text." },
  );
export type StockFilterValues = z.infer<typeof stockFilterSchema>;
const stockListing = staffListingSchema.extend({
  title: z.string().min(1).max(180),
  priceKobo: z.string().regex(/^[1-9][0-9]{0,15}$/),
  version: z.number().int().nonnegative(),
});
export const workStockVehicleSchema = staffVehicleSchema
  .extend({
    stockNumber: z.string().min(1).max(40),
    make: z.string().min(1).max(80),
    model: z.string().min(1).max(80),
    trim: z.string().max(80).nullable(),
    year: z.number().int().min(1886).max(2200),
    mileageKm: z.number().int().min(0).max(10_000_000).nullable(),
    version: z.number().int().nonnegative(),
    listings: z.array(stockListing),
  })
  .superRefine((row, context) => {
    if (
      row.branchId !== row.branch.id ||
      !row.branch.name.trim() ||
      !row.stockNumber.trim() ||
      !row.make.trim() ||
      !row.model.trim()
    )
      context.addIssue({ code: "custom", message: "Invalid stock identity" });
    if (
      new Set(row.listings.map((v) => v.id)).size !== row.listings.length ||
      new Set(row.images.map((v) => v.id)).size !== row.images.length ||
      row.images.filter((v) => v.isPrimary).length > 1
    )
      context.addIssue({ code: "custom", message: "Duplicate stock evidence" });
    if (
      row.images.some(
        (image) =>
          isStockPreviewUrl(image.url) &&
          image.url.toLowerCase() !==
            `/api/v1/staff/vehicles/${row.id}/images/${image.id}/content`.toLowerCase(),
      )
    )
      context.addIssue({ code: "custom", message: "Mismatched stock thumbnail" });
  });
export type WorkStockVehicle = z.infer<typeof workStockVehicleSchema>;
export function parseWorkVehicleStock(
  value: unknown,
  role: string,
  branchId?: string | null,
) {
  const raw = z
    .object({ items: z.array(z.unknown()).max(25), nextCursor: z.uuid().optional() })
    .parse(value);
  if (
    role === "STAFF" &&
    raw.items.some(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        (Object.hasOwn(row, "acquisitionCostKobo") ||
          Object.hasOwn(row, "acquisitionCurrency")),
    )
  )
    throw Error("Unexpected private acquisition fields");
  const items = raw.items.map((row) => workStockVehicleSchema.parse(row));
  if (
    new Set(items.map((row) => row.id)).size !== items.length ||
    new Set(items.map((row) => row.stockNumber)).size !== items.length
  )
    throw Error("Duplicate stock records");
  if (raw.nextCursor && raw.nextCursor !== items.at(-1)?.id)
    throw Error("Unexpected stock cursor");
  if (
    role === "STAFF" &&
    (!branchId || items.some((row) => row.branchId !== branchId || !row.branch.isActive))
  )
    throw Error("Unexpected staff branch scope");
  return { items, ...(raw.nextCursor ? { nextCursor: raw.nextCursor } : {}) };
}
export function workVehicleStockQuery(
  input: URLSearchParams,
  role: string,
  assignedBranch?: string | null,
) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" }),
    known = [
      "search",
      "make",
      "model",
      "year",
      "status",
      "listed",
      "branchId",
      "cursor",
      "_trail",
    ];
  let invalid = Array.from(input.keys()).some(
    (key) => !known.includes(key) || input.getAll(key).length > 1,
  );
  for (const [key, max] of [
    ["search", 100],
    ["make", 80],
    ["model", 80],
  ] as const) {
    const value = input.get(key)?.trim();
    if (value) {
      if (value.length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid = true;
      else params.set(key, value);
    }
  }
  const year = input.get("year");
  if (year) {
    if (!/^\d{4}$/.test(year) || Number(year) < 1886 || Number(year) > 2200)
      invalid = true;
    else params.set("year", year);
  }
  const status = input.get("status");
  if (status) {
    if (!(listingStatuses as readonly string[]).includes(status)) invalid = true;
    else params.set("status", status);
  }
  const listed = input.get("listed");
  if (listed) {
    if (!["true", "false"].includes(listed) || (listed === "false" && status))
      invalid = true;
    else params.set("listed", listed);
  }
  for (const key of ["branchId", "cursor"]) {
    const value = input.get(key);
    if (value) {
      if (
        !z.uuid().safeParse(value).success ||
        (key === "branchId" && role === "STAFF" && value !== assignedBranch)
      )
        invalid = true;
      else params.set(key, value);
    }
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
  return { params, api, invalid, path: invalid ? null : `/staff/vehicles?${api}` };
}
export function stockMatchesFilters(row: WorkStockVehicle, api: URLSearchParams) {
  return (
    (!api.has("branchId") || row.branchId === api.get("branchId")) &&
    (!api.has("year") || row.year === Number(api.get("year"))) &&
    (!api.has("status") ||
      row.listings.some((item) => item.status === api.get("status"))) &&
    (api.get("listed") !== "false" || row.listings.length === 0) &&
    (api.get("listed") !== "true" || row.listings.length > 0)
  );
}
export function stockFilterDefaults(params: URLSearchParams): StockFilterValues {
  return {
    search: params.get("search") ?? "",
    make: params.get("make") ?? "",
    model: params.get("model") ?? "",
    year: params.get("year") ?? "",
    branchId: params.get("branchId") ?? "",
    status:
      (params.get("status") as StockFilterValues["status"]) ||
      (params.get("listed") === "false"
        ? "UNLISTED"
        : params.get("listed") === "true"
          ? "LISTED"
          : ""),
  };
}
export function stockFilterParams(values: StockFilterValues, administrator: boolean) {
  const params = new URLSearchParams();
  for (const key of ["search", "make", "model", "year"] as const)
    if (values[key]) params.set(key, values[key]);
  if (values.status === "UNLISTED") params.set("listed", "false");
  else if (values.status === "LISTED") params.set("listed", "true");
  else if (values.status) params.set("status", values.status);
  if (administrator && values.branchId) params.set("branchId", values.branchId);
  return params;
}
