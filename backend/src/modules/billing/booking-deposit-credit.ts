/** Only a booking-allocated, verified deposit can offset workshop settlement. */
export function bookingDepositCredit(input: {
  bookingSlotId: string | null;
  depositPolicyVersion: string | null;
  depositBaseKobo: bigint | null;
  depositBasisPoints: number | null;
  depositAmountKobo: bigint | null;
  depositPaidAt: Date | null;
  depositForfeitedAt: Date | null;
  depositPaymentStatus: string | null;
  refundedKobo: bigint;
  acceptedQuoteTotalKobo: bigint;
}): bigint {
  const eligible =
    (input.bookingSlotId !== null ||
      input.depositPolicyVersion === "approved-quote-deposit-20-v1") &&
    input.depositPaymentStatus === "SUCCEEDED" &&
    input.depositPaidAt !== null &&
    input.depositForfeitedAt === null;
  if (!eligible) return 0n;
  const amount = input.depositAmountKobo ?? 0n;
  if (
    input.depositPolicyVersion === "approved-quote-deposit-20-v1" &&
    (input.depositBaseKobo !== input.acceptedQuoteTotalKobo ||
      input.depositBasisPoints !== 2_000 ||
      amount !== (input.acceptedQuoteTotalKobo * 2_000n + 5_000n) / 10_000n)
  )
    throw new Error("Approved booking deposit no longer matches its quote");
  const credit = amount - input.refundedKobo;
  if (credit < 0n || credit > input.acceptedQuoteTotalKobo)
    throw new Error("Booking deposit credit is inconsistent");
  return credit;
}
