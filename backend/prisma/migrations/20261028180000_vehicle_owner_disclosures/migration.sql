-- Additive only: unknown values remain NULL; existing records and inspection evidence are preserved.
ALTER TYPE "BodyType" ADD VALUE 'CROSSOVER';
ALTER TYPE "BodyType" ADD VALUE 'MINIVAN';
ALTER TABLE "Vehicle"
  ADD COLUMN "engineCode" VARCHAR(40),
  ADD COLUMN "cylinders" INTEGER,
  ADD COLUMN "ownerReportedCondition" VARCHAR(2000),
  ADD COLUMN "ownerReportedIssues" VARCHAR(4000);
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_cylinders_range" CHECK ("cylinders" IS NULL OR "cylinders" BETWEEN 1 AND 24);
