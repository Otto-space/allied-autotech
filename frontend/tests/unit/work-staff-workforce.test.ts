import { expect, it } from "vitest";
import {
  workforceBody,
  workforceLocalTime,
  verifyWorkforceReceipt,
} from "@/lib/admin/work-staff-workforce";
import { parseWorkforceAccount } from "@/lib/api/workforce-schemas";
import { staffWorkforceRecord, id } from "../fixtures/work-staff-detail";
const actor = id(302),
  stamp = "2026-10-19T08:00:00.000Z";
it("rejects invalid dates, reversed intervals and short reasons without accepting password metadata in receipts", () => {
  expect(() => workforceLocalTime("2026-02-30T10:00")).toThrow();
  expect(() => workforceLocalTime("not a date")).toThrow();
  expect(workforceLocalTime("2026-10-19T10:15")).toMatch(/^2026-10-19T/);
  expect(() =>
    workforceBody("assign", {
      currentPassword: "synthetic",
      reason: "Reviewed assignment",
      expectedVersion: 0,
      template: "WORKSHOP_LEAD",
      branchId: id(101),
      temporary: false,
      startsAt: stamp,
      expiresAt: "2026-10-18T08:00:00.000Z",
    }),
  ).toThrow();
  expect(() =>
    workforceBody("revoke", {
      currentPassword: "synthetic",
      reason: "short",
      expectedVersion: 1,
    }),
  ).toThrow();
});
it("validates target, actor, version and preserved delegation in enrollment and delegation receipts", () => {
  const r = staffWorkforceRecord(),
    receipt = {
      userId: r.userId,
      position: "WORKSHOP_LEAD",
      enabledAt: stamp,
      updatedByUserId: actor,
      version: 0,
      delegatedTemplates: [],
      delegatedBranchIds: [],
      delegationPolicyVersion: 1,
    };
  const body = { position: "WORKSHOP_LEAD", expectedVersion: null };
  expect(verifyWorkforceReceipt(receipt, "enroll", r.userId, actor, body, r)).toEqual(
    receipt,
  );
  for (const change of [
    { userId: actor },
    { version: 1 },
    { updatedByUserId: r.userId },
    { position: "ACCOUNTANT" },
    { currentPassword: "must-not-appear" },
    { delegationPolicyVersion: 2 },
  ])
    expect(() =>
      verifyWorkforceReceipt(
        { ...receipt, ...change },
        "enroll",
        r.userId,
        actor,
        body,
        r,
      ),
    ).toThrow();
  r.access = receipt;
  const delegated = {
      ...receipt,
      version: 1,
      delegatedTemplates: ["WORKSHOP_LEAD", "ADMIN_INVITE"],
      delegatedBranchIds: [id(101)],
    },
    input = {
      templates: ["WORKSHOP_LEAD"],
      branchIds: [id(101)],
      allowAdminInvitations: true,
    };
  expect(
    verifyWorkforceReceipt(delegated, "delegate", r.userId, actor, input, r),
  ).toEqual(delegated);
  expect(() =>
    verifyWorkforceReceipt(
      { ...delegated, delegatedBranchIds: [] },
      "delegate",
      r.userId,
      actor,
      input,
      r,
    ),
  ).toThrow();
});
it("validates every assignment and revocation fact and rejects replayed assignment IDs", () => {
  const r = staffWorkforceRecord(),
    body = {
      template: "WORKSHOP_LEAD",
      branchId: id(101),
      temporary: true,
      startsAt: stamp,
      expiresAt: null,
      reason: "Reviewed temporary cover",
    };
  const receipt = {
    id: id(890),
    templateVersion: 1,
    userId: r.userId,
    ...body,
    scope: "BRANCH" as const,
    assignedByUserId: actor,
    createdAt: stamp,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  };
  expect(verifyWorkforceReceipt(receipt, "assign", r.userId, actor, body, r)).toEqual(
    receipt,
  );
  for (const change of [
    { temporary: false },
    { branchId: id(102) },
    { reason: "Different reason" },
    { startsAt: "2026-10-20T08:00:00.000Z" },
    { scope: "ASSIGNED" },
    { templateVersion: 2 },
  ])
    expect(() =>
      verifyWorkforceReceipt(
        { ...receipt, ...change },
        "assign",
        r.userId,
        actor,
        body,
        r,
      ),
    ).toThrow();
  r.assignments = [receipt];
  expect(() =>
    verifyWorkforceReceipt(receipt, "assign", r.userId, actor, body, r),
  ).toThrow();
  const revoked = {
    ...receipt,
    revokedAt: stamp,
    revokedByUserId: actor,
    revocationReason: "Cover completed and reviewed",
  };
  expect(
    verifyWorkforceReceipt(
      revoked,
      "revoke",
      r.userId,
      actor,
      { reason: revoked.revocationReason },
      r,
      receipt.id,
    ),
  ).toEqual(revoked);
  expect(() =>
    verifyWorkforceReceipt(
      { ...revoked, reason: "Altered assignment" },
      "revoke",
      r.userId,
      actor,
      { reason: revoked.revocationReason },
      r,
      receipt.id,
    ),
  ).toThrow();
});
it("rejects cross-account assignments and false active/branch scope in inspection", () => {
  const r = staffWorkforceRecord();
  expect(parseWorkforceAccount(r)).toEqual(r);
  expect(() => parseWorkforceAccount({ ...r, activeAssignmentIds: [id(999)] })).toThrow();
  expect(() =>
    parseWorkforceAccount({
      ...r,
      management: { ...r.management, branchIds: [id(999)] },
    }),
  ).toThrow();
  expect(() =>
    parseWorkforceAccount({ ...r, branches: [r.branches[0], r.branches[0]] }),
  ).toThrow();
});
it("does not label an unsupported or missing definition as an active grant", () => {
  const r = staffWorkforceRecord(),
    assignment = {
      id: id(890),
      userId: r.userId,
      template: "WORKSHOP_LEAD" as const,
      templateVersion: 99,
      branchId: id(101),
      scope: "BRANCH" as const,
      temporary: false,
      startsAt: stamp,
      expiresAt: null,
      reason: "Synthetic unsupported historical definition",
      assignedByUserId: actor,
      createdAt: stamp,
      revokedAt: null,
      revokedByUserId: null,
      revocationReason: null,
    };
  r.assignments = [assignment];
  r.assignmentDefinitions = { [assignment.id]: null };
  expect(parseWorkforceAccount(r)).toEqual(r);
  expect(() =>
    parseWorkforceAccount({ ...r, activeAssignmentIds: [assignment.id] }),
  ).toThrow();
  expect(() => parseWorkforceAccount({ ...r, assignmentDefinitions: {} })).toThrow();
  expect(() =>
    parseWorkforceAccount({
      ...r,
      assignmentDefinitions: {
        [assignment.id]: {
          label: "Wrong scope",
          department: "Services",
          scope: "ASSIGNED",
          actions: [],
        },
      },
    }),
  ).toThrow();
});
