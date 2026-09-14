# Local development and isolated verification

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

Use a separate database, accounts, storage and provider test credentials. Confirm the hosting topology with the backend deployment documentation: older handover material names Cloudflare, newer material names Vercel and DigitalOcean. Preserve the browser's same-origin `/api/v1` boundary and test host-only secure cookies through the chosen proxy over HTTPS.

Keep `SITE_INDEXING=disabled`; this adds noindex but is not access control. Restrict staging access separately at the hosting layer. Verify the media hostname allowlist, storage CORS and signed document access. Confirm the actual production domain, official social profiles, exact map location and approved reservation terms before enabling their dependent features. No production domain is assumed.

Complete the endpoint coverage ledger, security review, staff/payment/upload journeys, performance/accessibility checks and final release blockers before any deployment decision.
