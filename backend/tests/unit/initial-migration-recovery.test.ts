import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import {
  assertInitialRecoveryHandoff,
  initialChecksum,
  initialMigration,
  recoveryApproval,
} from "../../src/config/initial-migration-recovery.js";
import { assertSafePrismaCommand } from "../../src/config/prisma-command-safety.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "aat-initial-recovery-"));
  directories.push(directory);
  const target = "127.0.0.1:5432/initial_recovery_abcdef_ci";
  const bytes = Buffer.from("synthetic backup bytes");
  writeFileSync(join(directory, "fixture.dump"), bytes);
  const backup = join(directory, "backup.json");
  writeFileSync(
    backup,
    JSON.stringify({
      version: 1,
      target,
      archive: "fixture.dump",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      createdAt: new Date().toISOString(),
    }),
  );
  const receipt = {
    version: 1,
    target,
    migration: initialMigration,
    checksum: initialChecksum(),
    observedAt: new Date().toISOString(),
    emptyBusinessSchema: true,
    failureWasFirstCitextStatement: true,
    migrationCreateFixed: true,
    backupReceipt: backup,
  };
  const file = join(directory, "recovery.json");
  writeFileSync(file, JSON.stringify(receipt));
  const environment = {
    NODE_ENV: "test",
    DEPLOYMENT_ENV: "local",
    DB_HOST: "127.0.0.1",
    DB_PORT: "5432",
    DB_NAME: "initial_recovery_abcdef_ci",
    CONFIRM_INITIAL_MIGRATION_RECOVERY_TARGET: target,
    DB_RECOVERY_APPROVAL_REFERENCE: recoveryApproval,
    DB_INITIAL_RECOVERY_RECEIPT: file,
  };
  const args = [
    "migrate",
    "resolve",
    "--rolled-back",
    initialMigration,
    "--config",
    fileURLToPath(new URL("../../prisma.initial-recovery.config.ts", import.meta.url)),
  ];
  return { file, directory, receipt, environment, args };
}
it("permits only the approved recovery handoff while the normal guard still rejects resolve", () => {
  const f = fixture();
  expect(() => assertInitialRecoveryHandoff(f.args, f.environment)).not.toThrow();
  expect(() => assertSafePrismaCommand(f.args, f.environment)).toThrow("blocked");
});
it.each([
  { checksum: "0".repeat(64) },
  { emptyBusinessSchema: false },
  { migrationCreateFixed: false },
  { failureWasFirstCitextStatement: false },
  { target: "127.0.0.1:5432/application" },
  { observedAt: new Date(0).toISOString() },
  { migration: "another_migration" },
])("rejects a receipt that does not prove the exact recovery: %j", (change) => {
  const f = fixture();
  writeFileSync(f.file, JSON.stringify({ ...f.receipt, ...change }));
  expect(() => assertInitialRecoveryHandoff(f.args, f.environment)).toThrow();
});
it("rejects unrelated commands, another target, missing approval and damaged backups", () => {
  const f = fixture();
  for (const args of [
    ["migrate", "reset"],
    f.args.map((a) => (a === "--rolled-back" ? "--applied" : a)),
    [...f.args, "--schema", "elsewhere.prisma"],
  ])
    expect(() => assertInitialRecoveryHandoff(args, f.environment)).toThrow();
  expect(() =>
    assertInitialRecoveryHandoff(f.args, {
      ...f.environment,
      DB_NAME: "allied_autotech_staging",
    }),
  ).toThrow();
  expect(() =>
    assertInitialRecoveryHandoff(f.args, {
      ...f.environment,
      DB_RECOVERY_APPROVAL_REFERENCE: "",
    }),
  ).toThrow();
  writeFileSync(join(f.directory, "fixture.dump"), "changed");
  expect(() => assertInitialRecoveryHandoff(f.args, f.environment)).toThrow("backup");
});
