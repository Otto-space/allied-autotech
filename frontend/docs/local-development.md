# Local development and isolated verification

### Notification inbox checks

Run `npx playwright test tests/e2e/notifications.spec.ts tests/e2e/security.spec.ts tests/e2e/public.spec.ts` against the local standalone build, setting `PLAYWRIGHT_BASE_URL` to its loopback URL. Customer and staff notification reads, read updates and delivery-preference writes are intercepted synthetic responses. The suite verifies all four roles, filters/pages, sparse preference defaults, explicit marketing consent, independent failures, unknown/contradictory mutations, account changes and mobile keyboard/accessibility behavior. It does not send email/SMS or demonstrate real provider delivery or database ownership. No new environment variable is required.

This guide does not authorize deployment. The implementation and acceptance audit are still in progress.

## Frontend

Use the Node/npm versions compatible with the checked-in lockfile. Run `npm ci` in `frontend`, copy `.env.example` to a local environment file and set only the values appropriate for your local API. No server secret belongs in a `NEXT_PUBLIC_` variable.

- `npm run dev` uses Next.js Webpack mode. Turbopack crashed during local compilation; choosing the documented Webpack compiler avoids that reproduced failure.
- `npm run check` runs lint, typecheck, unit tests, production build and formatting checks.
- `npm run api:types` regenerates request contracts from the sibling backend OpenAPI artifact. Its response schemas are incomplete; runtime projection schemas remain necessary.
- `npm run api:inventory` rebuilds the endpoint inventory from the contract and explicit status ledger.
- `npm run build` produces the standalone server. Its postbuild step copies static assets and approved public files. The preserved generated workshop image is excluded from the standalone artifact.
- `npm start` runs `.next/standalone/server.js`. Next.js reads standard `PORT` and `HOSTNAME` environment variables. For local browser checks use port 3000 and a loopback hostname.
- With the local server running, `npm run test:e2e` runs Edge on Windows or bundled Chromium elsewhere. Install the corresponding browser if unavailable. `PLAYWRIGHT_BASE_URL` can select another **local isolated** target.

The default browser suite intercepts mutations. The separately gated `real-api.spec.ts` uses the isolated loopback test harness described below. Do not run mutation journeys against a production backend. Public server rendering uses BACKEND_ORIGIN directly, so browser interception alone cannot supply service/product/vehicle detail fixtures.

## Backend database verification

The completed database run used a fresh PostgreSQL 17 Alpine container with no mounted host data, bound only to `127.0.0.1:55432`. Database: `allied_frontend_test`. The existing `test:migrations` script verifies an empty database whose name ends in `_test` or `_ci` before applying migrations.

Set local test connection variables in the test process: `NODE_ENV=test`, `DEPLOYMENT_ENV=local`, explicit loopback `DB_HOST`, test `DB_PORT`, `DB_NAME`, `TEST_DB_NAME`, `DB_USER`, test-only `DB_PASSWORD`, `DB_SSL_MODE=disable`, and empty `DB_SSL_CA_FILE`. Set `CONFIRM_EMPTY_MIGRATION_DATABASE=true` only for the newly created empty database, then run `npm run test:migrations` from `backend`.

For the suite set `RUN_DATABASE_TESTS=true` and run `npm test -- --maxWorkers=1`. The existing test setup forces email/SMS delivery off, disables real payment providers and removes provider secrets. The verified run applied all 30 migrations and passed all 152 tests in 44 files. Do not disable test isolation to shorten the run.

The temporary container name for this work is `allied-frontend-isolated-20260913-test`, labelled `allied.scope=frontend-integration-test`. It uses `--rm`; stopping this specific container removes its temporary data. Do not stop unrelated containers or remove shared Docker volumes.

### Real browser/API journey

`backend/tests/helpers/frontend-api-server.ts` is a test-only harness outside the application source. It imports the existing test environment, disables external delivery/providers, and refuses to seed unless the environment is test/local, the database host is loopback, the database port is `55432`, the database name is `allied_frontend_test`, and `RUN_FRONTEND_DATABASE_TESTS=true`. It binds the test API to `127.0.0.1:5000`.

