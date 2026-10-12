import { expect, it } from "vitest";
import { parseOperationsOverview } from "@/lib/api/operations-overview-schemas";

const base = { queues: [], openPaymentAnomalies: 0, lastReconciliation: null };
const worker = {
  name: "refunds",
  missing: false,
  overdue: false,
  staleAfterMs: 600000,
  lastStartedAt: "2026-10-12T08:00:00Z",
  lastSucceededAt: "2026-10-12T08:00:00Z",
};

it("preserves unavailable legacy fields and real zero values without inventing health", () => {
  const parsed = parseOperationsOverview(base);
  expect(parsed.openPaymentAnomalies).toBe(0);
  expect(parsed.workers).toBeUndefined();
  expect(parsed.operationalAlerts).toBeUndefined();
});

it("rejects contradictory heartbeats and duplicate workers", () => {
  expect(() => parseOperationsOverview({ ...base, workers: [worker, worker] })).toThrow();
  expect(() =>
    parseOperationsOverview({ ...base, workers: [{ ...worker, lastSucceededAt: null }] }),
  ).toThrow();
  expect(() =>
    parseOperationsOverview({ ...base, workers: [{ ...worker, missing: true }] }),
  ).toThrow();
  expect(
    parseOperationsOverview({
      ...base,
      workers: [{ name: "refunds", missing: true, overdue: true, staleAfterMs: 600000 }],
    }).workers?.[0].missing,
  ).toBe(true);
});

it("rejects negative counts and excludes backend fields outside the display projection", () => {
  expect(() => parseOperationsOverview({ ...base, openPaymentAnomalies: -1 })).toThrow();
  const parsed = parseOperationsOverview({
    ...base,
    workers: [{ ...worker, errorCode: "INTERNAL_CODE" }],
    operationalAlerts: [
      {
        id: "ef000000-0000-4000-8000-000000000001",
        category: "PAYMENT_REVIEW",
        message: "Review required",
        createdAt: worker.lastStartedAt,
        key: "private-key",
        resourceId: "private-id",
      },
    ],
  });
  expect(JSON.stringify(parsed)).not.toMatch(/INTERNAL_CODE|private-key|private-id/);
});
