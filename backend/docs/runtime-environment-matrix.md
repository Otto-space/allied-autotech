# Runtime configuration and credential inventory

Audit: 20 October 2026. Source: release branch `deploy/private-testing-20261017`, actual loaders, schema, scripts, Dockerfiles, template and live App Platform component names. The main checkout has unrelated work; release changes are isolated.

## Which file should I edit?

- Local API and workers: **`backend/.env`**. Restart the affected processes after changes.
- Local frontend: **`frontend/.env.local`**. Restart Next; rebuild for build-time/public settings.
- Hosted backend: DigitalOcean ? Apps ? allied-autotech-staging ? Settings ? select the component ? Environment Variables. These values do not sync from your PC. Provider keys belong only on sending workers; deployment tokens stay on the operator machine.
- Hosted frontend: Vercel ? allied-autotech ? Settings ? Environment Variables ? **Preview**, Git branch **deploy/private-testing-20261017**. Redeploy that branch after changes. Do not overwrite production settings.
- `.env.staging.example` and `.env.production.example` are tracked placeholder inventories. Neither `.env.staging` nor an example is automatically loaded. Do not populate tracked examples.

## Loading and precedence

| Context | Command / directory | Source and order | Existing process values | Timing |
|---|---|---|---|---|
| Local API | `npm run dev`, cwd backend; predev runs db:check and prisma:generate | src/config/env.ts resolves backend/.env relative to module; no override | Win over file | Runtime; Prisma generation needs DB-shaped config, not a connection |
| Local workers | npm run worker:identity / worker:general, cwd backend | Same env.ts and backend/.env; prehooks read-only db:check | Win | Runtime |
| Database operator scripts | npm run db:check / db:backup / db:migrate, cwd backend | scripts/lib/database-safety.ts explicitly loads backend/.env; guarded migration inherits process env | Win | Execution; confirm actual target first |
| Direct Prisma config | prisma.config.ts, cwd backend | import dotenv/config reads cwd/.env (DOTENV_CONFIG_PATH can change dotenv path); URL constructed from DB_* | Win | CLI execution; guarded commands remain mandatory |
| Backend unit/integration tests | npm test, cwd backend | tests/setup/environment.ts loads cwd/.env then forcibly sets test/local, disabled payments/email/SMS and isolated TEST_DB_NAME or allied_autotech_test | Explicit test safety assignments win; other inherited values remain | Test runtime; DB integration flags off by default |
| Local Next frontend | npm run dev, cwd frontend (root npm scripts delegate here) | process.env ? .env.development.local ? .env.local ? .env.development ? .env; first defined wins | Win | Config/build and runtime; NEXT_PUBLIC_* exposed to browser |
| Next production build | npm run build, cwd frontend | process.env ? .env.production.local ? .env.local ? .env.production ? .env | Win | Rewrites, CSP/static output and NEXT_PUBLIC_* need rebuild |
| Frontend Vitest | npm test, cwd frontend | No explicit dotenv loader; test stubs/process values. Vite env-file values are not automatically copied into arbitrary process.env reads | Inherited/stubbed | Test runtime |
| Frontend browser tests | npm run test:e2e, cwd frontend | Playwright reads process env; PLAYWRIGHT_BASE_URL or loopback default. Individual harness scripts can explicitly load fixture env | Inherited | Test execution; never production data |
| Local Docker | docker build backend or frontend context; run with explicit --env-file | No Compose file in repository. Docker does not discover .env by itself; .dockerignore excludes .env* | docker run explicit -e overrides --env-file | Runtime for backend; frontend config/public vars also needed during build |
| Backend staging images | release.ps1 build, backend Docker context | Dockerfile build-only synthetic datasource for Prisma generation; no provider/runtime secrets in build | Build process only | Images built locally; no App Platform buildpack |
| DO API | api image / node dist/server.js, /app | Component RUN_TIME env; no .env in image; aat-with-database-ca decodes CA and unsets helper | Injected env | Runtime |
| DO workers | outbox.worker.js and worker-runtime.js, /app | Component-specific RUN_TIME env, same shared parser and role-specific assertions; CA wrapper | Injected env | Runtime |
| DO predeploy job | aat-with-database-ca node --import tsx scripts/check-database-safety.ts, /app | Component RUN_TIME env with separate DB role | Injected env | Read-only deploy gate. Real migrations run beforehand on durable guarded runner |
| Vercel Preview | Git source deploy/private-testing-20261017, root frontend | Branch-scoped Preview environment, then Next conventions; no backend/.env uploaded | Injected env wins | Both build/runtime; NEXT_PUBLIC_* public |
| GitHub Actions | .github/workflows/frontend-release.yml | Job env: offline example URLs, disabled indexing; no deployment credentials used | Job/step env | Checks only; not a cloud deploy pipeline |

