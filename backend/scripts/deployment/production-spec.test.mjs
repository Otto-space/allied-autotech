import assert from "node:assert/strict";
import { randomBytes, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { test } from "node:test";
import { images, keyNames, parseTemplate } from "./spec.mjs";
import { renderProductionSpec } from "./production-spec.mjs";

function fixture() {
  const template = parseTemplate(
    readFileSync(
      new URL("../../ops/digitalocean/production.app.yaml.template", import.meta.url),
      "utf8",
    ),
  );
  const input = JSON.parse(
    readFileSync(
      new URL("../../ops/digitalocean/production-inputs.example.json", import.meta.url),
      "utf8",
    ),
  );
  const ca = rootCertificates.find((pem) => {
    const certificate = new X509Certificate(pem);
    return (
      certificate.ca &&
      Date.parse(certificate.validTo) > Date.now() &&
      Date.parse(certificate.validFrom) < Date.now()
    );
  });
  input.values = {
    FRONTEND_PROXY_SECRET: randomBytes(32).toString("base64"),
    DB_HOST: "synthetic.db.ondigitalocean.com",
    DB_PORT: "25060",
    DB_USER: "allied_production_runtime",
    DB_PASSWORD: "synthetic-runtime-password",
    MIGRATION_DB_USER: "allied_production_migrator",
    MIGRATION_DB_PASSWORD: "synthetic-migrator-password",
    DB_SSL_CA_BASE64: Buffer.from(ca).toString("base64"),
    OBJECT_STORAGE_ENDPOINT: "https://lon1.digitaloceanspaces.com",
    OBJECT_STORAGE_BUCKET: input.bucket,
    OBJECT_STORAGE_ACCESS_KEY_ID: "synthetic-access",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "synthetic-secret",
    RESEND_API_KEY: "re_synthetic",
    RESEND_WEBHOOK_SECRET: `whsec_${randomBytes(32).toString("base64")}`,
    PRIVATE_TESTING_PASSWORD: "f".repeat(64),
  };
  const keys = Object.fromEntries(
    keyNames.map((name) => [name, randomBytes(32).toString("base64")]),
  );
  const commit = "a".repeat(40);
  const manifest = {
    registry: input.registry,
    commit,
    sourceTreeClean: true,
    images: images.map((image, index) => ({
      ...image,
      tag: commit,
      digest: "sha256:" + String(index).repeat(64),
    })),
  };
  return { template, input, manifest, keys };
}

test("production render uses the existing server, separate database and immutable images", () => {
  const f = fixture();
  const spec = renderProductionSpec(f.template, f.input, f.manifest, f.keys);
  assert.equal(spec.databases[0].cluster_name, "allied-autotech-staging-db");
  assert.equal(spec.databases[0].db_name, "allied_autotech_production");
  assert.equal(JSON.stringify(spec).includes("REPLACE_"), false);
  assert.equal(
    Object.fromEntries(spec.services[0].envs.map((e) => [e.key, e.value]))
      .PRIVATE_TESTING_ENABLED,
    "true",
  );
  assert.equal(spec.jobs[0].run_command.includes("check-database-safety.ts"), true);
});

test("all initial enquiry types route to the approved monitored inbox", () => {
  const f = fixture();
  const spec = renderProductionSpec(f.template, f.input, f.manifest, f.keys);
  const env = Object.fromEntries(spec.services[0].envs.map((e) => [e.key, e.value]));
  for (const key of [
    "DEPARTMENT_INFO_EMAIL",
    "DEPARTMENT_SALES_EMAIL",
    "DEPARTMENT_SUPPORT_EMAIL",
  ]) {
    assert.equal(env[key], "support@alliedautotech.com");
    const changed = fixture();
    changed.template.services[0].envs.find((e) => e.key === key).value =
      "unreviewed@example.com";
    assert.throws(
      () =>
        renderProductionSpec(
          changed.template,
          changed.input,
          changed.manifest,
          changed.keys,
        ),
      /approved monitored support inbox/,
    );
  }
});

for (const [name, mutate] of [
  [
    "another server",
    (f) => {
      f.input.databaseClusterName = "unapproved-new-server";
    },
  ],
  [
    "staging data",
    (f) => {
      f.input.databaseName = "allied_autotech_staging";
    },
  ],
  [
    "staging credentials",
    (f) => {
      f.input.values.DB_USER = "allied_staging_runtime";
    },
  ],
  [
    "shared passwords",
    (f) => {
      f.input.values.DB_PASSWORD = f.input.values.MIGRATION_DB_PASSWORD;
    },
  ],
  [
    "staging storage",
    (f) => {
      f.input.values.OBJECT_STORAGE_BUCKET = "staging-private";
    },
  ],
  [
    "increased capacity",
    (f) => {
      f.template.services[0].instance_count = 2;
    },
  ],
  [
    "payment activation",
    (f) => {
      f.template.services[0].envs.find((e) => e.key === "PAYSTACK_MODE").value = "live";
    },
  ],
  [
    "removed private gate",
    (f) => {
      f.template.services[0].envs.find((e) => e.key === "PRIVATE_TESTING_ENABLED").value =
        "false";
    },
  ],
  [
    "startup migrations",
    (f) => {
      f.template.jobs[0].run_command = "npm run db:migrate";
    },
  ],
  [
    "invalid CA",
    (f) => {
      f.input.values.DB_SSL_CA_BASE64 = Buffer.from("invalid").toString("base64");
    },
  ],
  [
    "mutable image",
    (f) => {
      f.manifest.images[0].digest = "latest";
    },
  ],
]) {
  test(`production render rejects ${name}`, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => renderProductionSpec(f.template, f.input, f.manifest, f.keys));
  });
}
