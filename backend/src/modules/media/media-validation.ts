import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { matchesAllowedFileSignature } from "../../providers/storage/s3-object-storage.adapter.js";
import { mediaError } from "./media.errors.js";
import {
  mediaLimits,
  type MediaPurpose,
  type MediaUploadInput,
} from "./media.schemas.js";

export async function validateAndTransformImage(
  bytes: Buffer,
  input: MediaUploadInput,
  purpose: MediaPurpose,
) {
  if (bytes.length > mediaLimits[purpose].maxBytes) throw mediaError("MEDIA_TOO_LARGE");
  if (bytes.length !== input.sizeBytes) throw mediaError("MEDIA_INVALID");
  if (createHash("sha256").update(bytes).digest("hex") !== input.checksumSha256)
    throw mediaError("MEDIA_CHECKSUM_MISMATCH");
  if (!matchesAllowedFileSignature(input.mimeType, bytes))
    throw mediaError("MEDIA_UNSUPPORTED_FORMAT");
  // Some decoders expose only APNG's first frame. Reject its animation-control chunk.
  if (input.mimeType === "image/png") {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(offset);
      if (length > bytes.length - offset - 12) throw mediaError("MEDIA_INVALID");
      const chunk = bytes.toString("ascii", offset + 4, offset + 8);
      if (chunk === "acTL") throw mediaError("MEDIA_UNSUPPORTED_FORMAT");
      offset += length + 12;
      if (chunk === "IEND") break;
    }
  }
  const decoder = sharp(bytes, {
    limitInputPixels: 40_000_000,
    failOn: "warning",
    animated: false,
  });
  let metadata: Metadata;
  try {
    metadata = await decoder.metadata();
  } catch {
    throw mediaError("MEDIA_INVALID");
  }
  if (`image/${metadata.format}` !== input.mimeType || (metadata.pages ?? 1) !== 1)
    throw mediaError("MEDIA_UNSUPPORTED_FORMAT");
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 32 ||
    metadata.height < 32 ||
    metadata.width > 8192 ||
    metadata.height > 8192 ||
    metadata.width * metadata.height > 40_000_000
  )
    throw mediaError("MEDIA_INVALID_DIMENSIONS");
  const scale = Math.min(
    1,
    mediaLimits[purpose].maxOutputDimension / Math.max(metadata.width, metadata.height),
  );
  if (Math.floor(metadata.width * scale) < 32 || Math.floor(metadata.height * scale) < 32)
    throw mediaError("MEDIA_INVALID_DIMENSIONS");
  try {
    // Re-encode all accepted formats. Sharp drops EXIF, GPS, XMP and other metadata by default.
    const { data, info } = await decoder
      .rotate()
      .resize({
        width: mediaLimits[purpose].maxOutputDimension,
        height: mediaLimits[purpose].maxOutputDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: data,
      width: info.width,
      height: info.height,
      sizeBytes: data.length,
      mimeType: "image/webp",
      checksumSha256: createHash("sha256").update(data).digest("hex"),
    };
  } catch {
    throw mediaError("MEDIA_INVALID");
  }
}
