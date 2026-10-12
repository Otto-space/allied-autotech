# Operational jobs pagination and monitoring contract

The administrator processing-jobs page previously disabled pagination because the API returned a cursor but ignored it. The updated API applies a bounded keyset across the outbox and payment-webhook queues, and the frontend enables its existing Next/Previous controls.

## Read contract

`GET /admin/operations/jobs` retains Admin/Super Admin access with verified privileged sessions, private/no-store responses and successful-read auditing. Each source fetches at most `limit + 1` records; the merged result returns at most `limit` (default 25, maximum 100). Ordering is `updatedAt DESC, id DESC, source DESC`; PAYMENT_WEBHOOK precedes OUTBOX when both identifiers and timestamps match.

The opaque cursor contains its original timestamp, identifier and source, signed with a dedicated token-hash purpose and bound to the current administrator and source/status filters. Copy it unchanged. Page size may change. Altered, oversized, legacy UUID, foreign-actor or changed-filter cursors return 422. Token-hash key rotation also requires returning to page one. Authentication and authorization are checked on every request.

The boundary does not require the originating row to exist or retain its status/timestamp. Retrying or removing a cursor row therefore does not restart traversal. This is a live listing: jobs updated into a newer position during traversal require refreshing page one. It does not promise a snapshot across concurrent changes. Filter changes reset the frontend to page one. Navigation does not submit retries.

## Monitoring and response types

OpenAPI and generated frontend types now describe the existing job union, retry acknowledgement and monitoring projection explicitly. Job projections exclude outbox payloads, webhook payloads, signatures and provider credentials. Existing administrator diagnostic fields remain available to the API; the frontend parser strips fields it does not display.

`GET /admin/operations/status` returns organization-wide grouped counts for the three queues, the count of open/investigating payment anomalies, latest-started reconciliation, configured expected workers, and at most 100 unresolved alerts ordered by creation time and identifier. Absent queue/status groups mean zero rows. Heartbeat and alert database reads use explicit projections.

A missing worker has no heartbeat. An overdue worker has no successful heartbeat inside its configured threshold. Neither a recent heartbeat nor a retry acknowledgement certifies provider delivery, financial settlement or a currently running process. Retry authorization, CSRF, expected-attempt checks and worker rules remain in force.

## Release

Release the matching backend and frontend together. Older clients validating UUID cursors must reload; cursor syntax changed because previous pagination was unusable. No migration is added. Local verification uses an isolated database and disabled providers. Target-environment acceptance remains necessary.

## Local verification

Verified locally on 12 October 2026:

- 57 committed migrations replayed into `allied_operations_paging_20261012_test`; schema comparison reported no difference. No migration was added and the application database was not changed.
- 14 focused backend cases passed: seven database/API cases, two signed-cursor cases and five existing OpenAPI handover cases. These cover tied timestamps and colliding source IDs, retry/deletion boundaries, filter/page-size behavior, malformed and foreign cursors, MFA/roles/revocation, private payload exclusion, read auditing and the actual monitoring projection.
- 46 existing worker/security cases passed: notification retries (10), webhook claim ownership (14), support/worker flows (9), API boundaries (7) and notification security (6). Total backend evidence: 60 passing cases.
- All 476 frontend unit cases passed, including the two new operational-job parser cases.
- All 15 production-browser cases passed: 13 controlled operations regressions and two real API/PostgreSQL cases. Admin at 1440px and Super Admin at 390px each traversed 27 outbox and 27 webhook records as 25 + 2 with no repeats, then returned to page one and changed sources. Accessibility checks, overflow checks and browser error checks passed. Screenshots were inspected.
- The real browser verification left all 54 seeded jobs at DEAD_LETTER with three attempts, recorded successful reads and produced zero mutation audits for its two actors. Synthetic sessions were revoked after verification and only the temporary servers were stopped. Protected webhook evidence was retained without bypassing database deletion protection.
- Backend TypeScript, lint, script checks, secret guard, formatting, OpenAPI validation (267 paths) and route coverage (316 operations) passed. Frontend scoped lint and an isolated production build, including TypeScript and standalone packaging, passed. The built jobs component, queue, pagination and parser matched the workspace files. Generated frontend API types were refreshed.

The fixture setup initially violated protected webhook deletion and required verification/timestamp constraints. The fixtures were corrected to honor those constraints; no database protections were disabled. The final focused run passed all 14 cases, followed by all 46 regressions.

Reproducible test entry points are `tests/integration/operational-jobs-pagination.test.ts`, `tests/unit/operational-job-cursor.test.ts`, frontend `tests/unit/operational-job-page.test.ts`, `tests/e2e/operations.spec.ts` and `tests/e2e/operational-jobs-real.spec.ts`. The guarded `tests/helpers/operations-paging-api-server.ts` requires the named isolated database, disabled providers, explicit test flags and a session-fixture file outside the repository. Run real browser paging on its seeded database before worker regressions add unrelated jobs. These tests do not certify deployed provider delivery or production database performance.
