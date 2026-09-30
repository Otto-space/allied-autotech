import { z } from "zod";
import { mediaVersionSchema } from "../media/media.schemas.js";
export const stockImageParams = z
  .object({ vehicleId: z.uuid(), imageId: z.uuid() })
  .strict();
export const stockImageUpdateSchema = mediaVersionSchema
  .extend({
    altText: z.string().trim().max(240).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
    "Include an image change",
  );
export type StockImageUpdate = z.infer<typeof stockImageUpdateSchema>;
export const stockImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  source: z.enum(["UPLOADED", "LEGACY", "EXTERNAL"]),
});
export const stockImageResultSchema = z.object({
  version: z.number().int(),
  images: z.array(stockImageSchema),
});
