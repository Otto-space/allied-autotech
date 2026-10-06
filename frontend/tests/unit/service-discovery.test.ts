import { describe, it, expect } from "vitest";
import { normalizeServiceQuery, serviceApiPath } from "@/lib/service-discovery";
const id = "f8000000-0000-4000-8000-000000000001";
describe("service discovery contract boundary", () => {
  it("forwards only supported public filters with a bounded page size", () => {
    const path = serviceApiPath(
      new URLSearchParams(
        `pricingType=FIXED&cursor=${id}&_trail=start&limit=999&isActive=false&search=oil&sort=price`,
      ),
    );
    expect(Object.fromEntries(new URLSearchParams(path.split("?")[1]))).toEqual({
      pricingType: "FIXED",
      cursor: id,
      limit: "12",
    });
  });
  it("flags malformed shared filters instead of sending invalid API queries", () => {
    const result = normalizeServiceQuery(
      new URLSearchParams("pricingType=free&cursor=not-a-uuid"),
    );
    expect(result.invalid).toBe(true);
    expect(result.params.toString()).toBe("");
  });
  it("retains valid pricing while discarding unsafe or unbounded navigation history", () => {
    for (const trail of ["invalid", "start,invalid", Array(52).fill(id).join(",")]) {
      const result = normalizeServiceQuery(
        new URLSearchParams({ pricingType: "QUOTE_REQUIRED", cursor: id, _trail: trail }),
      );
      expect(result.params.get("pricingType")).toBe("QUOTE_REQUIRED");
      expect(result.params.has("_trail")).toBe(false);
    }
    expect(
      normalizeServiceQuery(
        new URLSearchParams({ cursor: id, _trail: `start,${id}` }),
      ).params.get("_trail"),
    ).toBe(`start,${id}`);
  });
});
