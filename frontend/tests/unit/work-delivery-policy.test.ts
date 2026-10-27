import { it, expect } from "vitest";
import {
  parseDeliveryWorkspace,
  validateDeliveryReceipt,
} from "@/lib/admin/work-delivery-policy";
import {
  deliveryPolicyRow,
  deliverySettings,
  id,
} from "../fixtures/work-delivery-policy";
const state = () => ({
  evaluatedAt: "2026-10-19T09:00:00Z",
  current: deliveryPolicyRow(2),
  latest: deliveryPolicyRow(4),
  nextScheduled: deliveryPolicyRow(3),
  history: [4, 3, 2, 1].map(deliveryPolicyRow),
  availability: { checkoutEnabled: true, deliveryEnabled: true },
});
it("separates effective, latest, scheduled and checkout availability", () => {
  expect(parseDeliveryWorkspace(state()).current?.version).toBe(2);
  expect(
    parseDeliveryWorkspace({ ...state(), history: [deliveryPolicyRow(4)] }).current
      ?.version,
  ).toBe(2);
  expect(
    parseDeliveryWorkspace({
      ...state(),
      availability: { checkoutEnabled: false, deliveryEnabled: false },
    }).availability.deliveryEnabled,
  ).toBe(false);
});
it("rejects contradictory selections, foreign policy and impossible availability", () => {
  for (const bad of [
    { ...state(), current: deliveryPolicyRow(3) },
    { ...state(), latest: deliveryPolicyRow(3) },
    { ...state(), nextScheduled: deliveryPolicyRow(2) },
    { ...state(), current: { ...deliveryPolicyRow(2), key: "finance" } },
    { ...state(), history: [deliveryPolicyRow(4), deliveryPolicyRow(4)] },
    { ...state(), availability: { checkoutEnabled: false, deliveryEnabled: true } },
    {
      ...state(),
      current: { ...deliveryPolicyRow(2), approvalStatus: "DRAFT_OWNER_APPROVAL" },
    },
  ])
    expect(() => parseDeliveryWorkspace(bad)).toThrow();
});
it("validates exact Q1 provenance and nested zones, including zero and maximum fees", () => {
  const row = deliveryPolicyRow(4),
    body = {
      expectedVersion: 3,
      effectiveAt: row.effectiveAt,
      source: row.source,
      approvalEvidence: row.approvalEvidence,
      settings: deliverySettings,
    };
  expect(validateDeliveryReceipt(row, body, id(3))).toEqual(row);
  for (const feeKobo of ["0", "999999999999999"]) {
    const settings = {
      ...deliverySettings,
      zones: [{ ...deliverySettings.zones[0]!, feeKobo }],
    };
    expect(
      validateDeliveryReceipt({ ...row, settings }, { ...body, settings }, id(3))
        .settings,
    ).toEqual(settings);
  }
  for (const change of [
    { approvedByUserId: id(9) },
    { version: 5 },
    { sourceQuestion: "Q9" },
    { sourceSignatory: "unexpected" },
    { approvalEvidence: "other" },
    { effectiveAt: "2048-01-01T00:00:00Z" },
    {
      settings: {
        ...deliverySettings,
        zones: [{ ...deliverySettings.zones[0]!, feeKobo: "249999" }],
      },
    },
    {
      settings: {
        ...deliverySettings,
        zones: [{ ...deliverySettings.zones[0]!, unexpected: true }],
      },
    },
    {
      settings: {
        ...deliverySettings,
        zones: [deliverySettings.zones[0], deliverySettings.zones[0]],
      },
    },
    { settings: { ...deliverySettings, collectionAddress: "Other address" } },
  ])
    expect(() => validateDeliveryReceipt({ ...row, ...change }, body, id(3))).toThrow();
});
