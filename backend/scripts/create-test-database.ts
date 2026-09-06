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
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65_535),
    DB_NAME: z.string().regex(/^[A-Za-z0-9_]+_(?:test|ci)$/),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
  })
  .parse(process.env);

const client = new pg.Client({
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  database: "postgres",
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
});

await client.connect();
try {
  const existing = await client.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [settings.DB_NAME],
  );
  if (existing.rows[0]?.exists !== true) {
    await client.query(`CREATE DATABASE "${settings.DB_NAME}"`);
    process.stdout.write(`Created isolated test database ${settings.DB_NAME}.\n`);
  } else {
    process.stdout.write(`Isolated test database ${settings.DB_NAME} already exists.\n`);
  }
} finally {
  await client.end();
}
