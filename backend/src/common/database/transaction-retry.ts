import { setTimeout as delay } from "node:timers/promises";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export function isTransactionConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const failure = error as {
    code?: string;
    meta?: { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } };
  };
  const sqlState =
    failure.meta?.code ?? failure.meta?.driverAdapterError?.cause?.originalCode;
  return failure.code === "P2034" || ["40P01", "40001"].includes(sqlState ?? "");
}

/** Retry only database-aborted transactions. Callback must contain no external side effects. */
export async function withTransactionRetry<T>(
  database: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { isolationLevel: Prisma.TransactionIsolationLevel; maxAttempts?: number },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5)
    throw new RangeError("Transaction retry attempts must be between one and five");
  for (let attempt = 0; ; attempt++) {
    try {
      return await (options
        ? database.$transaction(work, { isolationLevel: options.isolationLevel })
        : database.$transaction(work));
    } catch (error) {
      if (attempt >= maxAttempts - 1 || !isTransactionConflict(error)) throw error;
      await delay(25 * (attempt + 1));
    }
  }
}
