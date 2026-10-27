// @vitest-environment jsdom
import { beforeEach, it, expect, vi } from "vitest";
import {
  parseCapacityWorkspace,
  validateCapacityReceipt,
} from "@/lib/admin/work-capacity-policy";
import {
  readCapacityPolicyPending,
  markCapacityPolicyPending,
  clearCapacityPolicyPending,
  redactCapacityPolicyChanges,
} from "@/lib/admin/work-capacity-policy-pending";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  capacityId as id,
  capacityRow,
  capacitySettings,
} from "../fixtures/work-booking-capacity";
const state = () => ({
  evaluatedAt: "2026-10-19T09:00:00Z",
  branch: {
    id: id(1),
    name: "Synthetic workshop",
    isActive: true,
    updatedAt: "2026-10-18T08:00:00Z",
  },
  current: capacityRow(2),
  nextScheduled: capacityRow(3),
  latest: capacityRow(4),
  history: [4, 3, 2, 1].map((v) => capacityRow(v)),
});
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${id(3)}:SUPER_ADMIN`);
});
it("selects effective policy independently of latest and permits bounded history", () => {
  expect(parseCapacityWorkspace(state(), id(1)).current?.version).toBe(2);
  expect(
    parseCapacityWorkspace({ ...state(), history: [capacityRow(4)] }, id(1)).current
      ?.version,
  ).toBe(2);
});
it("rejects another branch, inconsistent schedule, duplicate versions and wrong latest", () => {
  for (const bad of [
    { ...state(), branch: { ...state().branch, id: id(9) } },
    { ...state(), current: capacityRow(2, id(9)) },
    { ...state(), current: capacityRow(3) },
    { ...state(), nextScheduled: capacityRow(2) },
    { ...state(), latest: capacityRow(3) },
    { ...state(), history: [capacityRow(4), capacityRow(4)] },
  ])
    expect(() => parseCapacityWorkspace(bad, id(1))).toThrow();
});
it("requires exact branch, approver, Q5 provenance, date and settings in approval receipt", () => {
  const row = capacityRow(4),
    body = {
      branchId: id(1),
      expectedVersion: 3,
      effectiveAt: row.effectiveAt,
      source: row.source,
      approvalEvidence: row.approvalEvidence,
      settings: capacitySettings,
    };
  expect(validateCapacityReceipt(row, body, id(3))).toEqual(row);
  for (const change of [
    { key: `booking-capacity:${id(9)}` },
    { approvedByUserId: id(9) },
    { version: 5 },
    { sourceQuestion: "Q13" },
    { sourceSignatory: "other" },
    { approvalEvidence: "other" },
    { effectiveAt: "2048-01-01T00:00:00Z" },
    { settings: { ...capacitySettings, dailyLimit: 7 } },
    { settings: { ...capacitySettings, extra: true } },
    { settings: { ...capacitySettings, opensAt: "07:00" } },
  ])
    expect(() => validateCapacityReceipt({ ...row, ...change }, body, id(3))).toThrow();
});
it("isolates pending approvals by branch and requires the matching token", () => {
  const marker = { expectedVersion: 4, fingerprint: "a".repeat(64) },
    saved = markCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1), marker);
  expect(readCapacityPolicyPending(id(3), "SUPER_ADMIN", id(9))).toBeUndefined();
  expect(() => markCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1), marker)).toThrow();
  const second = markCapacityPolicyPending(id(3), "SUPER_ADMIN", id(9), marker);
  expect(() =>
    clearCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1), second.token),
  ).toThrow();
  clearCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1), saved.token);
  expect(readCapacityPolicyPending(id(3), "SUPER_ADMIN", id(9))).toEqual(second);
});
it("redacts every branch marker and fails closed on account change or unavailable storage", () => {
  const marker = { expectedVersion: 4, fingerprint: "a".repeat(64) };
  for (const n of [1, 9]) markCapacityPolicyPending(id(3), "SUPER_ADMIN", id(n), marker);
  redactCapacityPolicyChanges();
  for (const n of [1, 9])
    expect(readCapacityPolicyPending(id(3), "SUPER_ADMIN", id(n))).toBe("unknown");
  clearCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => markCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1), marker)).toThrow();
  setDraftIdentity("other:SUPER_ADMIN");
  expect(() => clearCapacityPolicyPending(id(3), "SUPER_ADMIN", id(9))).toThrow();
});
