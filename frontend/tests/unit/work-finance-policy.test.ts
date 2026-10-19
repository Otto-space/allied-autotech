import { describe, it, expect } from "vitest";
import {
  parseFinanceWorkspace,
  validateFinanceReceipt,
} from "@/lib/admin/work-finance-policy";
import { financePolicyRow, id } from "../fixtures/work-finance-policy";
const state = () => ({
  evaluatedAt: "2026-10-18T09:00:00.000Z",
  current: financePolicyRow(2),
  latest: financePolicyRow(4),
  nextScheduled: financePolicyRow(3),
  history: [4, 3, 2, 1].map(financePolicyRow),
});
describe("financial policy authoritative state", () => {
  it("distinguishes current from highest version and permits a current policy outside bounded history", () => {
    expect(parseFinanceWorkspace(state()).current?.version).toBe(2);
    expect(
      parseFinanceWorkspace({ ...state(), history: [financePolicyRow(4)] }).current
        ?.version,
    ).toBe(2);
  });
  it("rejects contradictory dates, keys, latest and history order", () => {
    for (const bad of [
      { ...state(), current: financePolicyRow(3) },
      { ...state(), nextScheduled: financePolicyRow(2) },
      { ...state(), latest: financePolicyRow(3) },
      { ...state(), history: [financePolicyRow(4), financePolicyRow(4)] },
      { ...state(), current: { ...financePolicyRow(2), key: "refund" } },
    ])
      expect(() => parseFinanceWorkspace(bad)).toThrow();
  });
  it("requires exact provenance, settings, effective time and approver in a publication receipt", () => {
    const row = financePolicyRow(4),
      body = {
        expectedVersion: 3,
        effectiveAt: row.effectiveAt,
        source: row.source,
        approvalEvidence: row.approvalEvidence!,
        settings: row.settings,
      };
    expect(validateFinanceReceipt(row, body, id(302))).toEqual(row);
    for (const change of [
      { approvedByUserId: id(999) },
      { version: 5 },
      { approvalEvidence: "other" },
      { sourceQuestion: "other" },
      { sourceSignatory: "unexpected" },
      { effectiveAt: "2030-01-05T07:31:00Z" },
      { settings: { ...(row.settings as object), deliveryTaxable: false } },
    ])
      expect(() =>
        validateFinanceReceipt({ ...row, ...change }, body, id(302)),
      ).toThrow();
  });
});
