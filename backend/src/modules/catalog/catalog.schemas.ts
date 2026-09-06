import { z } from "zod";

const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      "Contains invalid characters",
    );
const nullableText = (maximum: number) => cleanText(maximum).nullable().optional();
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens");
const sku = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9][A-Z0-9._/-]*$/, "Enter a valid SKU");
const kobo = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/, "Use integer kobo");
const optionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const pageFields = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;

export const catalogEmptyBodySchema = z.object({}).strict().default({});
export const catalogEmptyQuerySchema = z.object({}).strict().default({});
export const categoryParamsSchema = z.object({ categoryId: z.uuid() }).strict();
export const productParamsSchema = z.object({ productId: z.uuid() }).strict();
export const compatibilityParamsSchema = z
  .object({
    productId: z.uuid(),
    compatibilityId: z.uuid(),
  })
  .strict();
export const imageParamsSchema = z
  .object({
    productId: z.uuid(),
    imageId: z.uuid(),
  })
  .strict();

export const categoryListQuerySchema = z.object(pageFields).strict();
export const adminCategoryListQuerySchema = z
  .object({
    ...pageFields,
    isActive: optionalBoolean,
  })
  .strict();
export const categoryCreateBodySchema = z
  .object({
    name: cleanText(120),
    slug,
    description: nullableText(2_000),
    isActive: z.boolean().default(true),
  })
  .strict();
export const categoryUpdateBodySchema = z
  .object({
    name: cleanText(120).optional(),
    slug: slug.optional(),
    description: nullableText(2_000),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const productListQuerySchema = z
  .object({
    ...pageFields,
    categoryId: z.uuid().optional(),
    brand: cleanText(100).optional(),
    search: cleanText(100).optional(),
    make: cleanText(100).optional(),
    model: cleanText(100).optional(),
    year: z.coerce.number().int().min(1886).max(2100).optional(),
    featured: optionalBoolean,
    sort: z.enum(["newest", "name", "price_asc", "price_desc"]).default("newest"),
  })
  .strict();
export const adminProductListQuerySchema = productListQuerySchema.extend({
  isActive: optionalBoolean,
});

const productFields = {
  categoryId: z.uuid(),
  name: cleanText(180),
  slug,
  sku,
  brand: nullableText(100),
  manufacturerPartNumber: nullableText(120),
  description: nullableText(10_000),
  priceKobo: kobo,
  compareAtPriceKobo: kobo.nullable().optional(),
  currency: z.literal("NGN").default("NGN"),
  isActive: z.boolean().default(true),
  featured: z.boolean().default(false),
} as const;
const validPrices = (value: {
  priceKobo?: string | undefined;
  compareAtPriceKobo?: string | null | undefined;
}) =>
  value.priceKobo === undefined ||
  value.compareAtPriceKobo == null ||
  BigInt(value.compareAtPriceKobo) >= BigInt(value.priceKobo);
export const productCreateBodySchema = z
  .object(productFields)
  .strict()
  .refine(validPrices, {
    path: ["compareAtPriceKobo"],
    message: "Must not be below the selling price",
  });
export const productUpdateBodySchema = z
  .object({
    categoryId: productFields.categoryId.optional(),
    name: productFields.name.optional(),
    slug: productFields.slug.optional(),
    sku: productFields.sku.optional(),
    brand: productFields.brand,
    manufacturerPartNumber: productFields.manufacturerPartNumber,
    description: productFields.description,
    priceKobo: productFields.priceKobo.optional(),
    compareAtPriceKobo: productFields.compareAtPriceKobo,
    currency: z.literal("NGN").optional(),
    isActive: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine(validPrices, {
    path: ["compareAtPriceKobo"],
    message: "Must not be below the selling price",
  });

const compatibilityFields = {
  make: cleanText(100),
  model: nullableText(100),
  yearFrom: z.number().int().min(1886).max(2100).nullable().optional(),
  yearTo: z.number().int().min(1886).max(2100).nullable().optional(),
  notes: nullableText(1_000),
} as const;
const validYearRange = (value: {
  yearFrom?: number | null | undefined;
  yearTo?: number | null | undefined;
}) => value.yearFrom == null || value.yearTo == null || value.yearFrom <= value.yearTo;
export const compatibilityCreateBodySchema = z
  .object(compatibilityFields)
  .strict()
  .refine(validYearRange, { path: ["yearTo"], message: "Must not precede yearFrom" });
export const compatibilityUpdateBodySchema = z
  .object({
    make: compatibilityFields.make.optional(),
    model: compatibilityFields.model,
    yearFrom: compatibilityFields.yearFrom,
    yearTo: compatibilityFields.yearTo,
    notes: compatibilityFields.notes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required")
  .refine(validYearRange, { path: ["yearTo"], message: "Must not precede yearFrom" });

const publicImageUrl = z
  .url()
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  }, "Use a public HTTPS URL without credentials");
export const imageCreateBodySchema = z
  .object({
    url: publicImageUrl,
    altText: nullableText(250),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export const imageUpdateBodySchema = z
  .object({
    url: publicImageUrl.optional(),
    altText: nullableText(250),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const favouriteListQuerySchema = z.object(pageFields).strict();
export const cartItemBodySchema = z
  .object({
    quantity: z.number().int().min(1).max(1_000),
  })
  .strict();

export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
export type AdminCategoryListQuery = z.infer<typeof adminCategoryListQuerySchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateBodySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateBodySchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;
export type ProductCreateInput = z.infer<typeof productCreateBodySchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateBodySchema>;
export type CompatibilityCreateInput = z.infer<typeof compatibilityCreateBodySchema>;
export type CompatibilityUpdateInput = z.infer<typeof compatibilityUpdateBodySchema>;
export type ImageCreateInput = z.infer<typeof imageCreateBodySchema>;
export type ImageUpdateInput = z.infer<typeof imageUpdateBodySchema>;
export type FavouriteListQuery = z.infer<typeof favouriteListQuerySchema>;
export type CartItemInput = z.infer<typeof cartItemBodySchema>;
