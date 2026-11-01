BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TABLE "PartsQuote" (
 "id" UUID NOT NULL, "enquiryId" UUID NOT NULL, "productId" UUID NOT NULL,
 "createdByUserId" UUID NOT NULL, "orderId" UUID, "revision" INTEGER NOT NULL,
 "status" "QuoteStatus" NOT NULL DEFAULT 'ISSUED', "productName" TEXT NOT NULL,
 "sku" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "unitPriceKobo" BIGINT NOT NULL,
 "subtotalKobo" BIGINT NOT NULL, "taxKobo" BIGINT NOT NULL, "totalKobo" BIGINT NOT NULL,
 "currency" CHAR(3) NOT NULL DEFAULT 'NGN', "notes" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "decidedAt" TIMESTAMP(3), "idempotencyKeyHash" CHAR(64) NOT NULL,
 "requestHash" CHAR(64) NOT NULL, "policySnapshot" JSONB NOT NULL,
 CONSTRAINT "PartsQuote_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PartsQuote_values_valid" CHECK ("revision" > 0 AND "quantity" BETWEEN 1 AND 100 AND "unitPriceKobo" > 0 AND "subtotalKobo" = "unitPriceKobo" * "quantity" AND "taxKobo" >= 0 AND "totalKobo" = "subtotalKobo" + "taxKobo" AND "currency" = 'NGN'),
 CONSTRAINT "PartsQuote_acceptance_valid" CHECK (("status" = 'ACCEPTED') = ("orderId" IS NOT NULL)),
 CONSTRAINT "PartsQuote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PartsQuote_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PartsQuote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PartsQuote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PartsQuote_orderId_key" ON "PartsQuote"("orderId");
CREATE UNIQUE INDEX "PartsQuote_idempotencyKeyHash_key" ON "PartsQuote"("idempotencyKeyHash");
CREATE UNIQUE INDEX "PartsQuote_enquiryId_revision_key" ON "PartsQuote"("enquiryId", "revision");
CREATE INDEX "PartsQuote_status_expiresAt_idx" ON "PartsQuote"("status", "expiresAt");
COMMIT;
