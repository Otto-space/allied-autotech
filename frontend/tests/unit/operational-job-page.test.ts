import { expect, it } from "vitest";
import { parseJobs } from "@/lib/api/operations-schemas";
const job = {
  id: "c0000000-0000-4000-8000-000000000001",
  source: "OUTBOX",
  eventId: "c0000000-0000-4000-8000-000000000002",
  eventType: "Synthetic",
  aggregateType: "ORDER",
  aggregateId: "synthetic",
  status: "FAILED",
  attempts: 1,
  availableAt: "2026-10-12T10:00:00Z",
  createdAt: "2026-10-12T10:00:00Z",
  updatedAt: "2026-10-12T10:00:00Z",
  lockedAt: null,
};
it("accepts the bounded opaque job cursor and excludes private diagnostic fields", () => {
  const result = parseJobs({
    items: [{ ...job, lastError: "PRIVATE", payload: { secret: "PRIVATE" } }],
    nextCursor: "A".repeat(100),
  });
  expect(result.nextCursor).toBe("A".repeat(100));
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(parseJobs({ items: [] })).toEqual({ items: [] });
});
it("rejects legacy, oversized or malformed job cursors", () => {
  for (const cursor of [job.id, "A".repeat(1025), "invalid/cursor"]) {
    expect(() => parseJobs({ items: [job], nextCursor: cursor })).toThrow();
  }
});
