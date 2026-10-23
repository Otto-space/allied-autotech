import { z } from "zod";
import { productExtrasSchema } from "@/lib/api/product-extras-schemas";
import { nairaToKobo } from "@/lib/format/currency-input";
const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const money = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/);
export const productCategorySchema = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  slug: z.string(),
  isActive: z.boolean(),
  parentId: uuid.nullable().optional(),
});
export const adminProductSchema = productExtrasSchema.extend({
  name: z.string().min(1).max(180),
  slug: z.string().min(2).max(120),
  sku: z.string().min(2).max(80),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]).nullable().optional(),
  classification: z.enum(["GENUINE_OEM", "AFTERMARKET"]).nullable().optional(),
  productType: z.string().max(80).nullable().optional(),
  brand: z.string().max(100).nullable(),
  manufacturerPartNumber: z.string().max(120).nullable(),
  description: z.string().max(10000).nullable(),
  priceKobo: money,
  compareAtPriceKobo: money.nullable(),
  currency: z.literal("NGN"),
  featured: z.boolean(),
  mediaVersion: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
  category: productCategorySchema,
  availability: z.array(
    z.object({
      branch: z.object({ id: uuid, code: z.string(), name: z.string() }),
      inStock: z.boolean(),
    }),
  ),
});
export type AdminProduct = z.infer<typeof adminProductSchema>;
export const parseAdminProduct = (value: unknown) => adminProductSchema.parse(value);
export const parseAdminProducts = (value: unknown) =>
  z
    .object({ items: z.array(adminProductSchema).max(25), nextCursor: uuid.optional() })
    .refine(
      (p) => new Set(p.items.map((r) => r.id)).size === p.items.length,
      "Duplicate products",
    )
    .parse(value);
export const parseProductCategories = (value: unknown) =>
  z
    .object({
      items: z.array(productCategorySchema).max(100),
      nextCursor: uuid.optional(),
    })
    .parse(value);

export function productQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  const keys = [
    "search",
    "categoryId",
    "isActive",
    "featured",
    "sort",
    "brand",
    "make",
    "model",
    "year",
    "cursor",
    "_trail",
    "view",
    "edit",
    "media",
  ];
  for (const key of keys) if (input.getAll(key).length > 1) invalid = true;
  for (const key of ["search", "brand", "make", "model"]) {
    const value = input.get(key)?.trim();
    if (!value) continue;
    if (value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) invalid = true;
    else {
      params.set(key, value);
      api.set(key, value);
    }
  }
  for (const [key, values] of [
    ["isActive", ["true", "false"]],
    ["featured", ["true", "false"]],
    ["sort", ["newest", "name", "price_asc", "price_desc"]],
  ] as const) {
    const value = input.get(key);
    if (!value) continue;
    if (!(values as readonly string[]).includes(value)) invalid = true;
    else {
      params.set(key, value);
      api.set(key, value);
    }
  }
  for (const key of ["categoryId", "cursor", "edit", "media"]) {
    const value = input.get(key);
    if (!value) continue;
    if (!uuid.safeParse(value).success) invalid = true;
    else {
      params.set(key, value);
      if (["categoryId", "cursor"].includes(key)) api.set(key, value);
    }
  }
  const year = input.get("year");
  if (year) {
    if (!/^\d{4}$/.test(year) || Number(year) < 1886 || Number(year) > 2100)
      invalid = true;
    else {
      params.set("year", year);
      api.set("year", year);
    }
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length &&
    trail.length <= 20 &&
    trail[0] === "start" &&
    trail.slice(1).every((v) => uuid.safeParse(v).success)
  )
    params.set("_trail", trail.join(","));
  const view = input.get("view");
  if (view) {
    if (view !== "create") invalid = true;
    else params.set("view", view);
  }
  if (
    [params.has("view"), params.has("edit"), params.has("media")].filter(Boolean).length >
    1
  )
    invalid = true;
  return {
    params,
    api,
    invalid,
    path: invalid ? null : `/admin/catalog/products?${api}`,
    edit: invalid ? undefined : (params.get("edit") ?? undefined),
    media: invalid ? undefined : (params.get("media") ?? undefined),
    creating: !invalid && params.get("view") === "create",
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
const amount = (optional = false) =>
  z
    .string()
    .trim()
    .refine((v) => {
      if (optional && !v) return true;
      try {
        return money.safeParse(nairaToKobo(v)).success;
      } catch {
        return false;
      }
    }, "Enter a valid amount with up to two decimal places.");
export const productFormSchema = z
  .object({
    name: clean(180).min(1, "Enter a product name."),
    slug: clean(120)
      .min(2)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
    sku: clean(80)
      .min(2)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Enter a valid SKU."),
    categoryId: uuid,
    condition: z.enum(["", "NEW", "USED", "REFURBISHED"]).optional(),
    classification: z.enum(["", "GENUINE_OEM", "AFTERMARKET"]).optional(),
    productType: clean(80).optional(),
    brand: clean(100),
    manufacturerPartNumber: clean(120),
    description: clean(10000),
    priceKobo: amount(),
    compareAtPriceKobo: amount(true),
    featured: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((v, context) => {
    try {
      if (
        v.compareAtPriceKobo &&
        BigInt(nairaToKobo(v.compareAtPriceKobo)) < BigInt(nairaToKobo(v.priceKobo))
      )
        context.addIssue({
          code: "custom",
          path: ["compareAtPriceKobo"],
          message: "Comparison price must not be below the selling price.",
        });
    } catch {
      /* Field validation explains invalid amounts. */
    }
  });
export type ProductFormValues = z.infer<typeof productFormSchema>;
export function productBody(values: ProductFormValues, record?: AdminProduct | null) {
  return {
    name: values.name,
    slug: values.slug,
    sku: values.sku.toUpperCase(),
    categoryId: values.categoryId,
    condition: values.condition || null,
    classification: values.classification || null,
    productType: values.productType || null,
    brand: values.brand || null,
    manufacturerPartNumber: values.manufacturerPartNumber || null,
    description: values.description || null,
    priceKobo: nairaToKobo(values.priceKobo),
    compareAtPriceKobo: values.compareAtPriceKobo
      ? nairaToKobo(values.compareAtPriceKobo)
      : null,
    currency: "NGN" as const,
    featured: values.featured,
    isActive: values.isActive,
    ...(record ? { expectedUpdatedAt: record.updatedAt } : {}),
  };
}
