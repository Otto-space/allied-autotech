import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.iso.datetime({ offset: true });
const schema = z.object({
  queues: z.array(
    z.object({ queue: z.string().min(1), status: z.string().min(1), count }),
  ),
  openPaymentAnomalies: count,
  lastReconciliation: z
    .object({
      status: z.string().min(1),
      periodStart: date,
      periodEnd: date,
      differenceCount: count,
      completedAt: date.nullable(),
      startedAt: date,
    })
    .nullable(),
  // Older responses do not supply these fields. Absence is unavailable, never zero.
  workers: z
    .array(
      z.object({
        name: z.string().min(1),
        missing: z.boolean(),
        overdue: z.boolean(),
        staleAfterMs: count,
        lastStartedAt: date.optional(),
        lastSucceededAt: date.nullable().optional(),
        lastFailedAt: date.nullable().optional(),
      }),
    )
    .optional(),
  operationalAlerts: z
    .array(
      z.object({
        id: z.uuid(),
        category: z.string().min(1),
        message: z.string(),
        createdAt: date,
      }),
    )
    .max(100)
    .optional(),
});

export const parseOperationsOverview = (value: unknown) => {
  const data = schema.parse(value);
  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  if (
    !unique(data.queues.map((row) => `${row.queue}:${row.status}`)) ||
    !unique((data.workers ?? []).map((worker) => worker.name)) ||
    !unique((data.operationalAlerts ?? []).map((alert) => alert.id)) ||
    data.workers?.some((worker) =>
      worker.missing
        ? !worker.overdue || !!worker.lastStartedAt || !!worker.lastSucceededAt
        : !worker.lastStartedAt || (!worker.overdue && !worker.lastSucceededAt),
    )
  ) {
    throw new Error("Operational status could not be verified.");
  }
  return data;
};
