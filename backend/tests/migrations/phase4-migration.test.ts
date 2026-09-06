import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL(
    "../../prisma/migrations/20260904010000_phase_4_catalog_inventory/migration.sql",
    import.meta.url,
  ),
);

describe("Phase 4 migration", () => {
  it("enforces reservation lifecycle, query indexes, and immutable terminal state", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('CREATE TYPE "InventoryReservationStatus"');
    expect(sql).toContain('CONSTRAINT "aat_inventory_reservation_quantity_positive"');
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "InventoryReservation_one_active_reference"',
    );
    expect(sql).toContain('CREATE INDEX "Product_public_price_id_idx"');
    expect(sql).toContain("Terminal inventory reservations are immutable");
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON "InventoryReservation"');
  });
});
