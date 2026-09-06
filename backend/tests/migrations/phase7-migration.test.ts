import { describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("Phase 7 database controls", () => {
  it("installs vehicle concurrency, integrity, and immutability controls", async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conname IN (
        'aat_vehicle_listing_price_positive',
        'aat_inspection_scheduled_window_valid',
        'aat_vehicle_transaction_prices_valid',
        'aat_vehicle_transaction_status_timestamps',
        'aat_vehicle_report_asset_pair_valid',
        'aat_vehicle_handover_asset_pair_valid',
        'aat_vehicle_version_nonnegative',
        'aat_vehicle_document_version_nonnegative'
      )
      UNION ALL
      SELECT indexname AS name
      FROM pg_indexes
      WHERE indexname IN (
        'VehicleListing_one_live_per_vehicle',
        'VehicleTransaction_one_committed_per_listing_idx',
        'VehicleImage_one_primary_per_vehicle',
        'InspectionRequest_staff_schedule_idx',
        'VehicleTransaction_expiring_commitment_idx'
      )
      UNION ALL
      SELECT tgname AS name
      FROM pg_trigger
      WHERE tgname IN (
        'VehiclePriceHistory_append_only',
        'VehicleTransactionStatusHistory_append_only',
        'VehicleTransaction_protect_commitment',
        'VehicleHandover_protect_signature'
      ) AND NOT tgisinternal`;

    expect(new Set(rows.map(({ name }) => name))).toEqual(
      new Set([
        "aat_vehicle_listing_price_positive",
        "aat_inspection_scheduled_window_valid",
        "aat_vehicle_transaction_prices_valid",
        "aat_vehicle_transaction_status_timestamps",
        "aat_vehicle_report_asset_pair_valid",
        "aat_vehicle_handover_asset_pair_valid",
        "aat_vehicle_version_nonnegative",
        "aat_vehicle_document_version_nonnegative",
        "VehicleListing_one_live_per_vehicle",
        "VehicleTransaction_one_committed_per_listing_idx",
        "VehicleImage_one_primary_per_vehicle",
        "InspectionRequest_staff_schedule_idx",
        "VehicleTransaction_expiring_commitment_idx",
        "VehiclePriceHistory_append_only",
        "VehicleTransactionStatusHistory_append_only",
        "VehicleTransaction_protect_commitment",
        "VehicleHandover_protect_signature",
      ]),
    );
  }, 15_000);
});
