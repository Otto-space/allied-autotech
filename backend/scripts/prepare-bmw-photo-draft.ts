// Local preparation only: no network, database, upload or publication operation.
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { z } from "zod";
import { mediaLimits, mediaUploadSchema } from "../src/modules/media/media.schemas.js";

const reviewSchema = z
  .array(
    z
      .object({
        index: z.number().int().min(1).max(14),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        bytes: z.number().int().positive(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        format: z.literal("JPEG"),
        view: z.string(),
        review: z.string(),
        galleryOrder: z.number().int().nonnegative().nullable(),
        privacyPolygon: z
          .array(
            z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
          )
          .optional(),
      })
      .strict(),
  )
  .length(14);
const source = process.argv[2],
  destination = process.argv[3];
if (!source || !destination)
  throw Error(
    "Usage: tsx scripts/prepare-bmw-photo-draft.ts <reviewed originals directory> <private output directory>",
  );
const repo = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const output = path.resolve(destination);
const relative = path.relative(repo, output);
if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  throw Error("Keep vehicle preparation photos outside the repository and public assets");
if (output === path.resolve(source)) throw Error("Do not overwrite originals");
const review = reviewSchema.parse(
  JSON.parse(
    await readFile(
      new URL("../data/vehicle-drafts/bmw-photo-review.json", import.meta.url),
      "utf8",
    ),
  ),
);
await mkdir(output, { recursive: true });
const gallery = [];
for (const row of review
  .filter((row) => row.galleryOrder !== null)
  .sort((a, b) => a.galleryOrder! - b.galleryOrder!)) {
  const original = await readFile(
    path.join(source, `${String(row.index).padStart(2, "0")}.jpg`),
  );
  if (
    original.length > mediaLimits.STOCK.maxBytes ||
    original.length !== row.bytes ||
    createHash("sha256").update(original).digest("hex") !== row.sha256
  )
    throw Error(
      `Image ${row.index} differs from the visually reviewed original; review it again`,
    );
  if (original[0] !== 0xff || original[1] !== 0xd8 || original[2] !== 0xff)
    throw Error("Invalid JPEG signature");
  const metadata = await sharp(original, {
    limitInputPixels: 40_000_000,
    failOn: "warning",
  }).metadata();
  if (
    metadata.format !== "jpeg" ||
    metadata.width !== row.width ||
    metadata.height !== row.height ||
    (metadata.pages ?? 1) !== 1
  )
    throw Error("Image dimensions or type changed");
  let transformed = sharp(original, { limitInputPixels: 40_000_000, failOn: "warning" });
  if (row.privacyPolygon) {
    // Opaque identifier mask, not generative reconstruction. No vehicle wear,
    // condition, paint or instrument warning is removed or recoloured.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${row.width}" height="${row.height}"><polygon points="${row.privacyPolygon.map((point) => point.join(",")).join(" ")}" fill="#555555"/></svg>`;
    transformed = transformed.composite([{ input: Buffer.from(svg) }]);
  }
  const bytes = await transformed
    .webp({ quality: 90 })
    .timeout({ seconds: 10 })
    .toBuffer();
  const checksum = createHash("sha256").update(bytes).digest("hex");
  mediaUploadSchema.parse({
    mimeType: "image/webp",
    sizeBytes: bytes.length,
    checksumSha256: checksum,
  });
  const name = `${String(row.galleryOrder! + 1).padStart(2, "0")}-view-${row.index}`;
  await writeFile(path.join(output, `${name}.webp`), bytes);
  for (const width of [320, 640])
    await sharp(bytes)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(output, `${name}-${width}.webp`));
  gallery.push({
    file: `${name}.webp`,
    sortOrder: row.galleryOrder,
    isPrimary: row.galleryOrder === 0,
    altText: row.view,
    checksumSha256: checksum,
    sizeBytes: bytes.length,
    sourceSha256: row.sha256,
    privacyMaskApplied: !!row.privacyPolygon,
  });
}
await writeFile(
  path.join(output, "gallery.json"),
  JSON.stringify({ status: "PRIVATE_UNPUBLISHED_PREPARATION", gallery }, null, 2) + "\n",
);
await writeFile(
  path.join(output, "stock-draft.json"),
  await readFile(new URL("../data/vehicle-drafts/bmw-120i-2007.json", import.meta.url)),
);
process.stdout.write(
  `Prepared ${gallery.length} privacy-reviewed views and responsive derivatives in a private directory. No upload or database write performed.\n`,
);
