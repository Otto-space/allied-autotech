import { describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("Phase 5 database controls", () => {
  it("installs service-operation constraints, triggers, and partial scheduling indexes", async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name FROM pg_constraint
      WHERE conname IN (
        'aat_service_version_nonnegative',
        'aat_booking_version_nonnegative',
        'aat_service_quote_revision_nonnegative',
        'aat_work_order_status_timestamps'
      )
      UNION ALL
      SELECT indexname AS name FROM pg_indexes
      WHERE indexname IN (
        'Booking_active_staff_schedule_idx',
        'Booking_active_vehicle_schedule_idx',
        'ServiceQuote_one_accepted_per_booking_key'
      )
      UNION ALL
      SELECT tgname AS name FROM pg_trigger
      WHERE tgname IN ('QuoteItem_protect_issued', 'WorkOrderItem_protect_closed')
        AND NOT tgisinternal
    `;
    expect(new Set(rows.map(({ name }) => name))).toEqual(
      new Set([
        "aat_service_version_nonnegative",
        "aat_booking_version_nonnegative",
        "aat_service_quote_revision_nonnegative",
        "aat_work_order_status_timestamps",
        "Booking_active_staff_schedule_idx",
        "Booking_active_vehicle_schedule_idx",
        "ServiceQuote_one_accepted_per_booking_key",
        "QuoteItem_protect_issued",
        "WorkOrderItem_protect_closed",
      ]),
    );
  });
});
