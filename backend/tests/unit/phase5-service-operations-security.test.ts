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
  bookingRescheduleBodySchema,
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

  it("accepts a preferred time without accepting mixed sources or client authority", () => {
    const preferred = {
      serviceId: crypto.randomUUID(),
      branchId: crypto.randomUUID(),
      preferredAt: "2026-11-10T10:00:00+01:00",
      policyVersion: "owner-booking-request-v2",
    };
    expect(bookingCreateBodySchema.safeParse(preferred).success).toBe(true);
    for (const field of ["serviceId", "branchId", "preferredAt"] as const) {
      expect(
        bookingCreateBodySchema.safeParse({ ...preferred, [field]: undefined }).success,
      ).toBe(false);
    }
    expect(
      bookingCreateBodySchema.safeParse({ ...preferred, slotId: crypto.randomUUID() })
        .success,
    ).toBe(false);
    expect(
      bookingCreateBodySchema.safeParse({ ...preferred, preferredAt: "2026-11-10T10:00" })
        .success,
    ).toBe(false);
    for (const extra of [
      { priceKobo: "1" },
      { status: "CONFIRMED" },
      { assignedStaffId: crypto.randomUUID() },
      { customerId: crypto.randomUUID() },
    ]) {
      expect(bookingCreateBodySchema.safeParse({ ...preferred, ...extra }).success).toBe(
        false,
      );
    }
  });

  it("requires a meaningful concern with a branch and preferred time, without accepting client financial or assignment facts", () => {
    const concern = {
      customerConcern: "My engine shakes on a cold start",
      branchId: crypto.randomUUID(),
      preferredAt: "2026-11-10T10:00:00+01:00",
      policyVersion: "test-policy",
    };
    expect(bookingCreateBodySchema.safeParse(concern).success).toBe(true);
    for (const extra of [
      { customerConcern: " " },
      { customerConcern: "x".repeat(2001) },
      { branchId: undefined },
      { preferredAt: undefined },
      { serviceId: crypto.randomUUID() },
      { slotId: crypto.randomUUID() },
      { priceKobo: "1" },
      { status: "CONFIRMED" },
      { assignedStaffId: crypto.randomUUID() },
      { customerId: crypto.randomUUID() },
    ]) {
      expect(bookingCreateBodySchema.safeParse({ ...concern, ...extra }).success).toBe(
        false,
      );
    }
  });

  it("requires exactly one reschedule time source and preserves version checks", () => {
    const input = { preferredAt: "2026-11-10T10:00:00+01:00", expectedVersion: 2 };
    expect(bookingRescheduleBodySchema.safeParse(input).success).toBe(true);
    for (const value of [
      { expectedVersion: 2 },
      { ...input, slotId: crypto.randomUUID() },
      { ...input, expectedVersion: -1 },
      { ...input, customerRescheduleCount: 0 },
    ])
      expect(bookingRescheduleBodySchema.safeParse(value).success).toBe(false);
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
