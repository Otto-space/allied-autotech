import { describe, expect, it } from "vitest";
import { isIndependentQuotationReviewer } from "../../src/modules/service-operations/quotation-reviewer.js";

describe("independent quotation approval", () => {
  it("rejects a preparer approving their own quotation", () => {
    expect(isIndependentQuotationReviewer("staff-one", "staff-one")).toBe(false);
  });
  it("allows a different eligible reviewer", () => {
    expect(isIndependentQuotationReviewer("staff-two", "staff-one")).toBe(true);
  });
  it("does not treat a missing staff profile as an independent staff reviewer", () => {
    expect(isIndependentQuotationReviewer(null, "staff-one")).toBe(false);
  });
});
