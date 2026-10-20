import { describe, it, expect } from "vitest";
import {
  parseComplaintWorkspace,
  validateComplaintReceipt,
} from "@/lib/admin/work-complaint-policy";
import { complaintPolicyRow, id } from "../fixtures/work-complaint-policy";
const state = () => ({
  evaluatedAt: "2026-10-18T09:00:00.000Z",
  current: complaintPolicyRow(2),
  latest: complaintPolicyRow(4),
  nextScheduled: complaintPolicyRow(3),
  history: [4, 3, 2, 1].map(complaintPolicyRow),
});
describe("complaint policy authoritative state", () => {
  it("distinguishes current from highest version and permits a current policy outside bounded history", () => {
    expect(parseComplaintWorkspace(state()).current?.version).toBe(2);
    expect(
      parseComplaintWorkspace({ ...state(), history: [complaintPolicyRow(4)] }).current
        ?.version,
    ).toBe(2);
  });
  it("rejects contradictory dates, keys, latest and history order", () => {
    for (const bad of [
      { ...state(), current: complaintPolicyRow(3) },
      { ...state(), nextScheduled: complaintPolicyRow(2) },
      { ...state(), latest: complaintPolicyRow(3) },
      { ...state(), history: [complaintPolicyRow(4), complaintPolicyRow(4)] },
      { ...state(), current: { ...complaintPolicyRow(2), key: "refund" } },
    ])
      expect(() => parseComplaintWorkspace(bad)).toThrow();
  });
  it("requires exact provenance, settings, effective time and approver in a publication receipt", () => {
    const row = complaintPolicyRow(4),
      body = {
        expectedVersion: 3,
        effectiveAt: row.effectiveAt,
        source: row.source,
        approvalEvidence: row.approvalEvidence!,
        settings: row.settings,
      };
    expect(validateComplaintReceipt(row, body, id(302))).toEqual(row);
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
          urgentClassifications: ["Different classification"],
        },
      },
    ])
      expect(() =>
        validateComplaintReceipt({ ...row, ...change }, body, id(302)),
      ).toThrow();
  });
});
