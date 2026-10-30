import { z } from "zod";
export const publicServiceCategorySchema = z.object({
  description: z.string().max(2000).nullable().optional(),
  id: z.uuid(),
  name: z.string().max(120),
  slug: z.string().max(120),
});
export const serviceSchema = z.object({
  category: publicServiceCategorySchema.nullable().default(null),
  image: z
    .object({
      id: z.uuid(),
      url: z.string().regex(/^\/api\/v1\/public\/media\/images\/[0-9a-f-]{36}$/i),
      altText: z.string().nullable(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable()
    .default(null),
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
  priceKobo: z.string().regex(/^\d+$/).nullable(),
  currency: z.literal("NGN"),
  durationMinutes: z.number().nullable(),
  version: z.number(),
});
export const servicePageSchema = z.object({
  items: z.array(serviceSchema),
  nextCursor: z.string().optional(),
});
export const parseServices = (value: unknown) => servicePageSchema.parse(value);
const catalogueCursor = z
  .string()
  .min(80)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/);
export const parseServiceDiscovery = (value: unknown) =>
  servicePageSchema
    .extend({
      items: z.array(serviceSchema).max(50),
      totalMatches: z.number().int().nonnegative(),
      nextCursor: catalogueCursor.optional(),
    })
    .parse(value);
export const parseServiceCategories = (value: unknown) =>
  z
    .object({
      items: z.array(publicServiceCategorySchema).max(50),
      nextCursor: catalogueCursor.optional(),
    })
    .parse(value);
export const parseServiceCategory = (value: unknown) =>
  publicServiceCategorySchema.parse(value);
