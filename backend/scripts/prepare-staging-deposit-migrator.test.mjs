import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  selectHistoricalBytes,
  verifyJournal,
} from "./prepare-staging-deposit-migrator.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("reconstructs exact LF, CRLF and terminal-CRLF historical bytes", () => {
  const sql = Buffer.from("SELECT 1;\r\nSELECT 2;\r\n");
  for (const historical of [
    Buffer.from("SELECT 1;\nSELECT 2;\n"),
    sql,
    Buffer.from("SELECT 1;\nSELECT 2;\r\n"),
  ]) {
    const restored = selectHistoricalBytes(sql, hash(historical), "example");
    assert.deepEqual(restored, historical);
  }
});

test("refuses unrelated SQL differences and unknown checksums", () => {
  assert.throws(() => selectHistoricalBytes(Buffer.from("SELECT 1;\n"), hash("DELETE FROM x;\n"), "x"), /differs beyond/);
  assert.throws(() => selectHistoricalBytes(Buffer.from("SELECT 1;\n"), "bad", "x"), /Invalid recorded/);
});

test("requires exactly 132 completed applied records and only two pending deposit migrations", (t) => {
  const root = mkdtempSync(join(tmpdir(), "aat-migration-journal-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const appliedNames = Array.from({ length: 132 }, (_, i) => `202601${String(i).padStart(6, "0")}_applied`);
  const pendingNames = [
    "20261123110000_approved_quote_booking_deposit_20",
    "20261123120000_booking_deposit_invoice_credit",
  ];
  for (const name of [...appliedNames, ...pendingNames]) {
    mkdirSync(join(root, name));
    writeFileSync(join(root, name, "migration.sql"), "SELECT 1;\r\n");
  }
  const rows = appliedNames.map((migration_name) => ({
    migration_name,
    checksum: hash("SELECT 1;\n"),
    finished_at: "2026-01-01T00:00:00Z",
    rolled_back_at: null,
  }));
  const result = verifyJournal(rows, root);
  assert.equal(result.applied.size, 132);
  assert.deepEqual(result.pending, pendingNames);
  assert.throws(() => verifyJournal(rows.slice(1), root), /132/);
  assert.throws(() => verifyJournal([...rows.slice(0, -1), rows[0]], root), /duplicate/);
  assert.throws(() => verifyJournal(rows.map((row, index) => index === 0 ? { ...row, finished_at: null } : row), root), /Incomplete/);
});
