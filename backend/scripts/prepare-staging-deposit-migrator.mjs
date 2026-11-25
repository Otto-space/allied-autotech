/**
 * Prepare an offline, disposable staging migrator from a read-only migration
 * journal export. Does not connect to a database or apply any migration.
 * The returned directory may only be used through the guarded db:migrate path.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = fileURLToPath(new URL("../", import.meta.url));
const pendingExpected = [
  "20261123110000_approved_quote_booking_deposit_20",
  "20261123120000_booking_deposit_invoice_credit",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function selectHistoricalBytes(bytes, expectedChecksum, name) {
  if (!/^[a-f0-9]{64}$/.test(expectedChecksum))
    throw new Error(`Invalid recorded checksum for ${name}`);
  const source = bytes.toString("utf8");
  if (source.includes("\ufffd") || /\r(?!\n)/.test(source))
    throw new Error(`Unexpected SQL encoding or line endings: ${name}`);
  const lf = source.replace(/\r\n/g, "\n");
  const candidates = [
    bytes,
    Buffer.from(lf),
    Buffer.from(lf.replace(/\n/g, "\r\n")),
    ...(lf.endsWith("\n") ? [Buffer.from(lf.slice(0, -1) + "\r\n")] : []),
  ];
  const matched = candidates.find((candidate) => hash(candidate) === expectedChecksum);
  if (!matched)
    throw new Error(`Recorded migration differs beyond approved line-ending profiles: ${name}`);
  return matched;
}

export function verifyJournal(journal, migrationDirectory) {
  if (!Array.isArray(journal) || journal.length !== 132)
    throw new Error("Expected exactly 132 applied staging migration records");
  const names = readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .sort();
  if (names.length !== 134 || new Set(journal.map((row) => row.migration_name)).size !== 132)
    throw new Error("Unexpected migration set or duplicate journal record");
  const applied = new Map();
  for (const row of journal) {
    if (!row || typeof row.migration_name !== "string" ||
        row.finished_at == null || row.rolled_back_at != null)
      throw new Error("Incomplete or rolled-back migration history requires review");
    if (!names.includes(row.migration_name))
      throw new Error("Applied migration is absent from source");
    applied.set(row.migration_name, selectHistoricalBytes(
      readFileSync(join(migrationDirectory, row.migration_name, "migration.sql")),
      row.checksum,
      row.migration_name,
    ));
  }
  const pending = names.filter((name) => !applied.has(name));
  if (pending.join("\n") !== pendingExpected.join("\n"))
    throw new Error("Pending migrations differ from the approved deposit release");
  return { applied, pending };
}

export function prepare(journalPath) {
  if (!isAbsolute(journalPath)) throw new Error("Journal file must use an absolute path");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const sourcePrisma = join(backend, "prisma");
  const { applied, pending } = verifyJournal(journal, join(sourcePrisma, "migrations"));
  const isolated = mkdtempSync(join(tmpdir(), "allied-deposit-migrator-"));
  cpSync(sourcePrisma, join(isolated, "prisma"), { recursive: true });
  const runtimeFiles = [
    "package.json", "prisma.config.ts", "scripts/backup-database.ts",
    "scripts/check-database-safety.ts", "scripts/migrate-safely.ts",
    "scripts/lib/database-safety.ts", "src/config/database-tls.ts",
    "src/config/database-url.ts", "src/config/prisma-command-safety.ts",
  ];
  for (const file of runtimeFiles) {
    const destination = join(isolated, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(backend, file), destination);
  }
  for (const [name, bytes] of applied)
    writeFileSync(join(isolated, "prisma", "migrations", name, "migration.sql"), bytes);
  for (const row of journal) {
    const actual = hash(readFileSync(join(isolated, "prisma", "migrations", row.migration_name, "migration.sql")));
    if (actual !== row.checksum) throw new Error("Disposable history verification failed");
  }
  for (const name of pending) {
    const source = readFileSync(join(sourcePrisma, "migrations", name, "migration.sql"));
    const copied = readFileSync(join(isolated, "prisma", "migrations", name, "migration.sql"));
    if (!source.equals(copied)) throw new Error("Pending migration changed in copy");
  }
  if (existsSync(join(backend, "node_modules")))
    symlinkSync(join(backend, "node_modules"), join(isolated, "node_modules"), "dir");
  return { isolated, applied: applied.size, pending: pending.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 4 || process.argv[2] !== "--journal")
    throw new Error("Usage: node scripts/prepare-staging-deposit-migrator.mjs --journal <absolute-private-json-path>");
  const result = prepare(process.argv[3]);
  process.stdout.write(
    `Disposable migrator: ${result.isolated}\n` +
    `Applied checksums verified: ${result.applied}\n` +
    `Pending SQL preserved: ${result.pending}\n` +
    "No database changes or migrations performed.\n",
  );
}
