// Owner originals are read-only. No retouching, recolouring or destructive crops.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Supply the original Allied photograph directory");
const definitions = [
  [
    "smoke-leak-detector",
    "IMG_3258.jpg.jpeg",
    "About engine equipment",
    "Full composition",
  ],
  [
    "workshop-equipment",
    "IMG_3263.jpg.jpeg",
    "About workshop equipment",
    "Full composition",
  ],
  [
    "service-bay",
    "IMG_3264.jpg.jpeg",
    "Home service bay; About equipment",
    "Both posts; natural portrait ratio",
  ],
  [
    "diagnostics-at-work",
    "IMG_3267.jpg.jpeg",
    "Hero 1; diagnostics; About team at work",
    "62% 50%; copy outside photo",
  ],
  [
    "diagnostic-tablet",
    "IMG_3447.jpg.jpeg",
    "Home equipment; About team at work",
    "Supporting detail",
  ],
  [
    "alignment-at-work",
    "IMG_3532.jpg.jpeg",
    "Hero 2; alignment; About team at work",
    "62% 50%; preserve person and equipment",
  ],
  [
    "allied-team",
    "IMG_3618.jpg.jpeg",
    "Home team; About team",
    "Full natural ratio; all seven people; never crop",
  ],
  [
    "tyre-care-at-work",
    "IMG_3412.jpg.jpeg",
    "Hero 3; About introduction",
    "50% 50%; landscape tyre action",
  ],
  ["tyre-changer", "IMG_3261.jpg.jpeg", "About workshop equipment", "Full portrait"],
  [
    "engine-oils",
    "WhatsApp Image 2026-11-01 at 21.48.06.jpeg",
    "Shop discovery",
    "Illustrative; no SKU/stock claim",
  ],
  [
    "filters",
    "WhatsApp Image 2026-11-01 at 21.48.07.jpeg",
    "Shop discovery",
    "Portrait contain; illustrative",
  ],
  [
    "replacement-parts",
    "WhatsApp Image 2026-11-01 at 21.48.08.jpeg",
    "Shop discovery",
    "Complete illustration; no SKU claim",
  ],
  [
    "branded-oils-withheld",
    "WhatsApp Image 2026-11-01 at 21.48.09.jpeg",
    "Withheld",
    "Unverified brand/grade/stock",
  ],
  [
    "oil-service",
    "WhatsApp Image 2026-11-01 at 21.48.010.jpeg",
    "Generic Lube Oil Service discovery",
    "Label illustrative; not Allied employee",
  ],
  [
    "performance-withheld",
    "WhatsApp Image 2026-11-01 at 21.48.011.jpeg",
    "Withheld",
    "Unsupported tuning direction",
  ],
];
const output = path.resolve("public/images/workshop/owner");
await fs.mkdir(output, { recursive: true });
const manifest = [];
for (const [id, filename, placement, framing] of definitions) {
  const input = await fs.readFile(path.join(source, filename));
  const metadata = await sharp(input).metadata();
  const derivatives = [];
  if (!id.endsWith("withheld")) {
    const max = Math.min(metadata.width, id === "allied-team" ? 1920 : 1600);
    const destination = path.join(output, `${id}.webp`);
    await sharp(input)
      .rotate()
      .resize({ width: max, withoutEnlargement: true })
      .webp({ quality: 82, effort: 5 })
      .toFile(destination);
    const delivered = await sharp(destination).metadata();
    derivatives.push({
      path: `/images/workshop/owner/${id}.webp`,
      width: delivered.width,
      height: delivered.height,
      bytes: (await fs.stat(destination)).size,
    });
  }
  manifest.push({
    id,
    source: filename,
    sha256: createHash("sha256").update(input).digest("hex"),
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    placement,
    framing,
    derivatives,
  });
}
await fs.writeFile(
  path.resolve("docs/workshop-asset-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Prepared ${manifest.length} source mappings; ${manifest.reduce((n, x) => n + x.derivatives.reduce((a, d) => a + d.bytes, 0), 0)} delivery bytes.`,
);
