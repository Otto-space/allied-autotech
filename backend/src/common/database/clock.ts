import type { Prisma } from "../../generated/prisma/client.js";

/** Durable facts and SQL invariants must share the database clock. Never clamp a
 * claimed bank/provider time or weaken a future-date check to hide clock skew. */
export async function databaseClock(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<{ recordedAt: Date }[]>`
    SELECT clock_timestamp() AS "recordedAt"`;
  if (
    !row ||
    !(row.recordedAt instanceof Date) ||
    !Number.isFinite(row.recordedAt.getTime())
  )
    throw new Error("The authoritative database clock could not be verified");
  return row.recordedAt;
}
