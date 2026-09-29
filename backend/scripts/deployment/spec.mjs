import { X509Certificate } from "node:crypto";

export const images = [
  { name: "api", target: "api", repository: "allied-autotech-api" },
  {
    name: "identity-worker",
    target: "worker",
    repository: "allied-autotech-identity-worker",
  },
  {
    name: "general-worker",
    target: "general-worker",
    repository: "allied-autotech-general-worker",
  },
  { name: "migrate", target: "migrate", repository: "allied-autotech-migrate" },
];

export const keyNames = [
  "TOKEN_HASH_KEY",
  "MFA_ENCRYPTION_KEY",
  "OUTBOX_ENCRYPTION_KEY",
  "ASSET_TICKET_KEY",
];

function requireValue(condition, description) {
  if (!condition) throw new Error(description);
}

export function parseTemplate(source) {
  return JSON.parse(source.replace(/^#.*(?:\r?\n|$)/gm, ""));
}

export function validateManifest(manifest, registry) {
  requireValue(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(registry),
    "Invalid registry name.",
  );
  requireValue(
    manifest.registry === registry,
    "Manifest registry does not match inputs.",
  );
  requireValue(/^[a-f0-9]{40}$/.test(manifest.commit), "Missing full Git commit SHA.");
  requireValue(
    manifest.sourceTreeClean === true,
    "Release requires a clean source tree.",
  );
  requireValue(
    manifest.images?.length === images.length,
    "Four pushed images are required.",
  );
  for (const image of images) {
    const entry = manifest.images.find((item) => item.name === image.name);
    requireValue(
      entry?.repository === image.repository &&
        entry.target === image.target &&
        entry.tag === manifest.commit,
      `Incorrect release provenance for ${image.name}.`,
    );
    requireValue(
      /^sha256:[a-f0-9]{64}$/.test(entry.digest),
      `Missing pushed digest for ${image.name}.`,
    );
  }
}

// Only missing deployment values can be supplied. Security flags and component
// scopes remain owned by the reviewed template, never by a generic env override.
export function renderSpec(template, input, manifest, keys) {
  validateManifest(manifest, input.registry);
  requireValue(
    /^[a-z][a-z0-9-]+$/.test(input.region),
    "Provide the actual App Platform region slug.",
  );
  requireValue(
    /^[a-z0-9][a-z0-9-]+$/.test(input.databaseCluster),
    "Provide the existing managed database cluster name.",
  );
  const values = input.values;
  requireValue(values && typeof values === "object", "Deployment values are missing.");
  const requiredValues = new Set();
  for (const component of [...template.services, ...template.workers, ...template.jobs]) {
    for (const entry of component.envs) {
      if (entry.value.includes("REPLACE_") && !keyNames.includes(entry.key)) {
        requiredValues.add(
          component.name === "migrate" && ["DB_USER", "DB_PASSWORD"].includes(entry.key)
            ? `MIGRATION_${entry.key}`
            : entry.key,
        );
      }
    }
  }
  for (const name of requiredValues) {
    requireValue(
      typeof values[name] === "string" &&
        values[name].trim().length > 0 &&
        !/REPLACE_|[<>]|\$\{/.test(values[name]),
      `Provide a real value for ${name}.`,
    );
  }
  requireValue(
    Object.keys(values).every((name) => requiredValues.has(name)),
    "Unknown deployment value; do not override security defaults.",
  );
  requireValue(
    /^[a-z0-9.-]+\.db\.ondigitalocean\.com$/.test(values.DB_HOST),
    "Use the actual Managed PostgreSQL hostname.",
  );
  requireValue(
    /^\d+$/.test(values.DB_PORT) &&
      Number(values.DB_PORT) > 0 &&
      Number(values.DB_PORT) <= 65535,
    "Invalid database port.",
  );
  for (const name of ["DB_USER", "MIGRATION_DB_USER"]) {
    requireValue(
      /^[a-z_][a-z0-9_]*$/.test(values[name]) &&
        !["doadmin", "postgres"].includes(values[name]),
      `Use a dedicated ${name}.`,
    );
  }
  requireValue(
    values.DB_USER !== values.MIGRATION_DB_USER,
    "Runtime and migration roles must differ.",
  );
  requireValue(
    values.DB_PASSWORD !== values.MIGRATION_DB_PASSWORD,
    "Runtime and migration passwords must differ.",
  );
  requireValue(
    values.PAYSTACK_SECRET_KEY.startsWith("sk_test_"),
    "Only a Paystack test key is allowed.",
  );
  requireValue(
    /^https:\/\/[a-z0-9-]+\.digitaloceanspaces\.com$/.test(
      values.OBJECT_STORAGE_ENDPOINT,
    ),
    "Use the regional Spaces HTTPS endpoint.",
  );
  requireValue(
    /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(values.OBJECT_STORAGE_BUCKET),
    "Invalid private bucket name.",
  );
  requireValue(
    Object.keys(keys).length === keyNames.length &&
      keyNames.every(
        (name) =>
          typeof keys[name] === "string" &&
          /^[A-Za-z0-9+/]{43}=$/.test(keys[name]) &&
          Buffer.from(keys[name], "base64").length === 32,
      ),
    "Four independent 32-byte Base64 application keys are required.",
  );
  requireValue(
    new Set(keyNames.map((name) => keys[name])).size === keyNames.length,
    "Application keys must be independent.",
  );
  const ca = Buffer.from(values.DB_SSL_CA_BASE64, "base64");
  requireValue(
    ca.toString("base64") === values.DB_SSL_CA_BASE64 && ca.length <= 1_048_576,
    "Invalid CA Base64 encoding.",
  );
  const certificates = ca
    .toString("utf8")
    .match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  requireValue(
    certificates?.length > 0 &&
      ca
        .toString("utf8")
        .replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, "")
        .trim() === "",
    "CA must contain only PEM certificates.",
  );
  try {
    for (const certificate of certificates) {
      const parsed = new X509Certificate(certificate);
      requireValue(
        parsed.ca &&
          Date.parse(parsed.validTo) > Date.now() &&
          Date.parse(parsed.validFrom) <= Date.now(),
        "CA certificate is not currently valid.",
      );
    }
  } catch {
    throw new Error("Provide a valid, current DigitalOcean CA certificate bundle.");
  }
  const spec = structuredClone(template);
  spec.region = input.region;
  spec.databases[0].cluster_name = input.databaseCluster;
  spec.databases[0].db_user = values.DB_USER;
  for (const component of [...spec.services, ...spec.workers, ...spec.jobs]) {
    const released = manifest.images.find((entry) => entry.name === component.name);
    component.image.registry = input.registry;
    component.image.digest = released.digest;
    for (const entry of component.envs) {
      if (!entry.value.includes("REPLACE_")) continue;
      const name =
        component.name === "migrate" && ["DB_USER", "DB_PASSWORD"].includes(entry.key)
          ? `MIGRATION_${entry.key}`
          : entry.key;
      entry.value = keyNames.includes(entry.key) ? keys[entry.key] : values[name];
      requireValue(
        typeof entry.value === "string",
        `Unresolved ${component.name}/${entry.key}.`,
      );
    }
  }
  requireValue(
    !JSON.stringify(spec).includes("REPLACE_"),
    "Unresolved App Spec placeholders.",
  );
  return spec;
}
