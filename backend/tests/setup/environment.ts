import { config } from "dotenv";

config({ quiet: true });

process.env.NODE_ENV = "test";
process.env.DEPLOYMENT_ENV = "local";
process.env.LOG_LEVEL ??= "silent";
process.env.EMAIL_DELIVERY_ENABLED = "false";
process.env.SMS_DELIVERY_ENABLED = "false";
process.env.PAYSTACK_MODE = "disabled";
process.env.PAYSTACK_LIVE_ENABLED = "false";
delete process.env.PAYSTACK_SECRET_KEY;
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.DB_HOST ??= "localhost";
process.env.DB_PORT ??= "5432";
const requestedTestDatabase = process.env.TEST_DB_NAME;
process.env.DB_NAME =
  requestedTestDatabase !== undefined && /_(?:test|ci)$/.test(requestedTestDatabase)
    ? requestedTestDatabase
    : "allied_autotech_test";
process.env.DB_USER ??= "postgres";
process.env.DB_PASSWORD ??= "test-only-password";
process.env.TOKEN_HASH_KEY ??= Buffer.alloc(32, 11).toString("base64");
process.env.TOKEN_HASH_KEY_ID ??= "test-v1";
process.env.MFA_ENCRYPTION_KEY ??= Buffer.alloc(32, 12).toString("base64");
process.env.MFA_ENCRYPTION_KEY_ID ??= "test-v1";
process.env.OUTBOX_ENCRYPTION_KEY ??= Buffer.alloc(32, 13).toString("base64");
process.env.OUTBOX_ENCRYPTION_KEY_ID ??= "test-v1";
process.env.ASSET_TICKET_KEY ??= Buffer.alloc(32, 14).toString("base64");
process.env.ASSET_TICKET_KEY_ID ??= "test-v1";
process.env.WEBAUTHN_RP_ID ??= "localhost";
process.env.WEBAUTHN_RP_NAME ??= "Allied AutoTech Test";
process.env.WEBAUTHN_ORIGINS ??= "http://localhost:3000";
process.env.FRONTEND_VERIFY_EMAIL_URL ??= "http://localhost:3000/verify-email";
process.env.FRONTEND_RESET_PASSWORD_URL ??= "http://localhost:3000/reset-password";
