import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000,
  });
}

test("staging SQL grants DML/default privileges and denies runtime DDL in an isolated PostgreSQL container", async () => {
  // No host ports, host volumes, real credentials, or application databases.
  const name = `aat-staging-role-test-${randomBytes(8).toString("hex")}`;
  const started = docker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17-alpine",
  ]);
  assert.equal(started.status, 0, "Disposable PostgreSQL container must start.");
  const id = started.stdout.trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  try {
    const deadline = Date.now() + 45_000;
    while (docker(["exec", id, "pg_isready", "-U", "postgres"]).status !== 0) {
      assert.ok(Date.now() < deadline, "Disposable PostgreSQL did not become ready.");
      await setTimeout(200);
    }
    const sql = (statement, role = "postgres", database = "allied_autotech_staging") =>
      docker(
        [
          "exec",
          "-i",
          id,
          "psql",
          "-X",
          "-U",
          role,
          "-d",
          database,
          "-v",
          "ON_ERROR_STOP=1",
          "-At",
        ],
        statement,
      );
    const ok = (result) => assert.equal(result.status, 0, result.stderr);
    ok(
      sql(
        "CREATE DATABASE allied_autotech_staging; CREATE ROLE fixture_runtime LOGIN; CREATE ROLE fixture_migrate LOGIN;",
        "postgres",
        "postgres",
      ),
    );
    ok(
      docker([
        "cp",
        path.join(backend, "ops/postgres/staging-privileges.sql"),
        `${id}:/tmp/staging-privileges.sql`,
      ]),
    );
    const provision = (
      database = "allied_autotech_staging",
      runtimeRole = "fixture_runtime",
    ) =>
      docker([
        "exec",
        id,
        "psql",
        "-X",
        "-U",
        "postgres",
        "-d",
        database,
        "-v",
        `runtime_role=${runtimeRole}`,
        "-v",
        "migration_role=fixture_migrate",
        "-f",
        "/tmp/staging-privileges.sql",
      ]);
    assert.notEqual(provision("postgres").status, 0, "Wrong database must fail.");
    assert.notEqual(
      provision("allied_autotech_staging", "fixture_migrate").status,
      0,
      "Shared roles must fail.",
    );
    ok(provision());
    ok(
      sql(
        "CREATE TABLE fixture (id serial PRIMARY KEY, label text); CREATE TABLE _prisma_migrations (id text);",
        "fixture_migrate",
      ),
    );
    ok(provision());
    ok(
      sql(
        "INSERT INTO fixture (label) VALUES ('synthetic'); UPDATE fixture SET label = 'updated'; SELECT * FROM fixture; DELETE FROM fixture;",
        "fixture_runtime",
      ),
    );
    for (const statement of [
      "CREATE TABLE forbidden (id integer);",
      "CREATE SCHEMA forbidden;",
      "ALTER TABLE fixture ADD COLUMN forbidden integer;",
      "TRUNCATE fixture;",
      "CREATE ROLE forbidden;",
      "SELECT * FROM _prisma_migrations;",
      "SET ROLE fixture_migrate;",
    ])
      assert.notEqual(
        sql(statement, "fixture_runtime").status,
        0,
        "Runtime must reject prohibited action.",
      );
    ok(
      sql(
        "CREATE TABLE fixture_later (id serial PRIMARY KEY, label text);",
        "fixture_migrate",
      ),
    );
    ok(
      sql(
        "INSERT INTO fixture_later (label) VALUES ('default grant');",
        "fixture_runtime",
      ),
    );
    ok(sql("GRANT fixture_migrate TO fixture_runtime;"));
    assert.notEqual(provision().status, 0, "Unexpected inherited privileges must fail.");
  } finally {
    // Remove only the exact container ID created above, never an existing name.
    const stopped = docker(["rm", "--force", id]);
    assert.equal(stopped.status, 0, "Disposable container cleanup failed.");
  }
});
