import { describe, expect, it } from "vitest";
import {
  addBusinessMinutes,
  ownerSupportCalendar,
} from "../../src/modules/support/business-calendar.js";
import { bankRefundDueAt } from "../../src/modules/policies/refund-clock.js";

describe("Signed support calendar and independently approved banking clock", () => {
  it("carries a Saturday closing-time urgent target through Sunday", () => {
    expect(
      addBusinessMinutes(
        new Date("2026-09-26T17:30:00+01:00"),
        60,
        ownerSupportCalendar,
      ).toISOString(),
    ).toBe("2026-09-28T07:30:00.000Z");
    expect(
      addBusinessMinutes(
        new Date("2026-09-27T10:00:00+01:00"),
        60,
        ownerSupportCalendar,
      ).toISOString(),
    ).toBe("2026-09-28T08:00:00.000Z");
  });
  it("honors explicitly configured holidays and the exact closing boundary", () => {
    expect(
      addBusinessMinutes(new Date("2026-09-26T18:00:00+01:00"), 60, {
        ...ownerSupportCalendar,
        holidays: ["2026-09-28"],
      }).toISOString(),
    ).toBe("2026-09-29T08:00:00.000Z");
  });
  it("uses labelled banking assumptions instead of borrowing the support calendar", () => {
    expect(() => bankRefundDueAt(new Date(), [], [])).toThrow();
    // Synthetic approved banking policy: Mon-Fri, excludes the start date, one holiday.
    expect(
      bankRefundDueAt(
        new Date("2026-09-25T10:00:00+01:00"),
        [1, 2, 3, 4, 5],
        ["2026-10-01"],
      ).toISOString(),
    ).toBe("2026-10-12T09:00:00.000Z");
  });
});
