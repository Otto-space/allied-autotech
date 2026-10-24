import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

/** Verify the actual dedicated local target before creating synthetic fixtures. */
export async function assertIsolatedLoopbackDatabase() {
  if (
    env.NODE_ENV !== "test" ||
    process.env.RUN_DATABASE_TESTS !== "true" ||
    !["127.0.0.1", "localhost"].includes(env.DB_HOST) ||
    !/_(?:test|ci)$/.test(env.DB_NAME) ||
    process.env.TEST_DB_NAME !== env.DB_NAME ||
    process.env.CONFIRM_EMPTY_MIGRATION_DATABASE !== "true"
  )
    throw new Error(
      "Configure an explicitly confirmed isolated local _test/_ci target first.",
    );
  const [target] = await prisma.$queryRaw<
    { host: string; port: number; database: string }[]
  >`SELECT host(inet_server_addr()) AS host, inet_server_port() AS port, current_database() AS database`;
  if (
    !target ||
    !["127.0.0.1", "::1"].includes(target.host) ||
    target.port !== env.DB_PORT ||
    target.database !== env.DB_NAME
  )
    throw new Error(
      "Actual database target differs from the isolated test configuration.",
    );
}
