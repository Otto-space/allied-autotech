import { z } from "zod";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => [...value].every((c) => (c.codePointAt(0) ?? 0) > 31 && c !== "\u007f"),
      "Contains invalid characters",
    );
const limit = z
  .string()
  .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
  .default("20")
  .transform(Number);
export const serviceDiscoveryQuerySchema = z
  .object({
    search: text(100)
      .refine((v) => v.length >= 2, "Enter at least two characters")
      .optional(),
    categoryId: z.uuid().optional(),
    pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]).optional(),
    sort: z.enum(["name", "newest", "duration_asc"]).default("name"),
    cursor: z.union([z.uuid(), catalogueCursorSchema]).optional(),
    limit,
  })
  .strict();
export type ServiceDiscoveryQuery = z.infer<typeof serviceDiscoveryQuerySchema>;
export const serviceCategoryQuerySchema = z
  .object({
    search: text(120).optional(),
    cursor: catalogueCursorSchema.optional(),
    limit,
  })
  .strict();
export const adminServiceCategoryQuerySchema = serviceCategoryQuerySchema.extend({
  limit: z
    .string()
    .regex(/^(?:[1-9]|[1-9][0-9]|100)$/)
    .default("25")
    .transform(Number),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});
export type ServiceCategoryQuery = z.infer<typeof adminServiceCategoryQuerySchema>;
export const serviceCategoryParamsSchema = z.object({ categoryId: z.uuid() }).strict();
export const serviceCategoryCreateSchema = z
  .object({
    name: text(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: text(2000).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();
export const serviceCategoryUpdateSchema = serviceCategoryCreateSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().min(0).max(2147483647),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "At least one change is required");
export type ServiceCategoryCreate = z.infer<typeof serviceCategoryCreateSchema>;
export type ServiceCategoryUpdate = z.infer<typeof serviceCategoryUpdateSchema>;
export const publicServiceCategorySchema = z.object({
  id: z.uuid(),
  name: z.string().max(120),
  slug: z.string().max(120),
});
export const adminServiceCategorySchema = publicServiceCategorySchema.extend({
  description: z.string().nullable(),
  isActive: z.boolean(),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
