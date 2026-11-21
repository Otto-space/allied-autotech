import {
  databaseTarget,
  verifyBackupReceipt,
} from "../src/config/prisma-command-safety.js";
import { createVerifiedBackup } from "./backup-database.js";
import {
  assertNonDestructiveMigration,
  checkDatabase,
  databaseSettings,
  inspectMigrationHistory,
  localMigrations,
  runPrisma,
} from "./lib/database-safety.js";

// Deliberately generic breadcrumbs for the owner-approved isolated QA restore
// rehearsal. Never include SQL, database identifiers, credentials, or rows.
const qaDiagnostics =
  process.env["QA_REHEARSAL_CONFIRM"] === "isolated-qa-staging-20261120";
function qaStage(stage: string): void {
  if (qaDiagnostics) process.stdout.write(`QA_MIGRATOR_STAGE: ${stage}\n`);
}

qaStage("startup");
const settings = databaseSettings();
const target = databaseTarget(process.env);
qaStage("configuration");
const history = await inspectMigrationHistory(settings);
qaStage("migration-history");
if (history.pending.length) {
  // Distinguish target authorization from pending-SQL review without logging
  // the target, migration names, SQL, or any database record.
  qaStage("target-authorization");
  const confirmed = process.env["DB_MIGRATION_TARGET"];
  const localDevelopment =
    (process.env["NODE_ENV"] ?? "development") === "development" &&
    ["localhost", "127.0.0.1", "::1"].includes(settings.DB_HOST);
  if (!localDevelopment && confirmed !== target) {
    qaStage("target-rejected");
    throw new Error(
      `Explicit DB_MIGRATION_TARGET=${target} is required before modifying a shared/remote database.`,
    );
  }
  qaStage("target-authorized");
  // Existing databases must never receive an unreviewed destructive/backfill change.
  // Initial replay on an empty database cannot remove pre-existing business data.
  qaStage("sql-safety-review");
  if (!history.empty)
    for (const name of history.pending) {
      try {
        assertNonDestructiveMigration(history.local.get(name)!.sql, name);
      } catch (error) {
        // Fixed, non-identifying failure tags survive even when subprocess
        // stderr is unavailable. The original error still stops the runner.
        const message = error instanceof Error ? error.message : "";
        qaStage(
          message.startsWith("Reviewed derived-field migration changed")
            ? "sql-review-checksum"
            : message.startsWith("A pending migration contains potentially destructive operations")
              ? "sql-review-destructive"
              : "sql-review-exception",
        );
        throw error;
      }
    }
  qaStage("sql-safety-gate");
  const receipt =
    process.env["DB_SAFE_MIGRATION_BACKUP"] ?? (await createVerifiedBackup());
  qaStage("backup-created");
  verifyBackupReceipt(receipt, process.env);
  qaStage("backup-verified");
  const current = localMigrations();
  if (
    current.size !== history.local.size ||
    [...history.local].some(
      ([name, migration]) => current.get(name)?.checksum !== migration.checksum,
    )
  )
    throw new Error(
      "Migration files changed during backup/review. Stop and restart verification before deployment.",
    );
  process.stdout.write(
    `Applying ${history.pending.length} reviewed migrations to ${target}. Verified backup receipt: ${receipt}\n`,
  );
  qaStage("prisma-deploy");
  await runPrisma(["migrate", "deploy"], {
    ...process.env,
    DB_SAFE_MIGRATION_BACKUP: receipt,
    DB_SAFE_MIGRATION_RUNNER: "verified-forward-migrations",
  });
  qaStage("prisma-deploy-complete");
}
qaStage("schema-verification");
await checkDatabase(settings);
qaStage("complete");
process.stdout.write(
  "Safe migration verification passed. No reset or data-removing repair was performed.\n",
);
