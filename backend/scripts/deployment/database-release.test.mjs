import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const image =
  process.env.AAT_MIGRATION_TEST_IMAGE || "allied-autotech-migrate:hosting-preparation";
function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}
function ok(result, label) {
  assert.equal(result.status, 0, `${label}: ${result.stderr}`);
  return result.stdout.trim();
}

test(
  "packaged deployment check rejects pending/drift and accepts isolated replay and actual separate restore",
  { timeout: 300_000 },
  async () => {
    // All writes are to newly created Docker-only _ci/_test databases. No ports,
    // host volumes, application configuration, provider keys or customer records.
    const suffix = randomBytes(6).toString("hex");
    const database = `hosting_${suffix}_ci`;
    const restored = `hosting_restore_${suffix}_test`;
    const network = ok(
      docker(["network", "create", "--internal", `aat-hosting-${suffix}`]),
      "create isolated network",
    );
    const containers = [];
    try {
      const postgres = ok(
        docker([
          "run",
          "--rm",
          "-d",
          "--network",
          network,
          "--network-alias",
          "fixture-postgres",
          "--tmpfs",
          "/var/lib/postgresql/data",
          "-e",
          "POSTGRES_HOST_AUTH_METHOD=trust",
          "-e",
          `POSTGRES_DB=${database}`,
          "postgres:17-alpine",
        ]),
        "start isolated PostgreSQL",
      );
      containers.push(postgres);
      const deadline = Date.now() + 45_000;
      while (docker(["exec", postgres, "pg_isready", "-U", "postgres"]).status !== 0) {
        assert.ok(Date.now() < deadline, "isolated PostgreSQL readiness");
        await setTimeout(250);
      }
      // Target confirmation before the replay/restore writes, without connection strings.
      console.log(
        `Isolated targets: fixture-postgres:5432/${database}, ${restored}; environment=test; no host ports.`,
      );
      const runner = ok(
        docker([
          "run",
          "--rm",
          "-d",
          "--network",
          network,
          "-e",
          "NODE_ENV=test",
          "-e",
          "DEPLOYMENT_ENV=local",
          "-e",
          "DB_HOST=fixture-postgres",
          "-e",
          "DB_PORT=5432",
          "-e",
          `DB_NAME=${database}`,
          "-e",
          "DB_USER=postgres",
          "-e",
          "DB_PASSWORD=synthetic-test-only",
          "-e",
          "DB_SSL_MODE=disable",
          "--entrypoint",
          "sleep",
          image,
          "600",
        ]),
        "start isolated migration image",
      );
      containers.push(runner);
      const check = (db = database) =>
        docker([
          "exec",
          "-e",
          `DB_NAME=${db}`,
          runner,
          "node",
          "--import",
          "tsx",
          "scripts/check-database-safety.ts",
        ]);
      const pending = check();
      assert.notEqual(pending.status, 0);
      assert.match(pending.stderr, /pending migrations/);
      ok(
        docker([
          "cp",
          path.join(backend, "scripts/verify-migrations.ts"),
          `${runner}:/app/scripts/verify-migrations.ts`,
        ]),
        "copy existing empty-replay verifier",
      );
      ok(
        docker([
          "exec",
          "-e",
          "CONFIRM_EMPTY_MIGRATION_DATABASE=true",
          runner,
          "node",
          "--import",
          "tsx",
          "scripts/verify-migrations.ts",
        ]),
        "guarded empty migration replay",
      );
      ok(check(), "read-only packaged check after replay");
      // pg_dump stays inside the isolated container; archive contents are never logged.
      ok(
        docker([
          "exec",
          postgres,
          "pg_dump",
          "-U",
          "postgres",
          "-d",
          database,
          "-Fc",
          "-f",
          "/tmp/hosting.dump",
        ]),
        "dump synthetic database",
      );
      ok(
        docker(["exec", postgres, "createdb", "-U", "postgres", restored]),
        "create NEW restore target",
      );
      ok(
        docker([
          "exec",
          postgres,
          "pg_restore",
          "-U",
          "postgres",
          "--exit-on-error",
          "-d",
          restored,
          "/tmp/hosting.dump",
        ]),
        "actual separate-target restore",
      );
      ok(check(restored), "restored migration history and schema check");
      const count = (db) =>
        ok(
          docker([
            "exec",
            postgres,
            "psql",
            "-X",
            "-U",
            "postgres",
            "-d",
            db,
            "-Atc",
            'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
          ]),
          "migration count",
        );
      assert.ok(Number(count(database)) > 0);
      assert.equal(count(restored), count(database));
      ok(
        docker([
          "exec",
          postgres,
          "psql",
          "-X",
          "-U",
          "postgres",
          "-d",
          restored,
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          "CREATE TABLE public.synthetic_drift_probe (id integer)",
        ]),
        "isolated drift fixture",
      );
      assert.notEqual(check(restored).status, 0, "schema drift must block promotion");
      console.log(
        "Pending migration rejection, empty replay, schema/history verification, separate restore and drift rejection passed. No cloud restore is claimed.",
      );
    } finally {
      for (const id of containers.reverse()) {
        assert.match(id, /^[a-f0-9]{64}$/);
        ok(docker(["rm", "--force", id]), "remove only this test's container");
      }
      assert.match(network, /^[a-f0-9]{64}$/);
      ok(docker(["network", "rm", network]), "remove only this test's network");
    }
  },
);
