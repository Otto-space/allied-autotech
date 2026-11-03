export interface PromotionEvaluation {
  promotion: {
    id: string;
    code: string | null;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    percentageBasisPoints: number | null;
    fixedAmountKobo: bigint | null;
  };
  discountAmountKobo: bigint;
}

// Resolved by the caller's existing account or verified guest-session boundary.
// An email address from a checkout body is never an ownership credential.
export type PromotionBuyer = string | { guestId: string };
