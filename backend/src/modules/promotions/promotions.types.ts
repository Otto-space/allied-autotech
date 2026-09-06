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
