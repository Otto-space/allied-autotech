BEGIN;
SET LOCAL lock_timeout = '10s';
-- Preserve all existing decisions as human decisions. Automatic checks retain
-- the original evidence reviewers in the snapshot, never a fabricated approver.
ALTER TABLE "OrderPurchaseReview" ADD COLUMN "decisionMode" VARCHAR(16) NOT NULL DEFAULT 'HUMAN';
ALTER TABLE "OrderPurchaseReview" DROP CONSTRAINT "OrderPurchaseReview_values_valid";
ALTER TABLE "OrderPurchaseReview" ADD CONSTRAINT "OrderPurchaseReview_values_valid" CHECK (
    "revision" > 0 AND jsonb_typeof("requirements") = 'object' AND (
      ("decisionMode" IN ('HUMAN', 'AUTOMATIC') AND "status" = 'REQUESTED' AND "decidedByUserId" IS NULL AND "reason" IS NULL
       AND "decidedAt" IS NULL AND "decisionSnapshot" IS NULL
       AND "payableFingerprint" IS NULL AND "expiresAt" IS NULL)
      OR
      ("status" IN ('APPROVED', 'DECLINED') AND (
         ("decisionMode" = 'HUMAN' AND "decidedByUserId" IS NOT NULL)
         OR ("decisionMode" = 'AUTOMATIC' AND "status" = 'APPROVED' AND "decidedByUserId" IS NULL)
       )
       AND "reason" IS NOT NULL AND length(btrim("reason")) >= 10
       AND "decidedAt" IS NOT NULL AND "decidedAt" >= "createdAt" AND (
         ("status" = 'APPROVED' AND "decisionSnapshot" IS NOT NULL
          AND jsonb_typeof("decisionSnapshot") = 'object'
          AND "payableFingerprint" IS NOT NULL AND "payableFingerprint" ~ '^[a-f0-9]{64}$'
          AND "expiresAt" IS NOT NULL AND "expiresAt" > "decidedAt")
         OR
         ("status" = 'DECLINED' AND "decisionSnapshot" IS NULL
          AND "payableFingerprint" IS NULL AND "expiresAt" IS NULL)
       ))
    )
  );
COMMIT;