With the migrated isolated database running, launch `npx tsx tests/helpers/frontend-api-server.ts` from `backend` with those test connection variables and `FRONTEND_URL=http://localhost:3000`. Start the frontend on `localhost:3000`, then set `RUN_FRONTEND_DATABASE_TESTS=true` in the frontend test process and run `npx playwright test tests/e2e/real-api.spec.ts`. A loopback-only fixture request creates fresh random records for every run. The journey covers customer login, profile update, booking deposit, cart/checkout and logout. Staff MFA and real payment-provider behavior are outside this journey's coverage.

## Staging prerequisites

### Private vehicle files and payment evidence

Set `ASSET_STORAGE_HOSTS` in the frontend server process to the approved bare HTTPS storage hostname(s), comma-separated. This is runtime configuration: the customer and administrator layouts expose only validated hostnames and the proxy uses the same list for `connect-src`. No access key or storage secret belongs in frontend configuration. Empty configuration deliberately disables upload and download controls. Customer manual reports can still be submitted without an optional evidence attachment. The backend bucket and signed URL host must match the configured environment.

Storage CORS must allow the actual frontend origin, PUT and the signed `content-type`, `x-amz-checksum-sha256` and `x-amz-server-side-encryption` headers. Browser uploads do not include application cookies or CSRF headers; only the same-origin ticket/attachment/access API requests carry session credentials. Configure HTTPS for actual storage. Do not add wildcard origins to bypass failed integration.

For the intercepted storage browser fixtures only, start the local frontend with `ASSET_STORAGE_HOSTS=storage.invalid`, and run `npx playwright test tests/e2e/vehicle-sales.spec.ts tests/e2e/vehicle-stock.spec.ts tests/e2e/staff-payments.spec.ts tests/e2e/manual-payments.spec.ts` with `RUN_ASSET_BROWSER_TESTS=true` in the test process. No request reaches genuine storage: fixture routes intercept the signed URL. Restart with the empty/default allowlist and omit that flag to test unavailable controls. The default suite skips eleven configured-storage scenarios (three handover, three stock attachment, one staff payment-evidence access and four customer payment-evidence scenarios); the configured run skips the one unavailable-storage handover scenario. These tests do not prove backend byte/signature verification, actual storage CORS, or private download content.

If another development server already uses port 3000, leave it running and use the standalone production build on a separate port. Set `PORT=3001`, `HOSTNAME=127.0.0.1` and the test storage allowlist in that server process, then run the stock suite with `PLAYWRIGHT_BASE_URL=http://localhost:3001`. Verify the active server's configuration before testing; setting an environment variable in the test process does not configure an already running frontend server. Stop the separate test server afterward. Keep handover fixtures on their documented origin unless their intercepted CORS origin is adjusted to match.

