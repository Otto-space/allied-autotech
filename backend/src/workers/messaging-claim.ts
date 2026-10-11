import type { PrismaClient } from "../generated/prisma/client.js";

// A batch may wait behind a slow send. Renew only the attempt still owned by this worker.
export async function renewMessagingClaim(
  database: PrismaClient,
  event: { id: string; attempts: number },
): Promise<boolean> {
  const count = await database.$executeRaw`
    UPDATE "OutboxEvent"
    SET "lockedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    WHERE "id" = ${event.id}::uuid AND "status" = 'PROCESSING'
      AND "attempts" = ${event.attempts}
  `;
  return count === 1;
}
