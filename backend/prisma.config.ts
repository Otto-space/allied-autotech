import "dotenv/config";
import { defineConfig, env } from "prisma/config";

import { parseDatabaseTlsEnvironment } from "./src/config/database-tls.js";
import { createPrismaDatabaseUrl } from "./src/config/database-url.js";
import { assertSafePrismaCommand } from "./src/config/prisma-command-safety.js";
import { localOwnerMode, verifyLocalIdentity } from "./scripts/lib/local-owner-safety.js";
import { createNodePostgresSslConfiguration } from "./src/config/database-tls.js";

assertSafePrismaCommand(process.argv.slice(2), process.env);

const databaseHostValue = env("DB_HOST");
const databasePort = env("DB_PORT");
const databaseName = env("DB_NAME");
const databaseUser = env("DB_USER");
const databasePassword = env("DB_PASSWORD");

if (localOwnerMode(process.env)) {
  const { default: pg } = await import("pg");
  const settings = {
    DB_HOST: databaseHostValue, DB_PORT: Number(databasePort),
    DB_NAME: databaseName, DB_USER: databaseUser,
  };
  const probe = new pg.Client({
    host: settings.DB_HOST, port: settings.DB_PORT, database: settings.DB_NAME,
    user: settings.DB_USER, password: databasePassword,
    ssl: createNodePostgresSslConfiguration(parseDatabaseTlsEnvironment(process.env)),
    connectionTimeoutMillis: 5000, statement_timeout: 10000,
  });
  try {
    await probe.connect();
    await verifyLocalIdentity(probe, settings, process.env);
  } finally { await probe.end(); }
}

if (
  !/^\d+$/.test(databasePort) ||
  Number(databasePort) < 1 ||
  Number(databasePort) > 65_535
) {
  throw new Error("DB_PORT must be an integer between 1 and 65535.");
}

const databaseUrl = createPrismaDatabaseUrl(
  {
    host: databaseHostValue,
    port: Number(databasePort),
    database: databaseName,
    user: databaseUser,
    password: databasePassword,
  },
  parseDatabaseTlsEnvironment(process.env),
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
