import { z } from "zod";

const cursor = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/);
export const adminCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(2).max(120),
  description: z.string().max(2000).nullable(),
  isActive: z.boolean(),
  version: z.number().int().nonnegative().max(2147483647),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;
export const parseAdminCategory = (value: unknown) => adminCategorySchema.parse(value);
export const parseAdminCategoryPage = (value: unknown) =>
  z
    .object({
      items: z.array(adminCategorySchema).max(25),
      nextCursor: cursor.optional(),
    })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate categories",
    )
    .parse(value);

export function categoryQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of ["search", "isActive", "cursor", "_trail", "edit"])
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
  const next = input.get("cursor");
  if (next) {
    if (!cursor.safeParse(next).success) invalid = true;
    else {
      params.set("cursor", next);
      api.set("cursor", next);
    }
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    next &&
    trail.length &&
    trail.length <= 20 &&
    trail[0] === "start" &&
    trail.slice(1).every((v) => cursor.safeParse(v).success)
  )
    params.set("_trail", trail.join(","));
  const edit = input.get("edit") || undefined;
  if (edit) {
    if (!z.uuid().safeParse(edit).success) invalid = true;
    else params.set("edit", edit);
  }
  return {
    params,
    api,
    invalid,
    edit: invalid ? undefined : edit,
    path: invalid ? null : `/admin/service-categories?${api}`,
  };
}

const clean = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => !/[\u0000-\u001f\u007f]/.test(v),
      "Remove unsupported control characters.",
    );
export const categoryFormSchema = z.object({
  name: clean(120).refine((v) => !!v, "Enter a category name."),
  slug: clean(120).refine(
    (v) => v.length >= 2 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    "Use lowercase words separated by hyphens.",
  ),
  description: clean(2000),
  isActive: z.boolean(),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
