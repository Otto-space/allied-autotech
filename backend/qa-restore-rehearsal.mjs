/**
 * One-off, fail-closed QA database acceptance runner.
 *
 * This file is deliberately isolated on a staging-only branch. It never
 * connects to a production host, never alters the source QA database, and
 * never embeds database or Spaces credentials in its outputs.
 *
 * --preflight: read-only database identity and 59-migration history proof.
 * --rehearse: fresh encrypted Spaces backup, independent populated restore,
 *             then guarded forward migration on the RESTORED database only.
 */

import { createHash, hkdfSync, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import pg from "pg";

const mode = process.argv[2];
if (!["--preflight", "--rehearse"].includes(mode) || process.argv.length !== 3) {
  throw new Error("Use --preflight or --rehearse; no operation was performed.");
}

const expectedHost =
  "allied-autotech-restore-acceptance-20261120-do-user-44970995-0.k.db.ondigitalocean.com";
// App Platform can resolve attached database HOSTNAME to this exact private
// endpoint in the same QA VPC instead of the public cluster endpoint.
const expectedPrivateHost =
  "private-allied-autotech-restore-acceptance-20261120-do-user-449.k.db.ondigitalocean.com";
const sourceDatabase = "allied_autotech_staging";
const expectedFingerprint = "27b094f565badb0bed039bed3d9d30ff";
const bucket = "allied-autotech-restore-qa-20261120";
// Mike approved this QA-only encrypted transfer on 21 November 2026 after
// confirming all four users are test accounts. The named admin and owner may
// still have genuine identities/session material, so the exception is opt-in,
// count-bound and confined to this exact isolated QA snapshot. A changed
// profile fails closed instead of silently transferring new personal records.
const qaTestAccountConfirmation = "qa-test-accounts-encrypted-backup-20261121";
const approvedTestAccountCounts = new Map([
  ["User", "4"], ["CustomerProfile", "4"],
  ["StaffProfile", "1"], ["Session", "8"],
]);
const personalTables = new Set([
  "User", "Session", "StaffProfile", "CustomerProfile", "CustomerVehicle",
  "Booking", "Order", "Payment", "Invoice", "Enquiry", "Complaint",
  "InspectionRequest", "Review", "Notification", "Quotation",
]);

if (process.env.QA_REHEARSAL_CONFIRM !== "isolated-qa-staging-20261120") {
  throw new Error("Explicit isolated QA-only confirmation is required.");
}
// Stop a wedged container before it can accumulate meaningful hourly charges.
setTimeout(() => {
  process.stderr.write("QA rehearsal exceeded its 45-minute runtime limit; stopped.\n");
  process.exit(124);
}, 45 * 60_000).unref();

// Bind individual database component fields in App Platform, not a database
// URL: the source database name is fixed here, irrespective of its defaultdb.
// No administrator password is ever copied into a source file or app form.
const suppliedHost = process.env.DB_HOST || "";
const suppliedPort = Number(process.env.DB_PORT);
const suppliedUser = process.env.DB_USER || "";
const roleAllowed = mode === "--preflight"
  ? ["allied_restore_qa_runtime", "doadmin"].includes(suppliedUser)
  : suppliedUser === "doadmin";
if (
  ![expectedHost, expectedPrivateHost].includes(suppliedHost) ||
  suppliedPort !== 25060 ||
  !roleAllowed ||
  !process.env.DB_PASSWORD
) {
  throw new Error(
    "Database target mismatch: exact QA connection required. " +
    `host allowed=${[expectedHost, expectedPrivateHost].includes(suppliedHost)}, ` +
    `port allowed=${suppliedPort === 25060}, role allowed=${roleAllowed}, ` +
    `credential bound=${Boolean(process.env.DB_PASSWORD)}.`,
  );
}
if (process.env.DB_SSL_MODE !== "verify-full") {
  throw new Error("Database TLS must use verify-full.");
}

const workspace = mkdtempSync(join(tmpdir(), "allied-qa-rehearsal-"));
const caFile = join(workspace, "qa-ca.pem");
const caBytes = process.env.DB_SSL_CA_CERT
  ? Buffer.from(process.env.DB_SSL_CA_CERT, "utf8")
  : Buffer.from(process.env.DB_SSL_CA_BASE64 || "", "base64");
const caText = caBytes.toString("utf8");
if (
  caBytes.length < 200 || caBytes.length > 1_048_576 ||
  !caText.includes("-----BEGIN CERTIFICATE-----") ||
  !caText.includes("-----END CERTIFICATE-----") ||
  caText.includes("PRIVATE KEY")
) throw new Error("Verified TLS CA certificate is required.");
writeFileSync(caFile, caBytes, { mode: 0o600, flag: "wx" });

const target = {
  host: suppliedHost,
  port: suppliedPort,
  database: sourceDatabase,
  user: suppliedUser,
  password: process.env.DB_PASSWORD,
};
const pgEnv = (database) => ({
  ...process.env,
  PGHOST: target.host,
  PGPORT: String(target.port),
  PGDATABASE: database,
  PGUSER: target.user,
  PGPASSWORD: target.password,
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT: caFile,
  PGCONNECT_TIMEOUT: "10",
});

async function command(program, args, env, cwd = "/app") {
  const child = spawn(program, args, { env, cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => {
    output += chunk.toString("utf8");
    if (output.length > 256_000) child.kill();
  });
  // Never echo stderr: database and storage tools can include connection detail.
  child.stderr.resume();
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error(`${program} could not start; stopped safely.`)));
    child.once("exit", resolve);
  });
  if (exitCode !== 0) throw new Error(`${program} failed; stopped safely without modifying the source database.`);
  return output;
}

