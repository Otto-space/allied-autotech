import { z } from "zod";
import { inventorySchema, type Inventory } from "@/lib/api/inventory-schemas";
export const workInventorySchema = inventorySchema
  .extend({
    quantity: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    reorderLevel: z.number().int().nonnegative(),
    version: z.number().int().nonnegative(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .refine(
    (row) => row.available === row.quantity - row.reserved,
    "Invalid stock balance",
  );
export const parseWorkInventories = (value: unknown) =>
  z
    .object({
      items: z.array(workInventorySchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .refine(
      (page) =>
        new Set(page.items.map((row) => row.id)).size === page.items.length &&
        new Set(page.items.map((row) => `${row.branch.id}:${row.product.id}`)).size ===
          page.items.length,
      "Duplicate inventory",
    )
    .parse(value);
export function workInventoryQuery(input: URLSearchParams, administrator: boolean) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of ["search", "lowStock", "branchId", "productId", "cursor", "_trail"])
    if (input.getAll(key).length > 1) invalid = true;
  const number = input.get("search")?.trim();
  if (number) {
    if (number.length > 100 || /[\u0000-\u001f\u007f]/.test(number)) invalid = true;
    else params.set("search", number);
  }
  const lowStock = input.get("lowStock");
  if (lowStock && !["true", "false"].includes(lowStock)) invalid = true;
  else if (lowStock === "true") params.set("lowStock", "true");
  for (const key of ["branchId", "productId", "cursor"]) {
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
  return { params, api, invalid, path: invalid ? null : `/staff/inventory?${api}` };
}

export function inventoryMatchesFilters(row: Inventory, api: URLSearchParams) {
  return (
    (!api.has("branchId") || row.branch.id === api.get("branchId")) &&
    (!api.has("productId") || row.product.id === api.get("productId")) &&
    (api.get("lowStock") !== "true" || row.available <= row.reorderLevel)
  );
}
const creationMarkerSchema = z
  .object({ branchId: z.uuid(), productId: z.uuid() })
  .strict();
export type InventoryCreationMarker = z.infer<typeof creationMarkerSchema>;
export const inventoryCreationKey = (owner: string) =>
  `inventory-create-pending:${owner}`;
export function readInventoryCreation(
  key: string,
): InventoryCreationMarker | "unknown" | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? creationMarkerSchema.parse(JSON.parse(raw)) : undefined;
  } catch {
    return "unknown";
  }
}
export function saveInventoryCreation(key: string, value: InventoryCreationMarker) {
  const raw = JSON.stringify(creationMarkerSchema.parse(value));
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Pending creation not saved");
}
export const clearInventoryCreation = (key: string) => sessionStorage.removeItem(key);
