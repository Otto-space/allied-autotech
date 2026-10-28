import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { InventoryService } from "../../src/modules/inventory/inventory.service.js";
import { inventoryReservationBodySchema } from "../../src/modules/inventory/inventory.schemas.js";
import { requestFingerprint } from "../../src/modules/inventory/inventory.types.js";

const inventoryId = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  role: "ADMIN",
  email: "operator@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };

function fixture(existing: Record<string, unknown> | null) {
  const executeRaw = vi.fn().mockResolvedValue(1);
  const reservationByKey = vi.fn().mockResolvedValue(existing);
  const transaction = {
    $executeRaw: executeRaw,
    inventory: {
      findUnique: vi.fn().mockResolvedValue({
        id: inventoryId,
        quantity: 5,
        reserved: 2,
        product: { id: randomUUID(), priceKobo: 1_000n },
        branch: { id: randomUUID() },
      }),
    },
    inventoryReservation: { findUnique: reservationByKey },
  };
  const database = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient;
  return { service: new InventoryService(database), executeRaw, reservationByKey };
}

describe("inventory reservation expiry and idempotent recovery", () => {
  it("returns the original authorized reservation after its requested expiry", async () => {
    const input = inventoryReservationBodySchema.parse({
      quantity: 2,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const original = {
      id: randomUUID(),
      inventoryId,
      requestHash: requestFingerprint({ operation: "reservation", inventoryId, input }),
      quantity: 2,
      expiresAt: new Date(input.expiresAt),
      status: "EXPIRED",
    };
    const { service, executeRaw, reservationByKey } = fixture(original);
    const result = await service.reserve(
      actor,
      inventoryId,
      input,
      "same-reservation-key",
      context,
    );

    expect(result).toMatchObject({
      replayed: true,
      reservation: { id: original.id, status: "EXPIRED" },
      inventory: { available: 3, product: { priceKobo: "1000" } },
    });
    expect(reservationByKey).toHaveBeenCalledOnce();
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("rejects a new expired or over-seven-day reservation before any stock write", async () => {
    for (const offset of [-60_000, 8 * 24 * 60 * 60 * 1_000]) {
      const input = inventoryReservationBodySchema.parse({
        quantity: 2,
        expiresAt: new Date(Date.now() + offset).toISOString(),
      });
      const { service, executeRaw } = fixture(null);
      await expect(
        service.reserve(actor, inventoryId, input, `new-reservation-${offset}`, context),
      ).rejects.toMatchObject({ statusCode: 422, code: "VALIDATION_FAILED" });
      expect(executeRaw).toHaveBeenCalledOnce();
    }
  });

  it("does not replay a different request with the same key", async () => {
    const input = inventoryReservationBodySchema.parse({
      quantity: 2,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const { service, executeRaw } = fixture({
      inventoryId,
      requestHash: "different-request",
    });
    await expect(
      service.reserve(actor, inventoryId, input, "reused-reservation-key", context),
    ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT" });
    expect(executeRaw).toHaveBeenCalledOnce();
  });
});