const dbClient = async (database) => {
  const client = new pg.Client({
    host: target.host, port: target.port, database,
    user: target.user, password: target.password,
    ssl: { ca: caText, rejectUnauthorized: true, servername: target.host },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
};
async function fileHash(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

let client = await dbClient(sourceDatabase);
let journal;
let sourceCounts;
let personalRecordsPresent = false;
try {
  const identity = await client.query(
    "SELECT current_database() AS database, current_user AS role, current_setting('server_version_num') AS version"
  );
  if (
    identity.rows[0]?.database !== sourceDatabase ||
    identity.rows[0]?.role !== suppliedUser ||
    Number(identity.rows[0]?.version) < 180000 ||
    Number(identity.rows[0]?.version) >= 190000
  ) throw new Error("QA database identity/version check failed.");
  journal = (await client.query(
    `SELECT migration_name, checksum FROM public."_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY migration_name`
  )).rows;
  const history = journal.map(row => `${row.migration_name}:${row.checksum}`).join("\n");
  if (journal.length !== 59 || createHash("md5").update(history).digest("hex") !== expectedFingerprint) {
    throw new Error("QA migration journal does not match the recorded 59-migration snapshot.");
  }
  const unfinished = await client.query(
    `SELECT count(*)::int AS total FROM public."_prisma_migrations"
      WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`
  );
  if (unfinished.rows[0].total !== 0) throw new Error("Unfinished or rolled-back QA migrations.");

  // Count every ordinary public table, not just the migration journal. This
  // compares restored data aggregates without exposing customer records.
  const tableNames = (await client.query(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
  )).rows.map(row => row.tablename);
  sourceCounts = new Map();
  for (const name of tableNames) {
    const safe = name.replaceAll('"', '""');
    const result = await client.query(`SELECT count(*)::bigint AS total FROM public."${safe}"`);
    sourceCounts.set(name, String(result.rows[0].total));
  }
  personalRecordsPresent = [...sourceCounts].some(
    ([name, total]) => personalTables.has(name) && total !== "0",
  );
} finally {
  await client.end();
}

process.stdout.write(
  `QA_PREFLIGHT_OK: server=18, applied=59, tables=${sourceCounts.size}, ` +
  `personal-record transfer blocked=${personalRecordsPresent}; source database unchanged.\n`,
);
if (mode === "--preflight") process.exit(0);
if (personalRecordsPresent) {
  const exactApprovedSnapshot = [...approvedTestAccountCounts].every(
    ([name, expected]) => sourceCounts.get(name) === expected,
  ) && [...personalTables].every(
    (name) => (sourceCounts.get(name) ?? "0") === (approvedTestAccountCounts.get(name) ?? "0"),
  );
  if (
    process.env.QA_TEST_ACCOUNT_BACKUP_CONFIRM !== qaTestAccountConfirmation ||
    !exactApprovedSnapshot
  ) {
    throw new Error(
      "Personal records require the exact approved QA-only test-account snapshot and " +
      "a separate explicit backup confirmation; no transfer was attempted.",
    );
  }
  process.stdout.write(
    "QA_TEST_ACCOUNTS_APPROVED: exactly 4 users, 4 customer profiles, " +
    "1 staff profile, 8 sessions, and no other listed personal records.\n",
  );
}

const accessId = process.env.QA_SPACES_ACCESS_KEY_ID || "";
const accessSecret = process.env.QA_SPACES_SECRET_ACCESS_KEY || "";
if (accessId !== "DO801PN4VKZLZT96KKV7" || accessSecret.length < 30) {
  throw new Error("QA-bucket-scoped Spaces key is required; backup not started.");
}
const s3 = new S3Client({
  region: "lon1", endpoint: "https://lon1.digitaloceanspaces.com",
  credentials: { accessKeyId: accessId, secretAccessKey: accessSecret },
});
// Spaces supports SSE-C; the customer-provided encryption key is derived from
// the separately protected scoped credential and never persisted with objects.
const customerKey = Buffer.from(hkdfSync("sha256", accessSecret, bucket, "allied-qa-backup-sse-c-v1", 32));
const sse = {
  SSECustomerAlgorithm: "AES256",
  SSECustomerKey: customerKey.toString("base64"),
  SSECustomerKeyMD5: createHash("md5").update(customerKey).digest("base64"),
};

const backup = join(workspace, "qa-original.dump");
await command("pg_dump", ["--no-password", "--format=custom", "--file", backup], pgEnv(sourceDatabase));
const listing = await command("pg_restore", ["--list", backup], pgEnv(sourceDatabase));
if (!listing.split(/\r?\n/).some(line => line.trim() === `;     dbname: ${sourceDatabase}`.trim())) {
  throw new Error("PostgreSQL dump archive identity did not match QA source.");
}
const digest = await fileHash(backup);
// Check all 83 source-table counts again before any outbound transfer. This
// catches source changes during the dump without exposing any row contents.
client = await dbClient(sourceDatabase);
try {
  const now = (await client.query(
    "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
  )).rows.map(row => row.tablename);
  if (now.length !== sourceCounts.size || now.some(name => !sourceCounts.has(name))) {
    throw new Error("QA source table set changed during backup; transfer blocked.");
  }
  for (const [name, expected] of sourceCounts) {
    const safe = name.replaceAll('"', '""');
    const actual = await client.query(`SELECT count(*)::bigint AS total FROM public."${safe}"`);
    if (String(actual.rows[0]?.total) !== expected) {
      throw new Error("QA source table counts changed during backup; transfer blocked.");
    }
  }
} finally {
  await client.end();
}
const key = `rehearsals/2026-11-20/${Date.now()}-${randomBytes(8).toString("hex")}.dump`;
const sourceSize = statSync(backup).size;
await s3.send(new PutObjectCommand({
  Bucket: bucket, Key: key, Body: createReadStream(backup), ContentLength: sourceSize,
  ...sse, Metadata: { sha256: digest, source: "allied-autotech-qa-staging" },
}));
const remote = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key, ...sse }));
if (Number(remote.ContentLength) !== sourceSize || remote.Metadata?.sha256 !== digest) {
  throw new Error("Encrypted off-device backup metadata verification failed.");
}
const fetched = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, ...sse }));
if (!fetched.Body) throw new Error("The remote QA backup is not readable.");
const restoredArchive = join(workspace, "qa-downloaded.dump");
await pipeline(fetched.Body, createWriteStream(restoredArchive, { mode: 0o600 }));
if (await fileHash(restoredArchive) !== digest) {
  throw new Error("Off-device backup retrieval checksum mismatch; no restore attempted.");
}
process.stdout.write(`QA_BACKUP_OK: encrypted Spaces object verified by download, sha256=${digest}.\n`);

