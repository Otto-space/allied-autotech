import { describe, expect, it } from "vitest";
import {
  normalizeVehicleQuery,
  vehicleApiPath,
  vehicleLabel,
} from "@/lib/vehicle-discovery";
import { countries, europeanCountryCodes } from "@/lib/reference/countries";
import { resolveCountry } from "@/app/components/country-field";
import {
  recordSchema,
  vehicleDefaults,
  vehicleRecordBody,
} from "@/lib/forms/vehicle-record";

describe("vehicle attributes and shareable filters", () => {
  it("keeps powertrain separate from fuel and preserves explicit condition and origin", () => {
    const query = new URLSearchParams({
      condition: "FOREIGN_USED",
      powertrain: "PHEV",
      fuelType: "HYBRID",
      manufactureCountryCode: "JP",
      minYear: "2018",
      maxYear: "2024",
      maxMileageKm: "75000",
      sort: "mileage_asc",
    });
    expect(normalizeVehicleQuery(query).invalid).toBe(false);
    const sent = new URLSearchParams(vehicleApiPath(query).split("?")[1]);
    for (const [key, value] of query) expect(sent.get(key)).toBe(value);
    expect(vehicleLabel("USED")).toBe("Used (origin unspecified)");
    expect(vehicleLabel("LOCALLY_USED")).toBe("Nigerian (locally) used");
  });
  it.each([
    "manufactureCountryCode=ZZ",
    "minYear=2025&maxYear=2018",
    "minMileageKm=-1",
    "minEngineCapacityCc=30001",
    "powertrain=HYBRID",
    "model=Corolla",
    "seats=1e2",
    "year=2020&minYear=2021",
  ])("rejects invalid shared filters: %s", (input) => {
    expect(normalizeVehicleQuery(new URLSearchParams(input)).invalid).toBe(true);
  });
  it("uses geographic Europe rather than a brand or EU shortcut", () => {
    expect(countries).toHaveLength(249);
    expect(new Set(countries.map((country) => country.code)).size).toBe(249);
    expect(europeanCountryCodes).toContain("GB");
    expect(europeanCountryCodes).toContain("CH");
    expect(europeanCountryCodes).not.toContain("TR");
    expect(europeanCountryCodes).not.toContain("JP");
    expect(
      normalizeVehicleQuery(
        new URLSearchParams("manufactureRegion=EUROPE&manufactureCountryCode=CN"),
      ).invalid,
    ).toBe(true);
    expect(
      normalizeVehicleQuery(
        new URLSearchParams("manufactureRegion=EUROPE&manufactureCountryCode=DE"),
      ).invalid,
    ).toBe(false);
  });
  it.each([
    ["Japan", "JP"],
    ["South Korea", "KR"],
    ["UK", "GB"],
    ["USA", "US"],
    ["Cote d'Ivoire", "CI"],
    ["Türkiye", "TR"],
  ])("resolves country aliases and accents: %s", (name, code) => {
    expect(resolveCountry(name)).toBe(code);
  });
  it("preserves unknown staff fields and validates real recorded attributes", () => {
    const defaults = vehicleDefaults(undefined, "f6000000-0000-4000-8000-000000000001");
    expect(defaults).toMatchObject({
      condition: "USED",
      manufactureCountryCode: "",
      powertrain: "",
      engineCapacityCc: "",
      features: "",
    });
    const values = {
      ...defaults,
      stockNumber: "CAR-01",
      make: "Toyota",
      model: "Corolla",
      year: "2018",
      condition: "FOREIGN_USED" as const,
      manufactureCountryCode: "JP",
      powertrain: "HEV" as const,
      engineCapacityCc: "1800",
      features: "Sunroof, Rear camera",
    };
    expect(recordSchema.safeParse(values).success).toBe(true);
    expect(vehicleRecordBody(values)).toMatchObject({
      condition: "FOREIGN_USED",
      manufactureCountryCode: "JP",
      powertrain: "HEV",
      engineCapacityCc: 1800,
      features: ["Sunroof", "Rear camera"],
    });
    expect(
      recordSchema.safeParse({ ...values, manufactureCountryCode: "Unknown country" })
        .success,
    ).toBe(false);
    expect(
      recordSchema.safeParse({ ...values, features: "Sunroof, sunroof" }).success,
    ).toBe(false);
  });
});
