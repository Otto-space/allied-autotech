import {
  fitmentDecisionSchema,
  publishedCompatibilitySchema,
} from "../fitment/fitment.schemas.js";
import { z } from "zod";
import { recordedProductFields, productFamilySchema } from "./product-family.js";
import { mediaConfirmSchema } from "../media/media.schemas.js";
export const productImageConfirmSchema = mediaConfirmSchema
  .extend({
    sortOrder: z.number().int().min(0).max(10000).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export type ProductImageConfirm = z.infer<typeof productImageConfirmSchema>;
export const productImageResponseSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  createdAt: z.iso.datetime({ offset: true }),
  source: z.enum(["UPLOADED", "EXTERNAL"]),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
const timestamp = z.iso.datetime({ offset: true });
const money = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
export const productResponseSchema = z.object({
  ...recordedProductFields,
  fitment: fitmentDecisionSchema.optional(),
  condition: z.enum(["NEW", "USED", "REFURBISHED"]).nullable().optional(),
  classification: z.enum(["GENUINE_OEM", "AFTERMARKET"]).nullable().optional(),
  productType: z.string().nullable().optional(),
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  brand: z.string().nullable(),
  manufacturerPartNumber: z.string().nullable(),
  description: z.string().nullable(),
  priceKobo: money,
  compareAtPriceKobo: money.nullable(),
  currency: z.literal("NGN"),
  isActive: z.boolean(),
  featured: z.boolean(),
  mediaVersion: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
  category: z.object({
    family: productFamilySchema.nullable().optional(),
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    parentId: z.uuid().nullable(),
    isActive: z.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }),
  images: z.array(productImageResponseSchema),
  compatibilities: z.array(publishedCompatibilitySchema),
  availability: z.array(
    z.object({
      branch: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
      inStock: z.boolean(),
    }),
  ),
});
