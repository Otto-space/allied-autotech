import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  images,
  keyNames,
  parseTemplate,
  renderSpec,
  validateManifest,
} from "./spec.mjs";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const template = parseTemplate(
  readFileSync(path.join(backend, "ops/digitalocean/staging.app.yaml.template"), "utf8"),
);
const directory = mkdtempSync(path.join(tmpdir(), "aat-release-test-"));
after(() => rmSync(directory, { recursive: true, force: true }));
const windowsOpenSsl = "C:/Program Files/Git/usr/bin/openssl.exe";
const openssl =
  process.platform === "win32" && existsSync(windowsOpenSsl) ? windowsOpenSsl : "openssl";
execFileSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=synthetic-release-test",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-keyout",
    path.join(directory, "key.pem"),
    "-out",
    path.join(directory, "ca.pem"),
  ],
  { stdio: "ignore", windowsHide: true },
);

function fixtures() {
  const commit = "a".repeat(40);
  const manifest = {
    registry: "synthetic-registry",
    commit,
    sourceTreeClean: true,
    images: images.map((image, index) => ({
      ...image,
      tag: commit,
      digest: `sha256:${String(index).repeat(64)}`,
    })),
  };
  const input = {
    registry: manifest.registry,
    region: "lon",
    databaseCluster: "synthetic-postgres",
    values: {
      DB_HOST: "synthetic.db.ondigitalocean.com",
      DB_PORT: "25060",
      DB_USER: "synthetic_runtime",
      DB_PASSWORD: randomBytes(24).toString("hex"),
      MIGRATION_DB_USER: "synthetic_migrator",
      MIGRATION_DB_PASSWORD: randomBytes(24).toString("hex"),
      DB_SSL_CA_BASE64: readFileSync(path.join(directory, "ca.pem")).toString("base64"),
      PAYSTACK_SECRET_KEY: "sk_test_synthetic_provider_credential",
      OBJECT_STORAGE_ENDPOINT: "https://lon1.digitaloceanspaces.com",
      OBJECT_STORAGE_BUCKET: "synthetic-private-bucket",
      OBJECT_STORAGE_ACCESS_KEY_ID: "synthetic-access-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: randomBytes(24).toString("hex"),
    },
  };
  const keys = Object.fromEntries(
    keyNames.map((name) => [name, randomBytes(32).toString("base64")]),
  );
  return { input, manifest, keys };
}

