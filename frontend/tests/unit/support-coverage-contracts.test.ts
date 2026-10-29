// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  assertCoverageTarget,
  careCoverageRecoverySchema,
  careCoverageScheduleSchema,
  coverageDraftBody,
  coverageMatches,
  coverageTime,
  newCoverageDraft,
  type CareCoverage,
} from "@/lib/api/support-coverage-schemas";
import {
  clearCoveragePending,
  coverageRecoveryOwner,
  readCoveragePending,
  redactCoveragePending,
  saveCoveragePending,
} from "@/lib/support/coverage-pending";
const id = "f1800000-0000-4000-8000-000000000001";
const base: CareCoverage = {
  branchId: id,
  enabled: false,
  version: 0,
  maxConcurrentPerAgent: 1,
  schedule: { timezone: "Africa/Lagos", windows: [] },
};
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
it("starts empty without inventing approved hours and roundtrips explicit midnight", () => {
  const draft = newCoverageDraft(base);
  expect(draft.windows).toEqual([]);
  expect(draft.enabled).toBe(false);
  expect(coverageTime(1440)).toBe("24:00");
  draft.reason = "Reviewed disabled configuration";
  expect(coverageDraftBody(draft).schedule.windows).toEqual([]);
  draft.windows.push({ key: "row", day: "6", start: "22:17", end: "24:00" });
  expect(coverageDraftBody(draft).schedule.windows).toEqual([
    { day: 6, startMinute: 1337, endMinute: 1440 },
  ]);
});
it.each(["", "0", "6", "01", "1.5"])(
  "rejects invalid capacity %j rather than coercing it",
  (capacity) => {
    expect(() => coverageDraftBody({ ...newCoverageDraft(base), capacity })).toThrow();
  },
);
it.each([
  { day: "", start: "09:00", end: "17:00" },
  { day: "1", start: "", end: "17:00" },
  { day: "1", start: "24:00", end: "24:00" },
  { day: "1", start: "22:00", end: "02:00" },
  { day: "1", start: "09:00", end: "09:00" },
])("rejects missing or overnight window values %j", (window) => {
  const draft = newCoverageDraft(base);
  draft.reason = "Approved synthetic schedule";
  draft.windows.push({ key: "row", ...window });
  expect(() => coverageDraftBody(draft)).toThrow();
});
it("preserves minute precision, accepts touching windows and rejects overlap", () => {
  const schedule = {
    timezone: "Africa/Lagos",
    windows: [
      { day: 1, startMinute: 540, endMinute: 600 },
      { day: 1, startMinute: 600, endMinute: 701 },
    ],
  };
  expect(careCoverageScheduleSchema.safeParse(schedule).success).toBe(true);
  expect(
    careCoverageScheduleSchema.safeParse({
      ...schedule,
      windows: [schedule.windows[0], { ...schedule.windows[1], startMinute: 599 }],
    }).success,
  ).toBe(false);
});
it("requires real support windows when enabling and a private audit reason", () => {
  const draft = newCoverageDraft(base);
  draft.enabled = true;
  draft.reason = "Reviewed";
  expect(() => coverageDraftBody(draft)).toThrow();
  draft.enabled = false;
  draft.reason = "   ";
  expect(() => coverageDraftBody(draft)).toThrow();
});
it("binds response identity, revision and the compared settings", () => {
  expect(() =>
    assertCoverageTarget(base, "f1800000-0000-4000-8000-000000000002"),
  ).toThrow();
  expect(
    careCoverageRecoverySchema.safeParse({
      state: "SAVED",
      savedVersion: 3,
      coverage: base,
    }).success,
  ).toBe(false);
  const body = coverageDraftBody({
    ...newCoverageDraft(base),
    reason: "Reviewed synthetic settings",
  });
  expect(coverageMatches(base, body)).toBe(true);
  expect(coverageMatches({ ...base, enabled: true }, body)).toBe(false);
});
it("stores only an opaque operation reference and redacts it on identity changes", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const owner = await coverageRecoveryOwner(id, id);
  const marker = {
    operationKey: `support-reply-v1.${Date.now()}.${crypto.randomUUID()}`,
  };
  saveCoveragePending(owner, marker);
  expect(readCoveragePending(owner)).toEqual(marker);
  expect(JSON.stringify(sessionStorage)).not.toContain(id);
  expect(() =>
    saveCoveragePending(owner, { ...marker, reason: "Private reason" } as typeof marker),
  ).toThrow();
  sessionStorage.setItem("other-feature", "retain");
  clearCoveragePending(owner);
  expect(readCoveragePending(owner)).toBeNull();
  saveCoveragePending(owner, marker);
  redactCoveragePending();
  expect(readCoveragePending(owner)).toBeNull();
  expect(sessionStorage.getItem("other-feature")).toBe("retain");
});
