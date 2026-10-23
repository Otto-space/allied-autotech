import { z } from "zod";
export const compatibilitySchema = z.object({
  id: z.uuid(),
  vehicleModelId: z.uuid().nullable().optional(),
  reviewStatus: z
    .enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "RETIRED"])
    .optional(),
  effect: z.enum(["INCLUDE", "EXCLUDE"]).optional(),
  make: z.string(),
  model: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  notes: z.string().nullable(),
});
export const productImageSchema = z.object({
  source: z.enum(["UPLOADED", "EXTERNAL"]).optional(),
  width: z.number().int().nullable().optional(),
  height: z.number().int().nullable().optional(),
  id: z.uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
});
export const productExtrasSchema = z.object({
  mediaVersion: z.number().int().nonnegative().optional(),
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
// Accept the legacy catalogue page and the independent administrator product read.
export const parseProductExtrasSource = (value: unknown) => {
  const direct = productExtrasSchema.safeParse(value);
  return direct.success ? { items: [direct.data] } : parseProductExtrasPage(value);
};
// Legacy compatibility writes compare the child projection; reviewed rules use the versioned fitment workspace.
export const productExtrasRevision = (product: ProductExtras) => JSON.stringify(product);
export const parseCompatibilityChange = (value: unknown) =>
  compatibilitySchema.extend({ productId: z.uuid() }).parse(value);
export const parseImageChange = (value: unknown) => productImageSchema.parse(value);
