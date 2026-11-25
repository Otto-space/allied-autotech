import { basisPoints } from "../policies/policy-money.js";

/** Approved-quotation deposit policy. Activation is controlled separately. */
export const approvedQuoteDepositPolicy = Object.freeze({
  version: "approved-quote-deposit-20-v1",
  basisPoints: 2_000,
});

export function approvedQuoteDeposit(approvedTotalKobo: bigint) {
  if (approvedTotalKobo <= 0n)
    throw new Error("An approved positive quotation total is required");

  const depositAmountKobo = basisPoints(
    approvedTotalKobo,
    approvedQuoteDepositPolicy.basisPoints,
  );
  if (depositAmountKobo <= 0n)
    throw new Error("The approved quotation is too small for a payable deposit");

  return {
    policyVersion: approvedQuoteDepositPolicy.version,
    approvedTotalKobo,
    depositBasisPoints: approvedQuoteDepositPolicy.basisPoints,
    depositAmountKobo,
    remainingAmountKobo: approvedTotalKobo - depositAmountKobo,
  };
}

export type ApprovedQuoteDepositPrerequisites = {
  bookingId: string;
  bookingStatus: string;
  confirmedAt: Date | null;
  branchId: string | null;
  assignedStaffId: string | null;
  capacityPolicyVersionId: string | null;
  depositPaidAt: Date | null;
  latestQuoteVersion: number | null;
  quote: {
    bookingId: string;
    version: number;
    status: string;
    acceptedAt: Date | null;
    totalKobo: bigint;
    originalInvoiceId: string | null;
  } | null;
};

/** Fail-closed domain check; callers must also enforce account ownership and lock rows. */
export function approvedQuoteDepositReady(input: ApprovedQuoteDepositPrerequisites) {
  return (
    input.bookingStatus === "CONFIRMED" &&
    input.confirmedAt !== null &&
    input.branchId !== null &&
    input.assignedStaffId !== null &&
    input.capacityPolicyVersionId !== null &&
    input.depositPaidAt === null &&
    input.quote !== null &&
    input.quote.bookingId === input.bookingId &&
    input.quote.version === input.latestQuoteVersion &&
    input.quote.status === "ACCEPTED" &&
    input.quote.acceptedAt !== null &&
    input.quote.originalInvoiceId === null &&
    input.quote.totalKobo >= 3n
  );
}
