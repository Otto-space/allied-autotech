import { describe, expect, it } from "vitest";
import {
  aftercareHistoryMatches,
  aftercarePermission,
  aftercareSnapshot,
  aftercareStages,
  parseWorkAftercareHistory,
  parseWorkAftercareOrder,
} from "@/lib/admin/work-aftercare";
import { staffOrderRecord, bookingId } from "../fixtures/work-order-detail";
import { workAftercareRecord } from "../fixtures/work-aftercare";
const order = () =>
  parseWorkAftercareOrder({
    ...staffOrderRecord(),
    fulfillmentEvidenceAt: null,
    fulfillmentEvidenceReference: null,
  });
const access = {
  id: bookingId(302),
  email: "qa@example.test",
  role: "STAFF",
  status: "ACTIVE",
  staffProfile: {
    id: bookingId(601),
    firstName: "QA",
    lastName: "Staff",
    branchId: bookingId(101),
  },
  capabilities: [] as string[],
};
describe("operational aftercare boundaries", () => {
  it("keeps operational stages separate from financial decisions", () => {
    expect(
      aftercareStages({ ...workAftercareRecord(), status: "REQUESTED" }, false),
    ).toEqual(["RECEIVED"]);
    expect(aftercareStages(workAftercareRecord(), false)).toEqual(["INSPECTED"]);
    expect(
      aftercareStages({ ...workAftercareRecord(), status: "INSPECTED" }, true),
    ).toEqual(["APPROVED", "REJECTED"]);
    expect(
      aftercareStages(
        { ...workAftercareRecord(), kind: "CANCELLATION", status: "REQUESTED" },
        false,
      ),
    ).toEqual([]);
    expect(aftercareStages(workAftercareRecord(1), true)).toEqual([]);
  });
  it("checks identity, role, active account and branch", () => {
    expect(aftercarePermission(access, access.id, "STAFF", order())).toBe(true);
    for (const profile of [
      { ...access, id: bookingId(999) },
      { ...access, status: "INACTIVE" },
      { ...access, staffProfile: { ...access.staffProfile, branchId: bookingId(999) } },
    ])
      expect(aftercarePermission(profile, access.id, "STAFF", order())).toBe(false);
    expect(aftercarePermission(access, access.id, "CUSTOMER", order())).toBe(false);
  });
  it("rejects duplicate and unrelated history and excessive quantities", () => {
    const record = workAftercareRecord();
    expect(() => parseWorkAftercareHistory([record, record])).toThrow();
    expect(
      aftercareHistoryMatches([{ ...record, orderId: bookingId(999) }], order()),
    ).toBe(false);
    expect(
      aftercareHistoryMatches(
        [{ ...record, items: [{ ...record.items[0], quantity: 100 }] }],
        order(),
      ),
    ).toBe(false);
  });
  it("normalizes history/capability ordering but observes record and access changes", () => {
    const history = [workAftercareRecord(), workAftercareRecord(1)],
      profile = { ...access, capabilities: ["A", "B"] };
    expect(aftercareSnapshot(order(), history, profile)).toBe(
      aftercareSnapshot(order(), [...history].reverse(), {
        ...profile,
        capabilities: ["B", "A"],
      }),
    );
    expect(aftercareSnapshot(order(), history, profile)).not.toBe(
      aftercareSnapshot(order(), history, access),
    );
  });
  it("supports historical unassigned branches and validates saved timestamps", () => {
    expect(parseWorkAftercareOrder({ ...order(), branch: null }).branch).toBeNull();
    expect(() => parseWorkAftercareOrder({ ...order(), createdAt: "invalid" })).toThrow();
  });
});
