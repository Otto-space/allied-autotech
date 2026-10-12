import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import pg from "pg";
import { z } from "zod";

import {
  createNodePostgresSslConfiguration,
  parseDatabaseTlsEnvironment,
} from "../src/config/database-tls.js";

config({ quiet: true });

const replayEnvironmentSchema = z.object({
  NODE_ENV: z.literal("test"),
  CONFIRM_EMPTY_MIGRATION_DATABASE: z.literal("true"),
  DB_NAME: z
    .string()
    .regex(
      /(?:_test|_ci)$/,
      "DB_NAME must end with _test or _ci before migration replay",
    ),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65_535),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
});

const settings = replayEnvironmentSchema.parse(process.env);
const database = new pg.Client({
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  database: settings.DB_NAME,
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
});
await database.connect();
try {
  const result = await database.query<{ count: string }>(`
    SELECT COUNT(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  if (result.rows[0]?.count !== "0") {
    throw new Error(
      "Migration replay requires a newly created empty _test or _ci database",
    );
  }
} finally {
  await database.end();
}

const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
async function runPrisma(args: string[], label: string): Promise<void> {
  const child = spawn(process.execPath, [prismaCli, ...args], {
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${label} terminated by ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${label} failed with exit code ${String(code)}`));
        return;
      }
      resolve();
    });
  });
}

await runPrisma(["migrate", "deploy"], "Migration replay");
// A successful replay alone does not prove that schema.prisma preserves all
// representable migrated objects when a future migration is generated.
await runPrisma(
  [
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)),
    "--exit-code",
  ],
  "Migration schema comparison",
);
