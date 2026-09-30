import { z } from "zod";

export const mediaPurposes = [
  "PROFILE",
  "GARAGE",
  "SERVICE",
  "PRODUCT",
  "STOCK",
] as const;
export type MediaPurpose = (typeof mediaPurposes)[number];
export const mediaLimits = {
  PROFILE: { maxBytes: 5 * 1024 * 1024, count: 1, maxOutputDimension: 1024 },
  GARAGE: { maxBytes: 10 * 1024 * 1024, count: 12, maxOutputDimension: 2048 },
  SERVICE: { maxBytes: 10 * 1024 * 1024, count: 1, maxOutputDimension: 2048 },
  PRODUCT: { maxBytes: 10 * 1024 * 1024, count: 12, maxOutputDimension: 2048 },
  STOCK: { maxBytes: 10 * 1024 * 1024, count: 20, maxOutputDimension: 2048 },
} as const;
export const mediaUploadSchema = z
  .object({
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export const mediaVersionSchema = z
  .object({ expectedVersion: z.number().int().min(0).max(2147483647) })
  .strict();
export const mediaConfirmSchema = mediaVersionSchema
  .extend({
    assetToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    altText: z.string().trim().max(240).nullable().optional(),
  })
  .strict();
export const mediaImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  width: z.number().int(),
  height: z.number().int(),
});
export const mediaResultSchema = z.object({
  version: z.number().int(),
  images: z.array(mediaImageSchema),
});
export const mediaPreparationSchema = z.object({
  assetToken: z.string(),
  upload: z.object({
    method: z.literal("PUT"),
    url: z.url(),
    expiresAt: z.iso.datetime(),
    headers: z.record(z.string(), z.string()),
  }),
  limits: z.object({
    maxBytes: z.number().int(),
    count: z.number().int(),
    maxOutputDimension: z.number().int(),
  }),
});
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type MediaConfirmInput = z.infer<typeof mediaConfirmSchema>;
export type MediaResult = z.infer<typeof mediaResultSchema>;
