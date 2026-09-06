import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import { createNodePostgresSslConfiguration } from "./database-tls.js";
import { env } from "./env.js";

const adapter = new PrismaPg({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: createNodePostgresSslConfiguration(env),
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  idle_in_transaction_session_timeout: env.DB_IDLE_TRANSACTION_TIMEOUT_MS,
  application_name: env.SERVICE_NAME,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
