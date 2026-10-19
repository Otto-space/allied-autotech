import { createHash } from "node:crypto";
import { closeSync, lstatSync, openSync, readFileSync, readSync } from "node:fs";
import { basename, dirname, isAbsolute, join } from "node:path";

export interface BackupReceipt {
  version: 1;
  target: string;
  archive: string;
  sha256: string;
  createdAt: string;
}

export function databaseTarget(environment: NodeJS.ProcessEnv): string {
  return `${environment["DB_HOST"]}:${environment["DB_PORT"]}/${environment["DB_NAME"]}`;
}

export function hashBackup(file: string): string {
  const descriptor = openSync(file, "r");
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let count: number;
    while ((count = readSync(descriptor, buffer, 0, buffer.length, null)) > 0)
      hash.update(buffer.subarray(0, count));
    return hash.digest("hex");
  } finally {
    closeSync(descriptor);
  }
}

/** Verify a portable backup receipt without exposing archive contents or credentials. */
export function verifyBackupReceipt(file: string, environment: NodeJS.ProcessEnv): void {
  try {
    if (
      !isAbsolute(file) ||
      !lstatSync(file).isFile() ||
      lstatSync(file).isSymbolicLink()
    )
      throw new Error();
    const receipt = JSON.parse(readFileSync(file, "utf8")) as BackupReceipt;
    const age = Date.now() - Date.parse(receipt.createdAt);
    if (
      receipt.version !== 1 ||
      receipt.target !== databaseTarget(environment) ||
      typeof receipt.archive !== "string" ||
      basename(receipt.archive) !== receipt.archive ||
      !receipt.archive.endsWith(".dump") ||
      !/^[a-f0-9]{64}$/.test(receipt.sha256) ||
      !Number.isFinite(age) ||
      age < -60_000 ||
      age > 60 * 60_000
    )
      throw new Error();
    const archive = join(dirname(file), receipt.archive);
    const stat = lstatSync(archive);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error();
    if (hashBackup(archive) !== receipt.sha256) throw new Error();
  } catch {
    throw new Error(
      "A fresh, unchanged backup for the exact database target is required. Run npm run db:backup, or supply its verified receipt with DB_SAFE_MIGRATION_BACKUP.",
    );
  }
}

export function assertSafePrismaCommand(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): void {
  if (
    (args.includes("migrate") &&
      args.some((arg) => ["reset", "dev", "resolve"].includes(arg))) ||
    (args.includes("db") && args.some((arg) => ["push", "execute"].includes(arg)))
  )
    throw new Error(
      "Database safety rule: reset, migrate dev/resolve, db push and db execute are blocked. Use reviewed forward migrations via npm run db:migrate. Generate migrations only in a separate disposable development project/database.",
    );
  if (!args.includes("migrate") || !args.includes("deploy")) return;
  // The existing replay tool separately proves that this isolated database is empty.
  if (
    environment["NODE_ENV"] === "test" &&
    environment["CONFIRM_EMPTY_MIGRATION_DATABASE"] === "true" &&
    /_(?:test|ci)$/.test(environment["DB_NAME"] ?? "")
  )
    return;
  const receipt = environment["DB_SAFE_MIGRATION_BACKUP"];
  if (
    !receipt ||
    environment["DB_SAFE_MIGRATION_RUNNER"] !== "verified-forward-migrations"
  )
    throw new Error(
      "Direct migration deployment is blocked without a verified backup. Use npm run db:migrate.",
    );
  verifyBackupReceipt(receipt, environment);
}
