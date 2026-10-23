import { describe, expect, it } from "vitest";
import {
  clearVehicleSelection,
  partsEnquiryHref,
  productFitmentHref,
} from "@/lib/parts-fitment";
import { normalizeProductQuery, productApiPath } from "@/lib/product-discovery";
import {
  canEditFitment,
  canReviewFitment,
  staffFitmentQuery,
  type FitmentAccess,
} from "@/lib/admin/parts-fitment";

const id = (value: number) =>
  `f7300000-0000-4000-8000-${String(value).padStart(12, "0")}`;
describe("parts fitment URL and permission boundaries", () => {
  it("carries validated car details through a product and existing enquiry without identity or redirects", () => {
    const params = normalizeProductQuery(
      new URLSearchParams({
        vehicleMakeId: id(1),
        vehicleModelId: id(2),
        year: "2018",
        engineCode: "2ZR-FE",
        market: "Japan",
        categoryId: id(3),
        fitment: "verified",
        condition: "NEW",
        customerId: id(99),
        email: "spoof@example.test",
        redirect: "https://example.test",
        cursor: id(4),
        _trail: "start",
      }),
    ).params;
    const product = new URL(productFitmentHref(id(5), params), "https://allied.example");
    expect(Object.fromEntries(product.searchParams)).toEqual({
      vehicleMakeId: id(1),
      vehicleModelId: id(2),
      year: "2018",
      fitment: "verified",
      engineCode: "2ZR-FE",
      market: "Japan",
    });
    const enquiry = new URL(partsEnquiryHref(params, id(5)), "https://allied.example");
    expect(enquiry.pathname).toBe("/contact");
    expect(enquiry.searchParams.get("part_productId")).toBe(id(5));
    expect(enquiry.searchParams.get("part_engineCode")).toBe("2ZR-FE");
    expect(
      [...enquiry.searchParams.keys()].some((key) =>
        /customer|email|redirect|cursor|trail|fitment/.test(key),
      ),
    ).toBe(false);
  });
  it("clears dependent car details together while preserving a customer's part filters", () => {
    const params = new URLSearchParams({
      vehicleMakeId: id(1),
      vehicleModelId: id(2),
      year: "2018",
      trim: "X",
      position: "front",
      fitment: "verified",
      make: "Legacy",
      model: "Legacy",
      categoryId: id(3),
      search: "brake pads",
    });
    clearVehicleSelection(params);
    expect(Object.fromEntries(params)).toEqual({
      categoryId: id(3),
      search: "brake pads",
    });
  });
  it("rejects partial or conflicting catalogue selections before making a public request", () => {
    for (const input of [
      { vehicleMakeId: id(1) },
      { vehicleModelId: id(2) },
      { year: "2018", position: "front" },
      { vehicleModelId: id(2), year: "2018", make: "Toyota" },
    ]) {
      const query = normalizeProductQuery(new URLSearchParams(input));
      expect(query.invalid).toBe(true);
    }
    expect(
      new URL(
        productApiPath(
          new URLSearchParams({
            vehicleModelId: id(2),
            year: "2018",
            engineCode: "2ZR-FE",
            condition: "USED",
            classification: "GENUINE_OEM",
            productType: "BRAKE_PADS",
            parentCategoryId: id(3),
          }),
        ),
        "https://allied.example",
      ).searchParams.get("parentCategoryId"),
    ).toBe(id(3));
  });
  it("keeps rule viewing and browser state out of the scoped list API", () => {
    const query = staffFitmentQuery(
      new URLSearchParams({
        productId: id(1),
        ruleId: id(2),
        reviewStatus: "PENDING",
        limit: "999",
        branchId: id(99),
      }),
    );
    expect(query.invalid).toBe(false);
    expect(Object.fromEntries(query.api)).toEqual({
      limit: "25",
      productId: id(1),
      reviewStatus: "PENDING",
    });
    for (const text of [
      `ruleId=${id(2)}`,
      `view=create&productId=${id(1)}&ruleId=${id(2)}`,
      "reviewStatus=VERIFIED",
      `productId=${id(1)}&productId=${id(2)}`,
    ])
      expect(staffFitmentQuery(new URLSearchParams(text)).invalid).toBe(true);
  });
  const access: FitmentAccess = {
    canAuthor: true,
    canReview: true,
    globalAuthor: false,
    globalReviewer: false,
    authorBranches: [id(1)],
    reviewBranches: [id(1)],
    branches: [{ id: id(1), name: "Permitted branch" }],
  };
  const rule = {
    branchId: id(1),
    reviewStatus: "PENDING" as const,
    createdByUserId: id(3),
    updatedByUserId: id(4),
  };
  it("withholds review for authors, last editors, foreign branches and completed states", () => {
    expect(canReviewFitment(access, rule, id(5))).toBe(true);
    expect(canReviewFitment(access, rule, id(3))).toBe(false);
    expect(canReviewFitment(access, rule, id(4))).toBe(false);
    expect(canReviewFitment(access, { ...rule, branchId: id(2) }, id(5))).toBe(false);
    expect(canReviewFitment(access, { ...rule, branchId: null }, id(5))).toBe(false);
    expect(canReviewFitment(access, { ...rule, reviewStatus: "APPROVED" }, id(5))).toBe(
      false,
    );
    expect(canReviewFitment({ ...access, globalReviewer: true }, rule, id(3))).toBe(
      false,
    );
  });
  it("does not treat review permission as edit permission or allow editing retired evidence", () => {
    expect(canEditFitment(access, rule)).toBe(true);
    expect(canEditFitment({ ...access, canAuthor: false }, rule)).toBe(false);
    expect(canEditFitment(access, { ...rule, branchId: id(2) })).toBe(false);
    expect(canEditFitment(access, { ...rule, reviewStatus: "RETIRED" })).toBe(false);
  });
});
