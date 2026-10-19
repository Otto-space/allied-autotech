import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  databaseTarget,
  hashBackup,
  verifyBackupReceipt,
  type BackupReceipt,
} from "../src/config/prisma-command-safety.js";
import { parseDatabaseTlsEnvironment } from "../src/config/database-tls.js";
import { backendDirectory, databaseSettings } from "./lib/database-safety.js";

function postgresTool(name: "pg_dump" | "pg_restore"): string {
  const override = process.env[name === "pg_dump" ? "PG_DUMP_PATH" : "PG_RESTORE_PATH"];
  if (override) {
    if (!isAbsolute(override))
      throw new Error("PostgreSQL tool overrides must be absolute executable paths.");
    return override;
  }
  if (process.platform === "win32") {
    const root = join(process.env["ProgramFiles"] ?? "C:/Program Files", "PostgreSQL");
    if (existsSync(root)) {
      const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
      for (const version of versions) {
        const executable = join(root, version, "bin", `${name}.exe`);
        if (existsSync(executable)) return executable;
      }
    }
  }
  return name;
}

async function capture(
  program: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const child = spawn(program, args, {
    env: environment,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const timeout = setTimeout(() => child.kill(), 10 * 60_000);
  // Never echo tool stderr: it may contain connection or archive details.
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
    if (output.length > 8 * 1024 * 1024) child.kill();
  });
  child.stderr.resume();
  try {
    await new Promise<void>((resolveDone, reject) => {
      child.once("error", () =>
        reject(
          new Error(
            `${basename(program)} could not start. Install compatible PostgreSQL client tools; no migration was applied.`,
          ),
        ),
      );
      child.once("exit", (code) =>
        code === 0
          ? resolveDone()
          : reject(
              new Error(
                `${basename(program)} failed. Backup is unverified; no migration was applied.`,
              ),
            ),
      );
    });
    return output;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createVerifiedBackup(): Promise<string> {
  const settings = databaseSettings();
  const tls = parseDatabaseTlsEnvironment(process.env);
  const configured = process.env["DB_BACKUP_DIRECTORY"];
  if (process.env["NODE_ENV"] === "production" && !configured)
    throw new Error(
      "Production requires an explicit durable DB_BACKUP_DIRECTORY or a verified backup receipt prepared before deployment.",
    );
  if (configured && !isAbsolute(configured))
    throw new Error("DB_BACKUP_DIRECTORY must be absolute and outside the repository.");
  const directory = configured ?? join(homedir(), ".codex", "backups", "allied-autotech");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const relation = relative(
    realpathSync(resolve(backendDirectory, "..")),
    realpathSync(directory),
  );
  if (
    (!relation.startsWith("..") && !isAbsolute(relation)) ||
    lstatSync(directory).isSymbolicLink()
  )
    throw new Error(
      "Backups must be stored outside the backend repository in a private, non-symlink directory.",
    );
  const archiveName = `before-migration-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.dump`;
  const archive = join(directory, archiveName);
  const environment = {
    ...process.env,
    PGHOST: settings.DB_HOST,
    PGPORT: String(settings.DB_PORT),
    PGDATABASE: settings.DB_NAME,
    PGUSER: settings.DB_USER,
    PGPASSWORD: settings.DB_PASSWORD,
    PGCONNECT_TIMEOUT: "10",
    PGSSLMODE: tls.mode,
    ...(tls.caFile ? { PGSSLROOTCERT: tls.caFile } : {}),
  };
  // This reads a consistent PostgreSQL snapshot; it never resets or restores data.
  await capture(
    postgresTool("pg_dump"),
    ["--no-password", "--format=custom", "--file", archive],
    environment,
  );
  const listing = await capture(
    postgresTool("pg_restore"),
    ["--list", archive],
    environment,
  );
  chmodSync(archive, 0o600);
  if (
    !listing
      .split(/\r?\n/)
      .some((line) => line.trim() === `;     dbname: ${settings.DB_NAME}`.trim())
  )
    throw new Error(
      "Backup archive target could not be verified. No migration was applied.",
    );
  const receipt: BackupReceipt = {
    version: 1,
    target: databaseTarget(process.env),
    archive: archiveName,
    sha256: hashBackup(archive),
    createdAt: new Date().toISOString(),
  };
  const receiptPath = `${archive}.receipt.json`;
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  verifyBackupReceipt(receiptPath, process.env);
  return receiptPath;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const receipt = await createVerifiedBackup();
  process.stdout.write(`Verified database backup receipt: ${receipt}\n`);
}