test("rendered spec preserves all four process boundaries and initial staging safety gates", () => {
  const { input, manifest, keys } = fixtures();
  const spec = renderSpec(template, input, manifest, keys);
  assert.equal(spec.name, "allied-autotech-staging");
  assert.equal(spec.services.length, 1);
  assert.equal(spec.workers.length, 2);
  assert.equal(spec.jobs.length, 1);
  assert.equal(spec.jobs[0].kind, "PRE_DEPLOY");
  assert.equal(spec.databases[0].production, true);
  assert.equal(spec.databases[0].cluster_name, input.databaseCluster);
  assert.equal(spec.services[0].http_port, 5000);
  assert.equal(spec.services[0].health_check.http_path, "/api/v1/health/ready");
  assert.equal(spec.services[0].liveness_health_check.http_path, "/api/v1/health/live");
  for (const component of [...spec.services, ...spec.workers, ...spec.jobs]) {
    assert.equal(component.instance_count, 1);
    assert.equal(component.image.registry, input.registry);
    assert.match(component.image.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(component.image.tag, undefined);
    const env = Object.fromEntries(
      component.envs.map((entry) => [entry.key, entry.value]),
    );
    assert.equal(env.NODE_ENV, "production");
    assert.equal(env.DEPLOYMENT_ENV, "staging");
    assert.equal(env.DB_SSL_MODE, "verify-full");
    assert.equal(env.DB_SSL_CA_FILE, "/tmp/allied-autotech-secrets/database-ca.pem");
    assert.equal(
      env.DB_USER,
      component.name === "migrate"
        ? input.values.MIGRATION_DB_USER
        : input.values.DB_USER,
    );
    for (const entry of component.envs) {
      assert.equal(entry.scope, "RUN_TIME");
      if (
        keyNames.includes(entry.key) ||
        [
          "DB_PASSWORD",
          "DB_SSL_CA_BASE64",
          "PAYSTACK_SECRET_KEY",
          "OBJECT_STORAGE_ACCESS_KEY_ID",
          "OBJECT_STORAGE_SECRET_ACCESS_KEY",
        ].includes(entry.key)
      ) {
        assert.equal(entry.type, "SECRET");
      }
    }
    if (component.name !== "api") assert.equal(component.http_port, undefined);
    if (component.name === "migrate") {
      assert.ok(
        component.envs.every(
          (entry) =>
            entry.key.startsWith("DB_") ||
            ["NODE_ENV", "DEPLOYMENT_ENV", "SERVICE_NAME"].includes(entry.key),
        ),
      );
    } else {
      assert.equal(env.EMAIL_DELIVERY_ENABLED, "false");
      if (component.name !== "identity-worker") {
        assert.equal(env.SMS_DELIVERY_ENABLED, "false");
        assert.equal(env.PAYSTACK_MODE, "test");
        assert.equal(env.PAYSTACK_LIVE_ENABLED, "false");
        assert.equal(env.MONNIFY_MODE, "disabled");
      }
    }
  }
  const api = Object.fromEntries(
    spec.services[0].envs.map((entry) => [entry.key, entry.value]),
  );
  assert.equal(api.API_DOCS_ENABLED, "false");
  assert.equal(api.TRUST_PROXY_HOPS, "0");
  assert.equal(api.TRUST_PROXY_CIDRS, "");
  assert.equal(api.WEBAUTHN_RP_ID, "staging.alliedautotech.com");
  assert.equal(api.FRONTEND_URL, "https://staging.alliedautotech.com");
});

for (const [description, mutate] of [
  [
    "unresolved credentials",
    ({ input }) => {
      input.values.DB_PASSWORD = "REPLACE_PASSWORD";
    },
  ],
  [
    "live Paystack credential",
    ({ input }) => {
      input.values.PAYSTACK_SECRET_KEY = "sk_live_synthetic_rejected";
    },
  ],
  [
    "reused database role",
    ({ input }) => {
      input.values.MIGRATION_DB_USER = input.values.DB_USER;
    },
  ],
  [
    "database administrator",
    ({ input }) => {
      input.values.DB_USER = "doadmin";
    },
  ],
  [
    "reused application keys",
    ({ keys }) => {
      keys.MFA_ENCRYPTION_KEY = keys.TOKEN_HASH_KEY;
    },
  ],
  [
    "invalid CA",
    ({ input }) => {
      input.values.DB_SSL_CA_BASE64 = Buffer.from("not a certificate").toString("base64");
    },
  ],
  [
    "private key mixed into CA",
    ({ input }) => {
      input.values.DB_SSL_CA_BASE64 = Buffer.from(
        readFileSync(path.join(directory, "ca.pem"), "utf8") +
          readFileSync(path.join(directory, "key.pem"), "utf8"),
      ).toString("base64");
    },
  ],
  [
    "TLS override",
    ({ input }) => {
      input.values.DB_SSL_MODE = "disable";
    },
  ],
  [
    "extra privileged environment",
    ({ input }) => {
      input.values.RUN_DATABASE_TESTS = "true";
    },
  ],
  [
    "wrong registry",
    ({ manifest }) => {
      manifest.registry = "another-registry";
    },
  ],
  [
    "missing image",
    ({ manifest }) => {
      manifest.images.pop();
    },
  ],
  [
    "dirty release",
    ({ manifest }) => {
      manifest.sourceTreeClean = false;
    },
  ],
  [
    "mutable tag in place of digest",
    ({ manifest }) => {
      manifest.images[0].digest = "latest";
    },
  ],
  [
    "mismatched image commit",
    ({ manifest }) => {
      manifest.images[0].tag = "b".repeat(40);
    },
  ],
]) {
  test(`rejects ${description} without including secret values in errors`, () => {
    const data = fixtures();
    mutate(data);
    assert.throws(
      () => renderSpec(template, data.input, data.manifest, data.keys),
      (error) => {
        for (const name of [
          "DB_PASSWORD",
          "MIGRATION_DB_PASSWORD",
          "PAYSTACK_SECRET_KEY",
          "OBJECT_STORAGE_SECRET_ACCESS_KEY",
        ]) {
          assert.ok(!error.message.includes(data.input.values[name]));
        }
        return true;
      },
    );
  });
}

test("duplicate components cannot substitute for a missing pushed image", () => {
  const { manifest } = fixtures();
  manifest.images[3] = manifest.images[0];
  assert.throws(() => validateManifest(manifest, manifest.registry));
});
