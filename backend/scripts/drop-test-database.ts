import { config } from "dotenv";
import pg from "pg";
import { z } from "zod";

import {
  createNodePostgresSslConfiguration,
  parseDatabaseTlsEnvironment,
} from "../src/config/database-tls.js";

config({ quiet: true });

const settings = z
  .object({
    NODE_ENV: z.literal("test"),
    CONFIRM_DROP_TEST_DATABASE: z.literal("true"),
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65_535),
    DB_NAME: z.string().regex(/^[A-Za-z0-9_]+_(?:test|ci)$/),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
  })
  .parse(process.env);

const administrativeDatabase = new pg.Client({
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  database: "postgres",
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
});

await administrativeDatabase.connect();
try {
  await administrativeDatabase.query(
    `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [settings.DB_NAME],
  );
  await administrativeDatabase.query(
    `DROP DATABASE IF EXISTS ${pg.escapeIdentifier(settings.DB_NAME)}`,
  );
  process.stdout.write(`Dropped isolated test database ${settings.DB_NAME}.\n`);
} finally {
  await administrativeDatabase.end();
}
