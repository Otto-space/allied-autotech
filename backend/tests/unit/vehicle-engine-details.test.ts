import { expect, it } from "vitest";
import {
  vehicleCreateBodySchema,
  vehicleUpdateBodySchema,
} from "../../src/modules/vehicles/vehicles.schemas.js";

const input = {
  branchId: "11111111-1111-4111-8111-111111111111",
  stockNumber: "SYNTHETIC",
  make: "Synthetic",
  model: "Test",
  year: 2026,
};
it("accepts supplied engine description independently from exact capacity, power, fuel, drive and features", () => {
  const engineDetails = "2.0L I-4 DI, DOHC, VVT, TURBO, PREMIUM, 252HP";
  expect(
    vehicleCreateBodySchema.parse({
      ...input,
      engineDetails,
      engineCapacityCc: 1998,
      features: ["Audio, navigation"],
      powertrain: "HEV",
      fuelType: "PETROL",
      driveType: "RWD",
    }),
  ).toMatchObject({
    engineDetails,
    engineCapacityCc: 1998,
    features: ["Audio, navigation"],
    powertrain: "HEV",
    fuelType: "PETROL",
    driveType: "RWD",
  });
  expect(
    vehicleUpdateBodySchema.parse({ expectedVersion: 3, engineDetails: null }),
  ).toEqual({ expectedVersion: 3, engineDetails: null });
});
it("keeps old clients compatible and enforces engine and feature limits on the server", () => {
  expect(vehicleCreateBodySchema.parse(input)).not.toHaveProperty("engineDetails");
  expect(vehicleCreateBodySchema.safeParse({ ...input, powertrain: "BEV" }).success).toBe(
    true,
  );
  for (const patch of [
    { engineDetails: "x".repeat(501) },
    { engineDetails: " " },
    { features: ["Audio", " audio "] },
    { features: ["x".repeat(81)] },
    { features: Array.from({ length: 41 }, (_, i) => String(i)) },
  ])
    expect(vehicleCreateBodySchema.safeParse({ ...input, ...patch }).success).toBe(false);
});
