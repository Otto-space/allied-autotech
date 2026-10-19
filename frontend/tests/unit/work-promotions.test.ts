import { describe, it, expect } from "vitest";
import {
  parseWorkPromotions,
  promotionMatchesFilters,
  workPromotionsQuery,
} from "@/lib/admin/work-promotions";
import { promotionDiscount } from "@/app/components/promotion-summary";
import { promotionRecord, bookingId } from "../fixtures/work-promotions";
describe("promotion discovery contract", () => {
  it("preserves percentage precision, fixed minor amounts and null limits", () => {
    expect(promotionDiscount(promotionRecord(3))).toBe("12.34%");
    expect(promotionDiscount(promotionRecord(1))).toContain("2,500.00");
    expect(
      parseWorkPromotions({ items: [promotionRecord(1)] }).items[0].usageLimit,
    ).toBeNull();
  });
  it("rejects malformed windows, duplicate IDs and inconsistent discounts/limits", () => {
    const row = promotionRecord();
    for (const value of [
      { ...row, endsAt: row.startsAt },
      { ...row, name: " " },
      { ...row, fixedAmountKobo: "100" },
      { ...row, usageLimit: 1, perCustomerLimit: 2 },
    ])
      expect(() => parseWorkPromotions({ items: [value] })).toThrow();
    expect(() => parseWorkPromotions({ items: [row, row] })).toThrow();
  });
  it("encodes literal search and combines only configured filters", () => {
    const q = workPromotionsQuery(
      new URLSearchParams({
        search: " CARE%_ ",
        isActive: "false",
        discountType: "FIXED_AMOUNT",
      }),
    );
    expect(q.invalid).toBe(false);
    expect(q.api.get("search")).toBe("CARE%_");
    expect(q.path).toContain("search=CARE%25_");
    expect(promotionMatchesFilters(promotionRecord(1), q.api)).toBe(true);
    expect(promotionMatchesFilters(promotionRecord(), q.api)).toBe(false);
  });
  it("blocks invalid/repeated filters and strips invalid cursor trails", () => {
    for (const query of [
      "search=a&search=b",
      "discountType=OTHER",
      "isActive=1",
      "cursor=bad",
      "search=" + "x".repeat(161),
    ])
      expect(workPromotionsQuery(new URLSearchParams(query)).invalid).toBe(true);
    expect(
      workPromotionsQuery(
        new URLSearchParams({ cursor: bookingId(1), _trail: "bad" }),
      ).params.has("_trail"),
    ).toBe(false);
  });
});
