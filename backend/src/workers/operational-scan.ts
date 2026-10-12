import type { PrismaClient, WorkerScanCheckpoint } from "../generated/prisma/client.js";

export const operationalScanLimit = 100;
type ScanName = "disputes" | "refunds" | "payments" | "vehicle-holds";

export function readOperationalScan(database: PrismaClient, name: ScanName) {
  return database.workerScanCheckpoint.upsert({
    where: { name: `operational-alerts:${name}` },
    create: { name: `operational-alerts:${name}` },
    update: {},
  });
}

export function operationalScanBoundary(checkpoint: WorkerScanCheckpoint) {
  const { afterCreatedAt, afterId } = checkpoint;
  if (afterCreatedAt === null || afterId === null) return [];
  // Store values, not a Prisma row cursor: the previous row may resolve or disappear.
  return [
    {
      OR: [
        { createdAt: { gt: afterCreatedAt } },
        { createdAt: afterCreatedAt, id: { gt: afterId } },
      ],
    },
  ];
}

export async function advanceOperationalScan(
  database: PrismaClient,
  checkpoint: WorkerScanCheckpoint,
  rows: readonly { id: string; createdAt: Date }[],
): Promise<void> {
  const last = rows.length === operationalScanLimit ? rows.at(-1) : undefined;
  // Only advance after every effect succeeded. Repeated pages are safe because
  // alerts are upserted and reminders have durable deduplication keys.
  // A stale concurrent scanner must never rewind a newer checkpoint.
  await database.workerScanCheckpoint.updateMany({
    where: { name: checkpoint.name, version: checkpoint.version },
    data: {
      afterCreatedAt: last?.createdAt ?? null,
      afterId: last?.id ?? null,
      version: { increment: 1 },
    },
  });
}
