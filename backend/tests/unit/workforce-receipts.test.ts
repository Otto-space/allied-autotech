import { expect, it } from "vitest";
import { projectWorkforceMutationReceipt } from "../../src/modules/organization/workforce-receipts.js";

it("keeps legacy mutation acknowledgements stable without reflecting new database columns", () => {
  const legacy = {
    id: "fixture",
    userId: "person",
    template: "OPERATIONS",
    branchId: "branch",
    scope: "BRANCH",
    temporary: false,
    startsAt: "start",
    expiresAt: null,
    reason: "Reviewed fixture",
    assignedByUserId: "owner",
    createdAt: "created",
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  };
  const row = { ...legacy, templateVersion: 1, futurePrivateColumn: "must not leak" };
  expect(projectWorkforceMutationReceipt("assign", row, undefined)).toEqual(legacy);
  expect(projectWorkforceMutationReceipt("revoke", row, 2)).toEqual({
    ...legacy,
    templateVersion: 1,
  });
});
it("opts in only the supported access metadata and leaves read projections to their own contracts", () => {
  const legacy = {
    userId: "person",
    position: "OPERATIONS",
    enabledAt: "time",
    updatedByUserId: "owner",
    version: 1,
    delegatedTemplates: [],
    delegatedBranchIds: [],
  };
  const row = {
    ...legacy,
    delegationPolicyVersion: 1,
    futurePrivateColumn: "must not leak",
  };
  expect(projectWorkforceMutationReceipt("enroll", row, undefined)).toEqual(legacy);
  expect(projectWorkforceMutationReceipt("delegate", row, 2)).toEqual({
    ...legacy,
    delegationPolicyVersion: 1,
  });
  expect(projectWorkforceMutationReceipt("inspect", row, undefined)).toBe(row);
});
