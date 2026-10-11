import { describe, it, expect } from "vitest";
import { normalizeProductQuery, productApiPath } from "@/lib/product-discovery";

const id = "f6000000-0000-4000-8000-000000000003";
describe("public product discovery contract boundary", () => {
  it("does not leak UI history, unsupported filters or caller-controlled limits", () => {
    const result = productApiPath(
      new URLSearchParams(
        `search=Oil&categoryId=${id}&brand=Brand&make=Toyota&model=Camry&year=2023&featured=false&sort=price_asc&cursor=${id}&_trail=start&limit=999&isActive=false&minPriceKobo=1&inStock=true`,
      ),
    );
    expect(Object.fromEntries(new URLSearchParams(result.split("?")[1]))).toEqual({
      search: "Oil",
      categoryId: id,
      brand: "Brand",
      make: "Toyota",
      model: "Camry",
      year: "2023",
      featured: "false",
      minPriceKobo: "1",
      sort: "price_asc",
      cursor: id,
      limit: "12",
    });
  });
  it.each(["1885", "2101", "2e3", "2020.5"])(
    "rejects unsupported year %s on shared links",
    (year) => {
      const result = normalizeProductQuery(
        new URLSearchParams({ year, brand: "Example" }),
      );
      expect(result.invalid).toBe(true);
      expect(result.params.toString()).toBe("brand=Example");
    },
  );
  it("drops invalid text, IDs and enums while preserving valid selections", () => {
    const result = normalizeProductQuery(
      new URLSearchParams({
        search: "bad\u0000text",
        categoryId: "bad",
        featured: "yes",
        sort: "year_desc",
        brand: "x".repeat(101),
        make: " Toyota ",
        model: " Camry ",
        year: "2100",
      }),
    );
    expect(result.invalid).toBe(true);
    expect(Object.fromEntries(result.params)).toEqual({
      make: "Toyota",
      model: "Camry",
      year: "2100",
    });
  });
  it("retains reloadable cursor history but discards invalid or excessive trails", () => {
    expect(
      normalizeProductQuery(
        new URLSearchParams(`cursor=${id}&_trail=start,${id}`),
      ).params.get("_trail"),
    ).toBe(`start,${id}`);
    for (const trail of ["bad", `start,${Array(50).fill(id).join(",")}`])
      expect(
        normalizeProductQuery(
          new URLSearchParams({ cursor: id, _trail: trail }),
        ).params.has("_trail"),
      ).toBe(false);
    expect(
      normalizeProductQuery(new URLSearchParams("_trail=start")).params.has("_trail"),
    ).toBe(false);
  });
  it("bounds signed cursor histories and validates price/availability filters", () => {
    const cursor = "a".repeat(220);
    const query = new URLSearchParams({
      cursor,
      _trail: `start,${cursor}`,
      minPriceKobo: "0",
      maxPriceKobo: "100",
      availability: "in_stock",
    });
    expect(normalizeProductQuery(query).params.get("_trail")).toBe(`start,${cursor}`);
    expect(productApiPath(query)).toContain("/products/discovery?");
    expect(productApiPath(query)).not.toContain("_trail");
    query.set("_trail", `start,${Array(20).fill(cursor).join(",")}`);
    expect(normalizeProductQuery(query).params.has("_trail")).toBe(false);
    query.set("minPriceKobo", "101");
    const invalid = normalizeProductQuery(query);
    expect(invalid.invalid).toBe(true);
    expect(invalid.params.has("cursor")).toBe(false);
    expect(invalid.params.has("minPriceKobo")).toBe(false);
  });
});
