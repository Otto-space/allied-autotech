import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

import { parseDatabaseTlsEnvironment } from "./database-tls.js";

const envFilePath = fileURLToPath(new URL("../../.env", import.meta.url));

const dotenvResult = config({
  path: envFilePath,
  quiet: true,
});

const dotenvError = dotenvResult.error as NodeJS.ErrnoException | undefined;

if (dotenvError !== undefined && dotenvError.code !== "ENOENT") {
  throw new Error("Unable to load environment configuration", {
    cause: dotenvError,
  });
}

const httpUrl = z.url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}, "Origin must use HTTP or HTTPS");

const base64Key = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .trim()
    .refine(
      (value) =>
        /^[A-Za-z0-9+/]{43}=$/.test(value) &&
        Buffer.from(value, "base64").byteLength === 32,
      { message: "Must be a base64-encoded 256-bit key" },
    )
    .optional(),
);

const commaSeparatedHttpUrls = z
  .string()
  .min(1)
  .transform((value) => value.split(",").map((origin) => origin.trim()))
  .pipe(z.array(httpUrl).min(1));

const optionalCommaSeparatedHttpUrls = z.preprocess(
  (value) => (value === "" ? undefined : value),
  commaSeparatedHttpUrls.optional(),
);

const optionalCommaSeparatedValues = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    )
    .pipe(z.array(z.string().min(1).max(254)).max(100))
    .optional(),
);

const booleanValue = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .default(defaultValue ? "true" : "false")
    .transform((value) => value === "true");

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.email().optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DEPLOYMENT_ENV: z.enum(["local", "staging", "production"]).default("local"),

  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),

  FRONTEND_URL: optionalCommaSeparatedHttpUrls,

  SERVICE_NAME: z.string().trim().min(1).max(100).default("allied-autotech-api"),

  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  REQUEST_BODY_LIMIT: z
    .string()
    .trim()
    .regex(/^\d+(?:b|kb|mb)$/i)
    .default("100kb"),

  READINESS_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(2_000),

  GLOBAL_RATE_LIMIT: z.coerce.number().int().min(1).max(100_000).default(300),

  GLOBAL_RATE_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(86_400_000)
    .default(900_000),
  API_DOCS_ENABLED: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  ),

  DB_HOST: z.string().trim().min(1, "DB_HOST is required"),

  DB_PORT: z.coerce.number().int().min(1).max(65_535),

  DB_NAME: z.string().trim().min(1, "DB_NAME is required"),

  DB_USER: z.string().trim().min(1, "DB_USER is required"),

  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),

  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  DB_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(15_000),

  TOKEN_HASH_KEY: base64Key,
  TOKEN_HASH_KEY_ID: z.string().trim().min(1).max(120).default("local-v1"),
  MFA_ENCRYPTION_KEY: base64Key,
  MFA_ENCRYPTION_KEY_ID: z.string().trim().min(1).max(120).default("local-v1"),
  OUTBOX_ENCRYPTION_KEY: base64Key,
  OUTBOX_ENCRYPTION_KEY_ID: z.string().trim().min(1).max(120).default("local-v1"),
  ASSET_TICKET_KEY: base64Key,
  ASSET_TICKET_KEY_ID: z.string().trim().min(1).max(120).default("local-v1"),

  OBJECT_STORAGE_ENDPOINT: optionalNonEmptyString.pipe(httpUrl.optional()),
  OBJECT_STORAGE_REGION: z.string().trim().min(1).default("us-east-1"),
  OBJECT_STORAGE_BUCKET: optionalNonEmptyString,
  OBJECT_STORAGE_ACCESS_KEY_ID: optionalNonEmptyString,
  OBJECT_STORAGE_SECRET_ACCESS_KEY: optionalNonEmptyString,
  OBJECT_STORAGE_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(true),
  ASSET_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  ASSET_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(120),

  WEBAUTHN_RP_ID: optionalNonEmptyString,
  WEBAUTHN_RP_NAME: z.string().trim().min(1).max(100).default("Allied AutoTech"),
  WEBAUTHN_ORIGINS: optionalCommaSeparatedHttpUrls,

  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalEmail,
  EMAIL_DELIVERY_ENABLED: booleanValue(false),
  SMS_DELIVERY_ENABLED: booleanValue(false),
  STAGING_EMAIL_ALLOWLIST: optionalCommaSeparatedValues,
  STAGING_SMS_ALLOWLIST: optionalCommaSeparatedValues,
  TERMII_API_KEY: optionalNonEmptyString,
  TERMII_SENDER_ID: optionalNonEmptyString,
  TERMII_BASE_URL: optionalNonEmptyString.pipe(httpUrl.optional()),
  MESSAGING_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .default(8_000),
  PAYSTACK_SECRET_KEY: optionalNonEmptyString,
  PAYSTACK_MODE: z.enum(["disabled", "test", "live"]).default("disabled"),
  PAYSTACK_LIVE_ENABLED: booleanValue(false),
  PAYSTACK_CALLBACK_URL: optionalNonEmptyString.pipe(httpUrl.optional()),
  PAYSTACK_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .default(8_000),
  PAYSTACK_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(1_048_576)
    .default(262_144),
  MONNIFY_MODE: z.enum(["disabled", "sandbox", "live"]).default("disabled"),
  MONNIFY_LIVE_ENABLED: booleanValue(false),
  MONNIFY_API_KEY: optionalNonEmptyString,
  MONNIFY_SECRET_KEY: optionalNonEmptyString,
  MONNIFY_CONTRACT_CODE: optionalNonEmptyString,
  MONNIFY_CALLBACK_URL: optionalNonEmptyString.pipe(httpUrl.optional()),
  MONNIFY_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(30_000)
    .default(8_000),
  MONNIFY_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(1_048_576)
    .default(262_144),
  PAYMENT_INTENT_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(1_800),
  FRONTEND_VERIFY_EMAIL_URL: optionalNonEmptyString.pipe(httpUrl.optional()),
  FRONTEND_RESET_PASSWORD_URL: optionalNonEmptyString.pipe(httpUrl.optional()),
  FRONTEND_PRIVILEGED_INVITATION_URL: optionalNonEmptyString.pipe(httpUrl.optional()),

  EMAIL_VERIFICATION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(172_800)
    .default(86_400),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).max(7_200).default(1_800),
  PRIVILEGED_INVITATION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(900)
    .max(604_800)
    .default(86_400),
  WEBAUTHN_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  CUSTOMER_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(3_600)
    .max(2_592_000)
    .default(604_800),
  CUSTOMER_SESSION_IDLE_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(604_800)
    .default(86_400),
  PRIVILEGED_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(900)
    .max(86_400)
    .default(43_200),
  PRIVILEGED_SESSION_IDLE_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(7_200)
    .default(1_800),
  MFA_PENDING_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(120)
    .max(1_800)
    .default(600),
  MAX_ACTIVE_SESSIONS: z.coerce.number().int().min(1).max(20).default(5),
  AUTH_FAILURE_LIMIT: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(2_000),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  PAYMENT_RECONCILIATION_ENABLED: booleanValue(false),
  EXPIRATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .max(3_600_000)
    .default(60_000),
  RECONCILIATION_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .max(86_400_000)
    .default(3_600_000),
});

