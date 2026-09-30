"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
import { validateGarageImage } from "./garage-media";
export const validateProductImage = validateGarageImage;
export function prepareProductImage(productId: string, options: UploadOptions) {
  const mimeType = validateProductImage(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<
        "/admin/catalog/products/{productId}/assets/upload",
        "post"
      > = { ...metadata, mimeType };
      const response = await apiRequest(
        `/admin/catalog/products/${productId}/assets/upload`,
        { method: "POST", csrf: true, signal: options.signal, body },
      );
      const result = z
        .object({ assetToken: z.string().min(40), upload: z.unknown() })
        .parse(response.data);
      return { token: result.assetToken, upload: result.upload };
    },
  });
}
