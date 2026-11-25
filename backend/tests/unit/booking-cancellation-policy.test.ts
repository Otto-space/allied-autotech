import { describe, expect, it } from "vitest";
import {
  assessBookingDepositCancellation,
  eligibleForFreeBookingReschedule,
} from "../../src/modules/service-operations/booking-cancellation-policy.js";

const appointmentAt = new Date("2026-11-30T09:00:00.000Z");
const before = (hours: number) => new Date(appointmentAt.getTime() - hours * 3_600_000);

describe("20% booking deposit cancellation rules", () => {
  it("marks early customer cancellations for a full refund review", () => {
    for (const notice of [48, 49, 72])
      expect(
        assessBookingDepositCancellation({
          circumstance: "CUSTOMER_CANCELLED",
          appointmentAt,
          assessedAt: before(notice),
          workStarted: false,
        }),
      ).toBe("FULL_REFUND_REVIEW");
  });

  it("requires staff review of late cancellation, emergencies and no-shows", () => {
    for (const circumstance of [
      "CUSTOMER_CANCELLED",
      "CUSTOMER_EMERGENCY",
      "CUSTOMER_NO_SHOW",
    ] as const)
      expect(
        assessBookingDepositCancellation({
          circumstance,
          appointmentAt,
          assessedAt: before(23),
          workStarted: false,
        }),
      ).toBe("STAFF_REVIEW");
  });

  it("grants full refund review for workshop failures before service starts", () => {
    for (const circumstance of [
      "WORKSHOP_CANCELLED",
      "WORKSHOP_UNABLE_TO_PERFORM",
    ] as const)
      expect(
        assessBookingDepositCancellation({
          circumstance,
          appointmentAt,
          assessedAt: before(1),
          workStarted: false,
        }),
      ).toBe("FULL_REFUND_REVIEW");
  });

  it("holds disputes and does not forfeit deposits after work has started", () => {
    expect(
      assessBookingDepositCancellation({
        circumstance: "PAYMENT_DISPUTED",
        appointmentAt,
        assessedAt: before(72),
        workStarted: false,
      }),
    ).toBe("DISPUTE_HOLD");
    expect(
      assessBookingDepositCancellation({
        circumstance: "CUSTOMER_CANCELLED",
        appointmentAt,
        assessedAt: before(72),
        workStarted: true,
      }),
    ).toBe("STAFF_REVIEW");
  });

  it("permits one free reschedule with at least 24 hours of notice", () => {
    const base = {
      appointmentAt,
      requestedAt: before(24),
      previousCustomerReschedules: 0,
      workStarted: false,
    };
    expect(eligibleForFreeBookingReschedule(base)).toBe(true);
    expect(eligibleForFreeBookingReschedule({ ...base, requestedAt: before(23) })).toBe(
      false,
    );
    expect(
      eligibleForFreeBookingReschedule({ ...base, previousCustomerReschedules: 1 }),
    ).toBe(false);
    expect(eligibleForFreeBookingReschedule({ ...base, workStarted: true })).toBe(false);
  });
});
