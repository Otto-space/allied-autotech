import { describe, expect, it } from "vitest";
import { parseCustomerVehicles } from "../../lib/api/vehicle-schemas";

describe("customer vehicle API response", () => {
  it("accepts an empty vehicles list from the customer API", () => {
    expect(parseCustomerVehicles({ vehicles: [] }).items).toEqual([]);
  });

  it("preserves vehicle details and the next-page cursor", () => {
    const vehicle = {
      id: "10000000-0000-4000-8000-000000000001",
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      registrationNumber: null,
      vin: null,
      color: null,
      mileageKm: 0,
    };
    expect(
      parseCustomerVehicles({ vehicles: [vehicle], nextCursor: vehicle.id }),
    ).toEqual({ items: [vehicle], nextCursor: vehicle.id });
  });

  it("rejects malformed responses instead of treating them as an empty garage", () => {
    for (const response of [{}, { items: [] }, { vehicles: null }, { vehicles: [{}] }]) {
      expect(() => parseCustomerVehicles(response)).toThrow();
    }
  });
});
