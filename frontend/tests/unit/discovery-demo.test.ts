import { describe, expect, it } from "vitest";
import { parseCategories, parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { parseVehicleDiscovery } from "@/lib/api/vehicle-schemas";
import { parseServices } from "@/lib/api/public-schemas";
import { demoModels } from "../fixtures/discovery-demo.mjs";
import { discoveryResponse } from "../fixtures/discovery-response.mjs";

const response = (
  path: string,
  mode: "populated" | "empty" | "error" | "no-fitment" = "populated",
) => discoveryResponse(new URL(`/api/v1/public/${path}`, "http://fixture.invalid"), mode);

describe("isolated populated catalogue contract", () => {
  it("validates all sample records with the real public parsers", () => {
    const parts = parseProductDiscovery(response("catalog/products/discovery?limit=50"));
    const vehicles = parseVehicleDiscovery(response("vehicles/discovery?limit=50"));
    const services = parseServices(response("services"));
    expect(parts.items).toHaveLength(20);
    expect(vehicles.items).toHaveLength(12);
    expect(services.items).toHaveLength(4);
    expect(parseCategories(response("catalog/categories")).items).toHaveLength(5);
    for (const item of [...parts.items, ...services.items])
      expect(item.name).toMatch(/^DEMO /);
    for (const item of vehicles.items) expect(item.title).toMatch(/^DEMO /);
  });

  it("exercises a second page, filtered matches and no matches independently", () => {
    const first = parseProductDiscovery(response("catalog/products/discovery?limit=12"));
    const next = parseProductDiscovery(
      response(`catalog/products/discovery?limit=12&cursor=${first.nextCursor}`),
    );
    expect(first.items).toHaveLength(12);
    expect(next.items).toHaveLength(8);
    expect(new Set([...first.items, ...next.items].map((item) => item.id)).size).toBe(20);
    expect(
      parseProductDiscovery(response("catalog/products/discovery?search=brake"))
        .totalMatches,
    ).toBe(5);
    expect(
      parseProductDiscovery(response("catalog/products/discovery?search=not-a-demo-part"))
        .totalMatches,
    ).toBe(0);
    expect(first.totalMatches).toBe(20);
  });

  it("never invents a verified compatibility decision", () => {
    const parts = parseProductDiscovery(
      response(
        `catalog/products/discovery?vehicleModelId=${demoModels[0].id}&fitment=verified`,
      ),
    );
    expect(parts.items).toEqual([]);
    expect(parts.verifiedMatches).toBe(0);
  });

  it("separates missing fitment choices from an empty catalogue", () => {
    expect(response("fitment/makes", "no-fitment")).toEqual({ items: [] });
    expect(
      parseProductDiscovery(response("catalog/products/discovery", "no-fitment"))
        .totalMatches,
    ).toBe(20);
    expect(
      parseProductDiscovery(response("catalog/products/discovery", "empty")).totalMatches,
    ).toBe(0);
    expect(parseVehicleDiscovery(response("vehicles/discovery", "empty")).items).toEqual(
      [],
    );
    expect(parseServices(response("services", "empty")).items).toEqual([]);
  });
});
