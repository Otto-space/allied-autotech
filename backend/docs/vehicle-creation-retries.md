# Vehicle inspection and enquiry creation retries

Backend and frontend recovery implemented and locally verified on 8 October 2026, including a real browser/API/PostgreSQL lost-response test. Track deployment under API-04 in [Backend Implementation Gaps](../../BACKEND_IMPLEMENTATION_GAPS.md). Deploy the backend contract before the dependent frontend; history-based recovery remains supported.

## Contract

The existing authenticated customer POST routes `/api/v1/customers/vehicle-inspections` and `/api/v1/customers/vehicle-transactions` accept an optional `Idempotency-Key` header. Use a fresh random UUID per intended submission. Keys are trimmed strings of 16–200 characters. Invalid supplied keys return 422; omitting the header preserves the previous creation behavior without duplicate protection. Session, customer role, CSRF, validation and existing request limits apply on every attempt.

The server scopes the key by authenticated user and operation and stores a keyed hash, never the raw key. It fingerprints the validated body using explicit field ordering, omitted optional values as null and inspection times normalized to UTC. The same retained key and equivalent input return HTTP 201 with the original record ID and its **current owner-authorized state**, using the existing response envelope. The request ID belongs to the current HTTP attempt. This is not a byte-for-byte replay of the original response.

Changed input with the same retained key returns HTTP 409 `IDEMPOTENCY_CONFLICT`. The caller must not silently generate a new key after an uncertain outcome. The same key used by another customer or for the other operation is an independent intent; it cannot retrieve the first customer's record. A retained receipt pointing to an absent or unowned record returns 404 and does not create a replacement.

Replays bypass new-creation availability and future-time checks after ownership validation. A vehicle becoming unavailable, or an inspection's preferred time passing, therefore does not prevent recovering a committed receipt. New requests still undergo those checks. No appointment, reservation or payment is established by this retry contract.

## Atomicity and retention

A PostgreSQL transaction-scoped advisory lock serializes the actor/operation/key. The existing unique `(scope, keyHash)` index backs the receipt. Domain creation, lifecycle history, audit and receipt commit together. A failed or database-aborted transaction leaves no receipt or domain record; transaction retry is restricted to database-aborted transactions and has no external side effects. A process ending before commit rolls back; a committed result is recoverable from PostgreSQL. This implementation never commits an `IN_PROGRESS` receipt. An unexpected retained incomplete receipt fails closed with 409 instead of guessing whether creation succeeded.

The receipt contains only the resource ID, status, fingerprints and timestamps, not a duplicate customer projection. It expires 24 hours after successful creation. The existing general expiration worker removes expired receipts in bounded batches. An expired receipt still present may replay, but clients must assume **no retry guarantee after 24 hours**. Once cleanup removes it, the same key is a new attempt. A new key is always a new intent. Neither case offers global exactly-once creation.

Token-hash key rotation must preserve the active retry window operationally; changing the hash key changes lookup hashes, as with existing keyed idempotency workflows.

## Frontend recovery

The [vehicle actions](../../frontend/app/components/vehicle-actions.tsx) use [a tab-scoped recovery helper](../../frontend/lib/api/vehicle-creation-retry.ts) to save the original reviewed body, random key, authenticated customer ID, operation and first-attempt time before sending. The recovery panel displays original inspection details and offers an explicit same-key/body retry after a lost response or reload. A fresh account check and CSRF protection apply to every attempt. Retries can recover a receipt after the preferred inspection time passes.

The client stops retries after 23 hours, inside the backend's 24-hour minimum retention. Expired, malformed or mismatched intents retain a history-review boundary instead of silently generating a new key. Confirmed success clears the intent; a customer may explicitly acknowledge checking history before abandoning it and starting another request. Known rejection of an initial attempt permits correction, while uncertain outcomes and failed recovery attempts retain their key.

Account invalidation removes stored notes and request details and retains only a non-sensitive history marker. Another customer cannot load or resend the intent; returning customers use history. Storage errors prevent an unrecorded creation and offer a recovery-check retry once storage is available. Stored data is schema-validated, bounded and rendered as text; authentication tokens are never stored. Session storage supports reloads in the same tab, not cross-device recovery. Use authenticated history on another device, after closing the tab, or if the listing is no longer publicly accessible.

