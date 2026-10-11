import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  savedVehicleCursor,
  readSavedVehicleCursor,
} from "../../src/modules/vehicles/saved-vehicle-cursor.js";
import { savedVehiclePageQuerySchema } from "../../src/modules/vehicles/vehicles.schemas.js";
import { VehiclesRepository } from "../../src/modules/vehicles/vehicles.repository.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

describe("Saved vehicle paging", () => {
  it("authenticates the position for its owner without depending on a saved row", () => {
    const customer = randomUUID(),
      id = randomUUID();
    const cursor = savedVehicleCursor(customer, id);
    expect(readSavedVehicleCursor(customer, cursor)).toBe(id);
    expect(readSavedVehicleCursor(customer)).toBeUndefined();
    for (const invalid of [
      cursor.slice(0, -1),
      `${randomUUID()}${cursor.slice(36)}`,
      "",
      id,
      `${id}_${"0".repeat(64)}`,
    ]) {
      expect(() => readSavedVehicleCursor(customer, invalid)).toThrow(
        "Invalid saved-vehicle cursor",
      );
    }
    expect(() => readSavedVehicleCursor(randomUUID(), cursor)).toThrow(
      "Invalid saved-vehicle cursor",
    );
  });
  it("accepts a bounded scalar page size and rejects unknown or repeated parameters", () => {
    expect(savedVehiclePageQuerySchema.parse({})).toEqual({ limit: 12 });
    expect(savedVehiclePageQuerySchema.parse({ limit: "50" })).toEqual({ limit: 50 });
    for (const limit of [
      "0",
      "51",
      "1.5",
      "1e1",
      "",
      " 12",
      ["12"],
      ["1", "2"],
      {},
      true,
    ]) {
      expect(savedVehiclePageQuerySchema.safeParse({ limit }).success).toBe(false);
    }
    expect(
      savedVehiclePageQuerySchema.safeParse({ customerId: randomUUID() }).success,
    ).toBe(false);
  });
  it("bounds the database query and scopes the keyset plus visibility to the owner", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new VehiclesRepository({
      savedVehicle: { findMany },
    } as unknown as PrismaClient);
    const customerId = randomUUID(),
      afterId = randomUUID();
    await repository.listSavedPage(customerId, 12, afterId);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerId,
          id: { gt: afterId },
          vehicleListing: { status: "AVAILABLE", branch: { isActive: true } },
        },
        take: 13,
        orderBy: { id: "asc" },
      }),
    );
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("cursor");
    const projection = JSON.stringify(findMany.mock.calls[0]?.[0].select);
    for (const privateField of [
      "vin",
      "acquisitionCostKobo",
      "objectKey",
      "passwordHash",
    ])
      expect(projection).not.toContain(privateField);
  });
});
