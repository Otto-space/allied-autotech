import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { env } from "../../src/config/env.js";
import { createNodePostgresSslConfiguration } from "../../src/config/database-tls.js";

export const databaseTimezones = ["UTC", "Africa/Lagos", "America/New_York"] as const;

export function timezoneDatabase(timezone: (typeof databaseTimezones)[number]) {
  return new PrismaClient({
    adapter: new PrismaPg({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: createNodePostgresSslConfiguration(env),
      max: 1,
      options: `-c timezone=${timezone}`,
    }),
  });
}
