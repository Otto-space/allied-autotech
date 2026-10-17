import { afterAll, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { verifyDatabaseSchema } from "../../src/common/database/schema-safety.js";

const enabled =
  process.env["RUN_DATABASE_TESTS"] === "true" &&
  process.env["RUN_DATABASE_SAFETY_TESTS"] === "true";
describe.skipIf(!enabled)("schema guard against real isolated PostgreSQL drift", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a physically missing column and preserves the schema through rollback", async () => {
    if (env.NODE_ENV !== "test" || !/_(?:test|ci)$/.test(env.DB_NAME))
      throw new Error(
        "Schema drift tests require an explicitly enabled isolated test database.",
      );
    await verifyDatabaseSchema(prisma);
    // Only the dedicated disposable database. No application data is read or changed.
    // The transaction rolls back the deliberate drift after the guard rejects it.
    await expect(
      prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`ALTER TABLE public."Service" DROP COLUMN "categoryId"`;
          await verifyDatabaseSchema(transaction as unknown as PrismaClient);
        },
        { timeout: 30_000 },
      ),
    ).rejects.toMatchObject({ code: "DATABASE_SCHEMA_MISMATCH" });
    await verifyDatabaseSchema(prisma);
  }, 45_000);
});
