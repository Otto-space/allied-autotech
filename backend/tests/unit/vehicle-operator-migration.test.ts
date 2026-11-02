import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { assertNonDestructiveMigration } from "../../scripts/lib/database-safety.js";

it("permits only the reviewed vehicle actor nullability expansion, not changed SQL", () => {
  const name = "20261102090000_vehicle_operator_actor_history";
  const sql = readFileSync(
    new URL(`../../prisma/migrations/${name}/migration.sql`, import.meta.url),
    "utf8",
  );
  expect(() => assertNonDestructiveMigration(sql, name)).not.toThrow();
  expect(() => assertNonDestructiveMigration(sql + "\n", name)).toThrow();
  expect(() => assertNonDestructiveMigration(sql)).toThrow();
});
