import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { rootCertificates } from "node:tls";
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
// A public CA is sufficient for configuration validation; no connection is made.
// Match the production-spec fixture without an OpenSSL process or disk files.
const ca = rootCertificates.find((pem) => {
  const certificate = new X509Certificate(pem);
  return (
    certificate.ca &&
    Date.parse(certificate.validFrom) < Date.now() &&
    Date.parse(certificate.validTo) > Date.now()
  );
});
assert.ok(ca, "A currently valid CA fixture is required.");
const privateKey = generateKeyPairSync("ed25519").privateKey.export({
  type: "pkcs8",
  format: "pem",
});

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
    paystackMode: "test",
    bookingDepositTestEnabled: true,
    values: {
      DB_HOST: "synthetic.db.ondigitalocean.com",
      DB_PORT: "25060",
      DB_USER: "synthetic_runtime",
      DB_PASSWORD: randomBytes(24).toString("hex"),
      MIGRATION_DB_USER: "synthetic_migrator",
      MIGRATION_DB_PASSWORD: randomBytes(24).toString("hex"),
      DB_SSL_CA_BASE64: Buffer.from(ca).toString("base64"),
      PAYSTACK_SECRET_KEY: "sk_test_synthetic_provider_credential",
      OBJECT_STORAGE_ENDPOINT: "https://lon1.digitaloceanspaces.com",
      OBJECT_STORAGE_BUCKET: "synthetic-private-bucket",
      OBJECT_STORAGE_ACCESS_KEY_ID: "synthetic-access-key",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: randomBytes(24).toString("hex"),
      PRIVATE_TESTING_PASSWORD: randomBytes(32).toString("hex"),
    },
  };
  const keys = Object.fromEntries(
    keyNames.map((name) => [name, randomBytes(32).toString("base64")]),
  );
  return { input, manifest, keys };
}

test("disabled payments need no provider key and cannot enable reconciliation or live payments", () => {
  const { input, manifest, keys } = fixtures();
  input.paystackMode = "disabled";
  input.bookingDepositTestEnabled = false;
  input.values.PAYSTACK_SECRET_KEY = "";
  const spec = renderSpec(template, input, manifest, keys);
  for (const component of [...spec.services, ...spec.workers]) {
    const env = Object.fromEntries(
      component.envs.map((entry) => [entry.key, entry.value]),
    );
    if (env.PAYSTACK_MODE !== undefined) {
      assert.equal(env.PAYSTACK_MODE, "disabled");
      assert.equal(env.PAYSTACK_SECRET_KEY, "");
      assert.equal(env.PAYSTACK_LIVE_ENABLED, "false");
    }
    if (env.PAYMENT_RECONCILIATION_ENABLED !== undefined) {
      assert.equal(env.PAYMENT_RECONCILIATION_ENABLED, "false");
    }
  }
  input.values.PAYSTACK_SECRET_KEY = "sk_live_synthetic";
  assert.throws(() => renderSpec(template, input, manifest, keys), /empty Paystack key/);
  input.paystackMode = "live";
  assert.throws(() => renderSpec(template, input, manifest, keys), /disabled or test/);
});

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
    assert.equal(component.image.registry, undefined);
    assert.match(component.image.digest, /^sha256:[a-f0-9]{64}$/);
    assert.equal(component.image.tag, undefined);
    const env = Object.fromEntries(
      component.envs.map((entry) => [entry.key, entry.value]),
    );
    assert.equal(env.NODE_ENV, "production");
    assert.equal(env.DEPLOYMENT_ENV, "staging");
    if (component.name !== "migrate") {
      assert.equal(env.PUBLIC_LAUNCH_MODE, "full");
      assert.equal(env.BOOKING_REQUESTS_ENABLED, "false");
      assert.equal(env.PRODUCT_PURCHASES_ENABLED, "false");
      assert.equal(
        env.BOOKING_DEPOSIT_TEST_ENABLED,
        component.name === "api" ? "true" : undefined,
      );
    }
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
          "PRIVATE_TESTING_PASSWORD",
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
        assert.equal(env.PAYMENT_RECONCILIATION_ENABLED, "false");
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
  assert.equal(api.PRIVATE_TESTING_ENABLED, "true");
  assert.equal(api.PRIVATE_TESTING_PASSWORD, input.values.PRIVATE_TESTING_PASSWORD);
  assert.equal(
    spec.jobs[0].run_command,
    "aat-with-database-ca node --import tsx scripts/check-database-safety.ts",
  );
  const pools = [...spec.services, ...spec.workers].map((c) =>
    Number(c.envs.find((e) => e.key === "DB_POOL_MAX").value),
  );
  assert.deepEqual(pools, [4, 1, 2]);
  assert.ok(pools.reduce((a, b) => a + b, 0) * 2 + 4 <= 22);
  assert.equal(spec.services[0].instance_size_slug, "apps-s-1vcpu-1gb-fixed");
  assert.ok(spec.workers.every((c) => c.instance_size_slug === "apps-s-1vcpu-0.5gb"));
  assert.ok(
    [...spec.workers, ...spec.jobs].every(
      (c) => !c.envs.some((e) => e.key === "PRIVATE_TESTING_PASSWORD"),
    ),
  );
});

