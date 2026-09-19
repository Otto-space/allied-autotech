import { z } from "zod";
export const compatibilitySchema = z.object({
  id: z.uuid(),
  make: z.string(),
  model: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  notes: z.string().nullable(),
});
export const productImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});
export const productExtrasSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  isActive: z.boolean(),
  category: z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() }),
  compatibilities: z.array(compatibilitySchema),
  images: z.array(productImageSchema),
});
export type ProductExtras = z.infer<typeof productExtrasSchema>;
export type ProductCompatibility = z.infer<typeof compatibilitySchema>;
export type ProductImage = z.infer<typeof productImageSchema>;
export const parseProductExtrasPage = (value: unknown) =>
  z
    .object({ items: z.array(productExtrasSchema), nextCursor: z.uuid().optional() })
    .parse(value);
// Child writes do not advance Product.updatedAt, so compare the actual child projection.
export const productExtrasRevision = (product: ProductExtras) => JSON.stringify(product);
export const parseCompatibilityChange = (value: unknown) =>
  compatibilitySchema.extend({ productId: z.uuid() }).parse(value);
export const parseImageChange = (value: unknown) => productImageSchema.parse(value);
