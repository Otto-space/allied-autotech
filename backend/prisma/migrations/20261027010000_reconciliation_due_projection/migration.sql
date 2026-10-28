-- Derived scheduling state only. Runs and items remain immutable evidence.
-- A NULL nextDueAt excludes a terminal matched attempt from recurring scans.
CREATE TABLE "PaymentReconciliationDue" (
  "paymentAttemptId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "initiatedAt" TIMESTAMP(3) NOT NULL,
  "nextDueAt" TIMESTAMP(3),
  "latestItemStatus" "ReconciliationItemStatus",
  "latestCompletedAt" TIMESTAMP(3),
  "latestItemCreatedAt" TIMESTAMP(3),
  "latestRunStartedAt" TIMESTAMP(3),
  "latestRunAttemptNumber" INTEGER,
  "latestItemId" UUID,
  CONSTRAINT "PaymentReconciliationDue_pkey" PRIMARY KEY ("paymentAttemptId"),
  CONSTRAINT "PaymentReconciliationDue_paymentAttemptId_fkey"
    FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReconciliationDue_observation_pair_check" CHECK (
    ("latestItemId" IS NULL AND "latestItemStatus" IS NULL
      AND "latestCompletedAt" IS NULL AND "latestItemCreatedAt" IS NULL
      AND "latestRunStartedAt" IS NULL AND "latestRunAttemptNumber" IS NULL)
    OR
    ("latestItemId" IS NOT NULL AND "latestItemStatus" IS NOT NULL
      AND "latestCompletedAt" IS NOT NULL AND "latestItemCreatedAt" IS NOT NULL
      AND "latestRunStartedAt" IS NOT NULL AND "latestRunAttemptNumber" IS NOT NULL)
  )
);

CREATE INDEX "ReconciliationDue_next_idx"
  ON "PaymentReconciliationDue"("provider", "nextDueAt", "initiatedAt", "paymentAttemptId");

-- A new or changed attempt cannot disappear from the queue. The attempt row
-- lock serializes this status update with completed-run materialization.
CREATE FUNCTION aat_reconciliation_due_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."status" IS NOT DISTINCT FROM NEW."status"
    AND OLD."provider" IS NOT DISTINCT FROM NEW."provider"
    AND OLD."initiatedAt" IS NOT DISTINCT FROM NEW."initiatedAt" THEN
    RETURN NEW;
  END IF;
  INSERT INTO "PaymentReconciliationDue" (
    "paymentAttemptId", "provider", "initiatedAt", "nextDueAt"
  ) VALUES (NEW."id", NEW."provider", NEW."initiatedAt", NEW."initiatedAt")
  ON CONFLICT ("paymentAttemptId") DO UPDATE SET
    "provider" = EXCLUDED."provider",
    "initiatedAt" = EXCLUDED."initiatedAt",
    "nextDueAt" = CASE
      WHEN "PaymentReconciliationDue"."latestItemId" IS NULL
        THEN EXCLUDED."initiatedAt"
      ELSE "PaymentReconciliationDue"."latestCompletedAt"
    END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PaymentAttempt_reconciliation_due"
  AFTER INSERT OR UPDATE OF "status", "provider", "initiatedAt" ON "PaymentAttempt"
  FOR EACH ROW EXECUTE FUNCTION aat_reconciliation_due_attempt();

-- Preserve every historical attempt and observation. This projection can be
-- rebuilt from the immutable source; no financial row is rewritten.
INSERT INTO "PaymentReconciliationDue" (
  "paymentAttemptId", "provider", "initiatedAt", "nextDueAt",
  "latestItemStatus", "latestCompletedAt", "latestItemCreatedAt",
  "latestRunStartedAt", "latestRunAttemptNumber", "latestItemId"
)
SELECT a."id", a."provider", a."initiatedAt",
  CASE
    WHEN observed."id" IS NULL THEN a."initiatedAt"
    WHEN observed."status" = 'MATCHED'
      AND a."status" NOT IN ('INITIALIZED', 'PENDING', 'PROCESSING') THEN NULL
    ELSE observed."completedAt"
  END,
  observed."status", observed."completedAt", observed."createdAt",
  observed."startedAt", observed."attemptNumber", observed."id"
FROM "PaymentAttempt" AS a
LEFT JOIN LATERAL (
  SELECT i."id", i."status", i."createdAt", r."completedAt",
    r."startedAt", r."attemptNumber"
  FROM "PaymentReconciliationItem" AS i
  JOIN "PaymentReconciliationRun" AS r ON r."id" = i."runId"
  WHERE i."paymentAttemptId" = a."id"
    AND r."status" IN ('MATCHED', 'DIFFERENCES_FOUND')
  ORDER BY i."createdAt" DESC, r."startedAt" DESC,
    r."attemptNumber" DESC, i."id" DESC
  LIMIT 1
) AS observed ON TRUE
ON CONFLICT ("paymentAttemptId") DO NOTHING;
