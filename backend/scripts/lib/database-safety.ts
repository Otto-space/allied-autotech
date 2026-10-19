import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import { z } from "zod";
import {
  createNodePostgresSslConfiguration,
  parseDatabaseTlsEnvironment,
} from "../../src/config/database-tls.js";

export const backendDirectory = fileURLToPath(new URL("../../", import.meta.url));
export const migrationsDirectory = fileURLToPath(
  new URL("../../prisma/migrations/", import.meta.url),
);
const cli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url),
);

export function databaseSettings() {
  config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });
  return z
    .object({
      DB_HOST: z.string().min(1),
      DB_PORT: z.coerce.number().int().min(1).max(65535),
      DB_NAME: z.string().min(1),
      DB_USER: z.string().min(1),
      DB_PASSWORD: z.string().min(1),
    })
    .parse(process.env);
}

type Settings = ReturnType<typeof databaseSettings>;
interface AppliedMigration {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

export function localMigrations(
  directory = migrationsDirectory,
): Map<string, { sql: string; checksum: string }> {
  return new Map(
    readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const bytes = readFileSync(`${directory}/${entry.name}/migration.sql`);
        return [
          entry.name,
          {
            sql: bytes.toString("utf8"),
            checksum: createHash("sha256").update(bytes).digest("hex"),
          },
        ];
      }),
  );
}

export function pendingMigrations(
  local: ReturnType<typeof localMigrations>,
  applied: readonly AppliedMigration[],
): string[] {
  const completed = new Set<string>();
  for (const row of applied) {
    if (row.rolled_back_at !== null) continue;
    if (row.finished_at === null)
      throw new Error(
        "An unresolved failed migration exists. Preserve its state and diagnose it; do not reset or auto-resolve.",
      );
    if (local.get(row.migration_name)?.checksum !== row.checksum)
      throw new Error(
        "Applied migration history differs from this checkout. Do not edit applied migrations or deploy the wrong release.",
      );
    completed.add(row.migration_name);
  }
  return [...local.keys()].filter((name) => !completed.has(name));
}

/** Conservative gate; it is not a substitute for reviewing migration SQL. */
export function assertNonDestructiveMigration(sql: string): void {
  const text = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\r\n]*/g, " ");
  if (
    /\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|TYPE)|DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?\w+\s+CASCADE|TRUNCATE\b|DELETE\s+FROM|ALTER\s+COLUMN\b|DROP\s+COLUMN\b|DO\s+\$|EXECUTE\s+(?:FORMAT\b|['"]))/i.test(
      text,
    ) ||
    /(?:^|;)\s*UPDATE\s+/i.test(text)
  )
    throw new Error(
      "A pending migration contains potentially destructive operations. Stop for a separate reviewed data-preservation plan; the safe migrator will not execute it.",
    );
}

export async function inspectMigrationHistory(settings: Settings) {
  const local = localMigrations();
  const client = new pg.Client({
    host: settings.DB_HOST,
    port: settings.DB_PORT,
    database: settings.DB_NAME,
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    options: "-c timezone=UTC",
  });
  await client.connect();
  try {
    const tables = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    const empty = tables.rows[0]?.count === 0;
    const applied = empty
      ? []
      : (
          await client.query<AppliedMigration>(
            'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at',
          )
        ).rows;
    return { local, pending: pendingMigrations(local, applied), empty };
  } finally {
    await client.end();
  }
}

export async function runPrisma(
  args: string[],
  environment = process.env,
): Promise<void> {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: backendDirectory,
    env: environment,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", () =>
      reject(new Error("Unable to run the installed Prisma CLI.")),
    );
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Database verification failed. Stop and review migration status/schema drift; no automatic repair was attempted.",
            ),
          ),
    );
  });
}

export async function checkDatabase(settings = databaseSettings()): Promise<void> {
  const history = await inspectMigrationHistory(settings);
  if (history.pending.length)
    throw new Error(
      `${history.pending.length} pending migrations. Run npm run db:migrate before starting the updated backend.`,
    );
  await runPrisma(["validate"]);
  await runPrisma(["migrate", "status"]);
  await runPrisma([
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ]);
}
