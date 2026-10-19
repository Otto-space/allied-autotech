import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.js";
import {
  assertDatabaseSchemaCompatible,
  DatabaseSchemaSafetyError,
  verifyDatabaseSchema,
} from "../../src/common/database/schema-safety.js";
import { safeErrorAttributes } from "../../src/common/observability/safe-error.js";

function fixture() {
  const delegates = Object.fromEntries(
    Object.values(Prisma.ModelName).map((name) => [
      name.charAt(0).toLowerCase() + name.slice(1),
      {
        fields: {
          id: { typeName: "String", isList: false },
          revision: { typeName: "Int", isList: false },
        },
        findMany: vi.fn(async () => []),
      },
    ]),
  );
  return { delegates, database: delegates as unknown as PrismaClient };
}

afterEach(() => vi.useRealTimers());

describe("schema safety before startup and worker writes", () => {
  it("validates every generated model with an impossible predicate and explicit scalar selection", async () => {
    const { database, delegates } = fixture();
    await verifyDatabaseSchema(database);
    for (const delegate of Object.values(delegates)) {
      expect(delegate.findMany).toHaveBeenCalledExactlyOnceWith({
        where: {
          AND: [
            { id: "00000000-0000-0000-0000-000000000000" },
            { NOT: { id: "00000000-0000-0000-0000-000000000000" } },
          ],
        },
        select: { id: true, revision: true },
        take: 1,
      });
    }
  });

  it.each(["P2021", "P2022"])(
    "fails closed on %s, without exposing SQL or credentials",
    async (code) => {
      const { database, delegates } = fixture();
      delegates["service"]!.findMany.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("private connection and SQL", {
          code,
          clientVersion: "7.10.0",
        }),
      );
      const failure = await verifyDatabaseSchema(database).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(DatabaseSchemaSafetyError);
      expect(safeErrorAttributes(failure)).toMatchObject({
        errorCode: "DATABASE_SCHEMA_MISMATCH",
        recoveryHint: expect.any(String),
      });
      expect(JSON.stringify(safeErrorAttributes(failure))).not.toContain("private");
    },
  );

  it("deduplicates readiness probes and detects subsequent drift after expiry", async () => {
    vi.useFakeTimers();
    const { database, delegates } = fixture();
    await Promise.all([
      assertDatabaseSchemaCompatible(database),
      assertDatabaseSchemaCompatible(database),
    ]);
    await assertDatabaseSchemaCompatible(database);
    expect(delegates["service"]!.findMany).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_001);
    delegates["service"]!.findMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("column missing", {
        code: "P2022",
        clientVersion: "7.10.0",
      }),
    );
    await expect(assertDatabaseSchemaCompatible(database)).rejects.toBeInstanceOf(
      DatabaseSchemaSafetyError,
    );
    await expect(assertDatabaseSchemaCompatible(database)).resolves.toBeUndefined();
    expect(delegates["service"]!.findMany).toHaveBeenCalledTimes(3);
  });

  it("preserves database outage classification instead of claiming a migration fixes an outage", async () => {
    const { database, delegates } = fixture();
    const outage = new Prisma.PrismaClientKnownRequestError("unreachable", {
      code: "P1001",
      clientVersion: "7.10.0",
    });
    delegates["user"]!.findMany.mockRejectedValueOnce(outage);
    await expect(verifyDatabaseSchema(database)).rejects.toBe(outage);
  });
});
