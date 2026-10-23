import { z } from "zod";
import { categoryFormSchema as baseCategoryFormSchema } from "./category-catalogue";
export const categoryFormSchema = baseCategoryFormSchema.extend({
  parentId: z.union([z.literal(""), z.uuid()]).optional(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export const adminProductCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(120),
  description: z.string().max(2000).nullable(),
  parentId: z.uuid().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type AdminProductCategory = z.infer<typeof adminProductCategorySchema>;
export const parseAdminProductCategory = (value: unknown) =>
  adminProductCategorySchema.parse(value);
export const parseAdminProductCategories = (value: unknown) =>
  z
    .object({
      items: z.array(adminProductCategorySchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate categories",
    )
    .parse(value);

export function productCategoryQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of ["search", "isActive", "cursor", "_trail", "edit", "view"])
    if (input.getAll(key).length > 1) invalid = true;
  const search = input.get("search")?.trim();
  if (search) {
    if (search.length > 120 || /[\u0000-\u001f\u007f]/.test(search)) invalid = true;
    else {
      params.set("search", search);
      api.set("search", search);
    }
  }
  const active = input.get("isActive");
  if (active) {
    if (active !== "true" && active !== "false") invalid = true;
    else {
      params.set("isActive", active);
      api.set("isActive", active);
    }
  }
  for (const key of ["cursor", "edit"]) {
    const value = input.get(key);
    if (!value) continue;
    if (!z.uuid().safeParse(value).success) invalid = true;
    else {
      params.set(key, value);
      if (key === "cursor") api.set(key, value);
    }
  }
  const view = input.get("view");
  if (view !== null) {
    if (view !== "create" || input.has("edit")) invalid = true;
    else params.set("view", view);
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length &&
    trail.length <= 20 &&
    trail[0] === "start" &&
    trail.slice(1).every((v) => z.uuid().safeParse(v).success)
  )
    params.set("_trail", trail.join(","));
  return {
    params,
    api,
    invalid,
    edit: invalid ? undefined : params.get("edit") || undefined,
    creating: !invalid && view === "create",
    path: invalid ? null : `/admin/catalog/categories?${api}`,
  };
}
export function productCategoryBody(
  values: CategoryFormValues,
  record?: AdminProductCategory | null,
) {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || null,
    isActive: values.isActive,
    parentId: values.parentId || null,
    ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
  };
}
