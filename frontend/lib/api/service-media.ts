"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
import { validateGarageImage } from "./garage-media";
export const serviceAdminImageSchema = z.object({
  id: z.uuid(),
  url: z
    .string()
    .regex(
      /^\/api\/v1\/admin\/services\/[0-9a-f-]{36}\/images\/[0-9a-f-]{36}\/content$/i,
    ),
  altText: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const serviceImagesSchema = z.object({
  version: z.number().int().nonnegative(),
  images: z.array(serviceAdminImageSchema).max(1),
});
export const parseServiceImages = (value: unknown) => serviceImagesSchema.parse(value);
export const validateServiceImage = validateGarageImage;
export function prepareServiceImage(serviceId: string, options: UploadOptions) {
  const mimeType = validateServiceImage(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<"/admin/services/{serviceId}/assets/upload", "post"> = {
        ...metadata,
        mimeType,
      };
      const response = await apiRequest(`/admin/services/${serviceId}/assets/upload`, {
        method: "POST",
        csrf: true,
        signal: options.signal,
        body,
      });
      const result = z
        .object({ assetToken: z.string().min(40), upload: z.unknown() })
        .parse(response.data);
      return { token: result.assetToken, upload: result.upload };
    },
  });
}
