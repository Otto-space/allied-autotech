import { describe, it, expect } from "vitest";
import {
  parseDisputeWorkspace,
  validateDisputeReceipt,
} from "@/lib/admin/work-dispute-policy";
import { disputePolicyRow, id } from "../fixtures/work-dispute-policy";
const state = () => ({
  evaluatedAt: "2026-10-18T09:00:00.000Z",
  current: disputePolicyRow(2),
  latest: disputePolicyRow(4),
  nextScheduled: disputePolicyRow(3),
  history: [4, 3, 2, 1].map(disputePolicyRow),
});
describe("dispute policy authoritative state", () => {
  it("distinguishes current from highest version and permits a current policy outside bounded history", () => {
    expect(parseDisputeWorkspace(state()).current?.version).toBe(2);
    expect(
      parseDisputeWorkspace({ ...state(), history: [disputePolicyRow(4)] }).current
        ?.version,
    ).toBe(2);
  });
  it("rejects contradictory dates, keys, latest and history order", () => {
    for (const bad of [
      { ...state(), current: disputePolicyRow(3) },
      { ...state(), nextScheduled: disputePolicyRow(2) },
      { ...state(), latest: disputePolicyRow(3) },
      { ...state(), history: [disputePolicyRow(4), disputePolicyRow(4)] },
      { ...state(), current: { ...disputePolicyRow(2), key: "refund" } },
    ])
      expect(() => parseDisputeWorkspace(bad)).toThrow();
  });
  it("requires exact provenance, settings, effective time and approver in a publication receipt", () => {
    const row = disputePolicyRow(4),
      body = {
        expectedVersion: 3,
        effectiveAt: row.effectiveAt,
        source: row.source,
        approvalEvidence: row.approvalEvidence!,
        settings: row.settings,
      };
    expect(validateDisputeReceipt(row, body, id(302))).toEqual(row);
    for (const change of [
      { approvedByUserId: id(999) },
      { version: 5 },
      { approvalEvidence: "other" },
      { sourceQuestion: "other" },
      { sourceSignatory: "unexpected" },
      { effectiveAt: "2030-01-05T07:31:00Z" },
      {
        settings: {
          ...(row.settings as object),
          closeMinute: 1050,
        },
      },
    ])
      expect(() =>
        validateDisputeReceipt({ ...row, ...change }, body, id(302)),
      ).toThrow();
  });
});
