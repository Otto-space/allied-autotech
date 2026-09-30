"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";

export function validateProfilePhoto(file: Pick<File, "type" | "size">) {
  const mime = z.enum(["image/jpeg", "image/png", "image/webp"]).safeParse(file.type);
  if (!mime.success) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size < 1 || file.size > 5 * 1024 * 1024)
    throw new Error("Choose a nonempty image no larger than 5 MiB.");
  return mime.data;
}
export function prepareProfilePhoto(options: UploadOptions) {
  const mimeType = validateProfilePhoto(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<"/customers/profile/photo/upload", "post"> = {
        ...metadata,
        mimeType,
      };
      const response = await apiRequest("/customers/profile/photo/upload", {
        method: "POST",
        csrf: true,
        body,
        signal: options.signal,
      });
      const result = z
        .object({ assetToken: z.string().min(40), upload: z.unknown() })
        .parse(response.data);
      return { token: result.assetToken, upload: result.upload };
    },
  });
}
