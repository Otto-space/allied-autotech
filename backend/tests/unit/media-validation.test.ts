import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateAndTransformImage } from "../../src/modules/media/media-validation.js";
import type { MediaUploadInput } from "../../src/modules/media/media.schemas.js";

const metadata = (
  bytes: Buffer,
  mimeType: MediaUploadInput["mimeType"] = "image/png",
) => ({
  mimeType,
  sizeBytes: bytes.length,
  checksumSha256: createHash("sha256").update(bytes).digest("hex"),
});
const png = (width = 64, height = 64) =>
  sharp({ create: { width, height, channels: 3, background: "red" } })
    .png()
    .toBuffer();
describe("managed image validation", () => {
  it("keeps product image dimensions and 10 MiB boundaries authoritative", async () => {
    const minimum = await png(32, 32);
    expect(
      (await validateAndTransformImage(minimum, metadata(minimum), "PRODUCT")).width,
    ).toBe(32);
    const maximumSide = await png(8192, 128);
    expect(
      (await validateAndTransformImage(maximumSide, metadata(maximumSide), "PRODUCT"))
        .width,
    ).toBeLessThanOrEqual(2048);
    for (const dimensions of [
      [31, 64],
      [8193, 32],
      [8192, 32],
    ]) {
      const bytes = await png(dimensions[0], dimensions[1]);
      await expect(
        validateAndTransformImage(bytes, metadata(bytes), "PRODUCT"),
      ).rejects.toMatchObject({ code: "MEDIA_INVALID_DIMENSIONS" });
    }
    const tooLarge = Buffer.alloc(10 * 1024 * 1024 + 1);
    await expect(
      validateAndTransformImage(tooLarge, metadata(tooLarge), "PRODUCT"),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE" });
  });
  it("decodes, resizes, strips personal metadata and returns actual dimensions", async () => {
    const bytes = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "blue" },
    })
      .withExif({ IFD0: { Artist: "Private owner" } })
      .jpeg()
      .toBuffer();
    const result = await validateAndTransformImage(
      bytes,
      metadata(bytes, "image/jpeg"),
      "PROFILE",
    );
    expect([result.width, result.height]).toEqual([1024, 768]);
    const decoded = await sharp(result.bytes).metadata();
    expect(decoded.format).toBe("webp");
    expect(decoded.exif).toBeUndefined();
    expect(decoded.xmp).toBeUndefined();
  });
  it("rejects MIME spoofing, corrupt files, checksums and declared sizes", async () => {
    const bytes = await png();
    await expect(
      validateAndTransformImage(bytes, metadata(bytes, "image/jpeg"), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_UNSUPPORTED_FORMAT" });
    await expect(
      validateAndTransformImage(
        bytes,
        { ...metadata(bytes), checksumSha256: "0".repeat(64) },
        "PROFILE",
      ),
    ).rejects.toMatchObject({ code: "MEDIA_CHECKSUM_MISMATCH" });
    await expect(
      validateAndTransformImage(
        bytes,
        { ...metadata(bytes), sizeBytes: bytes.length + 1 },
        "PROFILE",
      ),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID" });
    const truncated = bytes.subarray(0, 24);
    await expect(
      validateAndTransformImage(truncated, metadata(truncated), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID" });
  });
  it("rejects undersized dimensions and oversized profile bytes", async () => {
    const tiny = await png(16, 16);
    await expect(
      validateAndTransformImage(tiny, metadata(tiny), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID_DIMENSIONS" });
    const extreme = await png(8192, 32);
    await expect(
      validateAndTransformImage(extreme, metadata(extreme), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_INVALID_DIMENSIONS" });
    const large = Buffer.alloc(5 * 1024 * 1024 + 1);
    await expect(
      validateAndTransformImage(large, metadata(large), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE" });
  });
  it("rejects APNG animation control even when a decoder could read the first frame", async () => {
    const bytes = await png();
    const animation = Buffer.alloc(20);
    animation.writeUInt32BE(8, 0);
    animation.write("acTL", 4);
    animation.writeUInt32BE(2, 8);
    const animated = Buffer.concat([
      bytes.subarray(0, 33),
      animation,
      bytes.subarray(33),
    ]);
    await expect(
      validateAndTransformImage(animated, metadata(animated), "PROFILE"),
    ).rejects.toMatchObject({ code: "MEDIA_UNSUPPORTED_FORMAT" });
  });
});
