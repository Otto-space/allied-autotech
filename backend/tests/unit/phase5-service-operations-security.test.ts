import { describe, expect, it } from "vitest";

import { errorCodes } from "../../src/common/errors/error-codes.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import {
  assertCustomerActor,
  assertPrivilegedActor,
  assertServiceAdministrator,
} from "../../src/modules/service-operations/service-operations.policy.js";
import {
  bookingCreateBodySchema,
  serviceCreateBodySchema,
  serviceLineItemSchema,
} from "../../src/modules/service-operations/service-operations.schemas.js";

const actor = (role: AuthenticatedActor["role"], mfa = true): AuthenticatedActor => ({
  userId: "00000000-0000-4000-8000-000000000001",
  sessionId: "00000000-0000-4000-8000-000000000002",
  email: "actor@example.test",
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: mfa ? new Date() : null,
});

describe("Phase 5 service-operation security contracts", () => {
  it("uses default-deny role and MFA policies", () => {
    expect(() => assertCustomerActor(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertCustomerActor(actor("STAFF"))).toThrow();
    expect(() => assertPrivilegedActor(actor("STAFF"))).not.toThrow();
    expect(() => assertPrivilegedActor(actor("STAFF", false))).toThrow();
    expect(() => assertServiceAdministrator(actor("ADMIN"))).not.toThrow();
    try {
      assertServiceAdministrator(actor("STAFF"));
    } catch (error) {
      expect(error).toMatchObject({ code: errorCodes.forbidden, statusCode: 403 });
    }
  });

  it("rejects unknown fields, decimal money, and client-priced parts", () => {
    expect(
      serviceCreateBodySchema.safeParse({
        name: "Diagnostics",
        slug: "diagnostics",
        pricingType: "FIXED",
        priceKobo: "100.50",
        durationMinutes: 60,
      }).success,
    ).toBe(false);
    expect(
      bookingCreateBodySchema.safeParse({
        slotId: crypto.randomUUID(),
        policyVersion: "booking-deposit-v1",
        acceptNonRefundableDeposit: true,
      }).success,
    ).toBe(true);
    expect(
      serviceLineItemSchema.safeParse({
        type: "PART",
        productId: crypto.randomUUID(),
        quantity: 1,
        unitPriceKobo: "1",
      }).success,
    ).toBe(false);
    expect(
      bookingCreateBodySchema.safeParse({
        branchId: crypto.randomUUID(),
        serviceId: crypto.randomUUID(),
        scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        customerId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});
