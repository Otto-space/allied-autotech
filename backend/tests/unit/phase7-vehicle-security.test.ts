import { describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import {
  issueVehicleAssetTicket,
  readVehicleAssetTicket,
} from "../../src/common/security/asset-tickets.js";
import {
  assetUploadBodySchema,
  documentReviewBodySchema,
  publicVehicleListQuerySchema,
  vehicleCreateBodySchema,
} from "../../src/modules/vehicles/vehicles.schemas.js";
import {
  assertVehicleAdministrator,
  assertVehicleCustomer,
  assertVehicleOperator,
} from "../../src/modules/vehicles/vehicles.policy.js";
import {
  vehicleJsonSafe,
  vehiclePage,
} from "../../src/modules/vehicles/vehicles.types.js";
import {
  assertVehicleSaleCustomer,
  assertVehicleSaleOperator,
} from "../../src/modules/vehicle-sales/vehicle-sales.policy.js";
import {
  inspectionCreateBodySchema,
  inspectionTransitionBodySchema,
  negotiationBodySchema,
  transactionTransitionBodySchema,
} from "../../src/modules/vehicle-sales/vehicle-sales.schemas.js";
import {
  salesPage,
  vehicleSaleJson,
} from "../../src/modules/vehicle-sales/vehicle-sales.types.js";
import { matchesAllowedFileSignature } from "../../src/providers/storage/s3-object-storage.adapter.js";

const actor = (
  role: AuthenticatedActor["role"],
  mfaVerified = role !== "CUSTOMER",
): AuthenticatedActor => ({
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  email: `${role.toLowerCase()}@example.test`,
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: mfaVerified ? new Date() : null,
});

describe("Phase 7 vehicle security contracts", () => {
  it("defaults vehicle and sales authorization to deny", () => {
    expect(() => assertVehicleCustomer(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertVehicleCustomer(actor("STAFF"))).toThrow();
    expect(() => assertVehicleOperator(actor("STAFF", false))).toThrow();
    expect(() => assertVehicleOperator(actor("CUSTOMER"))).toThrow();
    expect(() => assertVehicleOperator(actor("STAFF"))).not.toThrow();
    expect(() => assertVehicleAdministrator(actor("STAFF"))).toThrow();
    expect(() => assertVehicleAdministrator(actor("ADMIN", false))).toThrow();
    expect(() => assertVehicleAdministrator(actor("SUPER_ADMIN"))).not.toThrow();
    expect(() => assertVehicleSaleCustomer(actor("ADMIN"))).toThrow();
    expect(() => assertVehicleSaleOperator(actor("ADMIN", false))).toThrow();
    expect(() => assertVehicleSaleOperator(actor("SUPER_ADMIN"))).not.toThrow();
  });

  it("encrypts upload capabilities and detects tampering", () => {
    const source = {
      actorUserId: crypto.randomUUID(),
      vehicleId: crypto.randomUUID(),
      kind: "DOCUMENT" as const,
      mimeType: "application/pdf",
      sizeBytes: 4_096,
      checksumSha256: "a".repeat(64),
    };
    const issued = issueVehicleAssetTicket(source);
    const envelope = Buffer.from(issued.ticket, "base64url").toString("utf8");
    expect(envelope).not.toContain(issued.payload.objectKey);
    expect(envelope).not.toContain(source.vehicleId);
    expect(readVehicleAssetTicket(issued.ticket)).toEqual(issued.payload);
    const tampered = `${issued.ticket.slice(0, -1)}${issued.ticket.endsWith("A") ? "B" : "A"}`;
    expect(() => readVehicleAssetTicket(tampered)).toThrow();
    const envelopeObject = JSON.parse(envelope) as Record<string, unknown>;
    for (const invalid of [
      { ...envelopeObject, v: 2 },
      { ...envelopeObject, kid: "unknown" },
      { ...envelopeObject, iv: 1 },
      { ...envelopeObject, ciphertext: null },
      { ...envelopeObject, tag: false },
    ]) {
      const encoded = Buffer.from(JSON.stringify(invalid)).toString("base64url");
      expect(() => readVehicleAssetTicket(encoded)).toThrow("Invalid asset ticket");
    }
  });

  it("enforces bounded asset types, sizes, and checksums", () => {
    const base = {
      kind: "IMAGE",
      mimeType: "image/webp",
      sizeBytes: 512_000,
      checksumSha256: "b".repeat(64),
    };
    expect(assetUploadBodySchema.safeParse(base).success).toBe(true);
    expect(
      assetUploadBodySchema.safeParse({ ...base, mimeType: "application/pdf" }).success,
    ).toBe(false);
    expect(
      assetUploadBodySchema.safeParse({ ...base, sizeBytes: 20 * 1024 * 1024 }).success,
    ).toBe(false);
    expect(
      assetUploadBodySchema.safeParse({ ...base, checksumSha256: "not-a-hash" }).success,
    ).toBe(false);
    expect(
      assetUploadBodySchema.safeParse({
        ...base,
        kind: "CONDITION_REPORT",
        mimeType: "application/pdf",
      }).success,
    ).toBe(true);
    expect(
      assetUploadBodySchema.safeParse({
        ...base,
        kind: "HANDOVER",
        mimeType: "image/png",
      }).success,
    ).toBe(false);
  });

  it("verifies file signatures instead of trusting upload MIME metadata", () => {
    expect(matchesAllowedFileSignature("application/pdf", Buffer.from("%PDF-1.7"))).toBe(
      true,
    );
    expect(matchesAllowedFileSignature("application/pdf", Buffer.from("<script>"))).toBe(
      false,
    );
    expect(
      matchesAllowedFileSignature(
        "image/png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(true);
    expect(matchesAllowedFileSignature("image/webp", Buffer.from("RIFF0000WEBP"))).toBe(
      true,
    );
    expect(
      matchesAllowedFileSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    ).toBe(true);
    expect(
      matchesAllowedFileSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0x00])),
    ).toBe(false);
    expect(matchesAllowedFileSignature("text/html", Buffer.from("safe"))).toBe(false);
  });

  it("rejects sensitive and unknown client-owned vehicle fields", () => {
    const input = {
      branchId: crypto.randomUUID(),
      stockNumber: "stock-7",
      make: "Toyota",
      model: "Corolla",
      year: new Date().getUTCFullYear(),
      priceKobo: "1",
    };
    expect(vehicleCreateBodySchema.safeParse(input).success).toBe(false);
    const { priceKobo: _clientPrice, ...serverOwnedPrice } = input;
    expect(vehicleCreateBodySchema.parse(serverOwnedPrice).stockNumber).toBe("STOCK-7");
  });

  it("allowlists public filters and dedicated lifecycle transitions", () => {
    expect(publicVehicleListQuerySchema.safeParse({ hidden: "true" }).success).toBe(
      false,
    );
    expect(
      publicVehicleListQuerySchema.safeParse({
        featured: "false",
        minPriceKobo: "200",
        maxPriceKobo: "100",
      }).success,
    ).toBe(false);
    expect(publicVehicleListQuerySchema.parse({ featured: "true" }).featured).toBe(true);
    expect(
      transactionTransitionBodySchema.safeParse({
        expectedVersion: 0,
        status: "PAYMENT_PENDING",
      }).success,
    ).toBe(true);
    for (const status of ["RESERVED", "HANDOVER_PENDING", "COMPLETED", "EXPIRED"])
      expect(
        transactionTransitionBodySchema.safeParse({ expectedVersion: 0, status }).success,
      ).toBe(false);
  });

  it("requires valid future-shaped inspection windows", () => {
    const start = new Date(Date.now() + 60_000).toISOString();
    expect(
      inspectionCreateBodySchema.safeParse({
        vehicleListingId: crypto.randomUUID(),
        preferredStartAt: start,
        preferredEndAt: new Date(Date.now() + 120_000).toISOString(),
      }).success,
    ).toBe(true);
    expect(
      inspectionCreateBodySchema.safeParse({
        vehicleListingId: crypto.randomUUID(),
        preferredStartAt: start,
        preferredEndAt: start,
      }).success,
    ).toBe(false);
  });

  it("enforces scheduling and document-review dependent fields", () => {
    expect(
      inspectionTransitionBodySchema.safeParse({
        expectedVersion: 0,
        status: "CONFIRMED",
      }).success,
    ).toBe(false);
    expect(
      inspectionTransitionBodySchema.safeParse({
        expectedVersion: 0,
        status: "RESCHEDULED",
        scheduledStartAt: new Date(Date.now() + 60_000).toISOString(),
        scheduledEndAt: new Date(Date.now() + 30_000).toISOString(),
      }).success,
    ).toBe(false);
    expect(
      inspectionTransitionBodySchema.safeParse({
        expectedVersion: 0,
        status: "CANCELLED",
      }).success,
    ).toBe(false);
    expect(
      inspectionTransitionBodySchema.safeParse({
        expectedVersion: 0,
        status: "COMPLETED",
      }).success,
    ).toBe(true);
    expect(
      documentReviewBodySchema.safeParse({
        expectedVersion: 0,
        status: "REJECTED",
      }).success,
    ).toBe(false);
    expect(
      documentReviewBodySchema.safeParse({
        expectedVersion: 0,
        status: "VERIFIED",
        rejectionReason: "not allowed",
      }).success,
    ).toBe(false);
    expect(
      documentReviewBodySchema.safeParse({
        expectedVersion: 0,
        status: "REJECTED",
        rejectionReason: "Unreadable evidence",
      }).success,
    ).toBe(true);
  });

  it("prevents a reservation requirement from exceeding the agreed price", () => {
    expect(
      negotiationBodySchema.safeParse({
        expectedVersion: 0,
        agreedPriceKobo: "1000",
        reservationRequiredKobo: "1001",
      }).success,
    ).toBe(false);
    expect(
      negotiationBodySchema.safeParse({
        expectedVersion: 0,
        agreedPriceKobo: "1000",
        reservationRequiredKobo: "1000",
      }).success,
    ).toBe(true);
  });

  it("serializes money and preserves pagination boundaries", () => {
    const now = new Date();
    const value = { amount: 10n, at: now, nested: [null, { amount: 20n }] };
    const expected = { amount: "10", at: now, nested: [null, { amount: "20" }] };
    expect(vehicleJsonSafe(value)).toEqual(expected);
    expect(vehicleSaleJson(value)).toEqual(expected);
    expect(vehiclePage([{ id: "one" }], 1)).toEqual({ items: [{ id: "one" }] });
    expect(vehiclePage([{ id: "one" }, { id: "two" }], 1)).toEqual({
      items: [{ id: "one" }],
      nextCursor: "one",
    });
    expect(salesPage([{ id: "one" }], 1)).toEqual({ items: [{ id: "one" }] });
    expect(salesPage([{ id: "one" }, { id: "two" }], 1)).toEqual({
      items: [{ id: "one" }],
      nextCursor: "one",
    });
  });
});
