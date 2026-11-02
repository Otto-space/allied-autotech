import { describe, expect, it } from "vitest";
import { resolvePublicSearch } from "@/lib/public-search";

describe("public catalogue search", () => {
  it("keeps combined and Help searches on the public result surface", () => {
    for (const scope of ["all", "help"])
      expect(resolvePublicSearch({ scope, search: "inspection" })).toEqual({
        scope,
        query: "inspection",
      });
  });
  it("routes a literal phrase only to the selected public catalogue", () => {
    for (const scope of ["services", "parts", "vehicles"]) {
      const result = resolvePublicSearch({ scope, search: "  brake pads & filters  " });
      const url = new URL(result.href!, "https://example.test");
      expect(url.pathname).toBe(`/${scope}`);
      expect([...url.searchParams]).toEqual([["search", "brake pads & filters"]]);
    }
  });
  it("rejects arbitrary destinations, repeated parameters and control characters", () => {
    for (const input of [
      { scope: "https://elsewhere.test", search: "diagnostics" },
      { scope: "//elsewhere.test", search: "diagnostics" },
      { scope: ["services", "parts"], search: "diagnostics" },
      { scope: "services", search: ["one", "two"] },
      { scope: "services", search: "one\ntwo" },
    ]) {
      expect(resolvePublicSearch(input).href).toBeUndefined();
      expect(resolvePublicSearch(input).error).toBeTruthy();
    }
  });
  it("respects each existing catalogue's real query limit and keeps invalid input for correction", () => {
    for (const [scope, limit] of [
      ["services", 100],
      ["parts", 100],
      ["vehicles", 100],
    ] as const) {
      expect(resolvePublicSearch({ scope, search: "x".repeat(limit) }).href).toBeTruthy();
      const result = resolvePublicSearch({ scope, search: "x".repeat(limit + 1) });
      expect(result.href).toBeUndefined();
      expect(result.query).toHaveLength(limit + 1);
      expect(result.error).toContain(String(limit));
    }
    expect(resolvePublicSearch({})).toEqual({ scope: "all", query: "" });
    expect(resolvePublicSearch({ search: "   " }).href).toBeUndefined();
  });
});
