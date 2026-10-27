import { describe, expect, it } from "vitest";
import {
  complaintsHref,
  complaintInScope,
  parseScopedWorkforceComplaints,
  parseWorkforceComplaint,
  validateComplaintReceipt,
  workforceComplaintsQuery,
  type WorkforceComplaint,
  type ComplaintChange,
} from "../../lib/admin/workforce-complaints";

const id = (n: number) => `bc000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-19T08:00:00.000Z";
function data(): WorkforceComplaint {
  return {
    id: id(10),
    branchId: id(4),
    branch: { id: id(4), name: "Stadium Road" },
    subject: "Inspection request",
    description: "Warning light has returned.",
    acknowledgedAt: null,
    acknowledgementDueAt: null,
    escalatedAt: null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
    priority: "HIGH",
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
      position: "Customer service",
      department: "Customer care",
      version: 1,
      permissions: ["COMPLAINTS"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "CUSTOMER_SERVICE",
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
const queue = (row: WorkforceComplaint) => ({
  items: [row],
  access: row.access,
  generatedAt: stamp,
});

describe("managed complaint scope and reviewed changes", () => {
  it("keeps selection and message history in the URL but outside collection requests", () => {
    const query = workforceComplaintsQuery(
      new URLSearchParams({
        q: "  Saturday %_  ",
        priority: "HIGH",
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
    expect(complaintsHref(query.params)).toContain("_messageTrail=start");
  });
  it("rejects malformed, duplicated and unsupported history/filter links", () => {
    for (const query of [
      "q=a&q=b",
      "priority=toString",
      "status=constructor",
      "selected=bad",
      `messageCursor=${id(20)}`,
      "_trail=start",
      `selected=${id(10)}&messageCursor=${id(20)}&_messageTrail=start,${id(20)}`,
      "q=a%00b",
      `q=${"x".repeat(121)}`,
      "branchId=foreign",
    ])
      expect(workforceComplaintsQuery(new URLSearchParams(query)).path).toBeNull();
  });
  it("requires active branch Customer Service responsibility and complaint permission", () => {
    const value = data();
    expect(complaintInScope(value, value.access)).toBe(true);
    value.access.assignments[0].template = "SALES_SUPERVISOR";
    expect(complaintInScope(value, value.access)).toBe(false);
    value.access.assignments[0].template = "CUSTOMER_SERVICE";
    value.access.permissions = [];
    expect(complaintInScope(value, value.access)).toBe(false);
  });
  it("rejects mismatched references, ownership, branch and inactive responsibilities", () => {
    for (const kind of ["reference", "owner", "branch", "revoked", "expired", "future"]) {
      const value = data(),
        assignment = value.access.assignments[0];
      if (kind === "reference") value.branch!.id = id(99);
      if (kind === "owner") assignment.userId = id(99);
      if (kind === "branch") assignment.branchId = id(99);
      if (kind === "revoked") assignment.revokedAt = stamp;
      if (kind === "expired") assignment.expiresAt = stamp;
      if (kind === "future") assignment.startsAt = "2027-01-01T00:00:00.000Z";
      expect(() => parseWorkforceComplaint(value)).toThrow();
    }
  });
  it("rejects repeated records, forged cursors and empty-scope permission claims", () => {
    const value = data();
    expect(() =>
      parseScopedWorkforceComplaints({ ...queue(value), items: [value, value] }),
    ).toThrow();
    expect(() =>
      parseScopedWorkforceComplaints({ ...queue(value), nextCursor: value.id }),
    ).toThrow();
    value.access.permissions = [];
    expect(() =>
      parseScopedWorkforceComplaints({ ...queue(value), items: [] }),
    ).toThrow();
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
    expect(parseWorkforceComplaint(value).messages.items).toHaveLength(1);
    expect(() =>
      parseWorkforceComplaint({
        ...value,
        messages: { items: [{ ...message, visibility: "INTERNAL" }] },
      }),
    ).toThrow();
    value.messages.items.push({
      ...message,
      id: id(21),
      createdAt: "2026-10-19T09:00:00.000Z",
    });
    expect(() => parseWorkforceComplaint(value)).toThrow();
  });
  it("accepts only the exact reply receipt for this actor, revision and customer-visible body", () => {
    const value = data();
    const change: ComplaintChange = {
      action: "reply",
      body: {
        expectedVersion: value.version,
        expectedLatestMessageId: null,
        body: "We will inspect this warning.",
      },
    };
    const receipt = {
      id: value.id,
      version: value.version + 1,
      branchId: value.branchId,
      actorUserId: value.access.userId,
      action: "reply",
      access: value.access,
      generatedAt: stamp,
      messageReceipt: {
        id: id(20),
        complaintId: value.id,
        authorType: "STAFF",
        visibility: "CUSTOMER",
        body: change.body.body,
        createdAt: stamp,
      },
    };
    expect(validateComplaintReceipt(receipt, value, change).version).toBe(3);
    for (const override of [
      { id: id(99) },
      { version: 2 },
      { branchId: id(99) },
      { actorUserId: id(99) },
      { action: "assignment" },
      { messageReceipt: { ...receipt.messageReceipt, body: "Different text" } },
      { messageReceipt: { ...receipt.messageReceipt, visibility: "INTERNAL" } },
      { messageReceipt: { ...receipt.messageReceipt, complaintId: id(99) } },
    ])
      expect(() =>
        validateComplaintReceipt({ ...receipt, ...override }, value, change),
      ).toThrow();
  });
  it("preserves recorded response tracking and resolution without accepting malformed timestamps", () => {
    const value = {
      ...data(),
      resolution: "Repair verified.",
      resolvedAt: stamp,
      acknowledgedAt: stamp,
    };
    expect(parseWorkforceComplaint(value).resolution).toBe("Repair verified.");
    expect(() =>
      parseWorkforceComplaint({ ...value, acknowledgementDueAt: "tomorrow" }),
    ).toThrow();
  });
});
