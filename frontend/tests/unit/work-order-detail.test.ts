import { describe, expect, it } from "vitest";
import {
  fulfilmentReason,
  orderActivity,
  orderChangeSnapshot,
  parseStaffOrderDetail,
} from "@/lib/admin/work-order-detail";
import { staffOrderRecord } from "../fixtures/work-order-detail";
describe("operational order detail contract", () => {
  it("accepts saved amounts, dates and authorized transitions", () => {
    const order = parseStaffOrderDetail(staffOrderRecord());
    expect(order.allowedTransitions).toEqual(["READY"]);
    expect(order.taxKobo).toBe("183750");
  });
  for (const data of [
    { allowedTransitions: ["CONFIRMED"] },
    { allowedTransitions: ["READY", "READY"] },
    { paidAt: null },
    { createdAt: "invalid" },
    { version: -1 },
  ])
    it(`rejects contradictory detail ${JSON.stringify(data)}`, () =>
      expect(() => parseStaffOrderDetail({ ...staffOrderRecord(), ...data })).toThrow());
  it("accepts a missing branch without inventing one", () =>
    expect(
      parseStaffOrderDetail({ ...staffOrderRecord(), branch: null }).branch,
    ).toBeNull());
  it("rejects duplicate and zero-quantity historical lines", () => {
    const order = staffOrderRecord();
    expect(() =>
      parseStaffOrderDetail({ ...order, items: [order.items[0], order.items[0]] }),
    ).toThrow();
    expect(() =>
      parseStaffOrderDetail({ ...order, items: [{ ...order.items[0], quantity: 0 }] }),
    ).toThrow();
  });
  it("rechecks operational details while excluding invoice projection", () => {
    const order = staffOrderRecord();
    expect(orderChangeSnapshot({ ...order, invoice: null })).toBe(
      orderChangeSnapshot(order),
    );
    expect(orderChangeSnapshot({ ...order, version: 1 })).not.toBe(
      orderChangeSnapshot(order),
    );
    expect(orderChangeSnapshot({ ...order, allowedTransitions: [] })).not.toBe(
      orderChangeSnapshot(order),
    );
  });
  it("orders actual timestamps and does not infer missing milestones", () => {
    const order = staffOrderRecord(),
      events = orderActivity(order);
    expect(events.map((e) => e.label)).toEqual([
      "Created",
      "Payment recorded",
      "Confirmed",
      "Processing",
    ]);
    expect(
      orderActivity({ ...order, confirmedAt: null }).map((e) => e.label),
    ).not.toContain("Confirmed");
  });
  it("validates one-paragraph reasons", () => {
    expect(fulfilmentReason.parse("  Customer requested cancellation  ")).toBe(
      "Customer requested cancellation",
    );
    expect(fulfilmentReason.safeParse("line\nbreak").success).toBe(false);
    expect(fulfilmentReason.safeParse("x".repeat(501)).success).toBe(false);
  });
});
