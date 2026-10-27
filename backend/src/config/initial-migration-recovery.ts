import { readFileSync, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { databaseTarget, verifyBackupReceipt } from "./prisma-command-safety.js";

export const initialMigration = "20260831203155_init";
export const recoveryApproval = "user-approval-20261021-initial-citext";
export const initialMigrationPath = fileURLToPath(
  new URL(`../../prisma/migrations/${initialMigration}/migration.sql`, import.meta.url),
);
export function initialChecksum() {
  return createHash("sha256").update(readFileSync(initialMigrationPath)).digest("hex");
}

export function assertInitialRecoveryTarget(environment: NodeJS.ProcessEnv) {
  const target = databaseTarget(environment);
  const production =
    environment["NODE_ENV"] === "production" &&
    environment["DEPLOYMENT_ENV"] === "production" &&
    target ===
      "allied-autotech-staging-db-do-user-44970995-0.k.db.ondigitalocean.com:25060/allied_autotech_production" &&
    environment["DB_USER"] === "allied_production_migrator";
  const isolated =
    environment["NODE_ENV"] === "test" &&
    environment["DEPLOYMENT_ENV"] === "local" &&
    environment["DB_HOST"] === "127.0.0.1" &&
    /^initial_recovery_[a-f0-9]+_ci$/.test(environment["DB_NAME"] ?? "");
  if (
    (!production && !isolated) ||
    environment["CONFIRM_INITIAL_MIGRATION_RECOVERY_TARGET"] !== target ||
    environment["DB_RECOVERY_APPROVAL_REFERENCE"] !== recoveryApproval
  )
    throw new Error("Initial migration recovery target/approval is not authorized.");
}

/** Used only by the dedicated config, never by normal Prisma operations. */
export function assertInitialRecoveryHandoff(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
) {
  assertInitialRecoveryTarget(environment);
  const config = fileURLToPath(
    new URL("../../prisma.initial-recovery.config.ts", import.meta.url),
  );
  const remaining = [...args];
  const index = remaining.indexOf("--config");
  if (
    index < 0 ||
    !remaining[index + 1] ||
    resolve(remaining[index + 1]!) !== resolve(config)
  )
    throw new Error("Use only the reviewed initial recovery config.");
  remaining.splice(index, 2);
  if (
    JSON.stringify(remaining) !==
    JSON.stringify(["migrate", "resolve", "--rolled-back", initialMigration])
  )
    throw new Error(
      "Only the approved initial failed migration rollback record is allowed.",
    );
  const file = environment["DB_INITIAL_RECOVERY_RECEIPT"];
  if (
    !file ||
    !isAbsolute(file) ||
    !lstatSync(file).isFile() ||
    lstatSync(file).isSymbolicLink() ||
    realpathSync(file) !== resolve(file)
  )
    throw new Error("A protected recovery inspection receipt is required.");
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  const age = Date.now() - Date.parse(receipt.observedAt);
  if (
    receipt.version !== 1 ||
    receipt.target !== databaseTarget(environment) ||
    receipt.migration !== initialMigration ||
    receipt.checksum !== initialChecksum() ||
    receipt.emptyBusinessSchema !== true ||
    receipt.failureWasFirstCitextStatement !== true ||
    receipt.migrationCreateFixed !== true ||
    !Number.isFinite(age) ||
    age < -60_000 ||
    age > 60_000 ||
    typeof receipt.backupReceipt !== "string"
  )
    throw new Error("Recovery receipt is stale or does not prove the approved failure.");
  verifyBackupReceipt(receipt.backupReceipt, environment);
}
