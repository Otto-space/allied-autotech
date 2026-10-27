import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";

// Expiry forbids reads immediately; this bounded shared worker erases payloads
// and retires only this feature's short-lived rows. Backups retain their own policy.
export async function purgeExpiredAllieState(limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error("Invalid assistant cleanup batch");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('assistant-state-v1', 0))`;
    const [clock] = await tx.$queryRaw<
      { at: Date }[]
    >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "at"`;
    const at = clock!.at,
      old = new Date(at.getTime() - 86400000);
    const expired = await tx.assistantConversation.findMany({
      where: {
        AND: [
          {
            OR: [
              { expiresAt: { lte: at } },
              { absoluteExpiresAt: { lte: at } },
              { closedAt: { not: null } },
            ],
          },
          {
            OR: [
              { encryptedState: { not: Prisma.DbNull } },
              {
                turns: {
                  some: {
                    OR: [
                      { encryptedResult: { not: Prisma.DbNull } },
                      { status: "PENDING" },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
      orderBy: { expiresAt: "asc" },
      take: limit,
      select: { id: true },
    });
    const ids = expired.map((row) => row.id);
    if (ids.length) {
      await tx.assistantTurn.updateMany({
        where: { conversationId: { in: ids } },
        data: { encryptedResult: Prisma.DbNull },
      });
      await tx.assistantTurn.updateMany({
        where: { conversationId: { in: ids }, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: at, failureCode: "cancelled" },
      });
      await tx.assistantConversation.updateMany({
        where: { id: { in: ids } },
        data: { encryptedState: Prisma.DbNull },
      });
    }
    const retired = await tx.assistantConversation.findMany({
      where: { OR: [{ absoluteExpiresAt: { lte: old } }, { closedAt: { lte: old } }] },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    // Owned guest requests lock their row before the shared assistant mutex.
    // Do not invert that ordering by waiting for a busy guest while holding it.
    // Logical expiry still denies access; a later pass retires skipped rows.
    const guests = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "AssistantGuestSession"
      WHERE "expiresAt" <= ${at}
      ORDER BY "expiresAt" ASC, "id" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    const removed = retired.length
      ? await tx.assistantConversation.deleteMany({
          where: { id: { in: retired.map((row) => row.id) } },
        })
      : { count: 0 };
    if (guests.length)
      await tx.assistantGuestSession.deleteMany({
        where: { id: { in: guests.map((row) => row.id) } },
      });
    return {
      payloadBatchesReviewed: ids.length,
      conversationsRetired: removed.count,
      guestSessionsRetired: guests.length,
    };
  });
}
