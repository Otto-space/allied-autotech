/**
 * Staging-only migration runtime. Read the migration journal under a read-only
 * transaction and reconstruct historical SQL bytes only in a disposable tree.
 * Never alter repository SQL, Prisma history, or database schema here.
 */
import { createHash } from "node:crypto";
import {
  copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  expectedJournalFingerprint, names, reconstruct,
} from "./verify-restore-migration-history.mjs";

const expectedLast = [
  "20261123110000_approved_quote_booking_deposit_20",
  "20261123120000_booking_deposit_invoice_credit",
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function matchingHistoricalBytes(bytes, checksum, name) {
  if (!/^[a-f0-9]{64}$/.test(checksum))
    throw new Error("Invalid recorded migration checksum: " + name);
  const sql = bytes.toString("utf8");
  if (sql.includes("\ufffd") || /\r(?!\n)/.test(sql))
    throw new Error("Unexpected SQL encoding or line endings: " + name);
  const lf = sql.replace(/\r\n/g, "\n");
  const profiles = [
    bytes, Buffer.from(lf), Buffer.from(lf.replace(/\n/g, "\r\n")),
    ...(lf.endsWith("\n") ? [Buffer.from(lf.slice(0, -1) + "\r\n")] : []),
  ];
  const matched = profiles.find((candidate) => hash(candidate) === checksum);
  if (!matched)
    throw new Error("Applied SQL differs beyond known checkout line-ending profiles: " + name);
  return matched;
}

async function readStagingJournal() {
  const { DB_HOST: host, DB_PORT: port, DB_NAME: database, DB_USER: user,
    DB_PASSWORD: password, DB_SSL_MODE: mode, DB_SSL_CA_FILE: caPath } = process.env;
  if (database !== "allied_autotech_staging" ||
      !host?.endsWith(".db.ondigitalocean.com") ||
      !/^\d+$/.test(port ?? "") || !user || !password ||
      mode !== "verify-full" || !caPath || !existsSync(caPath))
    throw new Error("Verified staging migration database connection is not configured");
  const client = new pg.Client({
    host, port: Number(port), database, user, password,
    ssl: { ca: readFileSync(caPath), rejectUnauthorized: true, servername: host },
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    options: "-c timezone=UTC",
  });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    try {
      const result = await client.query(
        'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at'
      );
      return result.rows;
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }
}

export async function prepare() {
  const backend = fileURLToPath(new URL("../", import.meta.url));
  const sourcePrisma = join(backend, "prisma");
  const migrationDirectory = join(sourcePrisma, "migrations");
  const allNames = readdirSync(migrationDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (allNames.length !== 134 ||
      allNames.slice(0, names.length).join("\n") !== names.join("\n") ||
      allNames.slice(-2).join("\n") !== expectedLast.join("\n"))
    throw new Error("Unexpected migration set; review the source before using this staging package");

  const journal = await readStagingJournal();
  if (journal.length !== allNames.length ||
      new Set(journal.map((row) => row.migration_name)).size !== allNames.length)
    throw new Error("Staging migration journal must contain exactly 134 unique records");
  const rows = new Map(journal.map((row) => [row.migration_name, row]));
  const matched = new Map();
  for (const name of allNames) {
    const row = rows.get(name);
    if (!row || row.finished_at == null || row.rolled_back_at != null)
      throw new Error("Missing, unfinished, or rolled-back staging migration: " + name);
    const source = readFileSync(join(migrationDirectory, name, "migration.sql"));
    const bytes = names.includes(name)
      ? reconstruct(name)
      : matchingHistoricalBytes(source, row.checksum, name);
    if (hash(bytes) !== row.checksum)
      throw new Error("Staging migration checksum differs: " + name);
    if (expectedLast.includes(name) && !bytes.equals(source))
      throw new Error("Approved deposit SQL differs from the applied source: " + name);
    matched.set(name, bytes);
  }

  const history = names.map((name) => name + ":" + hash(matched.get(name)));
  const fingerprint = createHash("md5").update(history.join("\n")).digest("hex");
  if (fingerprint !== expectedJournalFingerprint)
    throw new Error("The original 59-migration recovery fingerprint differs");

  const isolated = mkdtempSync(join(tmpdir(), "allied-restore-migrator-"));
  const isolatedPrisma = join(isolated, "prisma");
  cpSync(sourcePrisma, isolatedPrisma, { recursive: true });
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
  for (const [name, bytes] of matched)
    writeFileSync(join(isolatedPrisma, "migrations", name, "migration.sql"), bytes);
  for (const [name, bytes] of matched)
    if (hash(readFileSync(join(isolatedPrisma, "migrations", name, "migration.sql"))) !== hash(bytes))
      throw new Error("Disposable migration verification failed: " + name);

  const dependencies = join(backend, "node_modules");
  if (existsSync(dependencies))
    symlinkSync(dependencies, join(isolated, "node_modules"), "dir");
  return { isolated, checked: matched.size, dependencies: existsSync(dependencies) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length !== 3 || process.argv[2] !== "--prepare")
    throw new Error("Usage: node scripts/prepare-isolated-restore-migrator.mjs --prepare");
  const result = await prepare();
  process.stdout.write(
    "Disposable migration runtime: " + result.isolated + "\n" +
    "Applied history: " + result.checked + "/134 checked; pending SQL: 0.\n" +
    "Verified read-only journal; original 59-migration fingerprint preserved.\n" +
    "Database/backup operations: READ ONLY. Repository SQL: UNCHANGED.\n" +
    (result.dependencies ? "Dependencies available through a link to the original runtime.\n" :
      "Dependencies unavailable here; use the migration image.\n")
  );
}
