// Offline, deterministic derivatives. Source originals are read only.
// Usage: node scripts/prepare-brand-assets.mjs <owner-supplied-directory>
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { format, resolveConfig } from "prettier";

const source = process.argv[2];
if (!source) throw new Error("Provide the directory containing the nine supplied PNGs");
const output = path.resolve("public/brand/r2");
await fs.mkdir(output, { recursive: true });
const definitions = [
  [
    "mark-black-backed",
    "logo mark_black.png",
    "Opaque white; reserved for white-backed use",
    [],
  ],
  [
    "mark-black",
    "logo mark_black_on_white.png",
    "Transparent; light surfaces",
    ["About principles"],
  ],
  [
    "mark-red-backed",
    "logo mark_main.png",
    "Opaque #06181F; reserved for matching dark panels",
    [],
  ],
  [
    "mark-red",
    "logo mark_main_1.png",
    "Transparent; light surfaces",
    ["Header", "Mobile header", "Authentication", "Home introduction"],
  ],
  [
    "mark-white",
    "logo mark_white_on_black.png",
    "Transparent; dark surfaces only",
    ["Footer", "Dashboard sidebar", "Dashboard mobile header"],
  ],
  [
    "built-on-trust",
    "ad copy 1.png",
    "Opaque portrait; full composition",
    ["Home trust feature"],
  ],
  [
    "precision-autocare",
    "ad copy 2.png",
    "Opaque portrait; full composition",
    ["Home service introduction", "About introduction"],
  ],
  [
    "right-work",
    "ad copy 3.png",
    "Opaque portrait; full composition",
    ["Services workmanship feature"],
  ],
  [
    "parts-delivery-withheld",
    "ad copy 4.png",
    "Opaque portrait; unsupported nationwide delivery claim",
    [],
  ],
];
const assets = [];
for (const [id, filename, suitability, placements] of definitions) {
  const input = await fs.readFile(path.join(source, filename));
  const metadata = await sharp(input).metadata();
  const { isOpaque } = await sharp(input).stats();
  const derivatives = [];
  if (id.startsWith("mark-")) {
    // Full symbol bounds 352..712 x 374..686, plus 18 px on every side.
    // Extract only: no resampling, recolouring, masking or geometry changes.
    const name = `${id}.png`;
    await sharp(input)
      .extract({ left: 334, top: 356, width: 397, height: 349 })
      .png({ compressionLevel: 9 })
      .toFile(path.join(output, name));
    derivatives.push({ path: `/brand/r2/${name}`, width: 397, height: 349 });
  } else if (id !== "parts-delivery-withheld") {
    for (const width of [480, 800, 1080]) {
      const name = `${id}-${width}.webp`;
      await sharp(input)
        .resize({ width })
        .webp({ quality: 88, effort: 6 })
        .toFile(path.join(output, name));
      derivatives.push({ path: `/brand/r2/${name}`, width, height: width * 1.25 });
    }
  }
  for (const derivative of derivatives) {
    const data = await fs.readFile(path.resolve("public", derivative.path.slice(1)));
    derivative.bytes = data.length;
    derivative.sha256 = createHash("sha256").update(data).digest("hex");
  }
  assets.push({
    id,
    source: filename,
    provenance: "Owner-supplied Revision 2, 26 October 2026",
    sourceSha256: createHash("sha256").update(input).digest("hex"),
    sourceBytes: input.length,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    transparent: !isOpaque,
    canvasTreatment: id.startsWith("mark-")
      ? "Extract x334 y356 397x349; full 361x313 symbol plus 18px clearspace on each side. No resampling."
      : "Full 4:5 composition; proportional resize only.",
    accessibleDescription: id.startsWith("mark-")
      ? "Allied AutoTech; mark is decorative inside the named shared wordmark."
      : id === "built-on-trust"
        ? "Sculptural red Allied emblem from the Built on Trust campaign; adjacent HTML conveys Built on trust. Driven by quality."
        : id === "precision-autocare"
          ? "Allied AutoTech Precision Autocare You Can Trust campaign, with a person in a red branded uniform."
          : id === "right-work"
            ? "Allied AutoTech No Guesswork campaign showing mechanical work; adjacent HTML conveys No guesswork. Just the right work."
            : "Withheld: original parts and nationwide-delivery truck promotion.",
    suitability,
    placements,
    derivatives,
    restrictions:
      id === "parts-delivery-withheld"
        ? "Do not publish: workshop collection only. Requires a clean corrected source without nationwide delivery or implied fleet ownership. No derivative generated."
        : id === "precision-autocare"
          ? "Marketing portrait; no identity, employment or qualification inferred."
          : id === "right-work"
            ? "Marketing workmanship image; not proof of equipment, certification or service availability."
            : "Preserve original geometry and composition.",
  });
}
await fs.writeFile(
  "docs/brand-assets-manifest.json",
  await format(
    JSON.stringify(
      {
        revision: 2,
        sourceDirectory:
          "Owner Downloads/alliedautotechlogoandmedia (originals unchanged)",
        assets,
      },
      null,
      2,
    ),
    {
      ...(await resolveConfig("docs/brand-assets-manifest.json")),
      filepath: "docs/brand-assets-manifest.json",
    },
  ),
);
console.log(
  `Prepared ${assets.reduce((n, a) => n + a.derivatives.length, 0)} derivatives; delivery artwork withheld.`,
);