## Local verification

All 46 current migrations applied successfully to the separately created database `allied_api04_20261008_test`; the application database was not migrated or reset for this change. No new migration is needed.

Nine real PostgreSQL integration scenarios in `tests/integration/vehicle-creation-idempotency.test.ts` verify both concurrent creation operations (five attempts, one record and one audit), changed input, service reconstruction, replay after availability/time changes, customer/operation isolation, legacy callers, rollback after an audit failure, incomplete and unowned receipts, real worker expiry cleanup, canonical date offsets and HTTP session/CSRF/key validation. Existing vehicle flow, unit security and API boundary tests also passed.

Run from `backend` with an isolated test database:

```powershell
$env:RUN_DATABASE_TESTS = 'true'
$env:TEST_DB_NAME = 'allied_api04_20261008_test'
npx vitest run tests/integration/vehicle-creation-idempotency.test.ts tests/integration/phase7-vehicle-sales-flow.test.ts tests/unit/phase7-vehicle-security.test.ts tests/api/phase7-vehicle-boundaries.test.ts
```

OpenAPI validation, route coverage, backend type checking and lint passed; exported OpenAPI, endpoint handbook and frontend generated API types include the optional header. These checks do not certify deployed infrastructure or the remaining backend gap list.

The full default backend run passed 216 tests (285 database-gated tests were skipped); the nine new database scenarios were run separately with database tests enabled. Frontend type checking also passed. The OpenAPI hardener now preserves optional-header descriptions and does not invent JSON success envelopes for PDF downloads; the validator, handbook and regression assertions cover those corrections and all 303 mounted API operations.

### Frontend and real-browser acceptance

All 353 frontend unit tests passed, including five recovery-storage cases and existing API-client security tests. Type checking, affected-file ESLint, formatting, diff checks and an isolated production build passed. The three changed runtime files in the build copy were SHA-256 matched to the workspace. The existing preview on port 3001 was preserved; this preview used `%TEMP%/allied-api04-preview-20261008` and `http://localhost:3021`.

All 48 vehicle-detail browser scenarios were verified across the full run and focused reruns using repository Playwright and Edge (Browser plugin unavailable). The full run passed 45 cases; its two failures were a stale account-switch fixture and missing preview SEO settings. Both passed after correcting those test conditions. The six-case focused run also covered the added blocked-storage test, original-key/body recovery at 390px and 1440px, a passed preferred time, private-note redaction and returning-account history protection. Recovery had no recorded page errors in production; an initial development-only router initialization error did not recur.

The final **real integration check** used the production frontend, actual API on port 5021 and isolated PostgreSQL database `allied_api04_20261008_test`. For both inspection and enquiry, Playwright forwarded the first POST to the real backend, received HTTP 201, then aborted delivery to the browser. After reload, the browser reused the identical key/body and displayed the original persisted ID. Database assertions confirmed exactly one inspection, one enquiry, two creation audits and two completed retry receipts. Synthetic sessions were revoked after verification; provider delivery was disabled. This verifies the complete local request path, not a deployed environment.

Local evidence is outside the repository: `%TEMP%/allied-api04-live-results.json` (IDs and database assertions, no credentials), `%TEMP%/allied-api04-live-receipt.png`, `%TEMP%/allied-vehicle-recovery-{390,1440}.png` and `%TEMP%/allied-vehicle-retry-{390,1440}.png`. The recovery panels were visually inspected at both widths. Browser settings: `RUN_VEHICLE_DETAIL_TESTS=true`, `PLAYWRIGHT_BASE_URL=http://localhost:3021`. Preview settings: `BACKEND_ORIGIN=http://127.0.0.1:5021`, `PORT=3021`, `HOSTNAME=localhost`, `SITE_ORIGIN=https://allied-autotech.example.test`, `SITE_INDEXING=enabled`. The SEO origin is synthetic. Run `npx playwright test tests/e2e/vehicle-detail-quality.spec.ts`; the focused supplement used `--grep 'recovers original|blocked browser|account change discards|loading, SSR|unknown inspection'`.
