import { prisma } from "../config/database.js";
import { withTransactionRetry } from "../common/database/transaction-retry.js";
import { reconcileSupportChannel } from "../modules/support/support-channel.js";

const checkpointName = "support-channel-reconcile:v1";
export class SupportChannelWorker {
  constructor(private readonly database = prisma) {}
  async runOnce(requestedLimit = 10) {
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 25)
      throw new RangeError("Support reconciliation batch must be between one and 25");
    return withTransactionRetry(this.database, async (tx) => {
      // Do not hold up workforce changes or a current claim when another instance is busy.
      const [lock] = await tx.$queryRaw<
        { acquired: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtextextended('organization-access',0)) AS "acquired"`;
      if (!lock?.acquired) return { skipped: true, scanned: 0, changed: 0, more: false };
      const checkpoint = await tx.workerScanCheckpoint.upsert({
        where: { name: checkpointName },
        create: { name: checkpointName },
        update: {},
      });
      const after =
        checkpoint.afterCreatedAt && checkpoint.afterId
          ? {
              OR: [
                { createdAt: { gt: checkpoint.afterCreatedAt } },
                { createdAt: checkpoint.afterCreatedAt, id: { gt: checkpoint.afterId } },
              ],
            }
          : {};
      const rows = await tx.supportConversation.findMany({
        where: { state: { not: "ENDED" }, ...after },
        take: requestedLimit,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      let changed = 0;
      for (const row of rows) {
        const current = await reconcileSupportChannel(tx, row, {
          requestId: "support-channel-reconciliation",
          ipAddress: null,
          userAgent: null,
        });
        if (current.version !== row.version) changed++;
      }
      const last = rows.length === requestedLimit ? rows.at(-1) : undefined;
      await tx.workerScanCheckpoint.update({
        where: { name: checkpointName },
        data: {
          afterCreatedAt: last?.createdAt ?? null,
          afterId: last?.id ?? null,
          version: { increment: 1 },
        },
      });
      return { skipped: false, scanned: rows.length, changed, more: !!last };
    });
  }
}
