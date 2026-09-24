/** Integer half-up rounding. This is a labelled draft basis until finance approval. */
export function basisPoints(amountKobo: bigint, rate: number): bigint {
  if (amountKobo < 0n || !Number.isInteger(rate) || rate < 0 || rate > 10_000)
    throw new Error("Invalid monetary basis");
  return (amountKobo * BigInt(rate) + 5_000n) / 10_000n;
}

export function draftTotals(subtotalKobo: bigint, discountKobo = 0n) {
  if (discountKobo < 0n || discountKobo > subtotalKobo)
    throw new Error("Invalid discount");
  const taxableKobo = subtotalKobo - discountKobo;
  const taxKobo = basisPoints(taxableKobo, 750);
  return { subtotalKobo, discountKobo, taxKobo, totalKobo: taxableKobo + taxKobo };
}

export function draftVehicleRefund(
  vehicleValueKobo: bigint,
  capturedKobo: bigint,
  earlierRefundsKobo: bigint,
  reason: "BUYER_CHANGE" | "BUSINESS_FAILURE",
) {
  if (capturedKobo < 0n || earlierRefundsKobo < 0n || earlierRefundsKobo > capturedKobo)
    throw new Error("Invalid refundable balance");
  const remaining = capturedKobo - earlierRefundsKobo;
  const fee = reason === "BUYER_CHANGE" ? basisPoints(vehicleValueKobo, 50) : 0n;
  return {
    proposedDepositKobo: basisPoints(vehicleValueKobo, 7000),
    proposedFeeKobo: fee,
    proposedRefundKobo: remaining > fee ? remaining - fee : 0n,
    requiresApproval: true,
  };
}

export function cancellationAssessment(
  confirmed: boolean,
  workStarted: boolean,
  reviewedBasisKobo?: bigint,
) {
  if (!confirmed && !workStarted) return { feeKobo: 0n, requiresReview: false };
  if (workStarted || reviewedBasisKobo === undefined || reviewedBasisKobo === 10_000_000n)
    return { feeKobo: null, requiresReview: true };
  return {
    feeKobo: basisPoints(reviewedBasisKobo, reviewedBasisKobo < 10_000_000n ? 1000 : 500),
    requiresReview: true,
  };
}
