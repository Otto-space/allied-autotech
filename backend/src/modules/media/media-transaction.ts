import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

// S3 writes/deletes have a 20-second request deadline. Keep the ticket lock
// through that operation and its database outcome, with bounded headroom.
export function mediaTransaction<T>(
  db: PrismaClient,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT set_config('idle_in_transaction_session_timeout', '30000', true)`;
      return work(tx);
    },
    { timeout: 60_000 },
  );
}
