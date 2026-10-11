-- Historical acceptances remain readable without fabricating a document or signer.
ALTER TABLE "VehicleTransaction"
  ADD COLUMN "reservationTermsPolicyId" UUID,
  ADD COLUMN "reservationTermsAcceptedByUserId" UUID,
  ADD CONSTRAINT "VehicleTransaction_reservationTermsPolicyId_fkey"
    FOREIGN KEY ("reservationTermsPolicyId") REFERENCES "BusinessPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "VehicleTransaction_reservationTermsAcceptedByUserId_fkey"
    FOREIGN KEY ("reservationTermsAcceptedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
CREATE INDEX "VehicleTransaction_reservationTermsPolicyId_idx" ON "VehicleTransaction"("reservationTermsPolicyId");
CREATE INDEX "VehicleTransaction_reservationTermsAcceptedByUserId_idx" ON "VehicleTransaction"("reservationTermsAcceptedByUserId");

-- The same transaction lock is used by publication and reservation in the API.
CREATE FUNCTION aat_reservation_terms_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('policy:vehicle_reservation_terms', 0));
  IF NEW."approvalStatus" = 'APPROVED' AND (
    NEW."approvedByUserId" IS NULL OR
    NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."approvedByUserId" AND "role" = 'SUPER_ADMIN' AND "status" = 'ACTIVE' AND "emailVerifiedAt" IS NOT NULL) OR
    NEW."approvalEvidence" IS NULL OR length(btrim(NEW."approvalEvidence")) < 20 OR
    jsonb_typeof(NEW."settings"->'enabled') IS DISTINCT FROM 'boolean' OR
    (NEW."settings"->>'enabled' = 'true' AND (
      jsonb_typeof(NEW."settings"->'title') IS DISTINCT FROM 'string' OR
      jsonb_typeof(NEW."settings"->'body') IS DISTINCT FROM 'string' OR
      length(btrim(NEW."settings"->>'title')) NOT BETWEEN 1 AND 200 OR
      length(btrim(NEW."settings"->>'body')) NOT BETWEEN 1 AND 50000
    )) OR
    (NEW."settings"->>'enabled' = 'false' AND (
      jsonb_typeof(NEW."settings"->'reason') IS DISTINCT FROM 'string' OR
      length(btrim(NEW."settings"->>'reason')) NOT BETWEEN 1 AND 1000
    ))
  ) THEN RAISE EXCEPTION 'Reservation terms require approved owner provenance and valid content'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "BusinessPolicyVersion_reservation_terms_publication"
  BEFORE INSERT ON "BusinessPolicyVersion" FOR EACH ROW
  WHEN (NEW."key" = 'vehicle_reservation_terms') EXECUTE FUNCTION aat_reservation_terms_publication();

CREATE FUNCTION aat_vehicle_reservation_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy "BusinessPolicyVersion"%ROWTYPE;
DECLARE observed_now timestamp := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."termsAcceptedAt" IS NOT NULL THEN
    IF NEW."termsVersion" IS DISTINCT FROM OLD."termsVersion"
      OR NEW."termsAcceptedAt" IS DISTINCT FROM OLD."termsAcceptedAt"
      OR NEW."reservationTermsPolicyId" IS DISTINCT FROM OLD."reservationTermsPolicyId"
      OR NEW."reservationTermsAcceptedByUserId" IS DISTINCT FROM OLD."reservationTermsAcceptedByUserId"
      OR NEW."customerId" IS DISTINCT FROM OLD."customerId"
      OR NEW."vehicleListingId" IS DISTINCT FROM OLD."vehicleListingId"
    THEN RAISE EXCEPTION 'Vehicle reservation acceptance is immutable'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."termsAcceptedAt" IS NULL AND NEW."termsVersion" IS NULL
    AND NEW."reservationTermsPolicyId" IS NULL AND NEW."reservationTermsAcceptedByUserId" IS NULL
  THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('policy:vehicle_reservation_terms', 0));
  observed_now := clock_timestamp() AT TIME ZONE 'UTC';
  SELECT * INTO policy FROM "BusinessPolicyVersion"
    WHERE "key" = 'vehicle_reservation_terms' AND "effectiveAt" <= NEW."termsAcceptedAt"
    ORDER BY "effectiveAt" DESC, "version" DESC LIMIT 1;
  IF policy."id" IS NULL OR policy."approvalStatus" <> 'APPROVED'
    OR policy."settings"->>'enabled' IS DISTINCT FROM 'true'
    OR NEW."reservationTermsPolicyId" IS DISTINCT FROM policy."id"
    OR NEW."termsVersion" IS DISTINCT FROM policy."id"::text
    OR NEW."termsAcceptedAt" IS NULL
    OR NEW."termsAcceptedAt" < policy."effectiveAt"
    OR NEW."termsAcceptedAt" < observed_now - interval '1 minute'
    OR NEW."termsAcceptedAt" > observed_now + interval '1 second'
    OR NOT EXISTS (
      SELECT 1 FROM "CustomerProfile" c JOIN "User" u ON u."id" = c."userId"
      WHERE c."id" = NEW."customerId" AND u."id" = NEW."reservationTermsAcceptedByUserId"
        AND u."role" = 'CUSTOMER' AND u."status" = 'ACTIVE'
    )
  THEN RAISE EXCEPTION 'A current approved reservation agreement and customer acceptance are required'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "VehicleTransaction_reservation_acceptance"
  BEFORE INSERT OR UPDATE ON "VehicleTransaction" FOR EACH ROW EXECUTE FUNCTION aat_vehicle_reservation_acceptance();
