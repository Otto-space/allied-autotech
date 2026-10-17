import { z } from "zod";
import { promotionSchema } from "@/lib/api/promotion-schemas";
export const discountTypeLabels = {
  PERCENTAGE: "Percentage",
  FIXED_AMOUNT: "Fixed amount",
} as const;
export const workPromotionSchema = promotionSchema
  .safeExtend({
    name: z.string().min(1).max(160),
    code: z.string().min(1).max(80).nullable(),
  })
  .refine(
    (row) =>
      row.name.trim().length > 0 &&
      Date.parse(row.endsAt) > Date.parse(row.startsAt) &&
      (row.usageLimit === null ||
        row.perCustomerLimit === null ||
        row.perCustomerLimit <= row.usageLimit),
    "Invalid promotion configuration",
  );
export const parseWorkPromotions = (value: unknown) =>
  z
    .object({
      items: z.array(workPromotionSchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate promotions",
    )
    .parse(value);
export type WorkPromotion = z.infer<typeof workPromotionSchema>;
export function workPromotionsQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of ["search", "isActive", "discountType", "cursor", "_trail"])
    if (input.getAll(key).length > 1) invalid = true;
  const search = input.get("search")?.trim();
  if (search) {
    if (search.length > 160 || /[\u0000-\u001f\u007f]/.test(search)) invalid = true;
    else params.set("search", search);
  }
  const active = input.get("isActive");
  if (active) {
    if (!["true", "false"].includes(active)) invalid = true;
    else params.set("isActive", active);
  }
  const type = input.get("discountType");
  if (type) {
    if (!Object.hasOwn(discountTypeLabels, type)) invalid = true;
    else params.set("discountType", type);
  }
  const cursor = input.get("cursor");
  if (cursor) {
    if (!z.uuid().safeParse(cursor).success) invalid = true;
    else params.set("cursor", cursor);
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
  return { params, api, invalid, path: invalid ? null : `/admin/promotions?${api}` };
}
export function promotionMatchesFilters(row: WorkPromotion, api: URLSearchParams) {
  return (
    (!api.has("isActive") || String(row.isActive) === api.get("isActive")) &&
    (!api.has("discountType") || row.discountType === api.get("discountType"))
  );
}
