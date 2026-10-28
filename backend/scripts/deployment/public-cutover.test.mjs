import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { preparePublicBrowseCutover } from "./public-cutover.mjs";
import { parseTemplate } from "./spec.mjs";

function fixture() {
  const spec = parseTemplate(
    readFileSync(
      new URL("../../ops/digitalocean/production.app.yaml.template", import.meta.url),
      "utf8",
    ),
  );
  for (const c of [...spec.services, ...spec.workers, ...spec.jobs]) {
    c.image = {
      registry: "existing",
      repository: c.name,
      digest: "sha256:" + "a".repeat(64),
    };
    c.envs.push({
      key: "OPAQUE_PROVIDER_SECRET",
      type: "SECRET",
      value: "EV[synthetic]",
    });
  }
  const frontend = {
    BACKEND_ORIGIN: "https://api.alliedautotech.com",
    SITE_ORIGIN: "https://alliedautotech.com",
    NEXT_PUBLIC_PUBLIC_LAUNCH_MODE: "browse_enquiries",
    PRIVATE_TESTING_ENABLED: "true",
    SITE_INDEXING: "disabled",
  };
  return { spec, frontend };
}

test("public plan changes only the outer API gate and two frontend settings", () => {
  const { spec, frontend } = fixture();
  const original = structuredClone(spec);
  const plan = preparePublicBrowseCutover(spec, frontend);
  assert.deepEqual(spec, original, "Planner mutated current provider state.");
  assert.equal(plan.summary.applied, false);
  assert.deepEqual(plan.frontendChanges, {
    PRIVATE_TESTING_ENABLED: "false",
    SITE_INDEXING: "enabled",
  });
  assert.deepEqual(plan.frontendRollback, {
    PRIVATE_TESTING_ENABLED: "true",
    SITE_INDEXING: "disabled",
  });
  plan.appSpec.services[0].envs.find((e) => e.key === "PRIVATE_TESTING_ENABLED").value =
    "true";
  assert.deepEqual(
    plan.appSpec,
    original,
    "Images, capacity, secrets or other settings changed.",
  );
});

for (const [name, mutate] of [
  [
    "wrong app",
    (s) => {
      s.name = "allied-autotech-staging";
    },
  ],
  [
    "wrong database",
    (s) => {
      s.databases[0].db_name = "allied_autotech_staging";
    },
  ],
  [
    "new database server",
    (s) => {
      s.databases[0].cluster_name = "new-paid-cluster";
    },
  ],
  [
    "more capacity",
    (s) => {
      s.services[0].instance_count = 2;
    },
  ],
  [
    "autoscaling",
    (s) => {
      s.services[0].autoscaling = { min_instance_count: 1 };
    },
  ],
  [
    "mutable image",
    (s) => {
      delete s.services[0].image.digest;
      s.services[0].image.tag = "latest";
    },
  ],
  [
    "duplicate component",
    (s) => {
      s.workers[1].name = s.workers[0].name;
    },
  ],
  [
    "migration on deploy",
    (s) => {
      s.jobs[0].run_command = "npm run db:migrate";
    },
  ],
  [
    "frontend full launch",
    (_s, f) => {
      f.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE = "full";
    },
  ],
  [
    "wrong frontend origin",
    (_s, f) => {
      f.SITE_ORIGIN = "https://staging.alliedautotech.com";
    },
  ],
  [
    "wrong backend origin",
    (_s, f) => {
      f.BACKEND_ORIGIN = "https://another.example";
    },
  ],
]) {
  test(`rejects ${name}`, () => {
    const f = fixture();
    mutate(f.spec, f.frontend);
    assert.throws(() => preparePublicBrowseCutover(f.spec, f.frontend));
  });
}

for (const [key, value] of [
  ["PUBLIC_LAUNCH_MODE", "full"],
  ["PAYSTACK_MODE", "live"],
  ["MONNIFY_MODE", "live"],
  ["PAYMENT_RECONCILIATION_ENABLED", "true"],
  ["SMS_DELIVERY_ENABLED", "true"],
  ["DB_USER", "doadmin"],
  ["DB_SSL_MODE", "disable"],
  ["PRIVATE_TESTING_ENABLED", "false"],
  ["DEPARTMENT_INFO_EMAIL", "unreviewed@example.test"],
]) {
  test(`rejects unsafe current ${key}`, () => {
    const f = fixture();
    f.spec.services[0].envs.find((e) => e.key === key).value = value;
    assert.throws(() => preparePublicBrowseCutover(f.spec, f.frontend));
  });
}

test("rejects ambiguous duplicate API configuration", () => {
  const f = fixture();
  f.spec.services[0].envs.push({ key: "PRIVATE_TESTING_ENABLED", value: "false" });
  assert.throws(() => preparePublicBrowseCutover(f.spec, f.frontend), /Duplicate/);
});
