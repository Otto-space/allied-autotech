import { expect, it } from "vitest";
import {
  jobQuery,
  jobPageParams,
  parseJobPage,
  parseCurrentJob,
  validateJobRetry,
  type CurrentJob,
} from "@/lib/admin/work-processing-jobs";
const id = "d1000000-0000-4000-8000-000000400000",
  at = "2026-10-19T08:00:00.000Z";
const row: CurrentJob = {
  id,
  source: "OUTBOX",
  eventId: id,
  eventType: "synthetic",
  aggregateType: "TEST",
  aggregateId: id,
  status: "FAILED",
  attempts: 0,
  availableAt: at,
  createdAt: at,
  updatedAt: at,
  lockedAt: null,
  publishedAt: null,
};
it("preserves opaque cursor case through scoped URL history and rejects contradictory URLs", () => {
  const cursor = "AbC".repeat(30),
    first = new URLSearchParams("source=OUTBOX&status=FAILED"),
    next = jobPageParams(first, cursor);
  expect(jobQuery(next).path).toContain(cursor);
  expect(jobQuery(next).invalid).toBe(false);
  expect(jobPageParams(next, undefined, true).toString()).toBe(first.toString());
  for (const value of [
    "source=ANY",
    "source=OUTBOX&source=PAYMENT_WEBHOOK",
    "cursor=bad",
    "selected=outbox:bad",
    `_trail=start&cursor=${cursor}&_trail=start`,
    `cursor=${cursor}&_trail=${cursor}`,
  ])
    expect(jobQuery(new URLSearchParams(value)).invalid).toBe(true);
});
it("validates source, chronology, duplicate identity and diagnostic privacy", () => {
  const queue = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "publishedAt"),
  );
  expect(
    parseJobPage({ items: [{ ...queue, lastError: null }] }, new URLSearchParams()).items,
  ).toHaveLength(1);
  for (const value of [
    { items: [queue, queue] },
    { items: [{ ...queue, lastError: "PRIVATE" }] },
    { items: [{ ...queue, payload: {} }] },
    { items: [], nextCursor: "AbC".repeat(30) },
  ])
    expect(() => parseJobPage(value, new URLSearchParams())).toThrow();
  expect(() =>
    parseJobPage({ items: [queue] }, new URLSearchParams("source=PAYMENT_WEBHOOK")),
  ).toThrow();
});
it("matches current inspection and retry receipts to the exact physical queue and attempt", () => {
  expect(parseCurrentJob(row, `outbox:${id}`)).toEqual(row);
  expect(() => parseCurrentJob(row, `webhook:${id}`)).toThrow();
  const receipt = { id, source: "outbox", status: "RETRY_REQUESTED", attempts: 0 };
  expect(validateJobRetry(receipt, row)).toEqual(receipt);
  for (const changed of [
    { source: "webhook" },
    { attempts: 1 },
    { status: "PUBLISHED" },
    { extra: true },
  ])
    expect(() => validateJobRetry({ ...receipt, ...changed }, row)).toThrow();
});
