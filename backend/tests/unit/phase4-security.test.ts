import { describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { errorCodes } from "../../src/common/errors/error-codes.js";
import {
  compatibilityCreateBodySchema,
  imageCreateBodySchema,
  productCreateBodySchema,
  productListQuerySchema,
} from "../../src/modules/catalog/catalog.schemas.js";
import {
  assertCatalogueAdministrator,
  assertCustomer,
} from "../../src/modules/catalog/catalog.policy.js";
import {
  idempotencyHeadersSchema,
  inventoryMovementBodySchema,
  inventoryReservationBodySchema,
} from "../../src/modules/inventory/inventory.schemas.js";
import { assertInventoryAccess } from "../../src/modules/inventory/inventory.policy.js";

const actor = (role: AuthenticatedActor["role"], mfa = true): AuthenticatedActor => ({
  userId: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  email: "actor@example.test",
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: mfa ? new Date() : null,
});

describe("Phase 4 validation and authorization", () => {
  it("accepts only integer-kobo strings and rejects mass assignment", () => {
    const valid = {
      categoryId: "00000000-0000-4000-8000-000000000003",
      name: "Oil Filter",
      slug: "oil-filter",
      sku: "FLT-001",
      priceKobo: "125000",
    };
    expect(productCreateBodySchema.safeParse(valid).success).toBe(true);
    expect(
      productCreateBodySchema.safeParse({ ...valid, priceKobo: 125000 }).success,
    ).toBe(false);
    expect(
      productCreateBodySchema.safeParse({ ...valid, ownerId: actor("CUSTOMER").userId })
        .success,
    ).toBe(false);
    expect(
      productCreateBodySchema.safeParse({ ...valid, compareAtPriceKobo: "100000" })
        .success,
    ).toBe(false);
  });

  it("allowlists catalogue filters, image URLs, and compatibility years", () => {
    expect(
      productListQuerySchema.safeParse({ sort: "price_asc", limit: "20" }).success,
    ).toBe(true);
    expect(productListQuerySchema.safeParse({ sort: "price;drop table" }).success).toBe(
      false,
    );
    expect(
      imageCreateBodySchema.safeParse({ url: "http://example.test/image.jpg" }).success,
    ).toBe(false);
    expect(
      imageCreateBodySchema.safeParse({ url: "https://user:pass@example.test/image.jpg" })
        .success,
    ).toBe(false);
    expect(
      compatibilityCreateBodySchema.safeParse({
        make: "Toyota",
        yearFrom: 2025,
        yearTo: 2020,
      }).success,
    ).toBe(false);
  });

  it("requires bounded idempotency keys and coherent inventory references", () => {
    expect(
      idempotencyHeadersSchema.safeParse({ "idempotency-key": "stock-unique-001" })
        .success,
    ).toBe(true);
    expect(
      idempotencyHeadersSchema.safeParse({ "idempotency-key": "short" }).success,
    ).toBe(false);
    expect(
      inventoryMovementBodySchema.safeParse({
        type: "SALE",
        quantity: 1,
        referenceType: "ORDER",
      }).success,
    ).toBe(false);
    expect(
      inventoryMovementBodySchema.safeParse({
        type: "ADJUSTMENT",
        targetQuantity: -1,
        note: "Correction",
      }).success,
    ).toBe(false);
    expect(
      inventoryReservationBodySchema.safeParse({
        quantity: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }).success,
    ).toBe(true);
  });

  it("fails closed for role, MFA, and branch authorization", () => {
    expect(() => assertCustomer(actor("STAFF"))).toThrowError(
      expect.objectContaining({ code: errorCodes.forbidden }),
    );
    expect(() => assertCatalogueAdministrator(actor("ADMIN", false))).toThrowError(
      expect.objectContaining({ code: errorCodes.forbidden }),
    );
    expect(() =>
      assertInventoryAccess(actor("STAFF"), "branch-a", "branch-b"),
    ).toThrowError(expect.objectContaining({ code: errorCodes.forbidden }));
    expect(() =>
      assertInventoryAccess(actor("STAFF"), "branch-a", "branch-a"),
    ).not.toThrow();
    expect(() => assertInventoryAccess(actor("ADMIN"), null, "branch-b")).not.toThrow();
  });
});
