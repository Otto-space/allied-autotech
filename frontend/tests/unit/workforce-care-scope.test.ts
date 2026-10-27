import { expect, it } from "vitest";
import { careCaseAllows } from "@/lib/workforce-care";
import { workforceDestinationAllowed } from "@/lib/workforce-registry";
import {
  canReplyEnquiry,
  canAssignEnquiry,
  parseWorkforceEnquiry,
  validateEnquiryReceipt,
  parseWorkforceEnquiryCandidates,
  type WorkforceEnquiry,
} from "@/lib/admin/workforce-enquiries";
import {
  canReplyComplaint,
  canAssignComplaint,
  parseWorkforceComplaint,
  parseWorkforceComplaintCandidates,
  validateComplaintReceipt,
  type WorkforceComplaint,
} from "@/lib/admin/workforce-complaints";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";
import {
  aftercareFixtureData,
  aftercareSnapshot,
  aftercareId as id,
} from "../fixtures/workforce-aftercare-data";
import { definitionForAssignment } from "../../../backend/src/modules/organization/workforce-catalogue";
type Duty = "CARE_VIEWER" | "CARE_RESPONDER" | "CARE_ASSIGNER" | "CARE_LIVE_AGENT";
const branch = id(4),
  stamp = "2026-10-19T08:00:00.000Z";
function accessFor(...duties: [Duty, string?][]): WorkforceAccess {
  const access = aftercareFixtureData().access,
    base = access.assignments[0];
  access.independentCapabilities = [];
  access.position = "CUSTOMER_SERVICE";
  access.assignments = duties.map(([template, branchId = branch], i) => ({
    ...base,
    id: id(700 + i),
    template,
    templateVersion: 2,
    branchId,
  }));
  access.permissions = [
    ...new Set(
      access.assignments.flatMap((a) => [
        ...definitionForAssignment({ ...a, templateVersion: 2 })!.actions,
      ]),
    ),
  ];
  return aftercareSnapshot(access, "STAFF");
}
function enquiry(access: WorkforceAccess): WorkforceEnquiry {
  return {
    id: id(800),
    branchId: branch,
    branch: { id: branch, name: "Synthetic branch" },
    assignedStaffId: null,
    assignedStaff: null,
    type: "GENERAL",
    status: "OPEN",
    version: 0,
    subject: "Synthetic Care question",
    message: "Synthetic customer-visible content",
    contact: {
      name: "Synthetic customer",
      email: "synthetic@example.test",
      phone: null,
      customerId: null,
    },
    createdAt: stamp,
    updatedAt: stamp,
    generatedAt: stamp,
    latestMessageId: null,
    messages: { items: [] },
    access,
  };
}
function complaint(access: WorkforceAccess): WorkforceComplaint {
  return {
    id: id(801),
    branchId: branch,
    branch: { id: branch, name: "Synthetic branch" },
    assignedStaffId: null,
    assignedStaff: null,
    priority: "MEDIUM",
    status: "OPEN",
    version: 0,
    subject: "Synthetic Care complaint",
    description: "Synthetic customer-visible content",
    acknowledgedAt: null,
    acknowledgementDueAt: null,
    escalatedAt: null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    generatedAt: stamp,
    latestMessageId: null,
    messages: { items: [] },
    access,
  };
}
for (const duty of [
  "CARE_VIEWER",
  "CARE_RESPONDER",
  "CARE_ASSIGNER",
  "CARE_LIVE_AGENT",
] as const)
  it(`${duty} alone never acquires another duty or authority through its position`, () => {
    const access = accessFor([duty]);
    expect(careCaseAllows(access, "ENQUIRY", "view", { branchId: branch })).toBe(
      duty === "CARE_VIEWER",
    );
    expect(careCaseAllows(access, "COMPLAINT", "reply", { branchId: branch })).toBe(
      false,
    );
    expect(careCaseAllows(access, "ENQUIRY", "assign", { branchId: branch })).toBe(false);
    expect(careCaseAllows(access, "ENQUIRY", "live", { branchId: branch })).toBe(false);
    expect(workforceDestinationAllowed(access, "enquiries")).toBe(duty === "CARE_VIEWER");
    expect(workforceDestinationAllowed(access, "complaints")).toBe(
      duty === "CARE_VIEWER",
    );
  });
