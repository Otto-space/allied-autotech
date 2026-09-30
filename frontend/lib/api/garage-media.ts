"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { customerVehicleSchema } from "./vehicle-schemas";
import { profilePhotoSchema } from "./profile-schemas";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
export const garageDetailSchema = customerVehicleSchema.extend({
  mediaVersion: z.number().int().nonnegative(),
  images: z.array(profilePhotoSchema).max(12),
});
export const parseGarageDetail = (value: unknown) => garageDetailSchema.parse(value);
export function validateGarageImage(file: Pick<File, "type" | "size">) {
  const mime = z.enum(["image/jpeg", "image/png", "image/webp"]).safeParse(file.type);
  if (!mime.success) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a nonempty image no larger than 10 MiB.");
  return mime.data;
}
export function prepareGarageImage(vehicleId: string, options: UploadOptions) {
  const mimeType = validateGarageImage(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<"/customers/vehicles/{vehicleId}/assets/upload", "post"> = {
        ...metadata,
        mimeType,
      };
      const response = await apiRequest(
        `/customers/vehicles/${vehicleId}/assets/upload`,
        { method: "POST", csrf: true, signal: options.signal, body },
      );
      const result = z
        .object({ assetToken: z.string().min(40), upload: z.unknown() })
        .parse(response.data);
      return { token: result.assetToken, upload: result.upload };
    },
  });
}
