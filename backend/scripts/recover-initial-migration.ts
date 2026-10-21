import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseTarget } from "../src/config/prisma-command-safety.js";
import {
  assertInitialRecoveryTarget,
  initialMigration,
  initialChecksum,
} from "../src/config/initial-migration-recovery.js";
import {
  createNodePostgresSslConfiguration,
  parseDatabaseTlsEnvironment,
} from "../src/config/database-tls.js";
import { createVerifiedBackup } from "./backup-database.js";
import { databaseSettings, runPrisma } from "./lib/database-safety.js";

const settings = databaseSettings();
assertInitialRecoveryTarget(process.env);
const client = new pg.Client({
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  database: settings.DB_NAME,
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
  connectionTimeoutMillis: 15000,
});
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock(20261021, 1)");
  async function inspect() {
    const rows = (
      await client.query<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
        applied_steps_count: number;
        logs: string;
      }>(
        "SELECT migration_name, checksum, finished_at, rolled_back_at, applied_steps_count, logs FROM public._prisma_migrations",
      )
    ).rows;
    const row = rows[0];
    const state = (
      await client.query<{
        database: string;
        user: string;
        business_tables: number;
        enums: number;
        routines: number;
        citext: number;
        can_create: boolean;
      }>(`SELECT current_database() AS database, current_user AS user,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations') AS business_tables,
      (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS enums,
      (SELECT count(*)::int FROM information_schema.routines WHERE routine_schema='public') AS routines,
      (SELECT count(*)::int FROM pg_extension WHERE extname='citext') AS citext,
      has_database_privilege(current_user,current_database(),'CREATE') AS can_create`)
    ).rows[0];
    if (
      rows.length !== 1 ||
      !row ||
      row.migration_name !== initialMigration ||
      row.checksum !== initialChecksum() ||
      row.finished_at !== null ||
      row.rolled_back_at !== null ||
      row.applied_steps_count !== 0 ||
      !/permission denied to create extension "citext"/.test(row.logs) ||
      !state ||
      state.database !== settings.DB_NAME ||
      state.user !== settings.DB_USER ||
      state.business_tables !== 0 ||
      state.enums !== 0 ||
      state.routines !== 0 ||
      state.citext !== 0 ||
      !state.can_create
    ) {
      throw new Error(
        "Recovery inspection differs from the approved first-statement failure; no history changed.",
      );
    }
  }
  await inspect();
  const backupReceipt = await createVerifiedBackup();
  await inspect();
  const receipt = join(dirname(backupReceipt), `initial-recovery-${randomUUID()}.json`);
  writeFileSync(
    receipt,
    JSON.stringify({
      version: 1,
      target: databaseTarget(process.env),
      migration: initialMigration,
      checksum: initialChecksum(),
      observedAt: new Date().toISOString(),
      emptyBusinessSchema: true,
      failureWasFirstCitextStatement: true,
      migrationCreateFixed: true,
      backupReceipt,
    }),
    { flag: "wx", mode: 0o600 },
  );
  await runPrisma(
    [
      "migrate",
      "resolve",
      "--rolled-back",
      initialMigration,
      "--config",
      fileURLToPath(new URL("../prisma.initial-recovery.config.ts", import.meta.url)),
    ],
    { ...process.env, DB_INITIAL_RECOVERY_RECEIPT: receipt },
  );
  const after = (
    await client.query<{ rolled_back: boolean }>(
      "SELECT rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations",
    )
  ).rows;
  if (after.length !== 1 || after[0]?.rolled_back !== true)
    throw new Error("Recovery history verification failed; stop.");
  process.stdout.write(
    "Approved initial-failure rollback record verified. No business data changed. Run npm run db:migrate separately.\n",
  );
} finally {
  await client.query("SELECT pg_advisory_unlock(20261021, 1)").catch(() => {});
  await client.end();
}
