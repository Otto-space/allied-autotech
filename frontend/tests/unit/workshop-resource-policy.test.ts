// @vitest-environment jsdom
import { invalidateSession } from "@/lib/api/client";
import { workshopResourceSettingsSchema } from "@/lib/admin/workshop-resource-settings";
import { readCapacityPolicyPending } from "@/lib/admin/work-capacity-policy-pending";
import { beforeEach, it, expect, vi } from "vitest";
import {
  parseResourceWorkspace,
  validateResourceReceipt,
} from "@/lib/admin/workshop-resource-policy";
import {
  readResourcePolicyPending,
  markResourcePolicyPending,
  clearResourcePolicyPending,
  redactResourcePolicyChanges,
} from "@/lib/admin/workshop-resource-pending";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  resourceId as id,
  resourceRow,
  resourceSettings,
} from "../fixtures/workshop-resources";
const state = () => ({
  evaluatedAt: "2026-10-19T09:00:00Z",
  branch: {
    id: id(1),
    name: "Synthetic workshop",
    isActive: true,
    updatedAt: "2026-10-18T08:00:00Z",
  },
  current: resourceRow(2),
  nextScheduled: resourceRow(3),
  latest: resourceRow(4),
  history: [4, 3, 2, 1].map((v) => resourceRow(v)),
});
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${id(3)}:SUPER_ADMIN`);
});
it("selects effective policy independently of latest and permits bounded history", () => {
  expect(parseResourceWorkspace(state(), id(1)).current?.version).toBe(2);
  expect(
    parseResourceWorkspace({ ...state(), history: [resourceRow(4)] }, id(1)).current
      ?.version,
  ).toBe(2);
});
it("rejects another branch, inconsistent schedule, duplicate versions and wrong latest", () => {
  for (const bad of [
    { ...state(), branch: { ...state().branch, id: id(9) } },
    { ...state(), current: resourceRow(2, id(9)) },
    { ...state(), current: resourceRow(3) },
    { ...state(), nextScheduled: resourceRow(2) },
    { ...state(), latest: resourceRow(3) },
    { ...state(), history: [resourceRow(4), resourceRow(4)] },
  ])
    expect(() => parseResourceWorkspace(bad, id(1))).toThrow();
});
it("requires exact branch, approver, D06-D07 provenance, date and settings in approval receipt", () => {
  const row = resourceRow(4),
    body = {
      branchId: id(1),
      expectedVersion: 3,
      effectiveAt: row.effectiveAt,
      source: row.source,
      approvalEvidence: row.approvalEvidence,
      settings: resourceSettings,
    };
  expect(validateResourceReceipt(row, body, id(3))).toEqual(row);
  for (const change of [
    { key: `booking-resources:${id(9)}` },
    { approvedByUserId: id(9) },
    { version: 5 },
    { sourceQuestion: "Q13" },
    { sourceSignatory: "other" },
    { approvalEvidence: "other" },
    { effectiveAt: "2048-01-01T00:00:00Z" },
    { settings: { ...resourceSettings, resources: [] } },
    { settings: { ...resourceSettings, extra: true } },
    { settings: { ...resourceSettings, technicians: [] } },
  ])
    expect(() => validateResourceReceipt({ ...row, ...change }, body, id(3))).toThrow();
});
it("isolates pending approvals by branch and requires the matching token", () => {
  const marker = { expectedVersion: 4, fingerprint: "a".repeat(64) },
    saved = markResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), marker);
  expect(readResourcePolicyPending(id(3), "SUPER_ADMIN", id(9))).toBeUndefined();
  expect(() => markResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), marker)).toThrow();
  const second = markResourcePolicyPending(id(3), "SUPER_ADMIN", id(9), marker);
  expect(() =>
    clearResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), second.token),
  ).toThrow();
  clearResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), saved.token);
  expect(readResourcePolicyPending(id(3), "SUPER_ADMIN", id(9))).toEqual(second);
});
it("redacts every branch marker and fails closed on account change or unavailable storage", () => {
  const marker = { expectedVersion: 4, fingerprint: "a".repeat(64) };
  for (const n of [1, 9]) markResourcePolicyPending(id(3), "SUPER_ADMIN", id(n), marker);
  redactResourcePolicyChanges();
  for (const n of [1, 9])
    expect(readResourcePolicyPending(id(3), "SUPER_ADMIN", id(n))).toBe("unknown");
  clearResourcePolicyPending(id(3), "SUPER_ADMIN", id(1));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => markResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), marker)).toThrow();
  setDraftIdentity("other:SUPER_ADMIN");
  expect(() => clearResourcePolicyPending(id(3), "SUPER_ADMIN", id(9))).toThrow();
});

it("requires explicit service assessments, real cross-references and non-overlapping working periods", () => {
  expect(workshopResourceSettingsSchema.safeParse(resourceSettings).success).toBe(true);
  const independent = structuredClone(resourceSettings);
  independent.services[0]!.requirements = [];
  independent.resources = [];
  expect(workshopResourceSettingsSchema.safeParse(independent).success).toBe(true);
  for (const change of [
    { ...resourceSettings, services: [] },
    {
      ...resourceSettings,
      technicians: [{ ...resourceSettings.technicians[0], serviceIds: [id(99)] }],
    },
    {
      ...resourceSettings,
      resources: [
        {
          ...resourceSettings.resources[0],
          workingPeriods: [
            { weekday: 1, opensAt: "08:00", closesAt: "12:00" },
            { weekday: 1, opensAt: "11:00", closesAt: "18:00" },
          ],
        },
      ],
    },
    {
      ...resourceSettings,
      services: [
        { serviceId: id(32), requirements: [{ pool: "absent-pool", quantity: 1 }] },
      ],
    },
    {
      ...resourceSettings,
      resources: [
        {
          ...resourceSettings.resources[0],
          unavailablePeriods: [
            {
              startsAt: "2030-01-01T12:00:00Z",
              endsAt: "2030-01-01T11:00:00Z",
              reason: "Synthetic maintenance",
            },
          ],
        },
      ],
    },
  ])
    expect(workshopResourceSettingsSchema.safeParse(change).success).toBe(false);
});
it("stores only an opaque reference, version and fingerprint, isolated from capacity recovery", () => {
  const marker = { expectedVersion: 4, fingerprint: "b".repeat(64) };
  markResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), marker);
  const raw = Object.values(sessionStorage).join(" ");
  expect(raw).not.toContain("Synthetic alignment");
  expect(raw).not.toContain("workingPeriods");
  expect(raw).not.toContain("approvalEvidence");
  const row = readResourcePolicyPending(id(3), "SUPER_ADMIN", id(1));
  expect(row).not.toBe("unknown");
  expect(Object.keys(row!).sort()).toEqual(["expectedVersion", "fingerprint", "token"]);
  expect(readCapacityPolicyPending(id(3), "SUPER_ADMIN", id(1))).toBeUndefined();
});

it("redacts resource recovery through the shared session invalidation path", () => {
  markResourcePolicyPending(id(3), "SUPER_ADMIN", id(1), {
    expectedVersion: 4,
    fingerprint: "c".repeat(64),
  });
  invalidateSession();
  expect(readResourcePolicyPending(id(3), "SUPER_ADMIN", id(1))).toBe("unknown");
  expect(
    sessionStorage.getItem(`aat:resource-policy:v1:${id(3)}:SUPER_ADMIN:${id(1)}`),
  ).toBe("pending");
});