// This creates a new, empty, uniquely named database on the isolated QA
// cluster. No SQL is written to allied_autotech_staging or production.
const restoredDatabase = `allied_qa_${randomBytes(6).toString("hex")}_ci`;
client = await dbClient("defaultdb");
try {
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [restoredDatabase]);
  if (existing.rowCount !== 0) throw new Error("A new unique restore database is required.");
  await client.query(`CREATE DATABASE "${restoredDatabase}"`);
} finally {
  await client.end();
}
await command("pg_restore", [
  "--no-password", "--exit-on-error", "--no-owner", "--no-privileges",
  "--dbname", restoredDatabase, restoredArchive,
], pgEnv(restoredDatabase));

client = await dbClient(restoredDatabase);
try {
  for (const [name, expected] of sourceCounts) {
    const safe = name.replaceAll('"', '""');
    const result = await client.query(`SELECT count(*)::bigint AS total FROM public."${safe}"`);
    if (String(result.rows[0]?.total) !== expected) {
      throw new Error(`Populated restore row-count mismatch in ${name}.`);
    }
  }
} finally {
  await client.end();
}
process.stdout.write(`QA_RESTORE_OK: separate database populated, all ${sourceCounts.size} table counts preserved.\n`);

const prepared = await command("node", ["scripts/prepare-isolated-restore-migrator.mjs", "--prepare"], process.env);
const isolated = /^Disposable migration runtime: (.+)$/m.exec(prepared)?.[1];
if (!isolated?.startsWith("/tmp/allied-restore-migrator-")) {
  throw new Error("Isolated migration source preparation failed.");
}
const migrationEnv = {
  ...pgEnv(restoredDatabase),
  DB_HOST: target.host, DB_PORT: String(target.port), DB_NAME: restoredDatabase,
  DB_USER: target.user, DB_PASSWORD: target.password,
  DB_SSL_MODE: "verify-full", DB_SSL_CA_FILE: caFile,
  DB_BACKUP_DIRECTORY: workspace,
  DB_MIGRATION_TARGET: `${target.host}:${target.port}/${restoredDatabase}`,
  NODE_ENV: "production",
};
await command("node", ["--import", "tsx", "scripts/migrate-safely.ts"], migrationEnv, isolated);
client = await dbClient(restoredDatabase);
try {
  const result = await client.query(
    `SELECT count(*)::int AS total FROM public."_prisma_migrations"
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  );
  if (result.rows[0]?.total !== 132) throw new Error("Restored QA database did not reach 132 applied migrations.");
} finally {
  await client.end();
}
process.stdout.write(`QA_MIGRATION_REHEARSAL_OK: 59->132 applied on ${restoredDatabase}; original staging source untouched.\n`);
