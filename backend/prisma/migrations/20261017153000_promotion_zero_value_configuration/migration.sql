-- Align persisted configuration with the existing API's nonnegative kobo contract.
-- Zero fixed discounts/caps remain ineligible at checkout; no rows are rewritten.
-- This only widens the two existing checks; every previously valid row stays valid.
BEGIN;

ALTER TABLE "Promotion"
  DROP CONSTRAINT "aat_promotion_discount_shape_valid",
  ADD CONSTRAINT "aat_promotion_discount_shape_valid"
  CHECK (
    ("discountType" = 'PERCENTAGE' AND "percentageBasisPoints" BETWEEN 1 AND 10000 AND "fixedAmountKobo" IS NULL)
    OR ("discountType" = 'FIXED_AMOUNT' AND "fixedAmountKobo" >= 0 AND "percentageBasisPoints" IS NULL)
  ),
  DROP CONSTRAINT "aat_promotion_amounts_nonnegative",
  ADD CONSTRAINT "aat_promotion_amounts_nonnegative"
  CHECK (
    ("minimumOrderAmountKobo" IS NULL OR "minimumOrderAmountKobo" >= 0)
    AND ("maximumDiscountAmountKobo" IS NULL OR "maximumDiscountAmountKobo" >= 0)
  );

COMMIT;
