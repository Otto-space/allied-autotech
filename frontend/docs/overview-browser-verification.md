# Overview verification against a disposable API

The real-browser suite uses actual session middleware, frontend proxy, database queries and
response parsing. It creates synthetic accounts and MFA-assured test sessions; it does not test
password authentication or a physical MFA authenticator and must never target a real database.

1. Create `allied_overview_20260918_test` through the backend's guarded test-database script and
   replay all migrations, including `20260918092000_overview_date_indexes`.
2. From `backend`, set `RUN_OVERVIEW_DATABASE_TESTS=true` and
   `TEST_DB_NAME=allied_overview_20260918_test`, then run
   `npx tsx tests/helpers/overview-browser-server.ts`. The harness refuses any other database
   name, disables outgoing email/SMS and payment providers, and binds only to 127.0.0.1:5011.
3. Build an isolated frontend snapshot with `BACKEND_ORIGIN=http://127.0.0.1:5011` already set.
   Next.js proxy rewrites are captured at build time; setting this only when starting the server
   does not change the built destination. Do not replace a developer's active `.next` tree.
4. Start that snapshot on 127.0.0.1:3001. From `frontend`, set
   `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001` and `RUN_OVERVIEW_DATABASE_TESTS=true`, then run
   `npm run test:e2e -- tests/e2e/overview-real.spec.ts --workers=1`.
5. Stop both owned servers after verification. The harness's loopback-only account endpoint
   contains disposable session cookies and must not be exposed through a public tunnel or logs.

The separate `overview.spec.ts` suite intercepts API requests with explicitly synthetic data
for deterministic date, error, role, accessibility and responsive checks. Its screenshots are
test evidence, not company figures. `overview-refresh.test.tsx` uses fake time to verify minute
refresh, request coalescing while a request is pending, hidden/offline pauses and capped error
backoff, including immediately rejected requests.

Neither suite applies production migrations, provisions the selected real owner, submits a
payment, sends an invitation or publishes a deployment.
