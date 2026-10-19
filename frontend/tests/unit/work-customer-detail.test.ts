import { describe, it, expect } from "vitest";
import {
  customerActivityQuery,
  customerActivityPageParams,
  customerActivityAmount,
  customerActivityHref,
  parseCustomerActivity,
  parseWorkCustomerDetail,
} from "@/lib/admin/work-customer-detail";
const id = "d1000000-0000-4000-8000-000000030000",
  activity = {
    id,
    title: "Owned order",
    status: "COMPLETED",
    createdAt: "2026-10-17T09:00:37.123Z",
    amountKobo: "9999999999999999",
    currency: "NGN",
  };
describe("customer detail", () => {
  it("requires the requested complete profile identity", () => {
    const row = {
      id,
      firstName: "Amina",
      lastName: "Okafor",
      email: "a@example.test",
      phone: "+2348000000000",
      status: "ACTIVE",
      emailVerified: true,
      phoneVerified: false,
      createdAt: activity.createdAt,
      address: null,
      city: null,
      state: null,
      country: "NG",
    };
    expect(parseWorkCustomerDetail(row, id)).toEqual(row);
    expect(() =>
      parseWorkCustomerDetail(row, "d1000000-0000-4000-8000-000000030001"),
    ).toThrow();
  });
  it("accepts only supported collection/cursor state", () => {
    expect(
      customerActivityQuery(new URLSearchParams("collection=orders"), id).path,
    ).toContain("/orders?limit=25");
    for (const q of [
      "collection=other",
      "collection=orders&collection=payments",
      "cursor=opaque",
      "search=a",
      "cursor=" + id + "&_trail=start," + id,
    ])
      expect(customerActivityQuery(new URLSearchParams(q), id).invalid).toBe(true);
  });
  it("preserves collection and UUID trail on paging", () => {
    const q = new URLSearchParams("collection=orders"),
      next = customerActivityPageParams(q, id);
    expect(customerActivityQuery(next, id).invalid).toBe(false);
    expect(customerActivityPageParams(next, undefined, true).toString()).toBe(
      q.toString(),
    );
  });
  it("preserves exact large, zero, missing and non-NGN amounts without guessing", () => {
    expect(customerActivityAmount(activity)).toBe("₦99,999,999,999,999.99");
    expect(customerActivityAmount({ ...activity, amountKobo: "0" })).toBe("₦0.00");
    expect(customerActivityAmount({ ...activity, amountKobo: null })).toBe(
      "Not applicable",
    );
    expect(
      customerActivityAmount({ ...activity, amountKobo: "100", currency: null }),
    ).toBe("Currency not recorded · 100 minor units");
  });
  it("rejects duplicate/malformed activity and unsupported links", () => {
    expect(parseCustomerActivity({ items: [activity] }).items[0]).toEqual(activity);
    for (const value of [
      { items: [activity, activity] },
      { items: [{ ...activity, amountKobo: "1.5" }] },
      { items: [activity], nextCursor: "opaque" },
    ])
      expect(() => parseCustomerActivity(value)).toThrow();
    expect(customerActivityHref("vehicles", id)).toBeUndefined();
    expect(customerActivityHref("orders", id)).toBe(`/admin/orders/${id}`);
    expect(customerActivityHref("enquiries", id)).toBe(`/admin/support/enquiries/${id}`);
  });
});
