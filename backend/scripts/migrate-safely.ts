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

const settings = databaseSettings();
const target = databaseTarget(process.env);
const history = await inspectMigrationHistory(settings);
if (history.pending.length) {
  const confirmed = process.env["DB_MIGRATION_TARGET"];
  const localDevelopment =
    (process.env["NODE_ENV"] ?? "development") === "development" &&
    ["localhost", "127.0.0.1", "::1"].includes(settings.DB_HOST);
  if (!localDevelopment && confirmed !== target)
    throw new Error(
      `Explicit DB_MIGRATION_TARGET=${target} is required before modifying a shared/remote database.`,
    );
  // Existing databases must never receive an unreviewed destructive/backfill change.
  // Initial replay on an empty database cannot remove pre-existing business data.
  if (!history.empty)
    for (const name of history.pending)
      assertNonDestructiveMigration(history.local.get(name)!.sql, name);
  const receipt =
    process.env["DB_SAFE_MIGRATION_BACKUP"] ?? (await createVerifiedBackup());
  verifyBackupReceipt(receipt, process.env);
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
  await runPrisma(["migrate", "deploy"], {
    ...process.env,
    DB_SAFE_MIGRATION_BACKUP: receipt,
    DB_SAFE_MIGRATION_RUNNER: "verified-forward-migrations",
  });
}
await checkDatabase(settings);
process.stdout.write(
  "Safe migration verification passed. No reset or data-removing repair was performed.\n",
);
