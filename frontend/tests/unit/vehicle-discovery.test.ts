import { describe, expect, it } from "vitest";
import {
  koboToInput,
  nairaToKobo,
  normalizeVehicleQuery,
  vehicleApiPath,
} from "@/lib/vehicle-discovery";

describe("vehicle discovery contract", () => {
  it("uses the counted discovery API and preserves bounded opaque cursor history", () => {
    const cursor = `${"A".repeat(120)}_${"a".repeat(64)}`;
    const query = new URLSearchParams({ cursor, _trail: `start,${cursor}` });
    expect(normalizeVehicleQuery(query).params.get("_trail")).toBe(`start,${cursor}`);
    expect(vehicleApiPath(query)).toMatch(/^\/public\/vehicles\/discovery\?/);
    query.set("_trail", ["start", ...Array(25).fill(cursor)].join(","));
    expect(normalizeVehicleQuery(query).params.has("_trail")).toBe(false);
    expect(normalizeVehicleQuery(query).params.get("cursor")).toBe(cursor);
  });
  it.each([
    ["0.01", "1"],
    ["4500000.50", "450000050"],
    ["99999999999999.99", "9999999999999999"],
    ["0001.2", "120"],
    ["", ""],
  ])("converts %s without floating point rounding", (input, expected) => {
    expect(nairaToKobo(input)).toBe(expected);
    if (expected) expect(nairaToKobo(koboToInput(expected))).toBe(expected);
  });
  it.each(["0", "-1", "1e6", "1.001", "1,000", "100000000000000", "Infinity", "NaN"])(
    "rejects invalid price %s",
    (value) => expect(nairaToKobo(value)).toBeUndefined(),
  );
  it("keeps only supported API parameters, excluding presentation history and staff-only filters", () => {
    const cursor = "f6000000-0000-4000-8000-000000000021";
    const path = vehicleApiPath(
      new URLSearchParams(
        `make=Toyota&bodyType=SUV&featured=false&cursor=${cursor}&_trail=start&status=SOLD&branchId=any&limit=999&sort=price_asc`,
      ),
    );
    expect(Object.fromEntries(new URLSearchParams(path.split("?")[1]))).toEqual({
      make: "Toyota",
      bodyType: "SUV",
      featured: "false",
      cursor,
      sort: "price_asc",
      limit: "12",
    });
  });
  it("does not send invalid shared-link values to the API", () => {
    const { params, invalid } = normalizeVehicleQuery(
      new URLSearchParams(
        "year=2201&fuelType=GAS&make=Toyota&minPriceKobo=200&maxPriceKobo=100&cursor=wrong",
      ),
    );
    expect(invalid).toBe(true);
    expect(params.toString()).toBe("make=Toyota");
  });
  it("retains valid lower and upper contract boundaries", () => {
    expect(
      normalizeVehicleQuery(
        new URLSearchParams(
          "year=1886&minPriceKobo=1&maxPriceKobo=9999999999999999&sort=newest",
        ),
      ).invalid,
    ).toBe(false);
    expect(
      normalizeVehicleQuery(new URLSearchParams("year=2200")).params.get("year"),
    ).toBe("2200");
  });
  it("rejects malformed history but accepts a shareable valid cursor trail", () => {
    const cursor = "f6000000-0000-4000-8000-000000000021";
    expect(
      normalizeVehicleQuery(
        new URLSearchParams(`cursor=${cursor}&_trail=start,${cursor}`),
      ).params.get("_trail"),
    ).toBe(`start,${cursor}`);
    expect(
      normalizeVehicleQuery(
        new URLSearchParams(`cursor=${cursor}&_trail=start,<script>`),
      ).params.has("_trail"),
    ).toBe(false);
  });
});