No Google OAuth or Web Push/VAPID integration was found. WebAuthn passkeys are present and do not need Google client credentials. Do not create OAuth or VAPID credentials for this application.

## Complete variable inventory

Required now refers to the existing private hosted staging setup, scoped per component below. Conditional means required only for its named feature/tool. CA certificates, IDs, URLs and public browser keys are not authentication secrets. Local parser defaults are not permission to use synthetic keys in hosting.

| Variable | Classification | Secret? | Default / purpose / evidence |
|---|---|---|---|
| `AAT_DOCTL` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment/release.mjs`. |
| `AAT_DO_CONTEXT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment/release.mjs`. |
| `AAT_FRONTEND_TEST_ENV` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/scripts/check-hosted-backend.mjs`. |
| `AAT_FRONTEND_TEST_IMAGE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/scripts/check-hosted-backend.mjs`. |
| `AAT_IMAGE_TEST_REVISION` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment/images.test.mjs`. |****
| `AAT_IMAGE_TEST_TAG` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment/images.test.mjs`. |
| `AAT_MIGRATION_TEST_IMAGE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment/database-release.test.mjs`. |
| `AFTERCARE_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/aftercare-api-server.ts`. |
| `API_DOCS_ENABLED` | Optional: safe default/unset | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `ASSET_DOWNLOAD_TTL_SECONDS` | Optional: safe default/unset | No | Default 120 Source: `backend/src/config/env.ts`. |
| `ASSET_STORAGE_HOSTS` | Required now | No | Server-side frontend image hostname allowlist. Source: `frontend/.env.example`. |
| `ASSET_TICKET_KEY` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/common/security/asset-tickets.ts`. |
| `ASSET_TICKET_KEY_ID` | Required now | No | Default "local-v1" Source: `backend/src/common/security/asset-tickets.ts`. |
| `ASSET_UPLOAD_TTL_SECONDS` | Optional: safe default/unset | No | Default 300 Source: `backend/src/common/security/asset-tickets.ts`. |
| `AUTH_FAILURE_LIMIT` | Optional: safe default/unset | No | Default 5 Source: `backend/src/config/env.ts`. |
| `AUTH_LOCK_SECONDS` | Optional: safe default/unset | No | Default 900 Source: `backend/src/config/env.ts`. |
| `BACKEND_ORIGIN` | Required now | No | See source; unset unless its feature/tool is used. Source: `frontend/lib/backend-origin.ts`. |
| `BG_DIRECTORY_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/managed-media-api-server.ts`. |
| `BG_MEDIA_IMAGE_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/managed-media-api-server.ts`. |
| `BRAND_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/brand-refresh.spec.ts`. |
| `CUSTOMER_SESSION_IDLE_SECONDS` | Optional: safe default/unset | No | Default 86_400 Source: `backend/src/common/middleware/authenticate.ts`. |
| `CUSTOMER_SESSION_TTL_SECONDS` | Optional: safe default/unset | No | Default 604_800 Source: `backend/src/config/env.ts`. |
| `DB_BACKUP_DIRECTORY` | Conditional: deployment/DB operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/backup-database.ts`. |
| `DB_CONNECTION_TIMEOUT_MS` | Optional: safe default/unset | No | Default 5_000 Source: `backend/src/config/database.ts`. |
| `DB_HOST` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/database.ts`. |
| `DB_IDLE_TIMEOUT_MS` | Optional: safe default/unset | No | Default 30_000 Source: `backend/src/config/database.ts`. |
| `DB_IDLE_TRANSACTION_TIMEOUT_MS` | Optional: safe default/unset | No | Default 15_000 Source: `backend/src/config/database.ts`. |
| `DB_MIGRATION_TARGET` | Conditional: deployment/DB operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/migrate-safely.ts`. |
| `DB_NAME` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/database.ts`. |
| `DB_PASSWORD` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/database.ts`. |
| `DB_POOL_MAX` | Optional: safe default/unset | No | Default 10 Source: `backend/src/config/database.ts`. |
| `DB_PORT` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/database.ts`. |
| `DB_SAFE_MIGRATION_BACKUP` | Conditional: deployment/DB operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/migrate-safely.ts`. |
| `DB_SAFE_MIGRATION_RUNNER` | Conditional: deployment/DB operator tooling | No | Internal guarded-runner handover only. Never manually set to bypass checks. Source: `backend/scripts/deployment / database-safety`. |
| `DB_SSL_CA_BASE64` | Required now | No | Public CA, transported as SECRET for multiline safety; shell-only, removed before Node starts. Source: `backend/docker/with-database-ca.sh`. |
| `DB_SSL_CA_CERT` | Conditional: deployment/DB operator tooling | No | Supported shell-only PEM alternative; never configure with DB_SSL_CA_BASE64. Source: `backend/docker/with-database-ca.sh`. |
| `DB_SSL_CA_FILE` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/.env.example`. |
| `DB_SSL_MODE` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/.env.example`. |
| `DB_STATEMENT_TIMEOUT_MS` | Optional: safe default/unset | No | Default 30_000 Source: `backend/src/config/database.ts`. |
| `DB_USER` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/database.ts`. |
| `DEPARTMENT_INFO_EMAIL` | Conditional: email/routing | No | API-only routing destination; public enquiries info; product/vehicle/quotation sales; service/booking/complaint support. Unset keeps dashboard-only routing. Source: `backend/src/config/env.ts`. |
| `DEPARTMENT_SALES_EMAIL` | Conditional: email/routing | No | API-only routing destination; public enquiries info; product/vehicle/quotation sales; service/booking/complaint support. Unset keeps dashboard-only routing. Source: `backend/src/config/env.ts`. |
| `DEPARTMENT_SUPPORT_EMAIL` | Conditional: email/routing | No | API-only routing destination; public enquiries info; product/vehicle/quotation sales; service/booking/complaint support. Unset keeps dashboard-only routing. Source: `backend/src/config/env.ts`. |
| `DEPLOYMENT_ENV` | Required now | No | Default "local" Source: `backend/src/common/security/messaging-recipients.ts`. |
| `DIGITALOCEAN_ACCESS_TOKEN` | Conditional: deployment/DB operator tooling | Yes | Operator/doctl credential, never application runtime. Source: `backend/scripts/deployment / database-safety`. |
| `DRAWER_API_ORIGIN` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/fixtures/cart-drawer.ts`. |
| `EMAIL_DELIVERY_ENABLED` | Optional: safe default/unset | No | API controls enqueue; both workers control delivery; configure consistently. Source: `backend/src/config/env.ts`. |
| `EMAIL_VERIFICATION_TTL_SECONDS` | Optional: safe default/unset | No | Default 86_400 Source: `backend/src/config/env.ts`. |
| `EXPIRATION_INTERVAL_MS` | Optional: safe default/unset | No | Default 60_000 Source: `backend/src/config/env.ts`. |
| `FRONTEND_PRIVILEGED_INVITATION_URL` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `FRONTEND_RESET_PASSWORD_URL` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `FRONTEND_URL` | Required now | No | Exact CORS and CSRF origins; general worker uses first for reminder links. Source: `backend/src/app.ts`. |
| `FRONTEND_VERIFY_EMAIL_URL` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `GLOBAL_RATE_LIMIT` | Optional: safe default/unset | No | Default 300 Source: `backend/src/app.ts`. |
| `GLOBAL_RATE_WINDOW_MS` | Optional: safe default/unset | No | Default 60_000 Source: `backend/src/app.ts`. |
| `HOME_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/home-quality.spec.ts`. |
| `LOCALAPPDATA` | Platform/OS supplied | No | OS-provided path; not an application secret. Source: `backend/scripts/deployment/release.mjs`. |
| `LOG_LEVEL` | Optional: safe default/unset | No | Default "info" Source: `backend/src/common/observability/logger.ts`. |
| `MAX_ACTIVE_SESSIONS` | Optional: safe default/unset | No | Default 5 Source: `backend/src/config/env.ts`. |
| `MESSAGING_REQUEST_TIMEOUT_MS` | Optional: safe default/unset | No | Default 8_000 Source: `backend/src/config/env.ts`. |
| `MFA_ENCRYPTION_KEY` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/common/security/mfa-encryption.ts`. |
| `MFA_ENCRYPTION_KEY_ID` | Required now | No | Default "local-v1" Source: `backend/src/common/security/mfa-encryption.ts`. |
| `MFA_PENDING_SESSION_TTL_SECONDS` | Optional: safe default/unset | No | Default 600 Source: `backend/src/config/env.ts`. |
| `MIGRATION_DB_PASSWORD` | Conditional: deployment/DB operator tooling | Yes | Private release-input name; rendered as migrate component DB_PASSWORD. Source: `backend/scripts/deployment / database-safety`. |
| `MIGRATION_DB_USER` | Conditional: deployment/DB operator tooling | No | Private release-input name; rendered as migrate component DB_USER. Source: `backend/scripts/deployment / database-safety`. |
| `MONNIFY_API_KEY` | Conditional: payment testing (deferred) | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `MONNIFY_CALLBACK_URL` | Conditional: payment testing (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `MONNIFY_CONTRACT_CODE` | Conditional: payment testing (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `MONNIFY_LIVE_ENABLED` | Optional: safe default/unset | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `MONNIFY_MAX_RESPONSE_BYTES` | Optional: parser default | No | Default 262_144 Source: `backend/src/config/env.ts`. |
| `MONNIFY_MODE` | Optional: safe default/unset | No | Keep disabled today; parser rejects credentials while disabled. Source: `backend/src/config/env.ts`. |
| `MONNIFY_REQUEST_TIMEOUT_MS` | Optional: parser default | No | Default 8_000 Source: `backend/src/config/env.ts`. |
| `MONNIFY_SECRET_KEY` | Conditional: payment testing (deferred) | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Conditional: optional map embed | No | Optional browser-visible Maps Embed key, restricted by API and HTTP referrers; not Google OAuth. Source: `frontend/.env.example`. |
| `NEXT_PUBLIC_MEDIA_HOSTS` | Optional: safe default/unset | No | Optional legacy/public image-host allowlist; indirect consumers exist, retain. Source: `frontend/.env.example`. |
| `NODE_ENV` | Required now | No | Default "development" Source: `backend/src/app.ts`. |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `OBJECT_STORAGE_BUCKET` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `OBJECT_STORAGE_ENDPOINT` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | Optional: safe default/unset | No | Set false for current Spaces virtual-host setup. Source: `backend/src/config/env.ts`. |
| `OBJECT_STORAGE_REGION` | Required now | No | Default "us-east-1" Source: `backend/src/config/env.ts`. |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `OPERATIONS_PAGING_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/operations-paging-api-server.ts`. |
| `OUTBOX_ENCRYPTION_KEY` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/common/security/mfa-encryption.ts`. |
| `OUTBOX_ENCRYPTION_KEY_ID` | Required now | No | Default "local-v1" Source: `backend/src/common/security/mfa-encryption.ts`. |
| `PASSWORD_RESET_TTL_SECONDS` | Optional: safe default/unset | No | Default 1_800 Source: `backend/src/config/env.ts`. |
| `PAYMENT_INTENT_TTL_SECONDS` | Optional: safe default/unset | No | Default 1_800 Source: `backend/src/config/env.ts`. |
| `PAYMENT_RECONCILIATION_ENABLED` | Optional: safe default/unset | No | Keep false today. Source: `backend/src/config/env.ts`. |
| `PAYSTACK_CALLBACK_URL` | Conditional: payment testing (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `PAYSTACK_LIVE_ENABLED` | Optional: safe default/unset | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `PAYSTACK_MAX_RESPONSE_BYTES` | Optional: parser default | No | Default 262_144 Source: `backend/src/config/env.ts`. |
| `PAYSTACK_MODE` | Optional: safe default/unset | No | Keep disabled today; parser rejects a secret while mode is disabled. Source: `backend/src/config/env.ts`. |
| `PAYSTACK_REQUEST_TIMEOUT_MS` | Optional: parser default | No | Default 8_000 Source: `backend/src/config/env.ts`. |
| `PAYSTACK_SECRET_KEY` | Conditional: payment testing (deferred) | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `PG_DUMP_PATH` | Conditional: deployment/DB operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment / database-safety`. |
| `PG_RESTORE_PATH` | Conditional: deployment/DB operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/scripts/deployment / database-safety`. |
| `PLAYWRIGHT_BASE_URL` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/.env.example`. |
| `PORT` | Optional: safe default/unset | No | Default 5000 Source: `backend/src/config/env.ts`. |
| `PREFERENCE_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/preference-api-server.ts`. |
| `PRIVATE_TESTING_ENABLED` | Required now | No | See source; unset unless its feature/tool is used. Source: `backend/src/app.ts`. |
| `PRIVATE_TESTING_PASSWORD` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/app.ts`. |
| `PRIVILEGED_INVITATION_TTL_SECONDS` | Optional: safe default/unset | No | Default 86_400 Source: `backend/src/config/env.ts`. |
| `PRIVILEGED_SESSION_IDLE_SECONDS` | Optional: safe default/unset | No | Default 1_800 Source: `backend/src/common/middleware/authenticate.ts`. |
| `PRIVILEGED_SESSION_TTL_SECONDS` | Optional: safe default/unset | No | Default 43_200 Source: `backend/src/config/env.ts`. |
| `PRODUCT_DETAIL_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/product-detail-quality.spec.ts`. |
| `PROFILE_REVISION_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/profile-revision-api-server.ts`. |
| `PUBLIC_ACTION_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/public-account-actions.spec.ts`. |
| `READINESS_TIMEOUT_MS` | Optional: safe default/unset | No | Default 2_000 Source: `backend/src/app.ts`. |
| `RECONCILIATION_INTERVAL_MS` | Optional: safe default/unset | No | Default 3_600_000 Source: `backend/src/config/env.ts`. |
| `REQUEST_BODY_LIMIT` | Optional: safe default/unset | No | Default "100kb" Source: `backend/src/app.ts`. |
| `RESEND_API_KEY` | Conditional: email/routing | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `RESEND_FROM_EMAIL` | Conditional: email/routing | No | Single mailbox or display name <mailbox>; verified notify sender. Source: `backend/src/config/env.ts`. |
| `RESEND_REPLY_TO_EMAIL` | Conditional: email/routing | No | Customer notifications: support@alliedautotech.com; internal enquiry overrides with validated customer email. Source: `backend/src/config/env.ts`. |
| `REVIEW_SOURCES_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/review-sources-api-server.ts`. |
| `RUN_AFTERCARE_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/aftercare-api-server.ts`. |
| `RUN_ASSET_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/manual-payments.spec.ts`. |
| `RUN_BRAND_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/brand-refresh.spec.ts`. |
| `RUN_CART_DRAWER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/cart-drawer-quality.spec.ts`. |
| `RUN_DATABASE_SAFETY_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/integration/database-schema-safety.test.ts`. |
| `RUN_DATABASE_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/managed-media-api-server.ts`. |
| `RUN_FRONTEND_DATABASE_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/frontend-api-server.ts`. |
| `RUN_HOME_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/home-quality.spec.ts`. |
| `RUN_MANAGED_MEDIA_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/managed-media-api-server.ts`. |
| `RUN_OPERATIONAL_SCAN_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/integration/operational-scan.test.ts`. |
| `RUN_OPERATIONS_PAGING_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/operations-paging-api-server.ts`. |
| `RUN_OPERATIONS_PAGING_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/integration/operational-jobs-pagination.test.ts`. |
| `RUN_OVERVIEW_DATABASE_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/overview-browser-server.ts`. |
| `RUN_OWNER_PROVISIONING_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/integration/owner-provisioning.test.ts`. |
| `RUN_PREFERENCE_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/preference-api-server.ts`. |
| `RUN_PRODUCT_DETAIL_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/product-detail-quality.spec.ts`. |
| `RUN_PROFILE_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/profile-revision-api-server.ts`. |
| `RUN_PUBLIC_ACTION_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/public-account-actions.spec.ts`. |
| `RUN_REVIEW_SOURCES_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/review-sources-api-server.ts`. |
| `RUN_SEO_DISABLED_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/seo-disabled.spec.ts`. |
| `RUN_SEO_SERVER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/seo.spec.ts`. |
| `RUN_SERVICE_DETAIL_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/service-detail-quality.spec.ts`. |
| `RUN_SUPPORT_CREATION_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/support-creation-api-server.ts`. |
| `RUN_SUPPORT_REPLY_BROWSER_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/support-reply-api-server.ts`. |
| `RUN_VEHICLE_DETAIL_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/vehicle-detail-quality.spec.ts`. |
| `RUN_WORKSHOP_ACCESS_TESTS` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/integration/workshop-owner-access.test.ts`. |
| `SEO_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/seo.spec.ts`. |
| `SERVICE_DETAIL_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/service-detail-quality.spec.ts`. |
| `SERVICE_DISCOVERY_REAL` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/service-discovery-real.spec.ts`. |
| `SERVICE_NAME` | Optional: safe default/unset | No | Default "allied-autotech-api" Source: `backend/src/common/observability/logger.ts`. |
| `SITE_INDEXING` | Required now | No | See source; unset unless its feature/tool is used. Source: `frontend/lib/deployment-config.ts`. |
| `SITE_ORIGIN` | Required now | No | See source; unset unless its feature/tool is used. Source: `frontend/lib/deployment-config.ts`. |
| `SMS_DELIVERY_ENABLED` | Optional: safe default/unset | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `STAGING_EMAIL_ALLOWLIST` | Conditional: email/routing | No | Exact designated testers only. Never wildcard or department Groups for smoke tests. Source: `backend/src/common/security/messaging-recipients.ts`. |
| `STAGING_SMS_ALLOWLIST` | Conditional: SMS (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/common/security/messaging-recipients.ts`. |
| `SUPPORT_CREATION_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/support-creation-api-server.ts`. |
| `SUPPORT_REPLY_SESSION_FILE` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/support-reply-api-server.ts`. |
| `TERMII_API_KEY` | Conditional: SMS (deferred) | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `TERMII_BASE_URL` | Conditional: SMS (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `TERMII_SENDER_ID` | Conditional: SMS (deferred) | No | See source; unset unless its feature/tool is used. Source: `backend/src/config/env.ts`. |
| `TEST_DB_NAME` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/overview-browser-server.ts`. |
| `TEST_MAINTENANCE_DB_PASSWORD` | Conditional: isolated tests/operator tooling | Yes | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/service-search-maintenance.ts`. |
| `TEST_MAINTENANCE_DB_USER` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `backend/tests/helpers/service-search-maintenance.ts`. |
| `TOKEN_HASH_KEY` | Required now | Yes | See source; unset unless its feature/tool is used. Source: `backend/src/common/security/session-tokens.ts`. |
| `TOKEN_HASH_KEY_ID` | Required now | No | Default "local-v1" Source: `backend/src/common/security/session-tokens.ts`. |
| `TRUST_PROXY_CIDRS` | Optional: safe default/unset | No | See source; unset unless its feature/tool is used. Source: `backend/src/app.ts`. |
| `TRUST_PROXY_HOPS` | Optional: safe default/unset | No | Default 0 Source: `backend/src/app.ts`. |
| `VEHICLE_DETAIL_FIXTURE_PORT` | Conditional: isolated tests/operator tooling | No | See source; unset unless its feature/tool is used. Source: `frontend/tests/e2e/vehicle-detail-quality.spec.ts`. |
| `VERCEL` | Platform/OS supplied | No | See source; unset unless its feature/tool is used. Source: `frontend/lib/backend-origin.ts`. |
| `VERCEL_ENV` | Platform/OS supplied | No | See source; unset unless its feature/tool is used. Source: `frontend/lib/backend-origin.ts`. |
| `WEBAUTHN_CHALLENGE_TTL_SECONDS` | Optional: safe default/unset | No | Default 300 Source: `backend/src/common/security/webauthn.ts`. |
| `WEBAUTHN_ORIGINS` | Required now | No | Exact allowed frontend HTTPS origins; no wildcard. Source: `backend/src/common/security/webauthn.ts`. |
| `WEBAUTHN_RP_ID` | Required now | No | Frontend hostname. Host cutover changes passkey scope; review/re-enrol existing passkeys. Source: `backend/src/common/security/webauthn.ts`. |
| `WEBAUTHN_RP_NAME` | Optional: safe default/unset | No | Default "Allied AutoTech" Source: `backend/src/common/security/webauthn.ts`. |
| `WORKER_BATCH_SIZE` | Optional: safe default/unset | No | Default 25 Source: `backend/src/config/env.ts`. |
| `WORKER_POLL_INTERVAL_MS` | Optional: safe default/unset | No | Default 2_000 Source: `backend/src/config/env.ts`. |

## Removal and retention decisions

Removed from ignored local backend/.env on 20 October, after repository-wide consumer search: `AUTH_SECRET` (no consumer; actual opaque sessions use TOKEN_HASH_KEY), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (no Cloudinary adapter; media uses private Spaces), and `GOOGLE_MAPS_API_KEY` (backend unused; optional frontend integration uses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Original local file is preserved in the ACL-restricted .private audit backup. No provider credentials were fabricated or revoked by this cleanup. Do not publish that backup.

`DATABASE_URL` is not a runtime override: no actual local assignment was removed; Prisma builds the connection from DB_*. `DB_SSL_CA_CERT` is retained because the container entrypoint consumes it indirectly. `NEXT_PUBLIC_MEDIA_HOSTS` is retained because frontend policy code consumes it. All four encryption/hash keys and key IDs are preserved. Paystack/Monnify/Termii are implemented conditional integrations, not obsolete variables; keep their live features disabled and supply test credentials only when approved.

`accounts@alliedautotech.com` remains a Workspace Group for finance correspondence. Existing enquiry types have no dedicated accounts/billing type, so no unused ACCOUNTS_EMAIL variable or invented auto-broadcast is introduced.

## Component scopes

The following table is generated from the reviewed template. All entries are RUN_TIME; no backend key is a build argument. ?Secret? is the provider storage setting (the CA is public material stored this way for transport). API department destinations do not belong on workers: they are captured in encrypted outbox payloads. A dash means omitted; shared parser defaults still apply.

| Variable | api | identity-worker | general-worker | migrate |
|---|---|---|---|---|
| `API_DOCS_ENABLED` | Set | ? | ? | ? |
| `ASSET_DOWNLOAD_TTL_SECONDS` | Set | ? | ? | ? |
| `ASSET_TICKET_KEY` | Secret | ? | Secret | ? |
| `ASSET_TICKET_KEY_ID` | Set | ? | Set | ? |
| `ASSET_UPLOAD_TTL_SECONDS` | Set | ? | ? | ? |
| `DB_CONNECTION_TIMEOUT_MS` | Set | Set | Set | Set |
| `DB_HOST` | Set | Set | Set | Set |
| `DB_IDLE_TIMEOUT_MS` | Set | Set | Set | Set |
| `DB_IDLE_TRANSACTION_TIMEOUT_MS` | Set | Set | Set | Set |
| `DB_NAME` | Set | Set | Set | Set |
| `DB_PASSWORD` | Secret | Secret | Secret | Secret |
| `DB_POOL_MAX` | Set | Set | Set | Set |
| `DB_PORT` | Set | Set | Set | Set |
| `DB_SSL_CA_BASE64` | Secret | Secret | Secret | Secret |
| `DB_SSL_CA_FILE` | Set | Set | Set | Set |
| `DB_SSL_MODE` | Set | Set | Set | Set |
| `DB_STATEMENT_TIMEOUT_MS` | Set | Set | Set | Set |
| `DB_USER` | Set | Set | Set | Set |
| `DEPARTMENT_INFO_EMAIL` | Set | ? | ? | ? |
| `DEPARTMENT_SALES_EMAIL` | Set | ? | ? | ? |
| `DEPARTMENT_SUPPORT_EMAIL` | Set | ? | ? | ? |
| `DEPLOYMENT_ENV` | Set | Set | Set | Set |
| `EMAIL_DELIVERY_ENABLED` | Set | Set | Set | ? |
| `EXPIRATION_INTERVAL_MS` | Set | ? | Set | ? |
| `FRONTEND_PRIVILEGED_INVITATION_URL` | Set | ? | ? | ? |
| `FRONTEND_RESET_PASSWORD_URL` | Set | ? | ? | ? |
| `FRONTEND_URL` | Set | ? | Set | ? |
| `FRONTEND_VERIFY_EMAIL_URL` | Set | ? | ? | ? |
| `GLOBAL_RATE_LIMIT` | Set | ? | ? | ? |
| `GLOBAL_RATE_WINDOW_MS` | Set | ? | ? | ? |
| `LOG_LEVEL` | Set | ? | ? | ? |
| `MESSAGING_REQUEST_TIMEOUT_MS` | Set | Set | Set | ? |
| `MFA_ENCRYPTION_KEY` | Secret | ? | ? | ? |
| `MFA_ENCRYPTION_KEY_ID` | Set | ? | ? | ? |
| `MONNIFY_API_KEY` | Secret | ? | Secret | ? |
| `MONNIFY_CALLBACK_URL` | Set | ? | Set | ? |
| `MONNIFY_CONTRACT_CODE` | Set | ? | Set | ? |
| `MONNIFY_LIVE_ENABLED` | Set | ? | Set | ? |
| `MONNIFY_MAX_RESPONSE_BYTES` | Set | ? | Set | ? |
| `MONNIFY_MODE` | Set | ? | Set | ? |
| `MONNIFY_REQUEST_TIMEOUT_MS` | Set | ? | Set | ? |
| `MONNIFY_SECRET_KEY` | Secret | ? | Secret | ? |
| `NODE_ENV` | Set | Set | Set | Set |
| `OBJECT_STORAGE_ACCESS_KEY_ID` | Secret | ? | Secret | ? |
| `OBJECT_STORAGE_BUCKET` | Set | ? | Set | ? |
| `OBJECT_STORAGE_ENDPOINT` | Set | ? | Set | ? |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | Set | ? | Set | ? |
| `OBJECT_STORAGE_REGION` | Set | ? | Set | ? |
| `OBJECT_STORAGE_SECRET_ACCESS_KEY` | Secret | ? | Secret | ? |
| `OUTBOX_ENCRYPTION_KEY` | Secret | Secret | Secret | ? |
| `OUTBOX_ENCRYPTION_KEY_ID` | Set | Set | Set | ? |
| `PAYMENT_INTENT_TTL_SECONDS` | Set | ? | ? | ? |
| `PAYMENT_RECONCILIATION_ENABLED` | Set | ? | Set | ? |
| `PAYSTACK_CALLBACK_URL` | Set | ? | Set | ? |
| `PAYSTACK_LIVE_ENABLED` | Set | ? | Set | ? |
| `PAYSTACK_MAX_RESPONSE_BYTES` | Set | ? | Set | ? |
| `PAYSTACK_MODE` | Set | ? | Set | ? |
| `PAYSTACK_REQUEST_TIMEOUT_MS` | Set | ? | Set | ? |
| `PAYSTACK_SECRET_KEY` | Secret | ? | Secret | ? |
| `PORT` | Set | ? | ? | ? |
| `PRIVATE_TESTING_ENABLED` | Set | ? | ? | ? |
| `PRIVATE_TESTING_PASSWORD` | Secret | ? | ? | ? |
| `PRIVILEGED_INVITATION_TTL_SECONDS` | Set | ? | ? | ? |
| `READINESS_TIMEOUT_MS` | Set | ? | ? | ? |
| `RECONCILIATION_INTERVAL_MS` | Set | ? | Set | ? |
| `REQUEST_BODY_LIMIT` | Set | ? | ? | ? |
| `RESEND_API_KEY` | ? | Secret | Secret | ? |
| `RESEND_FROM_EMAIL` | ? | Set | Set | ? |
| `RESEND_REPLY_TO_EMAIL` | ? | Set | Set | ? |
| `SERVICE_NAME` | Set | Set | Set | Set |
| `SMS_DELIVERY_ENABLED` | Set | ? | Set | ? |
| `STAGING_EMAIL_ALLOWLIST` | Set | Set | Set | ? |
| `STAGING_SMS_ALLOWLIST` | Set | ? | Set | ? |
| `TERMII_API_KEY` | ? | ? | Secret | ? |
| `TERMII_BASE_URL` | ? | ? | Set | ? |
| `TERMII_SENDER_ID` | ? | ? | Set | ? |
| `TOKEN_HASH_KEY` | Secret | ? | Secret | ? |
| `TOKEN_HASH_KEY_ID` | Set | ? | Set | ? |
| `TRUST_PROXY_CIDRS` | Set | ? | ? | ? |
| `TRUST_PROXY_HOPS` | Set | ? | ? | ? |
| `WEBAUTHN_ORIGINS` | Set | ? | ? | ? |
| `WEBAUTHN_RP_ID` | Set | ? | ? | ? |
| `WEBAUTHN_RP_NAME` | Set | ? | ? | ? |
| `WORKER_BATCH_SIZE` | Set | Set | Set | ? |
| `WORKER_POLL_INTERVAL_MS` | Set | ? | Set | ? |

## Indirect operator and platform variables

These are also used outside the central runtime parser; they are not obsolete:

| Variable | Classification | Secret? | Consumer |
|---|---|---|---|
| CONFIRM_EMPTY_MIGRATION_DATABASE | Conditional: isolated migration replay | No | verify-migrations schema; literal true and _test/_ci required |
| CONFIRM_DROP_TEST_DATABASE | Conditional: isolated test cleanup | No | drop-test-database schema; never shared DB |
| CONFIRM_STAGING_PUBLIC_SEED | Conditional: reviewed one-time public catalogue seed | No | seed-staging-public schema; do not rerun merely to configure email |
| PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE, PGCONNECT_TIMEOUT | Internal backup subprocess variables | PGPASSWORD only | backup-database.ts derives these from confirmed DB settings; not App Platform inputs |
| ProgramFiles, ProgramW6432, ProgramFiles(x86), PATH, USERPROFILE, APPDATA | OS-provided executable/home/config lookup | No | Git/PostgreSQL/doctl/CLI discovery; preserve OS values |
| NEXT_TELEMETRY_DISABLED, NPM_CONFIG_UPDATE_NOTIFIER, NPM_CONFIG_FUND | Optional build/runtime defaults | No | Dockerfiles/package tools |
| HOSTNAME | Optional container bind address | No | Frontend standalone server; Docker defaults 0.0.0.0 |
| NODE_VERSION, VCS_REF | Build arguments, not credentials | No | Docker image base and provenance label |
| DOTENV_CONFIG_PATH | Optional direct dotenv/config CLI path override | No | Prisma config import only; does not override explicit env.ts path |
| VERCEL_TOKEN, CLOUDFLARE_API_TOKEN | Optional operator automation credentials | Yes | No application consumer; existing CLI OAuth/manual DNS suffice |

Do not repurpose OS environment variables or enable integration test flags in hosted components.
