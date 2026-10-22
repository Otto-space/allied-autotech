import { describe, expect, it } from "vitest";
import {
  canAssignEnquiry,
  enquiriesHref,
  enquiryInScope,
  parseScopedWorkforceEnquiries,
  parseWorkforceEnquiry,
  parseWorkforceEnquiryCandidates,
  validateEnquiryReceipt,
  workforceEnquiriesQuery,
  type WorkforceEnquiry,
  type EnquiryChange,
} from "../../lib/admin/workforce-enquiries";

const id = (n: number) => `bb000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-19T08:00:00.000Z";
function data(): WorkforceEnquiry {
  return {
    id: id(10),
    branchId: id(4),
    branch: { id: id(4), name: "Stadium Road" },
    assignedStaffId: id(2),
    assignedStaff: { id: id(2), firstName: "Ada", lastName: "Okoro" },
    subject: "Inspection request",
    message: "Is Saturday available?",
    type: "VEHICLE",
    status: "OPEN",
    version: 2,
    createdAt: stamp,
    updatedAt: stamp,
    generatedAt: stamp,
    latestMessageId: null,
    messages: { items: [] },
    access: {
      managed: true,
      userId: id(1),
      staffId: id(2),
      position: "Sales supervisor",
      department: "Sales",
      version: 1,
      permissions: ["SALES_ENQUIRIES", "ENQUIRIES_ASSIGN"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "SALES_SUPERVISOR",
          scope: "BRANCH",
          temporary: false,
          startsAt: stamp,
          expiresAt: null,
          reason: "Synthetic responsibilities",
          assignedByUserId: id(5),
          createdAt: stamp,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
        },
      ],
    },
  };
}
const queue = (row: WorkforceEnquiry) => ({
  items: [row],
  access: row.access,
  generatedAt: stamp,
});

describe("managed enquiry scope and reviewed changes", () => {
  it("keeps selection and message history in the URL but outside collection requests", () => {
    const query = workforceEnquiriesQuery(
      new URLSearchParams({
        q: "  Saturday %_  ",
        type: "VEHICLE",
        status: "OPEN",
        selected: id(10),
        messageCursor: id(20),
        _messageTrail: "start",
        cursor: id(30),
        _trail: "start",
      }),
    );
    expect(query.invalid).toBe(false);
    expect(query.path).toContain("q=Saturday+%25_");
    expect(query.path).not.toContain("selected");
    expect(query.path).not.toContain("message");
    expect(query.path).not.toContain("trail");
    expect(enquiriesHref(query.params)).toContain("_messageTrail=start");
  });
  it("rejects malformed, duplicated and unsupported history/filter links", () => {
    for (const query of [
      "q=a&q=b",
      "type=toString",
      "status=constructor",
      "selected=bad",
      `messageCursor=${id(20)}`,
      "_trail=start",
      `selected=${id(10)}&messageCursor=${id(20)}&_messageTrail=start,${id(20)}`,
      "q=a%00b",
      `q=${"x".repeat(121)}`,
      "branchId=foreign",
    ])
      expect(workforceEnquiriesQuery(new URLSearchParams(query)).path).toBeNull();
  });
  it("allows all types for customer service and limits sales roles to product/vehicle", () => {
    const value = data();
    expect(parseWorkforceEnquiry(value).id).toBe(value.id);
    value.type = "GENERAL";
    expect(enquiryInScope(value, value.access)).toBe(false);
    value.access.permissions = ["CUSTOMER_ENQUIRIES"];
    value.access.assignments[0].template = "CUSTOMER_SERVICE";
    expect(parseScopedWorkforceEnquiries(queue(value)).items).toHaveLength(1);
    expect(canAssignEnquiry(value, value.access)).toBe(false);
  });
  it("restricts cashiers to their assigned sales enquiries", () => {
    const value = data();
    Object.assign(value.access.assignments[0], {
      template: "SALES_CASHIER",
      scope: "ASSIGNED",
    });
    value.access.permissions = ["SALES_ENQUIRIES"];
    expect(enquiryInScope(value, value.access)).toBe(true);
    expect(canAssignEnquiry(value, value.access)).toBe(false);
    value.assignedStaffId = id(99);
    value.assignedStaff!.id = id(99);
    expect(() => parseWorkforceEnquiry(value)).toThrow();
  });
  it("rejects mismatched references, ownership, branch and inactive responsibilities", () => {
    for (const kind of [
      "reference",
      "staff",
      "owner",
      "branch",
      "revoked",
      "expired",
      "future",
    ]) {
      const value = data(),
        assignment = value.access.assignments[0];
      if (kind === "reference") value.branch!.id = id(99);
      if (kind === "staff") value.assignedStaff!.id = id(99);
      if (kind === "owner") assignment.userId = id(99);
      if (kind === "branch") assignment.branchId = id(99);
      if (kind === "revoked") assignment.revokedAt = stamp;
      if (kind === "expired") assignment.expiresAt = stamp;
      if (kind === "future") assignment.startsAt = "2027-01-01T00:00:00.000Z";
      expect(() => parseWorkforceEnquiry(value)).toThrow();
    }
  });
  it("does not grant assignment across branches or for closed records", () => {
    const value = data();
    expect(canAssignEnquiry(value, value.access)).toBe(true);
    value.status = "CLOSED";
    expect(canAssignEnquiry(value, value.access)).toBe(false);
    value.status = "OPEN";
    value.access.assignments[0].branchId = id(99);
    value.access.assignments.push({
      ...value.access.assignments[0],
      id: id(98),
      branchId: id(4),
      template: "CUSTOMER_SERVICE",
    });
    expect(enquiryInScope(value, value.access)).toBe(true);
    expect(canAssignEnquiry(value, value.access)).toBe(false);
  });
  it("rejects repeated records, forged cursors and empty-scope permission claims", () => {
    const value = data();
    expect(() =>
      parseScopedWorkforceEnquiries({ ...queue(value), items: [value, value] }),
    ).toThrow();
    expect(() =>
      parseScopedWorkforceEnquiries({ ...queue(value), nextCursor: value.id }),
    ).toThrow();
    value.access.permissions = [];
    expect(() => parseScopedWorkforceEnquiries({ ...queue(value), items: [] })).toThrow();
  });
  it("rejects internal history and inconsistent message ordering", () => {
    const value = data();
    const message = {
      id: id(20),
      authorType: "STAFF" as const,
      visibility: "CUSTOMER" as const,
      body: "Please confirm your time.",
      createdAt: stamp,
      isOwn: false,
    };
    value.messages.items = [message];
    value.latestMessageId = message.id;
    expect(parseWorkforceEnquiry(value).messages.items).toHaveLength(1);
    expect(() =>
      parseWorkforceEnquiry({
        ...value,
        messages: { items: [{ ...message, visibility: "INTERNAL" }] },
      }),
    ).toThrow();
    value.messages.items.push({
      ...message,
      id: id(21),
      createdAt: "2026-10-19T09:00:00.000Z",
    });
    expect(() => parseWorkforceEnquiry(value)).toThrow();
  });
  it("checks eligible staff metadata and active branch assignment", () => {
    const value = data(),
      response = {
        items: [value.assignedStaff],
        enquiryId: value.id,
        enquiryVersion: value.version,
        branchId: value.branchId,
        access: value.access,
        generatedAt: stamp,
      };
    expect(parseWorkforceEnquiryCandidates(response).items).toHaveLength(1);
    expect(() =>
      parseWorkforceEnquiryCandidates({ ...response, branchId: id(99) }),
    ).toThrow();
    expect(() =>
      parseWorkforceEnquiryCandidates({ ...response, nextCursor: id(2) }),
    ).toThrow();
  });
  it("accepts only exact reply receipts for the reviewed actor, record, version and body", () => {
    const value = data(),
      change: EnquiryChange = {
        action: "reply",
        body: {
          expectedVersion: 2,
          expectedLatestMessageId: null,
          body: "We will check availability.",
        },
      };
    const receipt = {
      id: value.id,
      version: 3,
      branchId: value.branchId,
      actorUserId: value.access.userId,
      action: "reply",
      access: value.access,
      generatedAt: stamp,
      messageReceipt: {
        id: id(20),
        enquiryId: value.id,
        authorType: "STAFF",
        visibility: "CUSTOMER",
        body: change.body.body,
        createdAt: stamp,
      },
    };
    expect(validateEnquiryReceipt(receipt, value, change).version).toBe(3);
    for (const patch of [
      { id: id(99) },
      { version: 4 },
      { actorUserId: id(99) },
      { messageReceipt: { ...receipt.messageReceipt, body: "Different reply" } },
      { messageReceipt: { ...receipt.messageReceipt, enquiryId: id(99) } },
    ])
      expect(() =>
        validateEnquiryReceipt({ ...receipt, ...patch }, value, change),
      ).toThrow();
  });
  it("checks the previous assignee and exact assignment reason in receipts", () => {
    const value = data(),
      change: EnquiryChange = {
        action: "assignment",
        body: {
          expectedVersion: 2,
          staffId: id(6),
          reason: "Afternoon cover for inspection enquiries.",
        },
      };
    const receipt = {
      id: value.id,
      version: 3,
      branchId: value.branchId,
      actorUserId: value.access.userId,
      action: "assignment",
      access: value.access,
      generatedAt: stamp,
      assignmentReceipt: {
        staffId: id(6),
        previousStaffId: id(2),
        reason: change.body.reason,
      },
    };
    expect(validateEnquiryReceipt(receipt, value, change).version).toBe(3);
    for (const patch of [
      { staffId: id(99) },
      { previousStaffId: null },
      { reason: "Another reason" },
    ])
      expect(() =>
        validateEnquiryReceipt(
          { ...receipt, assignmentReceipt: { ...receipt.assignmentReceipt, ...patch } },
          value,
          change,
        ),
      ).toThrow();
  });
});
