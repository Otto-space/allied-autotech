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
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().min(1).max(65_535),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
  })
  .parse(process.env);
const tls = parseDatabaseTlsEnvironment(process.env);
if (tls.mode !== "verify-full") {
  throw new Error("Database TLS verification requires DB_SSL_MODE=verify-full");
}

const client = new pg.Client({
  host: settings.DB_HOST,
  port: settings.DB_PORT,
  database: settings.DB_NAME,
  user: settings.DB_USER,
  password: settings.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(tls),
  connectionTimeoutMillis: 10_000,
  application_name: "allied-autotech-tls-verification",
});

await client.connect();
try {
  const result = await client.query<{
    ssl: boolean;
    version: string | null;
    cipher: string | null;
  }>(
    `SELECT ssl, version, cipher
       FROM pg_stat_ssl
      WHERE pid = pg_backend_pid()`,
  );
  const connection = result.rows[0];
  if (connection?.ssl !== true) {
    throw new Error("The PostgreSQL connection is not using TLS");
  }
  process.stdout.write(
    `Database TLS verification passed (${connection.version ?? "unknown protocol"}, ${connection.cipher ?? "unknown cipher"}).\n`,
  );
} finally {
  await client.end();
}
