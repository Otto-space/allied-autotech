import { describe, expect, it } from "vitest";
import {
  checkoutBodySchema,
  orderTransitionBodySchema,
} from "../../src/modules/orders/orders.schemas.js";
import {
  assertCustomer,
  assertOrderOperator,
} from "../../src/modules/orders/orders.policy.js";
import { jsonSafe, page } from "../../src/modules/orders/orders.types.js";
import {
  assertPromotionAdministrator,
  assertPromotionCustomer,
} from "../../src/modules/promotions/promotions.policy.js";
import {
  promotionCreateBodySchema,
  promotionListQuerySchema,
  promotionUpdateBodySchema,
} from "../../src/modules/promotions/promotions.schemas.js";
import { invoiceCreateBodySchema } from "../../src/modules/billing/billing.schemas.js";
import {
  assertInvoiceCustomer,
  assertInvoiceOperator,
} from "../../src/modules/billing/billing.policy.js";
import { invoiceJsonSafe, invoicePage } from "../../src/modules/billing/billing.types.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

const actor = (
  role: AuthenticatedActor["role"],
  mfa = role !== "CUSTOMER",
): AuthenticatedActor => ({
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  email: `${role.toLowerCase()}@example.test`,
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: mfa ? new Date() : null,
});

describe("Phase 6 commerce security contracts", () => {
  it("defaults authorization to deny and requires privileged MFA", () => {
    expect(() => assertCustomer(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertCustomer(actor("STAFF"))).toThrow();
    expect(() => assertOrderOperator(actor("STAFF", false))).toThrow();
    expect(() => assertOrderOperator(actor("STAFF"))).not.toThrow();
  });
  it("rejects client-owned checkout prices, totals, identities, and incomplete delivery", () => {
    const branchId = crypto.randomUUID();
    expect(
      checkoutBodySchema.safeParse({
        branchId,
        fulfillmentMethod: "COLLECTION",
        totalKobo: "1",
      }).success,
    ).toBe(false);
    expect(
      checkoutBodySchema.safeParse({ branchId, fulfillmentMethod: "DELIVERY" }).success,
    ).toBe(false);
    expect(
      checkoutBodySchema.safeParse({ branchId, customerId: crypto.randomUUID() }).success,
    ).toBe(false);
  });
  it("requires valid promotion shapes and rejects client invoice amounts", () => {
    const base = {
      name: "Ten percent",
      code: "SAVE10",
      discountType: "PERCENTAGE",
      percentageBasisPoints: 1000,
      startsAt: new Date(Date.now() + 1_000).toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(promotionCreateBodySchema.safeParse(base).success).toBe(true);
    expect(
      promotionCreateBodySchema.safeParse({ ...base, fixedAmountKobo: "100" }).success,
    ).toBe(false);
    expect(
      invoiceCreateBodySchema.safeParse({
        sourceType: "ORDER",
        sourceId: crypto.randomUUID(),
        totalKobo: "1",
      }).success,
    ).toBe(false);
  });
  it("allowlists lifecycle mutations and optimistic versions", () => {
    expect(
      orderTransitionBodySchema.safeParse({ status: "PENDING", expectedVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      orderTransitionBodySchema.safeParse({ status: "CONFIRMED", expectedVersion: -1 })
        .success,
    ).toBe(false);
  });
  it("covers every promotion shape, bounded list input, and patch requirement", () => {
    const startsAt = new Date(Date.now() + 60_000).toISOString();
    const endsAt = new Date(Date.now() + 120_000).toISOString();
    const percentage = {
      name: "Ten percent",
      code: "save10",
      discountType: "PERCENTAGE",
      percentageBasisPoints: 1000,
      startsAt,
      endsAt,
    };
    expect(promotionCreateBodySchema.parse(percentage).code).toBe("SAVE10");
    expect(
      promotionCreateBodySchema.safeParse({
        ...percentage,
        discountType: "FIXED_AMOUNT",
        percentageBasisPoints: undefined,
        fixedAmountKobo: "2500",
      }).success,
    ).toBe(true);
    expect(
      promotionCreateBodySchema.safeParse({ ...percentage, endsAt: startsAt }).success,
    ).toBe(false);
    expect(
      promotionCreateBodySchema.safeParse({
        ...percentage,
        usageLimit: 1,
        perCustomerLimit: 2,
      }).success,
    ).toBe(false);
    expect(promotionUpdateBodySchema.safeParse({ expectedVersion: 0 }).success).toBe(
      false,
    );
    expect(
      promotionUpdateBodySchema.safeParse({ expectedVersion: 0, isActive: false })
        .success,
    ).toBe(true);
    expect(promotionListQuerySchema.parse({ isActive: "false" }).isActive).toBe(false);
    expect(promotionListQuerySchema.safeParse({ isActive: "yes" }).success).toBe(false);
  });
  it("enforces promotion and invoice role boundaries", () => {
    expect(() => assertPromotionCustomer(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertPromotionCustomer(actor("ADMIN"))).toThrow();
    expect(() => assertPromotionAdministrator(actor("STAFF"))).toThrow();
    expect(() => assertPromotionAdministrator(actor("ADMIN", false))).toThrow();
    expect(() => assertPromotionAdministrator(actor("SUPER_ADMIN"))).not.toThrow();
    expect(() => assertInvoiceCustomer(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertInvoiceCustomer(actor("STAFF"))).toThrow();
    expect(() => assertInvoiceOperator(actor("CUSTOMER"))).toThrow();
    expect(() => assertInvoiceOperator(actor("STAFF", false))).toThrow();
    expect(() => assertInvoiceOperator(actor("STAFF"))).not.toThrow();
  });
  it("serializes money safely and emits cursors only for additional rows", () => {
    const now = new Date();
    const nested = { amount: 12n, at: now, values: [1n, null, "safe"] };
    expect(jsonSafe(nested)).toEqual({
      amount: "12",
      at: now,
      values: ["1", null, "safe"],
    });
    expect(invoiceJsonSafe(nested)).toEqual({
      amount: "12",
      at: now,
      values: ["1", null, "safe"],
    });
    expect(page([{ id: "one" }], 1)).toEqual({ items: [{ id: "one" }] });
    expect(page([{ id: "one" }, { id: "two" }], 1)).toEqual({
      items: [{ id: "one" }],
      nextCursor: "one",
    });
    expect(invoicePage([{ id: "one" }], 1)).toEqual({ items: [{ id: "one" }] });
    expect(invoicePage([{ id: "one" }, { id: "two" }], 1)).toEqual({
      items: [{ id: "one" }],
      nextCursor: "one",
    });
  });
});
