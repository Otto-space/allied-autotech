import { describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";

describe.skipIf(!runDatabaseTests)("booking deposit database controls", () => {
  it("uses paid, allocated 20% deposits for invoice credit without requiring a legacy slot", async () => {
    const definitions = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_functiondef('aat_validate_invoice_source_snapshot()'::regprocedure) AS definition
    `;
    expect(definitions).toHaveLength(1);
    const definition = definitions[0]!.definition;
    expect(definition).toContain("approved-quote-deposit-20-v1");
    expect(definition).toContain('b."depositPolicyVersion" = \'approved-quote-deposit-20-v1\'');
    expect(definition).toContain('b."depositPaidAt" IS NOT NULL');
    expect(definition).toContain('p."id" IS NOT NULL');
    expect(definition).toContain('b."depositBaseKobo" = q."totalKobo"');
    expect(definition).toContain('b."bookingSlotId" IS NULL');
    expect(definition).toContain('b."depositBaseKobo" IS DISTINCT FROM q."totalKobo"');
    expect(definition).toContain('Paid booking deposit and accepted quotation are inconsistent');
  });

  it("preserves legacy snapshots and restricts the new 20% policy to its version", async () => {
    const constraints = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'aat_booking_deposit_snapshot_complete'
    `;
    expect(constraints).toHaveLength(1);
    const definition = constraints[0]!.definition;
    expect(definition).toContain("owner-booking-request-v2");
    expect(definition).toContain("approved-quote-deposit-20-v1");
    expect(definition).toMatch(/"depositBasisPoints" = 3000/);
    expect(definition).toMatch(/"depositBasisPoints" = 2000/);
  });

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
