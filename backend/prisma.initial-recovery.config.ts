import "dotenv/config";
import { defineConfig } from "prisma/config";
import { assertInitialRecoveryHandoff } from "./src/config/initial-migration-recovery.js";
import { parseDatabaseTlsEnvironment } from "./src/config/database-tls.js";
import { createPrismaDatabaseUrl } from "./src/config/database-url.js";

assertInitialRecoveryHandoff(process.argv.slice(2), process.env);
const port = Number(process.env["DB_PORT"]);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid database port.");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: createPrismaDatabaseUrl(
      {
        host: process.env["DB_HOST"]!,
        port,
        database: process.env["DB_NAME"]!,
        user: process.env["DB_USER"]!,
        password: process.env["DB_PASSWORD"]!,
      },
      parseDatabaseTlsEnvironment(process.env),
    ),
  },
});
