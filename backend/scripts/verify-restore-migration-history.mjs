/**
 * Read-only byte-history verification for the isolated 20 November restore target.
 *
 * The original staging journal contains 59 applied migrations. Most were applied
 * from LF SQL files, six from CRLF files, and one from an otherwise-LF file with
 * a terminal CRLF. This script reconstructs those exact source bytes in memory;
 * it does not edit migrations, connect to PostgreSQL, or authorize deployment.
 *
 * The expected journal fingerprint was obtained independently from a read-only
 * query against allied_autotech_staging. It is not a production fingerprint.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = fileURLToPath(
  new URL("../prisma/migrations/", import.meta.url),
);

const expectedCount = 59;
const expectedLast = "20261017153000_promotion_zero_value_configuration";
export const expectedJournalFingerprint = "27b094f565badb0bed039bed3d9d30ff";
const historicalMediaChecksum =
  "eb71bac3433a906ea50fd8f6c36c921d5da91551ae5245deda32e7fbb79c45b0";
const historicalMediaName = "20260930020000_managed_media_lifecycle";
const crlfMigrations = new Set([
  "20260924100000_owner_policy_financial_controls",
  "20260924110000_owner_booking_reminder_enum",
  "20260924110100_owner_booking_requests",
  "20260924120000_owner_tax_snapshots",
  "20260924130000_owner_support_operations",
  "20260924140000_owner_aftercare_disputes",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function reconstruct(name) {
  const original = readFileSync(join(migrationsDirectory, name, "migration.sql"));
  const sql = original.toString("utf8").replace(/\r\n/g, "\n");
  if (sql.includes("\r")) {
    throw new Error(`Unexpected non-CRLF carriage return in ${name}`);
  }

  if (crlfMigrations.has(name)) return Buffer.from(sql.replace(/\n/g, "\r\n"));
  if (name === historicalMediaName) {
    if (!sql.endsWith("\n")) {
      throw new Error("Historical managed-media migration lacks its terminal newline");
    }
    return Buffer.from(sql.slice(0, -1) + "\r\n");
  }
  return Buffer.from(sql);
}

export const names = readdirSync(migrationsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .slice(0, expectedCount);

if (names.length !== expectedCount || names.at(-1) !== expectedLast) {
  throw new Error("The source no longer has the expected first 59 migrations");
}
if (crlfMigrations.size !== 6 || [...crlfMigrations].some((name) => !names.includes(name))) {
  throw new Error("The six historical CRLF migrations are no longer present");
}

const entries = names.map((name) => `${name}:${sha256(reconstruct(name))}`);
const fingerprint = createHash("md5").update(entries.join("\n")).digest("hex");
const mediaChecksum = sha256(reconstruct(historicalMediaName));

if (mediaChecksum !== historicalMediaChecksum) {
  throw new Error(`Original-image managed-media checksum mismatch: ${mediaChecksum}`);
}
if (fingerprint !== expectedJournalFingerprint) {
  throw new Error(`Restored journal fingerprint mismatch: ${fingerprint}`);
}

process.stdout.write(
  `${expectedCount} applied migration source checksums reconstructed in memory.\n` +
    `Original-image managed-media SHA256: ${mediaChecksum}\n` +
    `Restore journal MD5 fingerprint: ${fingerprint} (MATCH)\n` +
    "No repository or database changes were made.\n",
);
