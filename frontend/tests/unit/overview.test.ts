import { describe, expect, it } from "vitest";
import {
  overviewDates,
  overviewMoney,
  parseOverview,
  validOverviewDates,
} from "@/lib/api/overview-schemas";
import { overviewFixture } from "../fixtures/overview";

describe("overview date and amount boundaries", () => {
  it("uses Lagos midnight and includes leap days in inclusive presets", () => {
    expect(overviewDates(2, new Date("2024-02-29T23:30:00Z"))).toEqual({
      from: "2024-02-29",
      to: "2024-03-01",
    });
    expect(overviewDates(1, new Date("2026-09-18T22:59:59Z"))).toEqual({
      from: "2026-09-18",
      to: "2026-09-18",
    });
    expect(validOverviewDates("2024-01-01", "2024-03-30")).toBe(true);
    expect(validOverviewDates("2024-01-01", "2024-03-31")).toBe(false);
    expect(validOverviewDates("2023-02-29", "2023-03-01")).toBe(false);
    expect(validOverviewDates("2026-09-19", "2026-09-18")).toBe(false);
  });
  it("formats aggregate amounts exactly without converting to floating point", () => {
    expect(overviewMoney("10000000000000001", "NGN")).toBe("NGN 100,000,000,000,000.01");
    expect(overviewMoney("1", "NGN")).toBe("NGN 0.01");
    expect(overviewMoney("0", "NGN")).toBe("NGN 0.00");
  });
  it("rejects corrupt or unbounded aggregates instead of rendering misleading figures", () => {
    const data = overviewFixture("STAFF");
    expect(() =>
      parseOverview({ ...data, counts: { ...data.counts, bookings: -1 } }),
    ).toThrow();
    expect(() => parseOverview({ ...data, activity: [] })).toThrow();
    expect(() =>
      parseOverview({
        ...data,
        finance: {
          payments: [{ currency: "NGN", amountKobo: "1.2", count: 1 }],
          refunds: [],
        },
      }),
    ).toThrow();
  });
});
