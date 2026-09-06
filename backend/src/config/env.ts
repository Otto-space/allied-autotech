import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

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
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Origin must use HTTP or HTTPS");

const base64Key = z
  .string()
  .trim()
  .refine(
    (value) =>
      /^[A-Za-z0-9+/]{43}=$/.test(value) &&
      Buffer.from(value, "base64").byteLength === 32,
    { message: "Must be a base64-encoded 256-bit key" },
  )
  .optional();

const commaSeparatedHttpUrls = z
  .string()
  .min(1)
  .transform((value) => value.split(",").map((origin) => origin.trim()))
  .pipe(z.array(httpUrl).min(1));

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

  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),

  FRONTEND_URL: z
    .string()
    .min(1, "FRONTEND_URL is required")
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(httpUrl).min(1)),

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
  API_DOCS_ENABLED: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),

  DB_HOST: z.string().trim().min(1, "DB_HOST is required"),

  DB_PORT: z.coerce.number().int().min(1).max(65_535),

  DB_NAME: z.string().trim().min(1, "DB_NAME is required"),

  DB_USER: z.string().trim().min(1, "DB_USER is required"),

  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),

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

  WEBAUTHN_RP_ID: z.string().trim().min(1).default("localhost"),
  WEBAUTHN_RP_NAME: z.string().trim().min(1).max(100).default("Allied AutoTech"),
  WEBAUTHN_ORIGINS: commaSeparatedHttpUrls.prefault("http://localhost:3000"),

  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalEmail,
  PAYSTACK_SECRET_KEY: optionalNonEmptyString,
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
  PAYMENT_INTENT_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(1_800),
  FRONTEND_VERIFY_EMAIL_URL: httpUrl.default("http://localhost:3000/verify-email"),
  FRONTEND_RESET_PASSWORD_URL: httpUrl.default("http://localhost:3000/reset-password"),
  FRONTEND_PRIVILEGED_INVITATION_URL: httpUrl.default(
    "http://localhost:3000/staff/accept-invitation",
  ),

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
});

const environment = environmentSchema.safeParse(process.env);

if (!environment.success) {
  const invalidFields = environment.error.issues
    .map((issue) => issue.path.join("."))
    .filter((field, index, fields) => fields.indexOf(field) === index);

  throw new Error(
    `Invalid server environment configuration: ${invalidFields.join(", ")}`,
  );
}

if (
  environment.data.NODE_ENV === "production" &&
  environment.data.FRONTEND_URL.some((origin) => new URL(origin).protocol !== "https:")
) {
  throw new Error("Production FRONTEND_URL origins must use HTTPS");
}

const productionRequiredFields = [
  "TOKEN_HASH_KEY",
  "MFA_ENCRYPTION_KEY",
  "OUTBOX_ENCRYPTION_KEY",
  "ASSET_TICKET_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "PAYSTACK_SECRET_KEY",
  "OBJECT_STORAGE_ENDPOINT",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
] as const;

if (environment.data.NODE_ENV === "production") {
  const missing = productionRequiredFields.filter(
    (field) => environment.data[field] === undefined,
  );

  if (missing.length > 0) {
    throw new Error(`Missing production security configuration: ${missing.join(", ")}`);
  }

  const cryptographicKeys = [
    environment.data.TOKEN_HASH_KEY,
    environment.data.MFA_ENCRYPTION_KEY,
    environment.data.OUTBOX_ENCRYPTION_KEY,
    environment.data.ASSET_TICKET_KEY,
  ];
  if (new Set(cryptographicKeys).size !== cryptographicKeys.length) {
    throw new Error("Production cryptographic keys must be independently generated");
  }

  if (
    environment.data.OBJECT_STORAGE_ENDPOINT !== undefined &&
    new URL(environment.data.OBJECT_STORAGE_ENDPOINT).protocol !== "https:"
  ) {
    throw new Error("Production object storage must use HTTPS");
  }

  if (
    environment.data.PAYSTACK_CALLBACK_URL !== undefined &&
    new URL(environment.data.PAYSTACK_CALLBACK_URL).protocol !== "https:"
  ) {
    throw new Error("Production Paystack callback URL must use HTTPS");
  }

  for (const url of [
    environment.data.FRONTEND_VERIFY_EMAIL_URL,
    environment.data.FRONTEND_RESET_PASSWORD_URL,
    environment.data.FRONTEND_PRIVILEGED_INVITATION_URL,
    ...environment.data.WEBAUTHN_ORIGINS,
  ]) {
    if (new URL(url).protocol !== "https:") {
      throw new Error("Production identity and WebAuthn URLs must use HTTPS");
    }
  }
}

const localOnlyKey = (fill: number): string => Buffer.alloc(32, fill).toString("base64");

export const env = {
  ...environment.data,
  API_DOCS_ENABLED:
    environment.data.API_DOCS_ENABLED ?? environment.data.NODE_ENV !== "production",
  TOKEN_HASH_KEY: environment.data.TOKEN_HASH_KEY ?? localOnlyKey(1),
  MFA_ENCRYPTION_KEY: environment.data.MFA_ENCRYPTION_KEY ?? localOnlyKey(2),
  OUTBOX_ENCRYPTION_KEY: environment.data.OUTBOX_ENCRYPTION_KEY ?? localOnlyKey(3),
  ASSET_TICKET_KEY: environment.data.ASSET_TICKET_KEY ?? localOnlyKey(4),
};
