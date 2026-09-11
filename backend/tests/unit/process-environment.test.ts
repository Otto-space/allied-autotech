import { describe, expect, it } from "vitest";

import {
  assertApiEnvironment,
  assertIdentityWorkerEnvironment,
  env,
} from "../../src/config/env.js";

const configuredApiVariables = {
  FRONTEND_URL: "configured",
  TOKEN_HASH_KEY: "configured",
  MFA_ENCRYPTION_KEY: "configured",
  OUTBOX_ENCRYPTION_KEY: "configured",
  ASSET_TICKET_KEY: "configured",
  WEBAUTHN_RP_ID: "configured",
  WEBAUTHN_ORIGINS: "configured",
  FRONTEND_VERIFY_EMAIL_URL: "configured",
  FRONTEND_RESET_PASSWORD_URL: "configured",
  FRONTEND_PRIVILEGED_INVITATION_URL: "configured",
  PAYSTACK_MODE: "configured",
  PAYSTACK_SECRET_KEY: "configured",
  MONNIFY_MODE: "configured",
  OBJECT_STORAGE_ENDPOINT: "configured",
  OBJECT_STORAGE_BUCKET: "configured",
  OBJECT_STORAGE_ACCESS_KEY_ID: "configured",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "configured",
} satisfies NodeJS.ProcessEnv;

const productionApi = {
  ...env,
  NODE_ENV: "production" as const,
  FRONTEND_URL: ["https://app.example.test"],
  TOKEN_HASH_KEY: Buffer.alloc(32, 21).toString("base64"),
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 22).toString("base64"),
  OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 23).toString("base64"),
  ASSET_TICKET_KEY: Buffer.alloc(32, 24).toString("base64"),
  WEBAUTHN_RP_ID: "app.example.test",
  WEBAUTHN_ORIGINS: ["https://app.example.test"],
  FRONTEND_VERIFY_EMAIL_URL: "https://app.example.test/verify-email",
  FRONTEND_RESET_PASSWORD_URL: "https://app.example.test/reset-password",
  FRONTEND_PRIVILEGED_INVITATION_URL: "https://app.example.test/staff/accept-invitation",
  PAYSTACK_MODE: "test" as const,
  PAYSTACK_SECRET_KEY: "sk_test_synthetic_provider_credential",
  PAYSTACK_CALLBACK_URL: "https://app.example.test/payments/complete",
  MONNIFY_MODE: "disabled" as const,
  OBJECT_STORAGE_ENDPOINT: "https://objects.example.test",
  OBJECT_STORAGE_BUCKET: "private-assets",
  OBJECT_STORAGE_ACCESS_KEY_ID: "synthetic-access-key",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "synthetic-storage-credential",
  API_DOCS_ENABLED: false,
};

describe("process-specific production environment validation", () => {
  it("preserves explicit frontend-origin validation for local API startup", () => {
    expect(() =>
      assertApiEnvironment({ ...env, NODE_ENV: "development" }, { FRONTEND_URL: "" }),
    ).toThrow(/FRONTEND_URL/u);
  });

  it("validates the API without worker-only Resend credentials", () => {
    expect(() =>
      assertApiEnvironment(productionApi, configuredApiVariables),
    ).not.toThrow();
  });

  it("validates the identity worker without API-only configuration", () => {
    expect(() =>
      assertIdentityWorkerEnvironment(
        { ...env, NODE_ENV: "production" },
        {
          OUTBOX_ENCRYPTION_KEY: "configured",
          RESEND_API_KEY: "configured",
          RESEND_FROM_EMAIL: "configured",
        },
      ),
    ).not.toThrow();
  });

  it("rejects production API startup when hosted documentation is enabled", () => {
    expect(() =>
      assertApiEnvironment(
        { ...productionApi, API_DOCS_ENABLED: true },
        configuredApiVariables,
      ),
    ).toThrow(/documentation must remain disabled/u);
  });
});
