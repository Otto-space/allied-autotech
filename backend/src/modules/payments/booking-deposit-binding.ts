import { z } from "zod";

export const bookingDepositBindingSchema = z
  .object({
    policyVersion: z.literal("approved-quote-deposit-20-v1"),
    quoteId: z.uuid(),
    quoteVersion: z.number().int().positive(),
    quoteTotalKobo: z.string().regex(/^[1-9][0-9]*$/),
    depositAmountKobo: z.string().regex(/^[1-9][0-9]*$/),
    scheduleVersion: z.number().int().min(0),
    assignedStaffId: z.uuid(),
  })
  .strict();

export function bookingDepositBinding(snapshot: unknown) {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot))
    return null;
  const value = (snapshot as Record<string, unknown>)["bookingDeposit"];
  const result = bookingDepositBindingSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** A verified capture must belong to this exact, still-approved checkout window. */
export function bookingDepositCaptureWithinWindow(input: {
  capturedAt: Date;
  paymentCreatedAt: Date;
  termsAcceptedAt: Date | null;
  holdExpiresAt: Date | null;
}) {
  const { capturedAt, paymentCreatedAt, termsAcceptedAt, holdExpiresAt } = input;
  if (!termsAcceptedAt || !holdExpiresAt) return false;
  const timestamps = [capturedAt, paymentCreatedAt, termsAcceptedAt, holdExpiresAt].map(
    (value) => value.getTime(),
  );
  return (
    timestamps.every(Number.isFinite) &&
    timestamps[0]! >= timestamps[1]! &&
    timestamps[0]! >= timestamps[2]! &&
    timestamps[0]! <= timestamps[3]!
  );
}

export function bookingDepositSettlementMatches(input: {
  binding: ReturnType<typeof bookingDepositBinding>;
  booking: {
    scheduleVersion: number;
    assignedStaffId: string | null;
    depositBaseKobo: bigint | null;
    depositBasisPoints: number | null;
    depositAmountKobo: bigint | null;
    quotedPriceKobo: bigint | null;
  };
  quote: {
    id: string;
    version: number;
    status: string;
    totalKobo: bigint;
  } | null;
  paymentAmountKobo: bigint;
}) {
  const { binding, booking, quote, paymentAmountKobo } = input;
  if (!binding || !quote) return false;
  const expected = (quote.totalKobo * 2_000n + 5_000n) / 10_000n;
  return (
    quote.status === "ACCEPTED" &&
    quote.id === binding.quoteId &&
    quote.version === binding.quoteVersion &&
    quote.totalKobo.toString() === binding.quoteTotalKobo &&
    expected > 0n &&
    expected === paymentAmountKobo &&
    binding.depositAmountKobo === paymentAmountKobo.toString() &&
    booking.depositBaseKobo === quote.totalKobo &&
    booking.quotedPriceKobo === quote.totalKobo &&
    booking.depositBasisPoints === 2_000 &&
    booking.depositAmountKobo === paymentAmountKobo &&
    booking.scheduleVersion === binding.scheduleVersion &&
    booking.assignedStaffId === binding.assignedStaffId
  );
}
