import { it, expect } from "vitest";
import { parseCandidates, parseInvitations } from "@/lib/api/team-access-schemas";
import {
  invitationQuery,
  invitationPageParams,
} from "@/lib/admin/work-staff-invitations";
const id = "b0000000-0000-4000-8000-000000000001";
const customer = {
  id,
  email: "candidate@example.test",
  role: "CUSTOMER",
  profile: { firstName: "Synthetic", lastName: "Candidate" },
  staffProfile: null,
  management: { canPromote: true, canInvite: false },
};
it("candidate inspection binds exact email and refuses contradictory promotion eligibility", () => {
  expect(
    parseCandidates({ items: [customer] }, "CANDIDATE@example.test").items,
  ).toHaveLength(1);
  expect(() => parseCandidates({ items: [customer] }, "another@example.test")).toThrow();
  expect(() => parseCandidates({ items: [{ ...customer, profile: null }] })).toThrow();
  expect(() => parseCandidates({ items: [customer, customer] })).toThrow();
});
it("preserves status and cursor history without accepting email or malformed filters", () => {
  const first = invitationQuery(new URLSearchParams("status=PENDING"));
  const next = invitationPageParams(first.params, id);
  expect(invitationQuery(next).invalid).toBe(false);
  expect(next.get("status")).toBe("PENDING");
  expect(next.get("_trail")).toBe("start");
  expect(invitationPageParams(next, undefined, true).toString()).toBe("status=PENDING");
  for (const query of [
    "status=ACTIVE",
    "status=PENDING&status=REVOKED",
    "email=private@example.test",
    "cursor=invalid",
    `_trail=start,${id}&cursor=${id}`,
  ])
    expect(invitationQuery(new URLSearchParams(query)).path).toBeNull();
});
it("rejects mismatched owner, filter, lifecycle, duplicate and non-advancing invitation results", () => {
  const row = {
    id,
    email: customer.email,
    role: "ADMIN",
    recipientId: id,
    invitedById: id,
    status: "PENDING",
    createdAt: "2026-10-18T08:00:00Z",
    expiresAt: "2026-10-25T08:00:00Z",
    usedAt: null,
    revokedAt: null,
  };
  expect(
    parseInvitations({ items: [row] }, new URLSearchParams("status=PENDING"), {
      id,
      role: "ADMIN",
    }).items,
  ).toHaveLength(1);
  expect(() =>
    parseInvitations({ items: [row] }, new URLSearchParams("status=REVOKED")),
  ).toThrow();
  expect(() =>
    parseInvitations({ items: [row] }, new URLSearchParams(), {
      id: "other",
      role: "ADMIN",
    }),
  ).toThrow();
  expect(() => parseInvitations({ items: [row, row] })).toThrow();
  expect(() =>
    parseInvitations(
      { items: [row], nextCursor: id },
      new URLSearchParams(`cursor=${id}`),
    ),
  ).toThrow();
  expect(() => parseInvitations({ items: [{ ...row, status: "ACCEPTED" }] })).toThrow();
});
it("administrator invitation eligibility requires a matching active staff branch", () => {
  const staff = {
    ...customer,
    role: "STAFF",
    profile: null,
    staffProfile: {
      firstName: "Synthetic",
      lastName: "Staff",
      branchId: id,
      branch: { id, name: "Synthetic workshop", code: "TEST", isActive: true },
    },
    management: { canPromote: false, canInvite: true },
  };
  expect(parseCandidates({ items: [staff] }).items).toHaveLength(1);
  expect(() =>
    parseCandidates({
      items: [
        {
          ...staff,
          staffProfile: {
            ...staff.staffProfile,
            branch: { ...staff.staffProfile.branch, isActive: false },
          },
        },
      ],
    }),
  ).toThrow();
  expect(() =>
    parseCandidates({
      items: [{ ...staff, staffProfile: { ...staff.staffProfile, branchId: null } }],
    }),
  ).toThrow();
});
