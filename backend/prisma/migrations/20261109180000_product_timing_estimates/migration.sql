-- Optional factual estimates. Existing products retain unknown timing.
-- No inventory, payment, ready or collection state is inferred or changed.
ALTER TABLE "Product"
  ADD COLUMN "sourcingDaysMin" INTEGER,
  ADD COLUMN "sourcingDaysMax" INTEGER,
  ADD COLUMN "preparationMinutes" INTEGER,
  ADD CONSTRAINT "Product_sourcing_estimate_range" CHECK (
    ("sourcingDaysMin" IS NULL AND "sourcingDaysMax" IS NULL) OR
    ("sourcingDaysMin" IS NOT NULL AND "sourcingDaysMax" IS NOT NULL AND
     "sourcingDaysMin" >= 0 AND "sourcingDaysMax" <= 3650 AND
     "sourcingDaysMin" <= "sourcingDaysMax")
  ),
  ADD CONSTRAINT "Product_preparation_estimate_range" CHECK (
    "preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 0 AND 525600
  );
