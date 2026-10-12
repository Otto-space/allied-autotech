# Private file storage availability

## Runtime behavior

The default `objectStorage` adapter always uses S3-compatible storage. The former automatic `SyntheticObjectStorageAdapter` has been removed. Without `OBJECT_STORAGE_BUCKET`, upload preparation, object verification, signed download and signed view requests fail with HTTP 503 `PROVIDER_UNAVAILABLE`, using a non-sensitive message. No fabricated URLs or unconditional successful verification remain in runtime code.

This protects vehicle documents, condition-report files, signed handover documents, manual-payment evidence, refund-transfer evidence and dispute evidence. Existing role, branch, owner, MFA, CSRF, ticket and lifecycle checks still apply. An unconfirmed ticket cannot insert a document or payment-evidence record when storage is absent. Handover verification propagates storage unavailability separately from an invalid ticket, leaving the sale unchanged.

Managed image operations retain their existing `MEDIA_STORAGE_UNAVAILABLE` contract. Existing committed manual-evidence retries still replay their receipts without requiring another storage check. Workflows that legitimately omit an optional attachment retain their existing policy; this repair does not change settlement, approval, refund or handover authority.

Production startup already validates required storage configuration. Removing the fallback also protects local and other non-production runtimes, which previously could record nonexistent evidence. No historical records or audit events are rewritten or retroactively certified by this change.

## Local verification — 9 October 2026

All five initial missing-configuration regressions failed against the old fallback: four storage methods resolved successfully and the HTTP verification probe returned 200. After removal, they pass with safe 503 responses and no internal object key or credential detail.

The focused run passed **34 tests across nine files**: missing-storage unit/HTTP/database tests, vehicle lifecycle/security, payment lifecycle/security, manual-evidence replay, delegated refunds and dispute evidence. PostgreSQL checks verify no document, payment attempt, manual review or settlement is created by rejected evidence. The complete vehicle lifecycle fixture now explicitly injects byte-backed private storage and supplies matching PDF signature/size/checksum data instead of relying on the runtime fallback.

The two database tests passed again after extending the vehicle case to check a paid handover and unchanged sale status. The initial extended fixture lacked the accepted-terms fields required for paid sales; those fields were supplied without changing production constraints. Five OpenAPI handover tests also passed. Backend typecheck/build/lint, affected-file formatting, secret scanning, OpenAPI validation (265 paths), mounted-route coverage (314 operations), regenerated frontend types and frontend typecheck passed. The original 34-test JSON report is `%TEMP%/allied-private-storage-results.json`; the later expanded database check was run separately.

From `backend`, against the existing migrated isolated test database:

```powershell
$env:RUN_DATABASE_TESTS = 'true'
$env:TEST_DB_NAME = 'allied_media_cleanup_20261009_test'
npx vitest run tests/integration/unconfigured-storage.test.ts tests/integration/phase7-vehicle-sales-flow.test.ts tests/integration/manual-evidence-replay.test.ts tests/integration/refund-processing.test.ts tests/integration/dispute-workflow.test.ts tests/integration/phase8-payment-flow.test.ts tests/unit/unconfigured-storage.test.ts tests/unit/phase7-vehicle-security.test.ts tests/unit/phase8-payment-security.test.ts --maxWorkers=1
```

## Complete storage operation bounds - 12 October 2026

SEC-027 adds a single 20-second deadline for private verification (metadata plus signature read), and for each managed image read, write and delete. The deadline aborts the SDK request and independently bounds caller completion when a transport ignores abort. A metadata response arriving after the deadline cannot start a signature request. Signature responses are limited to 16 bytes even if a provider ignores the requested range. Managed reads reject excessive Content-Length or streamed bytes and cancel discarded bodies without waiting indefinitely for cancellation.

Missing or invalid private evidence still fails validation. Storage permission, configuration and transport failures now produce safe HTTP 503 `PROVIDER_UNAVAILABLE` errors instead of being reported as invalid files. Managed operations retain their existing media error codes. Retry classification stays internal to the error handler; the public error envelope contains the code, message and request ID without provider details.

The initial fault-injection baseline reproduced eleven failures in the old implementation. Acceptance covers ignored aborts, late metadata, stalled body reads and cancellation, oversized responses, successful bounded reads, missing objects, permission errors and the public error envelope. Loopback HTTP tests use the installed S3 SDK and verify that the actual stalled connection closes at the deadline; they do not contact DigitalOcean Spaces.

A timeout cannot establish whether a remote write or delete committed. Existing idempotency, evidence replay, confirmation transactions and orphan cleanup remain necessary. This change adds no schema migration or storage configuration.

The final regression passed **48 tests across ten files**, with no skipped tests. It includes 18 new fault-injection and real HTTP checks, missing-storage coverage, media validation, private-evidence replay, media confirmation/cleanup concurrency, refunds and disputes. PostgreSQL tests used only the migrated isolated `allied_vehicle_terms_20261012_test` database. The JSON report is `%TEMP%/allied-storage-bounds-regression.json`. An earlier expanded run passed 47 tests; its sole failure was a test incorrectly expecting the internal retry flag in the public envelope. The assertion was corrected without changing that envelope, and all 48 tests were rerun successfully.

Backend typecheck, build, lint, affected formatting and secret scanning passed. OpenAPI validation covers 266 paths; route coverage verifies 315 API operations and four infrastructure routes. Regenerated frontend types/inventory and frontend typecheck passed, as did `git diff --check`. No application database, live bucket or deployed service was changed. Release the updated adapter with both API and general worker processes; actual Spaces compatibility remains part of REL-01.

## Rollout and remaining acceptance

No migration is needed. Deploy the backend repair and retain the regenerated contract/types. The frontend already handles `PROVIDER_UNAVAILABLE`; this change introduces no new UI workflow. New tests that need storage must inject a test adapter or mock explicitly. `tests/helpers/object-storage.ts` verifies supplied bytes; it is not a runtime adapter or evidence of real storage acceptance.

DigitalOcean Spaces configuration remains deferred. Actual signed uploads, provider metadata/checksum behavior, private access, CORS and evidence reads still require the configured bucket under REL-01. No live bucket call, provider activation, frontend browser run or deployment is claimed for this repair.
