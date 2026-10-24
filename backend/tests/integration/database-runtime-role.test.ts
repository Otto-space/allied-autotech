import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { verifyDatabaseSchema } from "../../src/common/database/schema-safety.js";

const enabled =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.RUN_DATABASE_SAFETY_TESTS === "true";
describe.skipIf(!enabled)("isolated runtime role permissions", () => {
  afterAll(() => prisma.$disconnect());
  it("probes the schema and uses ordinary CRUD without ownership or destructive privileges", async () => {
    if (
      env.NODE_ENV !== "test" ||
      !/_(?:test|ci)$/.test(env.DB_NAME) ||
      !["127.0.0.1", "localhost"].includes(env.DB_HOST)
    )
      throw new Error(
        "Runtime role verification requires an isolated local test database.",
      );
    const [identity] = await prisma.$queryRaw<
      { host: string; port: number; database: string }[]
    >`SELECT inet_server_addr()::text AS host, inet_server_port() AS port, current_database() AS database`;
    expect(identity?.host).toMatch(/^127\.0\.0\.1(?:\/32)?$/);
    expect(identity?.port).toBe(env.DB_PORT);
    expect(identity?.database).toBe(env.DB_NAME);
    const role = `fitment_runtime_${randomUUID().replaceAll("-", "")}`;
    if (!/^[a-z0-9_]+$/.test(role)) throw new Error("Invalid generated test role");
    const rollback = new Error("Roll back this isolated permission verification");
    await expect(
      prisma.$transaction(
        async (tx) => {
          // New role and grants exist only in this transaction. No existing role or
          // grant is edited, and the deliberate exception rolls everything back.
          await tx.$executeRawUnsafe(
            `CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,
          );
          await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
          await tx.$executeRawUnsafe(
            `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
          );
          await tx.$executeRawUnsafe(
            `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`,
          );
          await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
          const [permissions] = await tx.$queryRaw<
            { admin: boolean; owns: boolean; createSchema: boolean; truncate: boolean }[]
          >`
        SELECT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS admin,
          EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relowner=r.oid) OR EXISTS(SELECT 1 FROM pg_database d WHERE d.datname=current_database() AND d.datdba=r.oid) AS owns,
          has_schema_privilege(current_user, 'public', 'CREATE') AS "createSchema",
          EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname='public' AND has_table_privilege(current_user, quote_ident(t.schemaname)||'.'||quote_ident(t.tablename), 'TRUNCATE')) AS truncate
        FROM pg_roles r WHERE r.rolname=current_user`;
          expect(permissions).toEqual({
            admin: false,
            owns: false,
            createSchema: false,
            truncate: false,
          });
          await verifyDatabaseSchema(tx as unknown as PrismaClient);
          const category = await tx.category.create({ data: { name: role, slug: role } });
          expect(
            (await tx.category.findUnique({ where: { id: category.id } }))?.name,
          ).toBe(role);
          await tx.category.update({
            where: { id: category.id },
            data: { description: "Isolated runtime permission probe" },
          });
          await tx.category.delete({ where: { id: category.id } });
          throw rollback;
        },
        { timeout: 30000 },
      ),
    ).rejects.toBe(rollback);
    const [state] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${role}) AS exists`;
    expect(state?.exists).toBe(false);
  }, 45000);
});