const environment = environmentSchema.safeParse(process.env);
const databaseTls = parseDatabaseTlsEnvironment(process.env);

if (!environment.success) {
  const invalidFields = environment.error.issues
    .map((issue) => issue.path.join("."))
    .filter((field, index, fields) => fields.indexOf(field) === index);

  throw new Error(
    `Invalid server environment configuration: ${invalidFields.join(", ")}`,
  );
}

const localOnlyKey = (fill: number): string => Buffer.alloc(32, fill).toString("base64");

export const env = {
  ...environment.data,
  ...databaseTls,
  FRONTEND_URL: environment.data.FRONTEND_URL ?? [],
  WEBAUTHN_RP_ID: environment.data.WEBAUTHN_RP_ID ?? "localhost",
  WEBAUTHN_ORIGINS: environment.data.WEBAUTHN_ORIGINS ?? ["http://localhost:3000"],
  FRONTEND_VERIFY_EMAIL_URL:
    environment.data.FRONTEND_VERIFY_EMAIL_URL ?? "http://localhost:3000/verify-email",
  FRONTEND_RESET_PASSWORD_URL:
    environment.data.FRONTEND_RESET_PASSWORD_URL ??
    "http://localhost:3000/reset-password",
  FRONTEND_PRIVILEGED_INVITATION_URL:
    environment.data.FRONTEND_PRIVILEGED_INVITATION_URL ??
    "http://localhost:3000/staff/accept-invitation",
  API_DOCS_ENABLED:
    environment.data.API_DOCS_ENABLED ?? environment.data.NODE_ENV !== "production",
  TOKEN_HASH_KEY: environment.data.TOKEN_HASH_KEY ?? localOnlyKey(1),
  MFA_ENCRYPTION_KEY: environment.data.MFA_ENCRYPTION_KEY ?? localOnlyKey(2),
  OUTBOX_ENCRYPTION_KEY: environment.data.OUTBOX_ENCRYPTION_KEY ?? localOnlyKey(3),
  ASSET_TICKET_KEY: environment.data.ASSET_TICKET_KEY ?? localOnlyKey(4),
  STAGING_EMAIL_ALLOWLIST: environment.data.STAGING_EMAIL_ALLOWLIST ?? [],
  STAGING_SMS_ALLOWLIST: environment.data.STAGING_SMS_ALLOWLIST ?? [],
};

