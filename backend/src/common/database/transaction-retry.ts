import { setTimeout as delay } from "node:timers/promises";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

/** Retry only database-aborted transactions. Callback must contain no external side effects. */
export async function withTransactionRetry<T>(
  database: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database.$transaction(work);
    } catch (error) {
      const failure = error as {
        code?: string;
        meta?: {
          code?: string;
          driverAdapterError?: { cause?: { originalCode?: string } };
        };
      };
      const sqlState =
        failure.meta?.code ?? failure.meta?.driverAdapterError?.cause?.originalCode;
      if (
        attempt >= 2 ||
        (failure.code !== "P2034" && !["40P01", "40001"].includes(sqlState ?? ""))
      )
        throw error;
      await delay(25 * (attempt + 1));
    }
  }
}
