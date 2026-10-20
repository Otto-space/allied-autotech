import { it, expect } from "vitest";
import {
  parseRefundTimingWorkspace,
  validateRefundTimingReceipt,
} from "@/lib/admin/work-refund-timing";
import {
  refundTimingPolicyRow as row,
  refundTimingSettings,
  id,
} from "../fixtures/work-refund-timing";
const state = () => ({
  evaluatedAt: "2026-10-19T09:00:00Z",
  current: row(2),
  latest: row(4),
  nextScheduled: row(3),
  history: [4, 3, 2, 1].map(row),
});
it("selects current outside history cap and supports a genuinely empty policy", () => {
  expect(
    parseRefundTimingWorkspace({ ...state(), history: [row(4)] }).current?.version,
  ).toBe(2);
  expect(
    parseRefundTimingWorkspace({
      evaluatedAt: state().evaluatedAt,
      current: null,
      latest: null,
      nextScheduled: null,
      history: [],
    }).current,
  ).toBeNull();
});
it("matches version-first selection and ignores future lower versions that cannot supersede current", () => {
  const current = { ...row(4), effectiveAt: "2025-01-01T00:00:00Z" };
  expect(
    parseRefundTimingWorkspace({
      ...state(),
      current,
      latest: current,
      nextScheduled: null,
      history: [current, row(3), row(2), row(1)],
    }).current?.version,
  ).toBe(4);
  expect(() =>
    parseRefundTimingWorkspace({
      ...state(),
      current,
      latest: current,
      nextScheduled: row(3),
      history: [current, row(3), row(2)],
    }),
  ).toThrow();
});
it("rejects wrong status, foreign key, duplicate, missing or contradictory selections", () => {
  for (const bad of [
    { ...state(), current: row(3) },
    { ...state(), latest: row(3) },
    { ...state(), nextScheduled: row(4) },
    { ...state(), current: { ...row(2), key: "finance" } },
    { ...state(), history: [row(4), row(4)] },
    { ...state(), current: null },
    { ...state(), current: { ...row(2), approvalStatus: "UNAPPROVED" } },
    { ...state(), nextScheduled: { ...row(3), settings: {} } },
  ])
    expect(() => parseRefundTimingWorkspace(bad)).toThrow();
});
it("skips unapproved future revisions and tie-breaks future activation by highest version", () => {
  const draft = { ...row(3), approvalStatus: "UNAPPROVED" };
  expect(
    parseRefundTimingWorkspace({
      ...state(),
      nextScheduled: row(4),
      history: [row(4), draft, row(2), row(1)],
    }).nextScheduled?.version,
  ).toBe(4);
  const future = { ...row(4), effectiveAt: row(3).effectiveAt };
  expect(
    parseRefundTimingWorkspace({
      ...state(),
      latest: future,
      nextScheduled: future,
      history: [future, row(3), row(2)],
    }).nextScheduled?.version,
  ).toBe(4);
});
it("binds exact Q6 actor, calendar and approval metadata in receipts", () => {
  const saved = row(4),
    body = {
      expectedVersion: 3,
      effectiveAt: saved.effectiveAt,
      source: saved.source,
      approvalEvidence: saved.approvalEvidence,
      settings: refundTimingSettings,
    };
  expect(validateRefundTimingReceipt(saved, body, id(3))).toEqual(saved);
  for (const change of [
    { approvedByUserId: id(9) },
    { version: 5 },
    { sourceQuestion: "Q3" },
    { sourceSignatory: "unexpected" },
    { approvalEvidence: "other" },
    { effectiveAt: "2048-01-01T00:00:00Z" },
    { settings: { ...refundTimingSettings, unexpected: true } },
    { settings: { ...refundTimingSettings, startEvent: "REQUESTED" } },
    { settings: { ...refundTimingSettings, holidays: [] } },
    { settings: { ...refundTimingSettings, businessDays: 11 } },
  ])
    expect(() =>
      validateRefundTimingReceipt({ ...saved, ...change }, body, id(3)),
    ).toThrow();
});
