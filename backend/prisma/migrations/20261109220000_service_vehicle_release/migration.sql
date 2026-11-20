-- Additive physical-collection history. No existing data is rewritten or inferred.
CREATE TABLE "ServiceVehicleRelease" (
 "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "performedByUserId" UUID NOT NULL,
 "idempotencyKey" UUID NOT NULL, "requestHash" CHAR(64) NOT NULL,
 "recipientName" VARCHAR(120) NOT NULL, "verificationNote" VARCHAR(1000) NOT NULL,
 "bookingVersion" INTEGER NOT NULL, "financialSnapshot" JSONB NOT NULL,
 "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ServiceVehicleRelease_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceVehicleRelease_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ServiceVehicleRelease_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ServiceVehicleRelease_shape_check" CHECK (
  "bookingVersion">=0 AND length(btrim("recipientName"))>0 AND length(btrim("verificationNote"))>=12
  AND "requestHash" ~ '^[a-f0-9]{64}$'
  AND COALESCE("financialSnapshot"->>'kind'='CLEARED_SERVICE_INVOICES_V1'
   AND jsonb_typeof("financialSnapshot"->'invoices')='array'
   AND jsonb_array_length("financialSnapshot"->'invoices')>0,false)
 )
);
CREATE UNIQUE INDEX "ServiceVehicleRelease_bookingId_key" ON "ServiceVehicleRelease"("bookingId");
CREATE UNIQUE INDEX "ServiceVehicleRelease_idempotencyKey_key" ON "ServiceVehicleRelease"("idempotencyKey");
CREATE INDEX "ServiceVehicleRelease_performedByUserId_releasedAt_idx" ON "ServiceVehicleRelease"("performedByUserId","releasedAt");
CREATE FUNCTION aat_preserve_service_vehicle_release() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invoice_count INTEGER;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Physical collection history is immutable'; END IF;
 PERFORM 1 FROM "Booking" b JOIN "WorkOrder" w ON w."bookingId"=b."id"
 WHERE b."id"=NEW."bookingId" AND b."status"='COMPLETED' AND b."completedAt" IS NOT NULL
 AND w."status"='COMPLETED' AND w."completedAt" IS NOT NULL AND b."version"=NEW."bookingVersion" FOR SHARE OF b;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record actual completion and review the current booking before collection'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id"=NEW."performedByUserId" AND "role" IN ('ADMIN','SUPER_ADMIN') AND "status"='ACTIVE' AND "emailVerifiedAt" IS NOT NULL) THEN
  RAISE EXCEPTION 'An authorised administrator must record collection'; END IF;
 PERFORM i."id" FROM "Invoice" i LEFT JOIN "ServiceQuote" q ON q."id"=i."additionalQuoteId"
 WHERE i."bookingId"=NEW."bookingId" OR q."bookingId"=NEW."bookingId" ORDER BY i."id" FOR SHARE OF i;
 SELECT count(*) INTO invoice_count FROM "Invoice" i LEFT JOIN "ServiceQuote" q ON q."id"=i."additionalQuoteId"
 WHERE i."bookingId"=NEW."bookingId" OR (q."bookingId"=NEW."bookingId" AND q."status"='ACCEPTED');
 IF invoice_count<>jsonb_array_length(NEW."financialSnapshot"->'invoices') OR invoice_count<1
 OR invoice_count<>(SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(NEW."financialSnapshot"->'invoices') item)
 OR EXISTS (SELECT 1 FROM "ServiceQuote" q LEFT JOIN "Invoice" i ON i."additionalQuoteId"=q."id"
  WHERE q."bookingId"=NEW."bookingId" AND q."originalInvoiceId" IS NOT NULL AND q."status"='ACCEPTED' AND (i."id" IS NULL OR i."status" NOT IN ('ISSUED','PAID')))
 OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(NEW."financialSnapshot"->'invoices') saved
  LEFT JOIN "Invoice" i ON i."id"=(saved->>'id')::uuid
  LEFT JOIN "ServiceQuote" q ON q."id"=i."additionalQuoteId"
  WHERE i."id" IS NULL OR NOT COALESCE(i."bookingId"=NEW."bookingId" OR (q."bookingId"=NEW."bookingId" AND q."status"='ACCEPTED'),false)
   OR i."status" NOT IN ('ISSUED','PAID') OR i."version"<>(saved->>'version')::integer
   OR i."totalKobo"<>(saved->>'totalKobo')::bigint OR i."depositCreditKobo"<>(saved->>'depositCreditKobo')::bigint
   OR i."totalKobo"<>COALESCE((SELECT sum(p."amountKobo") FROM "Payment" p WHERE p."invoiceId"=i."id" AND p."status"='SUCCEEDED'),0)
 ) THEN RAISE EXCEPTION 'Review all issued invoices and verified balances before collection'; END IF;
 IF EXISTS (SELECT 1 FROM "Payment" p JOIN "Invoice" i ON i."id"=p."invoiceId" LEFT JOIN "ServiceQuote" q ON q."id"=i."additionalQuoteId"
  WHERE (i."bookingId"=NEW."bookingId" OR q."bookingId"=NEW."bookingId") AND p."status" IN ('REQUIRES_PAYMENT','PROCESSING','REQUIRES_REVIEW')) THEN
  RAISE EXCEPTION 'Resolve pending or uncertain payments before collection'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ServiceVehicleRelease_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ServiceVehicleRelease"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_service_vehicle_release();
