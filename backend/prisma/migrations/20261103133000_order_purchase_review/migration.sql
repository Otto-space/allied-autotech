BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TABLE "OrderPurchaseReview" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'REQUESTED',
  "requirements" JSONB NOT NULL,
  "decidedByUserId" UUID,
  "reason" VARCHAR(2000),
  "decisionSnapshot" JSONB,
  "payableFingerprint" CHAR(64),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "OrderPurchaseReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderPurchaseReview_values_valid" CHECK (
    "revision" > 0 AND jsonb_typeof("requirements") = 'object' AND (
      ("status" = 'REQUESTED' AND "decidedByUserId" IS NULL AND "reason" IS NULL
       AND "decidedAt" IS NULL AND "decisionSnapshot" IS NULL
       AND "payableFingerprint" IS NULL AND "expiresAt" IS NULL)
      OR
      ("status" IN ('APPROVED', 'DECLINED') AND "decidedByUserId" IS NOT NULL
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
  ),
  CONSTRAINT "OrderPurchaseReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrderPurchaseReview_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderPurchaseReview_orderId_revision_key" ON "OrderPurchaseReview"("orderId", "revision");
CREATE INDEX "OrderPurchaseReview_orderId_createdAt_idx" ON "OrderPurchaseReview"("orderId", "createdAt");

CREATE FUNCTION protect_order_purchase_review() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Purchase review history must be retained';
  END IF;
  IF OLD."status" <> 'REQUESTED' OR NEW."status" NOT IN ('APPROVED', 'DECLINED')
    OR NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."revision" IS DISTINCT FROM OLD."revision"
    OR NEW."requirements" IS DISTINCT FROM OLD."requirements"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'A purchase review decision is immutable; append a revision';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrderPurchaseReview_protect_update_delete" BEFORE UPDATE OR DELETE ON "OrderPurchaseReview" FOR EACH ROW EXECUTE FUNCTION protect_order_purchase_review();
CREATE TRIGGER "OrderPurchaseReview_protect_truncate" BEFORE TRUNCATE ON "OrderPurchaseReview" FOR EACH STATEMENT EXECUTE FUNCTION protect_order_purchase_review();
COMMIT;
