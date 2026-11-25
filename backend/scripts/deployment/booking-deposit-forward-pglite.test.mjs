import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

/** Isolated forward-migration behavioral smoke only; NOT a full historic PostgreSQL replay. */
test("20% no-slot deposit and invoice SQL guards agree in isolated PostgreSQL semantics", async () => {
  const db = await PGlite.create();
  const sql = (value) => db.exec(value);
  const b = "00000000-0000-4000-8000-000000000001";
  const c = "00000000-0000-4000-8000-000000000002";
  const p = "00000000-0000-4000-8000-000000000003";
  const q = "00000000-0000-4000-8000-000000000004";
  const a = "00000000-0000-4000-8000-000000000005";
  try {
    await sql(`
      CREATE TABLE "Booking" (
        "id" uuid PRIMARY KEY, "customerId" uuid, "bookingSlotId" uuid,
        "branchId" uuid, "assignedStaffId" uuid, "depositBaseKobo" bigint,
        "depositBasisPoints" integer, "depositAmountKobo" bigint,
        "depositPolicyVersion" text, "depositTermsAcceptedAt" timestamptz,
        "paymentHoldExpiresAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(),
        "depositPaidAt" timestamptz, "depositForfeitedAt" timestamptz
      );
      ALTER TABLE "Booking" ADD CONSTRAINT "aat_booking_deposit_snapshot_complete" CHECK ("bookingSlotId" IS NULL);
      CREATE TABLE "ServiceQuote" (
        "id" uuid PRIMARY KEY, "bookingId" uuid, "version" integer,
        "status" text, "originalInvoiceId" uuid, "currency" char(3),
        "subtotalKobo" bigint, "taxKobo" bigint, "totalKobo" bigint,
        "acceptedAt" timestamptz, "amendmentReason" text, "acceptedAdditionalContext" jsonb
      );
      CREATE TABLE "Payment" ("id" uuid PRIMARY KEY, "bookingId" uuid, "status" text);
      CREATE TABLE "PaymentAttempt" ("id" uuid PRIMARY KEY, "paymentId" uuid);
      CREATE TABLE "Refund" ("paymentAttemptId" uuid, "amountKobo" bigint, "status" text);
      CREATE TABLE "Order" ("id" uuid, "customerId" uuid, "guestId" uuid, "currency" char(3), "totalKobo" bigint, "taxKobo" bigint);
      CREATE TABLE "VehicleTransaction" ("id" uuid, "customerId" uuid, "currency" char(3), "agreedPriceKobo" bigint);
      CREATE TABLE "CustomerProfile" ("id" uuid, "userId" uuid);
      CREATE TABLE "Invoice" (
        "id" uuid PRIMARY KEY, "customerId" uuid, "guestId" uuid,
        "orderId" uuid, "bookingId" uuid, "additionalQuoteId" uuid,
        "vehicleTransactionId" uuid, "currency" char(3),
        "subtotalKobo" bigint, "taxKobo" bigint,
        "depositCreditKobo" bigint, "totalKobo" bigint, "status" text,
        "invoiceNumber" text
      );
    `);
    await sql(readFileSync("prisma/migrations/20261123110000_approved_quote_booking_deposit_20/migration.sql", "utf8"));
    await sql(readFileSync("prisma/migrations/20261123120000_booking_deposit_invoice_credit/migration.sql", "utf8"));
    await sql(`CREATE TRIGGER "Invoice_validate_source_snapshot" BEFORE INSERT ON "Invoice"
      FOR EACH ROW EXECUTE FUNCTION aat_validate_invoice_source_snapshot();`);
    await assert.rejects(
      sql(`INSERT INTO "Booking" ("id", "customerId", "depositPolicyVersion", "depositBaseKobo", "depositBasisPoints", "depositAmountKobo")
        VALUES ('${b}', '${c}', 'approved-quote-deposit-20-v1', 1000000, 3000, 300000)`),
      /aat_booking_deposit_snapshot_complete/,
    );
    await sql(`INSERT INTO "Booking" ("id", "customerId", "branchId", "assignedStaffId", "depositPolicyVersion", "depositBaseKobo", "depositBasisPoints", "depositAmountKobo", "depositTermsAcceptedAt", "paymentHoldExpiresAt", "depositPaidAt")
      VALUES ('${b}', '${c}', '${c}', '${c}', 'approved-quote-deposit-20-v1', 1000000, 2000, 200000, now(), now() + interval '30 minutes', now());
      INSERT INTO "ServiceQuote" ("id", "bookingId", "version", "status", "currency", "subtotalKobo", "taxKobo", "totalKobo")
      VALUES ('${q}', '${b}', 1, 'ACCEPTED', 'NGN', 925000, 75000, 1000000);
      INSERT INTO "Payment" ("id", "bookingId", "status") VALUES ('${p}', '${b}', 'SUCCEEDED');
      INSERT INTO "PaymentAttempt" ("id", "paymentId") VALUES ('${a}', '${p}');`);
    const invoice = (id, credit, total) => sql(`INSERT INTO "Invoice" ("id", "customerId", "bookingId", "currency", "subtotalKobo", "taxKobo", "depositCreditKobo", "totalKobo")
      VALUES ('${id}', '${c}', '${b}', 'NGN', 925000, 75000, ${credit}, ${total})`);
    await invoice("00000000-0000-4000-8000-000000000010", 200000, 800000);
    await assert.rejects(invoice("00000000-0000-4000-8000-000000000011", 0, 1000000));
    await sql(`INSERT INTO "Refund" ("paymentAttemptId", "amountKobo", "status") VALUES ('${a}', 20000, 'PENDING')`);
    await assert.rejects(invoice("00000000-0000-4000-8000-000000000012", 200000, 800000), /refund is pending/);
    await sql(`DELETE FROM "Refund"; UPDATE "ServiceQuote" SET "totalKobo" = 900000 WHERE "id" = '${q}'`);
    await assert.rejects(invoice("00000000-0000-4000-8000-000000000013", 0, 1000000), /inconsistent/);
  } finally {
    await db.close();
  }
});