function requireConfiguredVariables(
  processName: string,
  fields: readonly string[],
  source: NodeJS.ProcessEnv,
): void {
  const missing = fields.filter((field) => {
    const value = source[field];
    return value === undefined || value.trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `Missing production configuration for ${processName}: ${missing.join(", ")}`,
    );
  }
}

function requireHttps(urls: readonly string[], purpose: string): void {
  if (urls.some((url) => new URL(url).protocol !== "https:")) {
    throw new Error(`Production ${purpose} must use HTTPS`);
  }
}

export function assertApiEnvironment(
  runtime: typeof env = env,
  source: NodeJS.ProcessEnv = process.env,
): void {
  if (runtime.NODE_ENV !== "production") {
    requireConfiguredVariables("API", ["FRONTEND_URL"], source);
    return;
  }

  requireConfiguredVariables(
    "API",
    [
      "FRONTEND_URL",
      "TOKEN_HASH_KEY",
      "MFA_ENCRYPTION_KEY",
      "OUTBOX_ENCRYPTION_KEY",
      "ASSET_TICKET_KEY",
      "WEBAUTHN_RP_ID",
      "WEBAUTHN_ORIGINS",
      "FRONTEND_VERIFY_EMAIL_URL",
      "FRONTEND_RESET_PASSWORD_URL",
      "FRONTEND_PRIVILEGED_INVITATION_URL",
      "PAYSTACK_MODE",
      "MONNIFY_MODE",
      "OBJECT_STORAGE_ENDPOINT",
      "OBJECT_STORAGE_BUCKET",
      "OBJECT_STORAGE_ACCESS_KEY_ID",
      "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    ],
    source,
  );

  const cryptographicKeys = [
    runtime.TOKEN_HASH_KEY,
    runtime.MFA_ENCRYPTION_KEY,
    runtime.OUTBOX_ENCRYPTION_KEY,
    runtime.ASSET_TICKET_KEY,
  ];
  if (new Set(cryptographicKeys).size !== cryptographicKeys.length) {
    throw new Error("Production cryptographic keys must be independently generated");
  }

  requireHttps(runtime.FRONTEND_URL, "FRONTEND_URL origins");
  requireHttps(
    [
      runtime.FRONTEND_VERIFY_EMAIL_URL,
      runtime.FRONTEND_RESET_PASSWORD_URL,
      runtime.FRONTEND_PRIVILEGED_INVITATION_URL,
      ...runtime.WEBAUTHN_ORIGINS,
    ],
    "identity and WebAuthn URLs",
  );
  if (
    runtime.OBJECT_STORAGE_ENDPOINT === undefined ||
    new URL(runtime.OBJECT_STORAGE_ENDPOINT).protocol !== "https:"
  ) {
    throw new Error("Production object storage must use HTTPS");
  }
  if (
    runtime.PAYSTACK_CALLBACK_URL !== undefined &&
    new URL(runtime.PAYSTACK_CALLBACK_URL).protocol !== "https:"
  ) {
    throw new Error("Production Paystack callback URL must use HTTPS");
  }
  assertPaystackMode(runtime);
  assertMonnifyMode(runtime);
  if (runtime.API_DOCS_ENABLED) {
    throw new Error("Hosted API documentation must remain disabled in production");
  }
}

export function assertIdentityWorkerEnvironment(
  runtime: typeof env = env,
  source: NodeJS.ProcessEnv = process.env,
): void {
  if (runtime.NODE_ENV !== "production") return;
  requireConfiguredVariables(
    "identity worker",
    ["OUTBOX_ENCRYPTION_KEY", "RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    source,
  );
  if (
    runtime.DEPLOYMENT_ENV === "staging" &&
    runtime.STAGING_EMAIL_ALLOWLIST.length === 0
  ) {
    throw new Error("Staging identity delivery requires STAGING_EMAIL_ALLOWLIST");
  }
}

export function assertGeneralWorkerEnvironment(
  runtime: typeof env = env,
  source: NodeJS.ProcessEnv = process.env,
): void {
  if (runtime.NODE_ENV !== "production") return;
  requireConfiguredVariables("general worker", ["OUTBOX_ENCRYPTION_KEY"], source);
  if (runtime.EMAIL_DELIVERY_ENABLED) {
    requireConfiguredVariables(
      "general worker email delivery",
      ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
      source,
    );
    if (
      runtime.DEPLOYMENT_ENV === "staging" &&
      runtime.STAGING_EMAIL_ALLOWLIST.length === 0
    )
      throw new Error("Staging email delivery requires STAGING_EMAIL_ALLOWLIST");
  }
  if (runtime.SMS_DELIVERY_ENABLED) {
    requireConfiguredVariables(
      "general worker SMS delivery",
      ["TERMII_API_KEY", "TERMII_SENDER_ID", "TERMII_BASE_URL"],
      source,
    );
    if (
      runtime.DEPLOYMENT_ENV === "staging" &&
      runtime.STAGING_SMS_ALLOWLIST.length === 0
    )
      throw new Error("Staging SMS delivery requires STAGING_SMS_ALLOWLIST");
    const termii = new URL(runtime.TERMII_BASE_URL ?? "http://invalid.invalid");
    if (
      termii.protocol !== "https:" ||
      !(termii.hostname === "termii.com" || termii.hostname.endsWith(".termii.com")) ||
      termii.username !== "" ||
      termii.password !== "" ||
      termii.search !== "" ||
      termii.hash !== ""
    )
      throw new Error("TERMII_BASE_URL must be an HTTPS Termii host without credentials");
  }
  assertPaystackMode(runtime);
  assertMonnifyMode(runtime);
}

export function assertPaystackMode(runtime: typeof env = env): void {
  const key = runtime.PAYSTACK_SECRET_KEY;
  if (runtime.DEPLOYMENT_ENV === "staging" && runtime.PAYSTACK_MODE !== "test")
    throw new Error("Staging requires PAYSTACK_MODE=test");
  if (runtime.PAYSTACK_MODE === "disabled") {
    if (key !== undefined)
      throw new Error("PAYSTACK_SECRET_KEY must be unset when PAYSTACK_MODE is disabled");
    return;
  }
  if (key === undefined)
    throw new Error("PAYSTACK_SECRET_KEY is required for configured mode");
  if (runtime.PAYSTACK_MODE === "test" && !key.startsWith("sk_test_"))
    throw new Error("PAYSTACK_MODE=test requires a Paystack test secret");
  if (runtime.PAYSTACK_MODE === "live") {
    if (runtime.DEPLOYMENT_ENV !== "production" || !runtime.PAYSTACK_LIVE_ENABLED)
      throw new Error(
        "Live Paystack is permitted only for an explicitly enabled production deployment",
      );
    if (!key.startsWith("sk_live_"))
      throw new Error("PAYSTACK_MODE=live requires a Paystack live secret");
  }
}

export function assertMonnifyMode(runtime: typeof env = env): void {
  const configured = [
    runtime.MONNIFY_API_KEY,
    runtime.MONNIFY_SECRET_KEY,
    runtime.MONNIFY_CONTRACT_CODE,
    runtime.MONNIFY_CALLBACK_URL,
  ];
  if (runtime.DEPLOYMENT_ENV === "staging" && runtime.MONNIFY_MODE !== "sandbox")
    throw new Error("Staging requires MONNIFY_MODE=sandbox");
  if (runtime.MONNIFY_MODE === "disabled") {
    if (configured.some((value) => value !== undefined))
      throw new Error("Monnify credentials and callback must be unset when disabled");
    return;
  }
  if (configured.some((value) => value === undefined))
    throw new Error("Monnify credentials, contract code, and callback are required");
  const callback = new URL(runtime.MONNIFY_CALLBACK_URL!);
  if (callback.protocol !== "https:")
    throw new Error("Configured Monnify callback URL must use HTTPS");
  if (runtime.MONNIFY_MODE === "sandbox") {
    if (!runtime.MONNIFY_API_KEY!.startsWith("MK_TEST_"))
      throw new Error("Monnify sandbox requires a test API key");
    if (!runtime.MONNIFY_SECRET_KEY!.startsWith("SK_TEST_"))
      throw new Error("Monnify sandbox requires a test secret key");
    return;
  }
  if (runtime.DEPLOYMENT_ENV !== "production" || !runtime.MONNIFY_LIVE_ENABLED)
    throw new Error(
      "Live Monnify is permitted only for an explicitly enabled production deployment",
    );
  if (
    runtime.MONNIFY_API_KEY!.startsWith("MK_TEST_") ||
    runtime.MONNIFY_SECRET_KEY!.startsWith("SK_TEST_")
  )
    throw new Error("Live Monnify cannot use sandbox credentials");
}
