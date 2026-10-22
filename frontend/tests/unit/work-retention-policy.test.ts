import { describe, it, expect } from "vitest";
import {
  parseRetentionWorkspace,
  validateRetentionReceipt,
} from "@/lib/admin/work-retention-policy";
import { retentionPolicyRow, id } from "../fixtures/work-retention-policy";
import { retentionSettingsSchema } from "@/lib/api/operational-policy-schemas";
const state = () => ({
  evaluatedAt: "2026-10-18T09:00:00.000Z",
  current: retentionPolicyRow(2),
  latest: retentionPolicyRow(4),
  nextScheduled: retentionPolicyRow(3),
  history: [4, 3, 2, 1].map(retentionPolicyRow),
});
describe("retention policy authoritative state", () => {
  it("distinguishes current from highest version and permits a current policy outside bounded history", () => {
    expect(parseRetentionWorkspace(state()).current?.version).toBe(2);
    expect(
      parseRetentionWorkspace({ ...state(), history: [retentionPolicyRow(4)] }).current
        ?.version,
    ).toBe(2);
  });
  it("rejects contradictory dates, keys, latest and history order", () => {
    for (const bad of [
      { ...state(), current: retentionPolicyRow(3) },
      { ...state(), nextScheduled: retentionPolicyRow(2) },
      { ...state(), latest: retentionPolicyRow(3) },
      { ...state(), history: [retentionPolicyRow(4), retentionPolicyRow(4)] },
      { ...state(), current: { ...retentionPolicyRow(2), key: "refund" } },
    ])
      expect(() => parseRetentionWorkspace(bad)).toThrow();
  });
  it("requires exact provenance, settings, effective time and approver in a publication receipt", () => {
    const row = retentionPolicyRow(4),
      body = {
        expectedVersion: 3,
        effectiveAt: row.effectiveAt,
        source: row.source,
        approvalEvidence: row.approvalEvidence!,
        settings: row.settings,
      };
    expect(validateRetentionReceipt(row, body, id(302))).toEqual(row);
    const originalSettings = retentionSettingsSchema.parse(row.settings);
    for (const change of [
      { approvedByUserId: id(999) },
      { version: 5 },
      { approvalEvidence: "other" },
      { sourceQuestion: "other" },
      { sourceSignatory: "unexpected" },
      { effectiveAt: "2030-01-05T07:31:00Z" },
      {
        settings: {
          ...originalSettings,
          records: [{ ...originalSettings.records[0], retentionMonths: 83 }],
        },
      },
      {
        settings: {
          ...originalSettings,
          records: [{ ...originalSettings.records[0], unexpected: true }],
        },
      },
      {
        settings: {
          ...(row.settings as object),
          destructiveExecutionEnabled: true,
        },
      },
    ])
      expect(() =>
        validateRetentionReceipt({ ...row, ...change }, body, id(302)),
      ).toThrow();
  });
});
