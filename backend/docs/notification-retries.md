# Notification retry recovery

Updated 9 October 2026. This repair covers the existing administrator processing-jobs action. It does not enable email, SMS or marketing delivery.

## Behavior

`POST /admin/operations/jobs/{source}/{jobId}/retry` requires an authenticated Admin or Super Admin with verified MFA, trusted-origin CSRF, a reason, and the current `expectedAttempts` value. The supported range is now 0–1000: disabled channels create legitimate dead letters with zero attempts.

For `notification.delivery.requested` outbox events, retry changes the failed/dead-letter outbox event and its failed/dead-letter delivery to `PENDING` in one transaction. The delivery attempt count must match the requested outbox attempt count, and it must have no delivery timestamp. Missing, active, completed or inconsistent delivery records produce 409 and roll back the outbox change. A successful retry also appends the existing audit event in that transaction.

The event ID, encrypted payload and cumulative attempts are preserved. Concurrent retries for the same state produce one success. The worker increments attempts on the next claim; retrying an exhausted job permits another attempt, but does not grant a fresh automatic retry budget. Worker checks for withdrawn operational consent, disabled marketing, stale booking reminders and permitted staging recipients remain in place.

`RETRY_REQUESTED` means queued, not sent or received. The current provider idempotency key is reused. Tests using an injected provider do not establish exactly-once behavior for a real provider or prove delivery to a recipient.

Other outbox event types and payment webhooks retain their existing transitions. No migration or data rewrite is needed. Deploy the backend before the frontend change that exposes zero-attempt retries at `/admin/processing-jobs`.

## Verification

The initial seven regressions all failed against the old implementation: two HTTP requests were rejected with 422 for zero attempts; the other five showed stuck, inconsistent or incorrectly accepted delivery states. After the repair, all ten database/HTTP cases pass:

- Admin email and Super Admin SMS zero-attempt retries, followed by worker delivery using the same event key and a single audit entry.
- One successful concurrent retry, stale request rejection and unchanged attempt count.
- Rollback for published, processing, missing or mismatched delivery records.
- An exhausted job advances from eight to nine attempts and returns to dead letter after another provider failure.
- Anonymous, Customer, Staff, pending-MFA, missing-CSRF and invalid attempt requests leave both records unchanged.
- Withdrawn operational consent prevents delivery after retry.

All 50 migrations were replayed into the isolated `allied_notification_retry_20261009_test` database. The final focused run passed 40 tests across six files: the new retry suite, existing Phase 9 support/worker flows and HTTP boundaries, notification security, worker resilience and OpenAPI handover. Results: `%TEMP%/allied-notification-retry-results.json`.

Backend typecheck, build, lint, affected-file formatting, secret scan, OpenAPI validation (265 paths) and mounted-route coverage (314 operations) passed. Frontend generated types, typecheck, affected-file ESLint and formatting passed.

Five focused Edge/Playwright scenarios passed at `http://localhost:3107/admin/processing-jobs`: Staff denial, changed-attempt/reason validation, Admin zero-attempt retry, Super Admin zero-attempt retry, and uncertain webhook/processing-state protection. The two zero-attempt scenarios then passed again at desktop 1280×720 and mobile 390×844. They verify the page URL/title, populated content, review dialog before any write, CSRF and exact attempt/reason submission, refreshed queue and absence of browser console/page errors. Screenshots were inspected and show the zero-attempt confirmation without a framework error overlay. Evidence: `%TEMP%/allied-notification-retry-browser`, `%TEMP%/allied-notification-retry-browser-responsive`, and `allied-notification-retry-{admin,super_admin}.png` in the same temporary directory.

Browser plugin was not available; tests used the repository Playwright workflow with installed Edge and an isolated copy running Next development mode. Browser API responses were controlled fixtures; real authorization, atomic persistence and worker behavior were verified separately against PostgreSQL by the HTTP/integration suite. No actual email/SMS was sent. A new frontend production build and a single end-to-end browser-to-provider run were not performed for this one-condition UI change.

## Remaining boundaries

Real email/SMS delivery and deployed worker acceptance remain infrastructure checks. This change does not repair records already left in an inconsistent `PENDING` outbox / `DEAD_LETTER` delivery state by an earlier successful retry; those require investigation and a separately audited recovery decision. The subsequent worker ownership repair below addresses stale lease completion separately.

## Messaging worker ownership repair — 9 October 2026

Both notification and identity-email workers previously completed or failed records using only the job ID and PROCESSING status. After a ten-minute lease takeover, an older provider call could complete or fail the newer worker's attempt. Notification delivery attempts could even regress from two to one. A worker also retained an entire claimed batch and could send later items after another worker had already completed them.

The workers now renew their lease immediately before each dispatch only when the recorded attempt still matches their claim. Superseded batch entries are skipped. Completion and failure require the same cumulative attempt. Notification outbox and delivery transitions are conditional and atomic: losing either record rolls back the pair. Stale failures no longer produce logs claiming the newer attempt failed. Existing encrypted payloads, provider idempotency keys, consent controls, retry budgets and ten-minute lease duration are unchanged.

Claims and lease renewals use explicit UTC timestamps to match Prisma's timestamp-without-time-zone representation. Previously, a non-UTC PostgreSQL session could shift lease timestamps and treat a future UTC retry deadline as already due. This repair covers the claim/scheduling statements in the two messaging workers. The subsequent [database clock repair](database-time.md) covers the remaining runtime SQL, identity cleanup, connection defaults and refund-policy trigger.

Eight initial concurrency cases failed before the fix. The final focused concurrency suite has fourteen passing cases: stale success/failure while a replacement worker is in flight, superseded batch items, atomic rollback for mismatched notification delivery attempts, and scheduling/fresh-lease/expired-lease/backoff behavior for both workers under explicitly configured UTC, Africa/Lagos and America/New_York sessions. The batch tests compare membership rather than relying on UPDATE RETURNING order. They use real PostgreSQL transactions and synthetic provider calls; no actual message is sent.

Final regression: **51 tests passed across eight files**, combining the fourteen concurrency cases, ten retry cases, full identity flow, Phase 9 support/worker flows and route boundaries, notification security, worker resilience and disabled-worker behavior. All 50 migrations replayed into the fresh isolated `allied_messaging_concurrency_20261009_test` database. Backend typecheck, build, lint, affected-file formatting, diff checks and the 1,627-file secret scan passed. Results: `%TEMP%/allied-messaging-concurrency-results.json`. No API or rendered frontend change was made in this worker follow-up, so browser tests were not rerun.

Deploy and drain both the identity and general workers together. No migration or frontend/API change is required for worker ownership. Existing timestamps are not rewritten: a deployment with historical local-time lease values may need operational investigation of delayed jobs. This repair cannot cancel provider calls already in progress; provider acceptance followed by process or network failure remains uncertain and requires idempotency/reconciliation. It is not an exactly-once delivery guarantee.
