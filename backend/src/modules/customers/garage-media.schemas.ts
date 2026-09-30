import { z } from "zod";
import { mediaConfirmSchema, mediaVersionSchema } from "../media/media.schemas.js";

export const garageImageConfirmSchema = mediaConfirmSchema
  .extend({
    sortOrder: z.number().int().min(0).max(10000).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();
export const garageImageUpdateSchema = mediaVersionSchema
  .extend({
    altText: z.string().trim().max(240).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    isPrimary: z.literal(true).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).some((key) => key !== "expectedVersion"),
    "At least one image field is required",
  );
export const garageImageParamsSchema = z
  .object({ vehicleId: z.uuid(), imageId: z.uuid() })
  .strict();
export type GarageImageConfirm = z.infer<typeof garageImageConfirmSchema>;
export type GarageImageUpdate = z.infer<typeof garageImageUpdateSchema>;
