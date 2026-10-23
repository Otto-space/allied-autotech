import { describe, expect, it } from "vitest";
import { parseCustomerVehicles } from "../../lib/api/vehicle-schemas";
import { garagePartsQuery } from "../../lib/customer-garage";
import type { CustomerVehicle } from "../../lib/api/vehicle-schemas";

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
  const vehicle: CustomerVehicle = {
    id: "10000000-0000-4000-8000-000000000001",
    make: "Toyota",
    model: "Corolla",
    year: 2018,
    nickname: "Private personal nickname",
    registrationNumber: "SYNTHETIC-REG",
    vin: "JTDBR32E720012345",
    color: null,
    mileageKm: null,
    vehicleModelId: "10000000-0000-4000-8000-000000000002",
    vehicleModel: {
      id: "10000000-0000-4000-8000-000000000002",
      makeId: "10000000-0000-4000-8000-000000000003",
      name: "Corolla",
      isActive: true,
      yearFrom: 2013,
      yearTo: 2019,
      make: {
        id: "10000000-0000-4000-8000-000000000003",
        name: "Toyota",
        isActive: true,
      },
    },
    engineCode: "2ZR-FE",
    market: "Japan",
    isDefault: true,
  };
  it("reuses only explicit catalogue identity and vehicle specifications in public search URLs", () => {
    expect(Object.fromEntries(garagePartsQuery(vehicle)!)).toEqual({
      vehicleMakeId: vehicle.vehicleModel!.makeId,
      vehicleModelId: vehicle.vehicleModelId,
      year: "2018",
      engineCode: "2ZR-FE",
      market: "Japan",
    });
    expect(garagePartsQuery(vehicle)!.toString()).not.toMatch(
      /Private|nickname|VIN|JTDB|REG|customer|default/i,
    );
  });
  it("does not guess links from legacy names or reuse an inconsistent or retired catalogue identity", () => {
    for (const changed of [
      { ...vehicle, vehicleModelId: null, vehicleModel: null },
      { ...vehicle, model: "Different model" },
      { ...vehicle, year: 2020 },
      { ...vehicle, vehicleModel: { ...vehicle.vehicleModel!, isActive: false } },
      {
        ...vehicle,
        vehicleModel: {
          ...vehicle.vehicleModel!,
          make: { ...vehicle.vehicleModel!.make, isActive: false },
        },
      },
      { ...vehicle, engineCode: "invalid\ncode" },
      { ...vehicle, chassisCode: vehicle.vin },
      { ...vehicle, engineCode: vehicle.registrationNumber },
    ])
      expect(garagePartsQuery(changed)).toBeNull();
  });
});