it("intersects view and action on the actual branch, including live eligibility", () => {
  let access = accessFor(
    ["CARE_VIEWER"],
    ["CARE_RESPONDER", id(999)],
    ["CARE_ASSIGNER"],
    ["CARE_LIVE_AGENT"],
  );
  expect(careCaseAllows(access, "ENQUIRY", "reply", { branchId: branch })).toBe(false);
  expect(careCaseAllows(access, "ENQUIRY", "assign", { branchId: branch })).toBe(true);
  expect(careCaseAllows(access, "ENQUIRY", "live", { branchId: branch })).toBe(false);
  access = accessFor(["CARE_VIEWER"], ["CARE_RESPONDER"], ["CARE_LIVE_AGENT"]);
  expect(careCaseAllows(access, "COMPLAINT", "live", { branchId: branch })).toBe(true);
  expect(careCaseAllows(access, "COMPLAINT", "live", { branchId: id(999) })).toBe(false);
});
it("rejects missing modern metadata, unknown pinned definitions and inactive/foreign assignment claims", () => {
  for (const mutate of [
    (a: WorkforceAccess) => {
      a.capabilityScopes = undefined;
      a.accessRevision = undefined;
    },
    (a: WorkforceAccess) => {
      a.assignments[0].templateVersion = 1;
    },
    (a: WorkforceAccess) => {
      a.assignments[0].templateVersion = 99;
    },
    (a: WorkforceAccess) => {
      a.assignments[0].userId = id(999);
    },
    (a: WorkforceAccess) => {
      a.assignments[0].revokedAt = stamp;
    },
    (a: WorkforceAccess) => {
      a.assignments[0].expiresAt = stamp;
    },
  ]) {
    const access = accessFor(["CARE_VIEWER"]);
    mutate(access);
    expect(careCaseAllows(access, "ENQUIRY", "view", { branchId: branch })).toBe(false);
  }
});
it("keeps populated case reading separate from replies and requires current assignment metadata", () => {
  const access = accessFor(["CARE_VIEWER"], ["CARE_ASSIGNER"]),
    e = enquiry(access),
    c = complaint(access);
  expect(parseWorkforceEnquiry(e).contact?.email).toBe("synthetic@example.test");
  expect(parseWorkforceComplaint(c).id).toBe(c.id);
  expect(canReplyEnquiry(e, access)).toBe(false);
  expect(canReplyComplaint(c, access)).toBe(false);
  expect(canAssignEnquiry(e, access)).toBe(true);
  expect(canAssignComplaint(c, access)).toBe(true);
  delete c.assignedStaffId;
  delete c.assignedStaff;
  expect(parseWorkforceComplaint(c).id).toBe(c.id);
  expect(canAssignComplaint(c, access)).toBe(false);
});
it("does not accept a reply receipt for a view-only actor even if its record and access revision match", () => {
  const access = accessFor(["CARE_VIEWER"]),
    e = enquiry(access);
  const change = {
    action: "reply" as const,
    body: {
      expectedVersion: 0,
      expectedLatestMessageId: null,
      body: "Synthetic reviewed reply",
    },
  };
  const receipt = {
    id: e.id,
    branchId: branch,
    version: 1,
    action: "reply",
    actorUserId: access.userId,
    access,
    generatedAt: stamp,
    messageReceipt: {
      id: id(802),
      enquiryId: e.id,
      body: change.body.body,
      authorType: "STAFF",
      visibility: "CUSTOMER",
      createdAt: stamp,
      kind: "REPLY",
      fromStatus: null,
      toStatus: null,
    },
  };
  expect(() => validateEnquiryReceipt(receipt, e, change)).toThrow();
});
it("rejects an internal-note kind even if a malformed response labels it customer-visible", () => {
  const access = accessFor(["CARE_VIEWER"]);
  const messages = {
    items: [
      {
        id: id(900),
        authorType: "STAFF",
        visibility: "CUSTOMER",
        body: "Synthetic internal note that must not render",
        createdAt: stamp,
        isOwn: false,
        kind: "INTERNAL_NOTE",
      },
    ],
  };
  expect(() => parseWorkforceEnquiry({ ...enquiry(access), messages })).toThrow();
  expect(() => parseWorkforceComplaint({ ...complaint(access), messages })).toThrow();
});
it("binds assignment candidate pages and complaint receipts to the actor's current branch authority", () => {
  const access = accessFor(["CARE_VIEWER"], ["CARE_ASSIGNER"]),
    c = complaint(access);
  const page = {
    items: [],
    branchId: branch,
    access,
    generatedAt: stamp,
    complaintId: c.id,
    complaintVersion: c.version,
  };
  expect(parseWorkforceComplaintCandidates(page).complaintId).toBe(c.id);
  expect(() =>
    parseWorkforceComplaintCandidates({ ...page, branchId: id(999) }),
  ).toThrow();
  expect(
    parseWorkforceEnquiryCandidates({ ...page, enquiryId: id(800), enquiryVersion: 0 })
      .enquiryId,
  ).toBe(id(800));
  const change = {
    action: "assignment" as const,
    body: {
      expectedVersion: 0,
      staffId: id(901),
      reason: "Reviewed internal assignment reason",
    },
  };
  const receipt = {
    id: c.id,
    branchId: branch,
    version: 1,
    action: "assignment",
    actorUserId: access.userId,
    access,
    generatedAt: stamp,
    assignmentReceipt: {
      staffId: change.body.staffId,
      previousStaffId: null,
      reason: change.body.reason,
    },
  };
  expect(validateComplaintReceipt(receipt, c, change).action).toBe("assignment");
  for (const changed of [
    { actorUserId: id(999) },
    { version: 9 },
    { branchId: id(999) },
    { assignmentReceipt: { ...receipt.assignmentReceipt, staffId: id(999) } },
    { assignmentReceipt: { ...receipt.assignmentReceipt, previousStaffId: id(999) } },
    { assignmentReceipt: { ...receipt.assignmentReceipt, reason: "Unreviewed reason" } },
  ])
    expect(() =>
      validateComplaintReceipt({ ...receipt, ...changed }, c, change),
    ).toThrow();
});