The upload uses browser SHA-256 and observable transfer progress, consistent with [MDN's digest example](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API/Non-cryptographic_uses_of_subtle_crypto) and [XMLHttpRequest upload events](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/upload). Attachment tickets and signed access URLs remain in component memory and are discarded on account invalidation; uploaded files are not attached until the reviewed record request succeeds.

### Deployment checks

Use a separate database, accounts, storage and provider test credentials. Confirm the hosting topology with the backend deployment documentation: older handover material names Cloudflare, newer material names Vercel and DigitalOcean. Preserve the browser's same-origin `/api/v1` boundary and test host-only secure cookies through the chosen proxy over HTTPS.

Keep `SITE_INDEXING=disabled`; this adds noindex but is not access control. Restrict staging access separately at the hosting layer. Verify the media hostname allowlist, storage CORS and signed document access. Confirm the actual production domain, official social profiles, exact map location and approved reservation terms before enabling their dependent features. No production domain is assumed.

Complete the endpoint coverage ledger, security review, staff/payment/upload journeys, performance/accessibility checks and final release blockers before any deployment decision.

### Team invitation links

Configure the backend `FRONTEND_PRIVILEGED_INVITATION_URL` as the frontend origin plus `/staff/accept-invitation` (local example: `http://localhost:3000/staff/accept-invitation`). The backend appends `#token=...`; do not replace it with a query token. Keep the frontend origin in the backend trusted-origin configuration. Invitation acceptance creates the account without logging it in; test sign-in and MFA enrollment separately using isolated accounts. UI fixtures intercept invitation creation/acceptance and never send real invitations.

### Product metadata browser checks

Run `npx playwright test tests/e2e/product-extras.spec.ts tests/e2e/account-flows.spec.ts` against a local standalone build (`PLAYWRIGHT_BASE_URL` may select the isolated test port). Fixtures intercept every API write and use unapproved image URLs to verify that no external image fetch occurs. These checks do not validate real database authorization, concurrent writers or genuine hosted image availability. Product images accept durable hosted URLs; no upload endpoint is available. Set the public bare-host allowlist `NEXT_PUBLIC_MEDIA_HOSTS` before building, and verify the resulting image CSP and genuine media separately on staging.

### Promotion checks

Run `npx playwright test tests/e2e/promotions.spec.ts tests/e2e/account-flows.spec.ts` against the local standalone build using `PLAYWRIGHT_BASE_URL` when needed. All promotion creation/update, preview and checkout requests in this suite are intercepted synthetic data. No real discounts or orders are changed. No new environment variable is required. Verify actual promotion usage limits, cancellation effects and concurrent checkout separately against the isolated test API.

### Account security checks

Run `npx playwright test tests/e2e/security.spec.ts tests/e2e/account-flows.spec.ts tests/e2e/staff-admin.spec.ts` against a local standalone build using `PLAYWRIGHT_BASE_URL`. All password changes, revocations, factor removals and code replacements are intercepted fixtures. These tests do not change real credentials or sessions. Verify actual cookie rotation, database revocation, privileged final-factor enforcement and concurrent security writes using disposable isolated accounts before release.

### MFA checks and WebAuthn origin configuration

Run `npx playwright test tests/e2e/mfa.spec.ts tests/e2e/security.spec.ts tests/e2e/auth-forms.spec.ts` against the local standalone build. The MFA suite intercepts API requests and uses an Edge virtual authenticator for an actual browser registration/assertion round trip; intercepted verification is not evidence of backend signature validation. Use `localhost` consistently for these browser fixtures.

For a real isolated journey, configure backend `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGINS` and challenge TTL to match the browser-visible frontend origin, not its internal rewrite destination. WebAuthn needs HTTPS outside supported localhost development contexts. Keep these server settings out of browser bundles. Test real origin/RP mismatches, signature rejection, single-use challenge/code consumption, session cookie rotation and bootstrap authorization before release. No real account credentials or factors are created by the intercepted suite.

### Isolated backend MFA regression checks

Use a disposable PostgreSQL instance bound to loopback and a database name ending in `_test`. Set `NODE_ENV=test`, `DEPLOYMENT_ENV=local`, `RUN_DATABASE_TESTS=true`, `TEST_DB_NAME=<disposable_name_test>` and the matching `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD=<isolated-test-password>`. Apply existing migrations with `npx prisma migrate deploy` from the backend, then run `npx vitest run tests/integration/mfa-enrollment-security.test.ts tests/integration/identity-flow.test.ts` or the full backend `npm run check`. Never point these suites at a shared or production database. The test environment disables email/SMS/payment delivery, and fixture audit records remain append-only until the disposable database is removed.

The MFA security suite covers all-role enrollment denial, first-factor bootstrap, actual TOTP activation/cookie rotation, recovery replacement, stale middleware session snapshots, expiry/revocation/suspension, concurrent bootstrap, concurrent final-factor removal and transaction rollback on an injected session-rotation fault. Browser virtual WebAuthn tests still use intercepted verification endpoints; they do not yet prove real browser-to-API signatures.

### Review workflow checks

Run `npx playwright test tests/e2e/reviews.spec.ts tests/e2e/notifications.spec.ts tests/e2e/public.spec.ts` against a local standalone build using `PLAYWRIGHT_BASE_URL`. All review submissions, moderation decisions, account sources and public publication are intercepted synthetic fixtures. No genuine review is published and no customer notification is sent. Check real ownership, completed-source eligibility, duplicate/source constraints, optimistic concurrency and delivery against disposable isolated data before release. The new screens need no additional environment variables.

### Customer care workflow checks

Run `npx playwright test tests/e2e/support.spec.ts tests/e2e/staff-bookings.spec.ts tests/e2e/staff-slots.spec.ts tests/e2e/inspections.spec.ts tests/e2e/public.spec.ts` against a local standalone build using `PLAYWRIGHT_BASE_URL`. Support fixtures intercept all contact submissions, customer replies and staff changes. Branch/source selection, CSRF bodies, message visibility and paging, closed-record preflight, versioned actions, unknown outcomes, account changes and mobile accessibility are exercised. No real complaint, email or staff notification is created. The shared staff and branch picker regressions are included. No additional frontend environment setting is required.

Before release, verify real anonymous origin/rate limits, customer ownership, staff branch isolation, internal-note visibility, concurrent message/status/assignment changes and notification/outbox delivery using disposable isolated accounts. Message pages are manually refreshed; `pollAfterMs` is validated but does not promise a live-agent or five-second update service.

### Cart maintenance checks

Run `npx playwright test tests/e2e/cart-maintenance.spec.ts tests/e2e/account-flows.spec.ts tests/e2e/promotions.spec.ts tests/e2e/operations.spec.ts` against a local standalone build using `PLAYWRIGHT_BASE_URL`. Clear-cart and item writes are synthetic intercepted requests; no customer cart is changed. Tests cover exact money, confirmation/cancellation, changed-state preflight, unreadable/unknown/malformed results, account invalidation, role-appropriate expiry availability and responsive accessibility. The manual expiry endpoints are never invoked. Verify real cart ownership and concurrent cart/checkout writes against isolated data before release; the preflight cannot provide a backend revision guarantee.

### Vehicle payment-request checks

Run `npx playwright test tests/e2e/vehicle-payments.spec.ts tests/e2e/account-flows.spec.ts tests/e2e/manual-payments.spec.ts tests/e2e/vehicle-sales.spec.ts` against a local standalone build using `PLAYWRIGHT_BASE_URL`. All financial requests/history are intercepted synthetic fixtures. The vehicle suite checks each purpose, exact source/key/CSRF bodies, complete-history failure/paging, existing unresolved requests, fresh preflight, original-key recovery after source changes, malformed target/purpose responses, deadline timers, account invalidation and responsive accessibility. It opens existing payment options without initiating a live provider charge. Real payable ownership, multiple-key concurrency, settlement/expiry and replay after source changes remain separate isolated API checks.

## SEO configuration and isolated verification

Keep `SITE_INDEXING=disabled` and `SITE_ORIGIN` empty until the actual production origin is approved. Both are server runtime settings for metadata/robots/sitemap; changing them requires a server restart. A valid `SITE_ORIGIN` is an HTTPS origin without credentials, path, query, fragment or non-default port. Preview/staging access still needs hosting-level restriction; robots is not authorization.

The dedicated `tests/e2e/seo.spec.ts` runs only with `RUN_SEO_SERVER_TESTS=true`. Use an isolated standalone server at `http://127.0.0.1:3001`, set its runtime `BACKEND_ORIGIN=http://127.0.0.1:5011`, `SITE_ORIGIN=https://allied.example` (synthetic test-only identity), and `SITE_INDEXING=enabled`. The suite owns a loopback HTTP fixture on 5011 and closes it afterward. No genuine API or provider should be used. Run with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` and `npx playwright test tests/e2e/seo.spec.ts tests/e2e/public.spec.ts`.

For the fail-closed deployment check, stop that owned server and restart it with empty `SITE_ORIGIN` but `SITE_INDEXING=enabled`. Set `RUN_SEO_DISABLED_TESTS=true` on the test command and run `npx playwright test tests/e2e/seo-disabled.spec.ts`. The app must omit canonical/social URLs, return noindex, block robots and return sitemap 404 without accessing a backend. Default-disabled and invalid-origin variants are also unit tested. All these values are fixtures/placeholders, not approved production settings.

The SEO fixture suite also verifies public first-page server rendering, validated public-only serialization, homepage partial failures, browser hydration without duplicate reads, filtering/cursor/reset transitions, failed refresh recovery and account-change recovery. Use the same dedicated loopback fixture settings described above; the browser's route interception cannot replace a server-side fetch. Main discovery filters and additional pages remain JavaScript interactions, while first-page content/detail links are readable without it. Existing browser-only suites exercise recovery when the server-side source is unavailable and their browser fixtures return valid records.

Public detail account-isolation checks use `RUN_PUBLIC_ACTION_TESTS=true npx playwright test tests/e2e/public-account-actions.spec.ts` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` and the standalone app configured with `BACKEND_ORIGIN=http://127.0.0.1:5011`. On PowerShell, set those environment variables using `$env:` before the command. The test owns the synthetic public-read server on 5011 and intercepts all browser customer writes; it does not create real bookings, cart entries or inspections. Run it sequentially with the SEO fixture suite, which owns the same port during its own tests.
