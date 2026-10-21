import { renderSpec } from "./spec.mjs";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

// Render only the reviewed private prelaunch configuration. This function neither
// purchases resources nor removes access protection. Public cutover is separate.
export function renderProductionSpec(template, input, manifest, keys) {
  requireValue(
    input.environment === "production" &&
      input.appName === "allied-autotech-production" &&
      input.databaseClusterName === "allied-autotech-staging-db" &&
      input.databaseName === "allied_autotech_production" &&
      input.region === "lon" &&
      input.bucket === "allied-autotech-production-5ae8fa4d" &&
      input.launchMode === "browse_enquiries",
    "Production target differs from the reviewed resource-reuse plan.",
  );
  const spec = structuredClone(template);
  requireValue(spec.name === input.appName, "Wrong production app template.");
  requireValue(
    spec.databases.length === 1 &&
      spec.databases[0].cluster_name === input.databaseClusterName &&
      spec.databases[0].db_name === input.databaseName,
    "Wrong production database attachment.",
  );
  const sizes = {
    api: "apps-s-1vcpu-1gb-fixed",
    "identity-worker": "apps-s-1vcpu-0.5gb",
    "general-worker": "apps-s-1vcpu-0.5gb",
    migrate: "apps-s-1vcpu-1gb-fixed",
  };
  const components = [...spec.services, ...spec.workers, ...spec.jobs];
  requireValue(components.length === 4, "Unexpected paid component.");
  for (const component of components) {
    requireValue(
      component.instance_count === 1 &&
        component.instance_size_slug === sizes[component.name] &&
        component.autoscaling === undefined,
      "Component capacity differs from the reviewed budget.",
    );
    const env = Object.fromEntries(component.envs.map(({ key, value }) => [key, value]));
    requireValue(
      env.DEPLOYMENT_ENV === "production" &&
        env.PUBLIC_LAUNCH_MODE === "browse_enquiries" &&
        env.DB_NAME === input.databaseName &&
        env.DB_SSL_MODE === "verify-full",
      "Production environment or database safety settings changed.",
    );
    for (const name of ["PAYSTACK_MODE", "MONNIFY_MODE"]) {
      requireValue(
        env[name] === undefined || env[name] === "disabled",
        "Payments must stay disabled.",
      );
    }
    for (const name of [
      "PAYSTACK_LIVE_ENABLED",
      "MONNIFY_LIVE_ENABLED",
      "PAYMENT_RECONCILIATION_ENABLED",
      "SMS_DELIVERY_ENABLED",
    ]) {
      requireValue(
        env[name] === undefined || env[name] === "false",
        "Unapproved provider activation.",
      );
    }
    if (component.name === "api") {
      requireValue(
        env.PRIVATE_TESTING_ENABLED === "true" &&
          env.CLIENT_IP_SOURCE === "digitalocean" &&
          env.FRONTEND_URL === "https://alliedautotech.com",
        "Private prelaunch access and exact production origin are required.",
      );
    }
    if (component.name === "migrate") {
      requireValue(
        component.kind === "PRE_DEPLOY" &&
          component.run_command ===
            "aat-with-database-ca node --import tsx scripts/check-database-safety.ts",
        "Deployment job must remain read-only; migrate separately with verified backups.",
      );
    }
    for (const entry of component.envs) {
      const expectedRole =
        component.name === "migrate"
          ? "allied_production_migrator"
          : "allied_production_runtime";
      if (entry.key === "DB_USER") {
        requireValue(entry.value === expectedRole, "Unexpected database role.");
        entry.value = "REPLACE_PRODUCTION_ROLE";
      }
      // Reuse the existing CA, credentials, independent-key and manifest validators.
      if (["OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_BUCKET"].includes(entry.key)) {
        entry.value = "REPLACE_PRODUCTION_STORAGE";
      }
    }
  }
  requireValue(
    /^[A-Za-z0-9+/]{43}=$/.test(input.values.FRONTEND_PROXY_SECRET ?? "") &&
      Buffer.from(input.values.FRONTEND_PROXY_SECRET, "base64").length === 32 &&
      !Object.values(keys).includes(input.values.FRONTEND_PROXY_SECRET),
    "Use an independent 32-byte frontend proxy secret.",
  );
  requireValue(
    input.values.DB_USER === "allied_production_runtime" &&
      input.values.MIGRATION_DB_USER === "allied_production_migrator" &&
      input.values.OBJECT_STORAGE_ENDPOINT === "https://lon1.digitaloceanspaces.com" &&
      input.values.OBJECT_STORAGE_BUCKET === input.bucket,
    "Production credentials or storage point at another environment.",
  );
  return renderSpec(
    spec,
    {
      registry: input.registry,
      region: input.region,
      databaseCluster: input.databaseClusterName,
      paystackMode: "disabled",
      values: input.values,
    },
    manifest,
    keys,
  );
}
