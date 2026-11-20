/**
 * Build a disposable *staging-only* migration runtime from a checkout.
 *
 * Never rewrite the committed SQL migrations. The existing staging database
 * records historical line endings different from the current checkout; this
 * creates a separate tree whose first 59 migration bytes match that journal.
 * It does not connect to PostgreSQL, take a backup, or execute any migration.
 * Only use the result with the existing guarded db:migrate workflow, following
 * an independently verified fresh backup and populated restore rehearsal.
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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectedJournalFingerprint,
  names,
  reconstruct,
} from "./verify-restore-migration-history.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--prepare") {
  throw new Error("Usage: node scripts/prepare-isolated-restore-migrator.mjs --prepare");
}

const backend = fileURLToPath(new URL("../", import.meta.url));
const isolated = mkdtempSync(join(tmpdir(), "allied-restore-migrator-"));
const sourcePrisma = join(backend, "prisma");
const isolatedPrisma = join(isolated, "prisma");

const runtimeFiles = [
  "package.json",
  "prisma.config.ts",
  "scripts/backup-database.ts",
  "scripts/check-database-safety.ts",
  "scripts/migrate-safely.ts",
  "scripts/lib/database-safety.ts",
  "src/config/database-tls.ts",
  "src/config/database-url.ts",
  "src/config/prisma-command-safety.ts",
];

cpSync(sourcePrisma, isolatedPrisma, { recursive: true });
for (const file of runtimeFiles) {
  const output = join(isolated, file);
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(join(backend, file), output);
}

const installedDependencies = join(backend, "node_modules");
if (existsSync(installedDependencies)) {
  // Reuse dependencies already present in a migration image; no install needed.
  symlinkSync(installedDependencies, join(isolated, "node_modules"), "dir");
}

for (const name of names) {
  writeFileSync(
    join(isolatedPrisma, "migrations", name, "migration.sql"),
    reconstruct(name),
  );
}

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const history = names.map(
  (name) =>
    `${name}:${hash(readFileSync(join(isolatedPrisma, "migrations", name, "migration.sql")))}`,
);
const fingerprint = createHash("md5").update(history.join("\n")).digest("hex");
if (fingerprint !== expectedJournalFingerprint) {
  throw new Error("The disposable package does not match the 59 applied staging migrations");
}

const allNames = readdirSync(join(sourcePrisma, "migrations"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (
  allNames.length !== 132 ||
  allNames.slice(0, names.length).join("\n") !== names.join("\n")
) {
  throw new Error("Unexpected migration set; review the source before using this staging package");
}
for (const name of allNames.slice(names.length)) {
  const path = join("migrations", name, "migration.sql");
  if (
    hash(readFileSync(join(sourcePrisma, path))) !==
    hash(readFileSync(join(isolatedPrisma, path)))
  ) {
    throw new Error(`Pending migration changed while creating the staging package: ${name}`);
  }
}

process.stdout.write(
  `Disposable migration runtime: ${isolated}\n` +
    `Applied history: ${names.length}/59 matched; pending SQL: ${allNames.length - names.length} unmodified.\n` +
    `Database/backup operations: NONE. Repository migration files: UNCHANGED.\n` +
    (existsSync(installedDependencies)
      ? "Dependencies available through a link to the original runtime.\n"
      : "Dependencies not installed here; run this inside the separately built migration image.\n"),
);
