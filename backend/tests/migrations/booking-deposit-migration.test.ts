import { describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("booking deposit database controls", () => {
  it("installs slot, payment-target, reminder, and invoice-credit invariants", async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name FROM pg_constraint
      WHERE conname IN (
        'aat_booking_slot_window_valid',
        'aat_booking_deposit_snapshot_complete',
        'aat_booking_reminder_state_valid',
        'aat_payment_exactly_one_target',
        'aat_invoice_amounts_valid'
      )
      UNION ALL
      SELECT indexname AS name FROM pg_indexes
      WHERE indexname IN ('BookingSlot_one_active_booking_idx')
      UNION ALL
      SELECT tgname AS name FROM pg_trigger
      WHERE tgname IN ('BookingSlot_validate', 'Booking_validate_slot_binding')
        AND NOT tgisinternal
    `;
    expect(new Set(rows.map(({ name }) => name))).toEqual(
      new Set([
        "aat_booking_slot_window_valid",
        "aat_booking_deposit_snapshot_complete",
        "aat_booking_reminder_state_valid",
        "aat_payment_exactly_one_target",
        "aat_invoice_amounts_valid",
        "BookingSlot_one_active_booking_idx",
        "BookingSlot_validate",
        "Booking_validate_slot_binding",
      ]),
    );
  });
});
