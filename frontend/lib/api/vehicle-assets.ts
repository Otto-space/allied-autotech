"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
export type { PreparedUpload as PreparedAsset } from "./signed-upload";
type UploadBody = RequestBody<"/staff/vehicles/{vehicleId}/assets/upload", "post">;
export type AssetKind = UploadBody["kind"];
const supportedMime = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function validateAssetFile(file: Pick<File, "type" | "size">, kind: AssetKind) {
  const mime = supportedMime.safeParse(file.type);
  if (
    !mime.success ||
    ((kind === "HANDOVER" || kind === "CONDITION_REPORT") &&
      mime.data !== "application/pdf") ||
    (kind === "IMAGE" && mime.data === "application/pdf")
  )
    throw new Error(
      kind === "HANDOVER" || kind === "CONDITION_REPORT"
        ? "Choose a PDF document."
        : kind === "IMAGE"
          ? "Choose a JPEG, PNG or WebP image."
          : "Choose a supported JPEG, PNG, WebP or PDF file.",
    );
  const limit = (kind === "IMAGE" ? 10 : 20) * 1024 * 1024;
  if (file.size < 1 || file.size > limit)
    throw new Error(
      `Choose a nonempty file no larger than ${kind === "IMAGE" ? 10 : 20} MiB.`,
    );
  return mime.data;
}

export async function prepareVehicleAsset(
  options: UploadOptions & { kind: AssetKind; vehicleId: string },
) {
  const mimeType = validateAssetFile(options.file, options.kind);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: UploadBody = { ...metadata, kind: options.kind, mimeType };
      const result = await apiRequest(
        `/staff/vehicles/${options.vehicleId}/assets/upload`,
        {
          method: "POST",
          body,
          csrf: true,
          signal: options.signal,
        },
      );
      const parsed = z
        .object({ assetToken: z.string().min(40).max(4096), upload: z.unknown() })
        .safeParse(result.data);
      if (!parsed.success)
        throw new Error("The upload instructions could not be read. Try again.");
      return { token: parsed.data.assetToken, upload: parsed.data.upload };
    },
  });
}
