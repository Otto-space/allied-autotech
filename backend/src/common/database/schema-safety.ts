import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

interface ProbeDelegate {
  fields: Record<string, unknown>;
  findMany(options: {
    where: { OR: never[] };
    select: Record<string, true>;
    take: number;
  }): Promise<unknown[]>;
}

export class DatabaseSchemaSafetyError extends Error {
  readonly code = "DATABASE_SCHEMA_MISMATCH";

  constructor(cause?: unknown) {
    super(
      "Database schema verification failed. Check the target with npm run db:check; apply reviewed migrations with npm run db:migrate. Startup does not modify the database.",
      { cause },
    );
  }
}

/** Probe the generated client's actual columns/mappings, selecting no business rows. */
export async function verifyDatabaseSchema(database: PrismaClient): Promise<void> {
  const delegates = database as unknown as Record<string, ProbeDelegate>;
  const models = Object.values(Prisma.ModelName);
  // Bound concurrent work so readiness cannot exhaust the database pool.
  for (let offset = 0; offset < models.length; offset += 4) {
    await Promise.all(
      models.slice(offset, offset + 4).map(async (model) => {
        const delegate = delegates[model.charAt(0).toLowerCase() + model.slice(1)];
        if (!delegate) throw new DatabaseSchemaSafetyError();
        try {
          // take: 0 is optimized away by Prisma and would NOT check PostgreSQL.
          // An empty OR emits WHERE 1=0, validating columns without reading rows.
          // Field references can omit isList, so do not infer scalar filter types.
          const rows = await delegate.findMany({
            where: { OR: [] },
            select: Object.fromEntries(
              Object.keys(delegate.fields).map((key) => [key, true]),
            ),
            take: 1,
          });
          if (rows.length !== 0) throw new DatabaseSchemaSafetyError();
        } catch (cause) {
          if (
            cause instanceof DatabaseSchemaSafetyError ||
            (cause instanceof Prisma.PrismaClientKnownRequestError &&
              ["P2021", "P2022"].includes(cause.code))
          )
            throw new DatabaseSchemaSafetyError(cause);
          throw cause;
        }
      }),
    );
  }
}

const checks = new WeakMap<PrismaClient, { expiresAt: number; pending: Promise<void> }>();

/** Deduplicate probes; revalidate readiness every minute and never cache failures. */
export function assertDatabaseSchemaCompatible(database: PrismaClient): Promise<void> {
  const cached = checks.get(database);
  if (cached && cached.expiresAt > Date.now()) return cached.pending;
  const entry = {
    expiresAt: Number.POSITIVE_INFINITY,
    pending: verifyDatabaseSchema(database),
  };
  checks.set(database, entry);
  void entry.pending.then(
    () => {
      entry.expiresAt = Date.now() + 60_000;
    },
    () => {
      if (checks.get(database) === entry) checks.delete(database);
    },
  );
  return entry.pending;
}
