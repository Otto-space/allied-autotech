import { it, expect } from "vitest";
import {
  parseReservationWorkspace,
  validateReservationReceipt,
} from "@/lib/admin/work-reservation-policy";
import {
  reservationPolicyRow as row,
  reservationSettings,
  id,
} from "../fixtures/work-reservation-policy";
const state = () => ({
  evaluatedAt: "2026-10-19T09:00:00Z",
  current: row(2),
  latest: row(4),
  nextScheduled: row(3),
  history: [4, 3, 2, 1].map(row),
});
it("separates current agreement, scheduled withdrawal and later enabled revision beyond bounded history", () => {
  expect(parseReservationWorkspace(state()).nextScheduled?.settings).toMatchObject({
    enabled: false,
  });
  expect(
    parseReservationWorkspace({ ...state(), history: [row(4)] }).current?.version,
  ).toBe(2);
  expect(
    parseReservationWorkspace({
      evaluatedAt: state().evaluatedAt,
      current: null,
      latest: null,
      nextScheduled: null,
      history: [],
    }).current,
  ).toBeNull();
});
it("rejects foreign, duplicate and contradictory revision selections", () => {
  for (const bad of [
    { ...state(), current: row(3) },
    { ...state(), latest: row(3) },
    { ...state(), nextScheduled: row(4) },
    { ...state(), current: { ...row(2), key: "finance" } },
    { ...state(), history: [row(4), row(4)] },
    { ...state(), current: null },
  ])
    expect(() => parseReservationWorkspace(bad)).toThrow();
});
it("binds exact Q3 actor, metadata and publish/withdraw text in receipts", () => {
  for (const settings of [
    reservationSettings,
    { enabled: false, reason: "Synthetic withdrawal" },
  ]) {
    const saved = { ...row(4), settings },
      body = {
        expectedVersion: 3,
        effectiveAt: saved.effectiveAt,
        source: saved.source,
        approvalEvidence: saved.approvalEvidence,
        settings,
      };
    expect(validateReservationReceipt(saved, body, id(3))).toEqual(saved);
    for (const change of [
      { approvedByUserId: id(9) },
      { version: 5 },
      { sourceQuestion: "Q1" },
      { sourceSignatory: "unexpected" },
      { approvalEvidence: "other" },
      { effectiveAt: "2048-01-01T00:00:00Z" },
      { settings: { ...settings, unexpected: true } },
      { settings: { enabled: true, title: "Changed", body: "Changed" } },
    ])
      expect(() =>
        validateReservationReceipt({ ...saved, ...change }, body, id(3)),
      ).toThrow();
  }
});
it("preserves literal text and rejects invalid settings instead of accepting another operation", () => {
  const settings = {
      ...reservationSettings,
      body: '<script>alert("synthetic")</script>\n' + "x".repeat(49900),
    },
    saved = { ...row(4), settings },
    body = {
      expectedVersion: 3,
      effectiveAt: saved.effectiveAt,
      source: saved.source,
      approvalEvidence: saved.approvalEvidence,
      settings,
    };
  expect(validateReservationReceipt(saved, body, id(3)).settings).toEqual(settings);
  for (const bodyText of ["", "x".repeat(50001), "bad\u0000text"]) {
    const value = { ...settings, body: bodyText };
    expect(() =>
      validateReservationReceipt(
        { ...saved, settings: value },
        { ...body, settings: value },
        id(3),
      ),
    ).toThrow();
  }
});