test("deposit-only test mode cannot enable bookings, purchases, live mode or reconciliation", () => {
  const { input, manifest, keys } = fixtures();
  for (const [name, value] of [
    ["BOOKING_REQUESTS_ENABLED", "true"],
    ["PRODUCT_PURCHASES_ENABLED", "true"],
    ["PUBLIC_LAUNCH_MODE", "browse_enquiries"],
    ["PAYSTACK_LIVE_ENABLED", "true"],
    ["PAYMENT_RECONCILIATION_ENABLED", "true"],
  ]) {
    const altered = structuredClone(template);
    const api = altered.services[0];
    const target = api.envs.find((entry) => entry.key === name);
    target.value = value;
    assert.throws(() => renderSpec(altered, input, manifest, keys));
  }
  input.bookingDepositTestEnabled = false;
  assert.throws(() => renderSpec(template, input, manifest, keys), /enabled together/);
  input.bookingDepositTestEnabled = true;
  input.paystackMode = "disabled";
  input.values.PAYSTACK_SECRET_KEY = "";
  assert.throws(() => renderSpec(template, input, manifest, keys), /enabled together/);
});

test("disabled staging mode stays explicitly closed with no API deposit exception", () => {
  const { input, manifest, keys } = fixtures();
  input.paystackMode = "disabled";
  input.bookingDepositTestEnabled = false;
  input.values.PAYSTACK_SECRET_KEY = "";
  const spec = renderSpec(template, input, manifest, keys);
  const api = Object.fromEntries(spec.services[0].envs.map((e) => [e.key, e.value]));
  assert.equal(api.PUBLIC_LAUNCH_MODE, "full");
  assert.equal(api.BOOKING_REQUESTS_ENABLED, "false");
  assert.equal(api.PRODUCT_PURCHASES_ENABLED, "false");
  assert.equal(api.BOOKING_DEPOSIT_TEST_ENABLED, "false");
  assert.equal(api.PAYSTACK_MODE, "disabled");
  assert.equal(api.PAYMENT_RECONCILIATION_ENABLED, "false");
});

for (const [description, mutate] of [
  [
    "weak private testing credential",
    ({ input }) => {
      input.values.PRIVATE_TESTING_PASSWORD = "weak";
    },
  ],
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
      input.values.DB_SSL_CA_BASE64 = Buffer.from(ca + privateKey).toString("base64");
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

test("media storage is configured for API and cleanup worker, with credentials runtime-scoped and absent from other processes", () => {
  const { input, manifest, keys } = fixtures();
  const spec = renderSpec(template, input, manifest, keys);
  const api = spec.services.find((c) => c.name === "api");
  const worker = spec.workers.find((c) => c.name === "general-worker");
  const apiStorage = api.envs.filter((e) => e.key.startsWith("OBJECT_STORAGE_"));
  const workerStorage = worker.envs.filter((e) => e.key.startsWith("OBJECT_STORAGE_"));
  assert.deepEqual(workerStorage, apiStorage);
  assert.equal(workerStorage.length, 6);
  for (const key of [
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  ]) {
    assert.equal(workerStorage.find((e) => e.key === key).type, "SECRET");
    assert.equal(workerStorage.find((e) => e.key === key).scope, "RUN_TIME");
  }
  assert.ok(!worker.envs.some((e) => e.key === "MFA_ENCRYPTION_KEY"));
  for (const component of [
    ...spec.workers.filter((c) => c.name !== "general-worker"),
    ...spec.jobs,
  ])
    assert.ok(!component.envs.some((e) => e.key.startsWith("OBJECT_STORAGE_")));
});
