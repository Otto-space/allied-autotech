import assert from "node:assert/strict";

const origin = "https://alliedautotech.com";
const backendOrigin = "https://api.alliedautotech.com";
const databaseName = "allied_autotech_production";
const capacity = {
  api: "apps-s-1vcpu-1gb-fixed",
  "identity-worker": "apps-s-1vcpu-0.5gb",
  "general-worker": "apps-s-1vcpu-0.5gb",
  migrate: "apps-s-1vcpu-1gb-fixed",
};

function environment(entries) {
  assert.ok(Array.isArray(entries), "Component environment is missing.");
  const values = {};
  for (const entry of entries) {
    assert.ok(!Object.hasOwn(values, entry.key), "Duplicate environment key.");
    values[entry.key] = entry.value;
  }
  return values;
}

/**
 * Prepare a reviewable, reversible configuration plan from the CURRENT provider
 * spec. Never apply it here: this module has no network, filesystem or database
 * operations. Publication readiness is checked by the operator before execution.
 * Opaque provider secrets and current immutable images are preserved verbatim.
 */
export function preparePublicBrowseCutover(current, frontend) {
  assert.equal(current.name, "allied-autotech-production", "Wrong app.");
  assert.equal(current.region, "lon", "Wrong region.");
  assert.equal(current.databases?.length, 1, "Unexpected database attachment.");
  assert.equal(current.databases[0].cluster_name, "allied-autotech-staging-db");
  assert.equal(current.databases[0].db_name, databaseName);
  assert.equal(current.services?.length, 1, "Unexpected API capacity.");
  assert.equal(current.workers?.length, 2, "Unexpected worker capacity.");
  assert.equal(current.jobs?.length, 1, "Unexpected deployment job.");
  assert.equal(current.services[0].name, "api");
  assert.equal(current.jobs[0].name, "migrate");
  const components = [...current.services, ...current.workers, ...current.jobs];
  assert.equal(new Set(components.map((c) => c.name)).size, 4);
  for (const component of components) {
    assert.ok(Object.hasOwn(capacity, component.name), "Unexpected component.");
    assert.equal(component.instance_count, 1, "Unapproved instance count.");
    assert.equal(component.instance_size_slug, capacity[component.name]);
    assert.equal(component.autoscaling, undefined, "Unapproved autoscaling.");
    assert.match(component.image?.digest ?? "", /^sha256:[a-f0-9]{64}$/);
    assert.ok(
      [undefined, false].includes(component.image?.deploy_on_push?.enabled),
      "Image deployment must remain pinned.",
    );
    const env = environment(component.envs);
    assert.equal(env.DEPLOYMENT_ENV, "production");
    assert.equal(env.PUBLIC_LAUNCH_MODE, "browse_enquiries");
    assert.equal(env.DB_NAME, databaseName);
    assert.equal(env.DB_SSL_MODE, "verify-full");
    assert.equal(
      env.DB_USER,
      component.name === "migrate"
        ? "allied_production_migrator"
        : "allied_production_runtime",
    );
    for (const key of ["PAYSTACK_MODE", "MONNIFY_MODE"])
      assert.ok(env[key] === undefined || env[key] === "disabled", "Payments enabled.");
    for (const key of [
      "PAYSTACK_LIVE_ENABLED",
      "MONNIFY_LIVE_ENABLED",
      "PAYMENT_RECONCILIATION_ENABLED",
      "SMS_DELIVERY_ENABLED",
    ])
      assert.ok(env[key] === undefined || env[key] === "false", "Provider enabled.");
  }
  const api = environment(current.services[0].envs);
  assert.equal(api.PRIVATE_TESTING_ENABLED, "true", "Expected a private prelaunch app.");
  assert.equal(api.FRONTEND_URL, origin);
  assert.equal(api.CLIENT_IP_SOURCE, "digitalocean");
  assert.equal(api.PAYSTACK_MODE, "disabled");
  assert.equal(api.MONNIFY_MODE, "disabled");
  for (const key of [
    "DEPARTMENT_INFO_EMAIL",
    "DEPARTMENT_SALES_EMAIL",
    "DEPARTMENT_SUPPORT_EMAIL",
  ])
    assert.equal(api[key], "support@alliedautotech.com");
  assert.equal(current.jobs[0].kind, "PRE_DEPLOY");
  assert.equal(
    current.jobs[0].run_command,
    "aat-with-database-ca node --import tsx scripts/check-database-safety.ts",
  );
  assert.equal(frontend.BACKEND_ORIGIN, backendOrigin);
  assert.equal(frontend.SITE_ORIGIN, origin);
  assert.equal(frontend.NEXT_PUBLIC_PUBLIC_LAUNCH_MODE, "browse_enquiries");
  assert.equal(frontend.PRIVATE_TESTING_ENABLED, "true");
  assert.equal(frontend.SITE_INDEXING, "disabled");

  const proposed = structuredClone(current);
  proposed.services[0].envs.find((e) => e.key === "PRIVATE_TESTING_ENABLED").value =
    "false";
  return {
    appSpec: proposed,
    frontendChanges: { PRIVATE_TESTING_ENABLED: "false", SITE_INDEXING: "enabled" },
    frontendRollback: { PRIVATE_TESTING_ENABLED: "true", SITE_INDEXING: "disabled" },
    summary: {
      app: current.name,
      backendChanges: ["api.PRIVATE_TESTING_ENABLED: true -> false"],
      frontendChanges: [
        "PRIVATE_TESTING_ENABLED: true -> false",
        "SITE_INDEXING: disabled -> enabled",
      ],
      launchMode: "browse_enquiries",
      origin,
      databaseWrite: false,
      resourcePurchase: false,
      applied: false,
    },
  };
}
