import "dotenv/config";
import { defineConfig, env } from "prisma/config";

import { parseDatabaseTlsEnvironment } from "./src/config/database-tls.js";
import { createPrismaDatabaseUrl } from "./src/config/database-url.js";

const databaseHostValue = env("DB_HOST");
const databasePort = env("DB_PORT");
const databaseName = env("DB_NAME");
const databaseUser = env("DB_USER");
const databasePassword = env("DB_PASSWORD");

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
