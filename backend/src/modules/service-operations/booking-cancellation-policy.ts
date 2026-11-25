/** Owner-approved rules for the new 20% deposit; never transfer money here. */
export const approvedBookingCancellationPolicy = Object.freeze({
  version: "approved-quote-deposit-cancellation-v1",
  earlyRefundNoticeHours: 48,
  freeRescheduleNoticeHours: 24,
  freeRescheduleLimit: 1,
});

export type BookingCancellationCircumstance =
  | "CUSTOMER_CANCELLED"
  | "CUSTOMER_EMERGENCY"
  | "CUSTOMER_NO_SHOW"
  | "WORKSHOP_CANCELLED"
  | "WORKSHOP_UNABLE_TO_PERFORM"
  | "PAYMENT_DISPUTED";

export type DepositDisposition = "FULL_REFUND_REVIEW" | "STAFF_REVIEW" | "DISPUTE_HOLD";

export function assessBookingDepositCancellation(input: {
  circumstance: BookingCancellationCircumstance;
  appointmentAt: Date;
  assessedAt: Date;
  workStarted: boolean;
}): DepositDisposition {
  if (
    !Number.isFinite(input.appointmentAt.getTime()) ||
    !Number.isFinite(input.assessedAt.getTime())
  )
    throw new Error("Valid booking and assessment dates are required");

  if (input.circumstance === "PAYMENT_DISPUTED") return "DISPUTE_HOLD";
  if (
    (input.circumstance === "WORKSHOP_CANCELLED" ||
      input.circumstance === "WORKSHOP_UNABLE_TO_PERFORM") &&
    !input.workStarted
  )
    return "FULL_REFUND_REVIEW";
  if (input.circumstance === "CUSTOMER_CANCELLED" && !input.workStarted) {
    const noticeMs = input.appointmentAt.getTime() - input.assessedAt.getTime();
    if (noticeMs >= approvedBookingCancellationPolicy.earlyRefundNoticeHours * 3_600_000)
      return "FULL_REFUND_REVIEW";
  }
  // No-show, emergencies, late cancellation and already-started work need a
  // human decision. This function never invents a fee or forfeits a deposit.
  return "STAFF_REVIEW";
}

export function eligibleForFreeBookingReschedule(input: {
  appointmentAt: Date;
  requestedAt: Date;
  previousCustomerReschedules: number;
  workStarted: boolean;
}) {
  return (
    Number.isFinite(input.appointmentAt.getTime()) &&
    Number.isFinite(input.requestedAt.getTime()) &&
    Number.isInteger(input.previousCustomerReschedules) &&
    input.previousCustomerReschedules >= 0 &&
    input.previousCustomerReschedules <
      approvedBookingCancellationPolicy.freeRescheduleLimit &&
    !input.workStarted &&
    input.appointmentAt.getTime() - input.requestedAt.getTime() >=
      approvedBookingCancellationPolicy.freeRescheduleNoticeHours * 3_600_000
  );
}
