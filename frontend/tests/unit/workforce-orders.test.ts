import { expect, it } from "vitest";
import {
  workforceOrdersQuery,
  ordersHref,
  parseWorkforceOrder,
  parseScopedWorkforceOrders,
  orderInScope,
  expectedOrderNextStates,
  validateOrderReceipt,
  type WorkforceOrder,
  type OrderChange,
} from "../../lib/admin/workforce-orders";
const id = (n: number) => `bd000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  stamp = "2026-10-20T08:00:00.000Z";
function data(): WorkforceOrder {
  return {
    id: id(10),
    orderNumber: "AA-2026-0148",
    branchId: id(4),
    branch: { id: id(4), name: "Stadium Road" },
    status: "CONFIRMED",
    fulfillmentMethod: "COLLECTION",
    paidAt: stamp,
    version: 2,
    createdAt: stamp,
    updatedAt: stamp,
    generatedAt: stamp,
    confirmedAt: stamp,
    processingAt: null,
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    items: [{ productName: "Brake pads", quantity: 2 }],
    availableNextStates: ["PROCESSING"],
    access: {
      managed: true,
      userId: id(1),
      staffId: id(2),
      position: "Operations",
      department: "Strategy",
      version: 1,
      permissions: ["ORDERS_READ", "ORDERS_PREPARE"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "OPERATIONS",
          scope: "BRANCH",
          temporary: false,
          startsAt: stamp,
          expiresAt: null,
          reason: "Synthetic responsibility",
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
it("keeps selection/trail in navigation and only allowed filters in API query", () => {
  const q = workforceOrdersQuery(
    new URLSearchParams({
      q: "  brake %_ ",
      status: "CONFIRMED",
      fulfillmentMethod: "COLLECTION",
      selected: id(10),
      cursor: id(20),
      _trail: "start",
    }),
  );
  expect(q.invalid).toBe(false);
  expect(q.path).toContain("q=brake+%25_");
  expect(q.path).not.toMatch(/selected|trail/);
  expect(ordersHref(q.params)).toContain("selected=");
});
it("rejects unknown, duplicate and malformed query state", () => {
  for (const q of [
    "status=constructor",
    "q=a&q=b",
    "fulfillmentMethod=OTHER",
    "selected=bad",
    "cursor=bad",
    "_trail=start",
    "q=a%00b",
    "q=" + "x".repeat(121),
    "branchId=" + id(4),
  ])
    expect(workforceOrdersQuery(new URLSearchParams(q)).path).toBeNull();
});
it("requires active responsibility in the actual order branch", () => {
  for (const mutate of [
    (r: WorkforceOrder) => {
      r.branchId = id(99);
    },
    (r: WorkforceOrder) => {
      r.access.assignments[0].revokedAt = stamp;
    },
    (r: WorkforceOrder) => {
      r.access.assignments[0].expiresAt = stamp;
    },
    (r: WorkforceOrder) => {
      r.access.assignments[0].userId = id(90);
    },
    (r: WorkforceOrder) => {
      r.access.permissions = [];
    },
  ]) {
    const row = data();
    mutate(row);
    expect(orderInScope(row, row.access)).toBe(false);
    expect(() => parseWorkforceOrder(row)).toThrow();
  }
});
it("read-only responsibility cannot receive preparation availability", () => {
  const row = data();
  row.access.permissions = ["ORDERS_READ"];
  row.access.assignments[0].template = "CUSTOMER_SERVICE";
  expect(() => parseWorkforceOrder(row)).toThrow();
  row.availableNextStates = [];
  expect(parseWorkforceOrder(row).id).toBe(row.id);
});
it("only paid collection orders in preceding states allow preparation", () => {
  const row = data();
  expect(expectedOrderNextStates(row, row.access)).toEqual(["PROCESSING"]);
  row.status = "PROCESSING";
  expect(expectedOrderNextStates(row, row.access)).toEqual(["READY"]);
  for (const status of ["PENDING", "READY", "COMPLETED", "CANCELLED"] as const) {
    row.status = status;
    expect(expectedOrderNextStates(row, row.access)).toEqual([]);
  }
  row.status = "CONFIRMED";
  row.paidAt = null;
  expect(expectedOrderNextStates(row, row.access)).toEqual([]);
  row.paidAt = stamp;
  row.fulfillmentMethod = "DELIVERY";
  expect(expectedOrderNextStates(row, row.access)).toEqual([]);
});
it("rejects duplicates and false cursor pagination", () => {
  const row = data(),
    page = { items: [row], access: row.access, generatedAt: stamp };
  expect(() => parseScopedWorkforceOrders({ ...page, items: [row, row] })).toThrow();
  expect(() => parseScopedWorkforceOrders({ ...page, nextCursor: row.id })).toThrow();
  expect(parseScopedWorkforceOrders(page).items).toHaveLength(1);
});
it("matches exact state, note, actor, version and recorded timestamp receipts", () => {
  const base = data(),
    change: OrderChange = {
      action: "prepare",
      body: {
        expectedVersion: 2,
        status: "PROCESSING",
        reason: "Checked all order items",
      },
    };
  const receipt = {
    ...base,
    action: "prepare",
    actorUserId: base.access.userId,
    previousVersion: 2,
    previousStatus: "CONFIRMED",
    reason: change.body.reason,
    status: "PROCESSING",
    version: 3,
    processingAt: stamp,
    availableNextStates: ["READY"],
  };
  expect(validateOrderReceipt(receipt, base, change).version).toBe(3);
  for (const bad of [
    { reason: "Different note" },
    { actorUserId: id(99) },
    { previousVersion: 1 },
    { previousStatus: "PENDING" },
    { version: 4 },
    { processingAt: null },
    { items: [{ productName: "Other item", quantity: 2 }] },
    { paidAt: null },
    { branchId: id(9) },
  ])
    expect(() => validateOrderReceipt({ ...receipt, ...bad }, base, change)).toThrow();
});
