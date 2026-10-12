// Runs without a database, credentials, network, or real customer media.
import assert from "node:assert/strict";
import sharp from "sharp";
const png = await sharp({
  create: { width: 32, height: 32, channels: 3, background: { r: 24, g: 48, b: 72 } },
})
  .png()
  .toBuffer();
const webp = await sharp(png).webp().toBuffer();
const metadata = await sharp(webp).metadata();
assert.equal(metadata.format, "webp");
assert.equal(metadata.width, 32);
assert.equal(metadata.height, 32);
console.log(
  JSON.stringify({
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
  }),
);
