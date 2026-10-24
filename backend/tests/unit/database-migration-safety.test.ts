import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafePrismaCommand,
  verifyBackupReceipt,
} from "../../src/config/prisma-command-safety.js";
import {
  assertNonDestructiveMigration,
  pendingMigrations,
} from "../../scripts/lib/database-safety.js";

const environment = {
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_NAME: "fixture_test",
  NODE_ENV: "development",
};
const directories: string[] = [];
afterEach(() => {
  // Only disposable paths made by this test; no application database or real backup.
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function receipt(overrides: Record<string, unknown> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "aat-backup-safety-test-"));
  directories.push(directory);
  const bytes = Buffer.from("synthetic archive integrity fixture");
  writeFileSync(join(directory, "fixture.dump"), bytes);
  const file = join(directory, "receipt.json");
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      target: "localhost:5432/fixture_test",
      archive: "fixture.dump",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      createdAt: new Date().toISOString(),
      ...overrides,
    }),
  );
  return { file, directory };
}

describe("database migration command protection", () => {
  it.each([
    ["migrate", "reset"],
    ["migrate", "dev", "--create-only"],
    ["migrate", "resolve", "--applied", "migration"],
    ["db", "push", "--accept-data-loss"],
    ["db", "execute", "--stdin"],
  ])("blocks destructive/bypass command %j", (...args) => {
    expect(() => assertSafePrismaCommand(args, environment)).toThrow(
      "Database safety rule",
    );
  });

  it("refuses raw deployment without a backup and accepts read-only checks", () => {
    expect(() => assertSafePrismaCommand(["migrate", "deploy"], environment)).toThrow(
      "verified backup",
    );
    for (const args of [
      ["validate"],
      ["generate"],
      ["migrate", "status"],
      ["migrate", "diff", "--exit-code"],
    ])
      expect(() => assertSafePrismaCommand(args, environment)).not.toThrow();
  });

  it("allows deployment only with a fresh unchanged backup for the exact target", () => {
    const { file, directory } = receipt();
    expect(() =>
      assertSafePrismaCommand(["migrate", "deploy"], {
        ...environment,
        DB_SAFE_MIGRATION_BACKUP: file,
      }),
    ).toThrow("blocked");
    expect(() =>
      assertSafePrismaCommand(["migrate", "deploy"], {
        ...environment,
        DB_SAFE_MIGRATION_BACKUP: file,
        DB_SAFE_MIGRATION_RUNNER: "verified-forward-migrations",
      }),
    ).not.toThrow();
    expect(() =>
      verifyBackupReceipt(file, { ...environment, DB_NAME: "different_test" }),
    ).toThrow("exact database");
    writeFileSync(join(directory, "fixture.dump"), "tampered");
    expect(() => verifyBackupReceipt(file, environment)).toThrow("unchanged backup");
  });

  it.each([
    { createdAt: new Date(Date.now() - 3_600_001).toISOString() },
    { createdAt: "invalid" },
    { archive: "../fixture.dump" },
    { archive: "missing.dump" },
  ])("rejects stale, invalid or missing backup evidence: %j", (overrides) => {
    expect(() => verifyBackupReceipt(receipt(overrides).file, environment)).toThrow(
      "backup",
    );
  });

  it("limits the replay exception to explicitly confirmed isolated test databases", () => {
    const testEnvironment = {
      ...environment,
      NODE_ENV: "test",
      CONFIRM_EMPTY_MIGRATION_DATABASE: "true",
    };
    expect(() =>
      assertSafePrismaCommand(["migrate", "deploy"], testEnvironment),
    ).not.toThrow();
    expect(() =>
      assertSafePrismaCommand(["migrate", "deploy"], {
        ...testEnvironment,
        DB_NAME: "allied_autotech",
      }),
    ).toThrow("verified backup");
    expect(() => assertSafePrismaCommand(["migrate", "reset"], testEnvironment)).toThrow(
      "blocked",
    );
  });
});

describe("forward migration history and SQL review gates", () => {
  const local = new Map([
    ["first", { checksum: "original", sql: "" }],
    ["second", { checksum: "new", sql: "" }],
  ]);
  const applied = {
    migration_name: "first",
    checksum: "original",
    finished_at: new Date(),
    rolled_back_at: null,
  };
  it("identifies pending migrations without accepting changed, failed or unknown history", () => {
    expect(pendingMigrations(local, [applied])).toEqual(["second"]);
    for (const change of [
      { checksum: "edited" },
      { finished_at: null },
      { migration_name: "unknown" },
    ])
      expect(() => pendingMigrations(local, [{ ...applied, ...change }])).toThrow();
  });
  it.each([
    "DROP TABLE users;",
    "TRUNCATE users;",
    "ALTER TABLE users DROP COLUMN email;",
    "DELETE FROM users;",
    "UPDATE users SET role = 'ADMIN';",
    "DO $$ BEGIN EXECUTE 'DROP TABLE users'; END $$;",
    "ALTER TABLE users ALTER COLUMN id TYPE text;",
  ])("refuses unsafe pending SQL %s", (sql) => {
    expect(() => assertNonDestructiveMigration(sql)).toThrow("potentially destructive");
  });
  const truncateProtection =
    'CREATE TRIGGER "ProductCompatibilityHistory_no_truncate" BEFORE TRUNCATE ON "ProductCompatibilityHistory" FOR EACH STATEMENT EXECUTE FUNCTION protect_fitment_history();';
  it("allows a complete protective truncate-trigger declaration", () => {
    expect(() => assertNonDestructiveMigration(truncateProtection)).not.toThrow();
  });
  it.each([
    `${truncateProtection} TRUNCATE "ProductCompatibilityHistory";`,
    `TRUNCATE users; ${truncateProtection}`,
    `CREATE FUNCTION protect_fitment_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM users; RETURN NULL; END $$; ${truncateProtection}`,
    "CREATE TRIGGER unsafe BEFORE TRUNCATE ON users FOR EACH STATEMENT EXECUTE FUNCTION handler('TRUNCATE users');",
    'CREATE TRIGGER "unsafe; TRUNCATE users" BEFORE TRUNCATE ON users FOR EACH STATEMENT EXECUTE FUNCTION handler();',
  ])("keeps destructive operations blocked alongside trigger DDL %s", (sql) => {
    expect(() => assertNonDestructiveMigration(sql)).toThrow("potentially destructive");
  });
  it("allows additive changes and harmless commented examples", () => {
    expect(() =>
      assertNonDestructiveMigration(
        "-- Never DROP TABLE users\nALTER TABLE users ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;\nCREATE INDEX revision_idx ON users(revision);",
      ),
    ).not.toThrow();
  });
});
