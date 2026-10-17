import pg from "pg";
import { env } from "../../src/config/env.js";
import { createNodePostgresSslConfiguration } from "../../src/config/database-tls.js";

/** Maintain only the synthetic service index, without granting runtime DDL/ownership. */
export async function maintainTestServiceSearch() {
  if (
    env.NODE_ENV !== "test" ||
    process.env.RUN_DATABASE_TESTS !== "true" ||
    !/_(?:test|ci)$/.test(env.DB_NAME)
  )
    throw new Error("Service index maintenance requires an isolated test database");
  const user = process.env.TEST_MAINTENANCE_DB_USER;
  const password = process.env.TEST_MAINTENANCE_DB_PASSWORD;
  if (!!user !== !!password)
    throw new Error("Both test maintenance credentials must be supplied together");
  const client = new pg.Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: user ?? env.DB_USER,
    password: password ?? env.DB_PASSWORD,
    ssl: createNodePostgresSslConfiguration(env),
  });
  let skipped = false;
  client.on("notice", (notice) => {
    if (notice.code === "42501" || /skipping.*Service/i.test(notice.message ?? ""))
      skipped = true;
  });
  await client.connect();
  try {
    const target = await client.query<{ database: string; port: number }>(
      "SELECT current_database() AS database, inet_server_port() AS port",
    );
    if (target.rows[0]?.database !== env.DB_NAME || target.rows[0]?.port !== env.DB_PORT)
      throw new Error("Test maintenance target does not match the test connection");
    await client.query('VACUUM (ANALYZE) "Service"');
    if (skipped)
      throw new Error(
        "Service index maintenance was denied; configure separate TEST_MAINTENANCE_DB_USER and TEST_MAINTENANCE_DB_PASSWORD credentials for this isolated database",
      );
  } finally {
    await client.end();
  }
}
