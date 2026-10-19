import { describe, expect, it } from "vitest";
import {
  customersQuery,
  customerPageParams,
  parseWorkCustomers,
} from "@/lib/admin/work-customers";
const row = {
  id: "d1000000-0000-4000-8000-000000030000",
  firstName: "Amina",
  lastName: "Okafor",
  email: "a@example.test",
  phone: "+2348000000000",
  status: "ACTIVE",
  emailVerified: true,
  phoneVerified: false,
  createdAt: "2026-10-17T09:00:37.123Z",
};
describe("customer directory", () => {
  it("normalizes only supported filters with a fixed limit", () => {
    const q = customersQuery(
      new URLSearchParams(
        "search=%20Amina%20%20Okafor%20&field=name&sort=oldest&verified=true",
      ),
    );
    expect(q.invalid).toBe(false);
    expect(q.path).toContain("search=amina+okafor");
    expect(q.path).toContain("limit=25");
  });
  it("rejects duplicates, unknown fields and invalid search forms", () => {
    for (const s of [
      "search=a",
      "search=a&search=b",
      "field=other",
      "verified=1",
      "status=UNKNOWN",
      "limit=50",
      "cursor=bad!",
      "search=12&field=phone",
      "search=bad&field=id",
    ])
      expect(customersQuery(new URLSearchParams(s)).invalid, s).toBe(true);
  });
  it("preserves opaque cursor trail and filters through next/previous", () => {
    const first = new URLSearchParams("verified=false&sort=oldest"),
      second = customerPageParams(first, "opaque25"),
      third = customerPageParams(second, "opaque50");
    expect(customersQuery(third).invalid).toBe(false);
    expect(customerPageParams(third, undefined, true).toString()).toBe(second.toString());
    expect(customerPageParams(second, undefined, true).toString()).toBe(first.toString());
    expect(
      customersQuery(new URLSearchParams("cursor=opaque25&_trail=start,opaque25"))
        .invalid,
    ).toBe(true);
  });
  it("preserves full row data and exact dates while rejecting malformed/duplicate pages", () => {
    expect(parseWorkCustomers({ items: [row] }).items[0]).toEqual(row);
    for (const value of [
      { items: [row, row] },
      { items: [{ ...row, status: "UNKNOWN" }] },
      { items: [{ ...row, createdAt: "bad" }] },
      { items: [row], nextCursor: "bad!" },
    ])
      expect(() => parseWorkCustomers(value)).toThrow();
  });
  it("rejects response filter mismatches and repeating cursors", () => {
    expect(() =>
      parseWorkCustomers({ items: [row] }, new URLSearchParams("status=SUSPENDED")),
    ).toThrow();
    expect(() =>
      parseWorkCustomers({ items: [row] }, new URLSearchParams("verified=false")),
    ).toThrow();
    expect(() =>
      parseWorkCustomers(
        { items: [row], nextCursor: "same" },
        new URLSearchParams("cursor=same"),
      ),
    ).toThrow();
  });
});
