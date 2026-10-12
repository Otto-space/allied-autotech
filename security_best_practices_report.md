# Security Best-Practices Review

Review date: 2026-09-10

## Dependency follow-up — 9 October 2026

This section supersedes the dependency status in the historical review below. It is a dependency and targeted regression review, not a fresh certification of all application code or deployment controls. The current full application/deployment audit remains open.

### SEC-012 — Express proxy trust dependency (critical package advisory, patched)

The backend used `proxy-addr` 2.0.7 through Express. Its mapped-IPv6 subnet bug can let clients spoof their apparent IP when a vulnerable trust subnet is configured, undermining IP-based limits and audit identity. The application supports operator-configured trusted CIDRs in [app.ts](backend/src/app.ts:44), so the dependency was updated to 2.0.8 in the lockfile. The [upstream advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) describes the configuration precondition; no exploit against the current deployment is claimed.

Three [Express regression tests](backend/tests/unit/proxy-trust.test.ts:5) prove that short mapped-IPv6/broad IPv6 trust subnets no longer trust arbitrary IPv4 peers, while a correctly scoped mapped loopback proxy still works. Existing proxy policy is preserved.

### SEC-013 — Next.js and compatible transitive updates (patched; local release regression passed)

[Frontend dependencies](frontend/package.json:27) now pin Next.js and its matching ESLint configuration to 16.3.8. This clears the flagged `next/og` critical advisory and the later image-optimization/cache/metadata advisories affecting 16.3.3. The [ImageResponse advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) requires attacker-controlled SVG content in Node image generation; source search found no application `next/og`/`ImageResponse` use. The [image-optimization advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) is addressed by the same patch upgrade. This is package remediation, not evidence of prior exploitation.

Compatible lockfile updates also install `sharp` 0.35.5, `source-map-js` 1.2.2 and patched `brace-expansion` versions in the frontend; backend updates include `ip-address` 10.7.3, `fast-uri` 3.1.8, `source-map-js` 1.2.2 and `brace-expansion` 5.0.12. No forced downgrade was used.

### SEC-014 — Prisma configuration merge dependency (resolved with scoped override)

The old SEC-011 finding is resolved locally by an [override confined to @prisma/config](backend/package.json:97), selecting `deepmerge-ts` 8.0.0 while keeping Prisma/client 7.10.0. The [upstream release](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) fixes recursive-merge handling but changes Map merging and some types. Inspection found Prisma uses the exported `deepmerge` function for plain configuration objects; this repository's [configuration](backend/prisma.config.ts:34) uses schema/migration paths and a datasource URL, without Maps/custom merge APIs. Prisma validation, generation, configuration typechecking and migration status all passed with the override. Remove the override once a supported Prisma version declares a patched dependency itself; revalidate configuration semantics when changing it.

### SEC-015 — Unpatched lint-tool brace parser (open, development tooling)

The frontend full npm audit still reports five high entries originating from one [unpatched braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): `braces` → `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → `eslint-config-next`. The installed plugin consumes root-directory patterns from repository-owned ESLint settings. No application request route imports this chain, and `npm ls braces --omit=dev` is empty. A fresh `npm ci --ignore-scripts` and production build with physical dependencies produced a standalone artifact containing 2,606 files, no external links/junctions and no `braces` package. The initial temporary preview shared development dependencies through a junction and was unsuitable evidence for deployment-package isolation; that packaging check was replaced by this clean build. The frontend runtime Docker stage copies the standalone application. Do not treat arbitrary external patterns as trusted lint configuration. An incompatible ESLint/Next downgrade is not a safe fix. Track a compatible upstream replacement or patched release; this finding remains open in development tooling.

### SEC-016 — Database connection failures reported as generic 500s (resolved locally)

The reported Prisma 7 `ECONNREFUSED` failures in session and service reads were outside the original mapper's `P1000`/`P1001`/`P1002` allowlist. The [mapper](backend/src/common/errors/prisma-error-mapper.ts:10) now recognizes socket failures only on genuine Prisma known-request errors, including the structured adapter cause wrapped by raw-query `P2010` errors. Closed connections (`P1017`) and connection-pool timeouts (`P2024`) also use the existing 503 `DATABASE_UNAVAILABLE` response. Arbitrary SQL errors and unrelated provider/network exceptions retain their existing classifications. The frontend already has a safe message for this code. No automatic mutation retry was added, and this change does not restore an unavailable database.

Twenty-four mapping cases, two HTTP tests using actual Prisma model/raw queries against a closed ephemeral loopback port, and the 14 existing HTTP foundation tests passed. The real refused-query tests verify the exact safe response envelope and `no-store` caching without exposing host, port, SQL, stack or credentials. Typechecking, targeted lint and formatting passed. These tests do not stop or alter a running database. The OpenAPI generator now describes 503 responses across all 308 operations, preserving specialized media/provider responses; five handover tests and route/artifact validation passed. Frontend API types were regenerated and typechecked.

### Current audit evidence and scope

Fresh npm registry audits after the changes: backend full dependency tree **zero advisories**; frontend production dependencies (`--omit=dev`) **zero advisories**; frontend full tree **five high development-tool entries**, zero critical. Audit JSON files are retained outside the repository under the OS temporary directory as `allied-{backend,frontend}-audit-after-20261009.json` and `allied-frontend-runtime-audit-20261009.json`. Counts describe the advisory database at this verification time, not a general security guarantee.

Post-update backend verification passed: Prisma validate/generate/configuration typecheck; all 49 migrations present on the isolated database; default test suite 225 passing/310 database-gated tests skipped; three focused proxy-trust cases; and a separate 24-case real database/API/identity/catalogue/proxy regression run. Frontend lint/typecheck, 355 unit tests, the Next.js 16.3.8 production build and 51 login/discovery browser regressions passed. The real Shop API/browser flow also passed against the 10,000-product fixture. The clean installation/build then passed the same 51 browser cases and real API/browser flow, with no page errors or horizontal overflow. Playwright/MS Edge was used because the Browser plugin was unavailable. The clean artifact is in the OS temporary directory at `allied-security-release-20261009`; its browser evidence is in `allied-clean-release-playwright`. This verifies a local standalone release, not a built Docker image or deployed host. No production database, deployment or provider credentials were changed.

### Expanded database regression — 9 October 2026

All 49 migrations replayed in fresh local `allied_security_full_20261009_test`, then the full backend suite ran with `RUN_DATABASE_TESTS=true` and `--maxWorkers=1`. The initial run had 532 passing cases, two fixture failures and four deliberately isolated cases skipped. The quotation fixture now supplies actual lines before issuance/acceptance, preserving the invoice snapshot checks and PostgreSQL immutability trigger. The saved-vehicle authorization fixture now reuses the protected singleton owner rather than trying to create a second owner. Both corrected suites passed along with the new outage cases and handover checks (36 cases in that focused run).

The subsequent full run included the new outage tests: **559 passed, one fixture failure, four skipped**. Its remaining payment-flow assertion assumed an unconfigured refund calendar even after the calendar suite had published an approved policy on the reused database. The fixture now verifies the selected policy snapshot/deadline/status when configured and the pending state otherwise, without deleting policy history or changing production refund behavior. That case passed on both the configured database and a new `allied_refund_no_calendar_20261009_test` database after all 49 migrations. The full command was not repeated after this final fixture-only correction; retain this distinction when reporting the gate.

The four specially isolated cases also passed separately: three owner-provisioning cases on fresh `allied_owner_security_20261009_test` and one workshop access case on fresh `allied_workshop_security_20261009_test`, each with all 49 migrations. Backend typechecking, affected-file lint/format, diff checks and the 1,581-file secret guard passed after the corrections. Evidence in the OS temporary directory: `allied-security-full-tests-20261009.json`, `allied-security-final-tests-20261009.json`, and `allied-security-repaired-tests-20261009.json`. These include their original failed outcomes; the focused configured/unconfigured refund and dedicated owner/workshop results are recorded above rather than relabeling the original full runs as green. Provider/storage adapters in the integration suites are controlled test doubles; real provider/storage/deployment acceptance remains open.

## Media cleanup concurrency review — 9 October 2026

### SEC-017 — Stale cleanup workers could overwrite newer work (resolved locally)

- Severity: Medium (media lifecycle integrity and retention).
- Evidence: [claim and completion handling](backend/src/workers/media-cleanup.worker.ts:47); [PostgreSQL concurrency regressions](backend/tests/integration/media-cleanup-concurrency.test.ts:32).
- Reproduced behavior: after a job was requeued or a lease expired, the previous worker updated completion/failure by job ID alone. A stale successful attempt could discard the newer cleanup request; a stale failure could replace its deadline or corrupt a replacement worker's completed state. Selection also ignored a concurrently postponed deadline when claiming, allowing early deletion. Four regressions failed before the production fix.
- Resolution: claiming compares the selected attempt, deadline and lease. Both completion and failure compare the active lease and incremented attempt count and leave superseding work untouched. This uses existing columns and preserves reference checks, bounded batches, safe error codes and retry backoff. It does not cancel storage operations already in progress or claim to solve all external-storage races.
- Verification: six new database cases and 54 existing media/worker cases passed together (60 total). All 50 migrations replayed on a fresh isolated test database; backend typecheck, build, lint, affected-file formatting and secret scanning passed. See [managed-media verification](backend/docs/managed-media.md#cleanup-concurrency-regression-9-october-2026). Real storage remains a separate deployment gate. No API or frontend contract changed.

### SEC-018 — Delayed confirmation could recreate removed media (resolved locally)

- Severity: Medium (private media retention and image availability).
- Evidence: [confirmation write and ticket checks](backend/src/modules/media/media.service.ts:149), [cleanup ticket locking](backend/src/workers/media-cleanup.worker.ts:69), [bounded media transaction](backend/src/modules/media/media-transaction.ts:5), and [PostgreSQL regressions](backend/tests/integration/media-confirmation-concurrency.test.ts).
- Reproduced behavior: verified bytes were written before the final ticket lock/replay check. A delayed duplicate could write after the original request confirmed, the customer removed the image and cleanup deleted it. The stale receipt returned successfully while orphaned bytes were recreated and their cleanup job remained completed. Concurrent confirmation also performed duplicate writes. Existing application reads still enforced authorization and removed-reference checks; this is not evidence of public disclosure.
- Resolution: the verified write runs under the ticket lock after binding/replay/expiry checks, followed by a second expiry check and atomic attachment. Cleanup acquires the same lock before checking references and deleting bytes, then revalidates claim ownership. S3 write/delete deadlines remain 20 seconds; media transactions alone receive a 60-second total and transaction-local 30-second idle budget. This deliberately holds a bounded database connection through storage to serialize shared-key mutations.
- Verification: both initial regressions failed before the fix. The final **65-test** PostgreSQL/media/worker run includes five new confirmation/cleanup cases and the six SEC-017 regressions. Build, typecheck, lint, affected-file formatting and secret scanning passed. No migration or API contract changed. Deploy/drain API and general workers together. Real provider uncertainty, connection/process failure and concurrent-upload acceptance still require REL-01; no live Spaces result is claimed. See [lifecycle acceptance](backend/docs/managed-media.md#confirmation-and-cleanup-serialization-9-october-2026).

### SEC-019 — Missing storage fabricated private-file verification (resolved locally)

- Severity: Medium (evidence integrity in runtimes without a configured bucket; production already requires storage configuration).
- Evidence: [real default adapter](backend/src/providers/storage/s3-object-storage.adapter.ts:219), [configuration rejection before verification](backend/src/providers/storage/s3-object-storage.adapter.ts:107), [safe handover propagation](backend/src/modules/vehicle-sales/vehicle-sales.service.ts:777), and the new missing-storage unit/database tests.
- Reproduced behavior: when no bucket was configured, the default adapter returned fabricated upload/download/view URLs and `verifyObject()` returned `true` without inspecting any bytes. Document and financial-evidence workflows could therefore record references to files that had never been uploaded. Other review/settlement controls remained in place; this finding does not claim unauthorized settlement or public file access.
- Resolution: runtime always uses the real adapter. Missing storage returns safe 503 `PROVIDER_UNAVAILABLE`; managed images retain `MEDIA_STORAGE_UNAVAILABLE`. Test storage is explicitly injected. The vehicle lifecycle fixture supplies actual matching bytes, and handover storage failures no longer become invalid-ticket conflicts. Contracts describe the unavailable state, and frontend types were regenerated.
- Verification: five regressions failed before the fix; 34 focused workflow/security tests passed afterward, followed by the expanded two-case database check and five OpenAPI tests. Backend build/type/lint/format/secret, contract/route checks and frontend typecheck passed. No migration or deployment occurred. See [verification and rollout](backend/docs/private-storage-availability.md). Real Spaces acceptance remains deferred.

### SEC-020 — Notification retries reported success without recovering delivery (resolved locally)

- Severity: Medium (notification availability and operational state integrity).
- Evidence: [atomic retry](backend/src/modules/audit/audit.service.ts:208), [request bounds](backend/src/modules/audit/audit.schemas.ts:95), [PostgreSQL and HTTP regressions](backend/tests/integration/notification-retry.test.ts), and [acceptance record](backend/docs/notification-retries.md).
- Reproduced behavior: retry reset only the outbox event, leaving its delivery in DEAD_LETTER where the worker could not claim it. Zero-attempt dead letters were also rejected by the API and hidden from the dashboard retry action. Inconsistent completed/active/missing deliveries could incorrectly produce a successful retry response and audit.
- Resolution: reset matching failed delivery and outbox states atomically with the audit, preserving attempts and provider idempotency keys. Reject inconsistent or completed deliveries without committing changes. Accept legitimate zero-attempt retries and align the dashboard. Existing authentication, MFA, CSRF, rate limits and worker consent checks remain intact.
- Verification: seven initial regressions failed; ten final retry cases plus 30 existing regression cases passed. Backend static/build/contract checks passed. Live provider delivery, previously stranded records and worker lease completion races remain separate audit/deployment boundaries; see the acceptance record.

### SEC-021 — Stale messaging workers could overwrite newer delivery attempts (resolved locally)

- Severity: Medium (delivery integrity and repeated-message risk).
- Evidence: [lease renewal](backend/src/workers/messaging-claim.ts:4), [identity worker](backend/src/workers/outbox.worker.ts:123), [notification worker](backend/src/workers/notification.worker.ts:111), and [PostgreSQL concurrency tests](backend/tests/integration/messaging-concurrency.test.ts).
- Reproduced behavior: old provider success/failure overwrote a newer PROCESSING attempt; notification attempt counts could regress. A retained batch could send a message already completed by another worker. Non-UTC database sessions also skewed lease and retry comparisons against Prisma UTC timestamps.
- Resolution: renew and finalize only the recorded attempt still owned by the worker, skip superseded batch entries, and commit notification outbox/delivery changes together or neither. Use explicit UTC for the two messaging claim/scheduling paths. No authentication, consent, encryption or provider activation changes.
- Verification: eight concurrency cases failed initially; fourteen final concurrency/timezone cases and 37 existing identity/notification/retry/security cases pass together (51 total) against real PostgreSQL with injected providers. All 50 migrations replayed in a new isolated database; typecheck, build, lint, format, diff and secret checks passed. See [worker acceptance and rollout](backend/docs/notification-retries.md#messaging-worker-ownership-repair--9-october-2026). In-flight provider uncertainty, historical stranded records and raw-SQL time handling elsewhere remain separate audit items.

### SEC-022 — Database session timezone changed security and financial deadlines (resolved locally)

- Severity: High (early security-throttle/idempotency cleanup and inconsistent financial eligibility under non-UTC database sessions).
- Evidence: [UTC pool configuration](backend/src/config/database.ts:21), [rate-limit windows](backend/src/common/middleware/postgres-rate-limit-store.ts:20), [database-boundary regressions](backend/tests/integration/database-time-boundaries.test.ts), and [clock contract/rollout](backend/docs/database-time.md).
- Reproduced behavior: Africa/Lagos sessions could delete unexpired authentication/MFA/idempotency records, dispatch future reminders/webhook retries early and shift alert/refund timestamps. New York sessions delayed eligible cleanup. A shared rate-limit window could reset when accessed from a connection with a different timezone. The refund authorization trigger also inherited the caller's clock interpretation.
- Resolution: application pool connections use UTC; runtime timestamp SQL explicitly uses UTC; additive migration `20261009160000_utc_refund_policy_clock` gives the existing refund trigger a local UTC setting without changing any authorization predicates. Historical values are not rewritten.
- Verification: sixteen clock and two refund baseline failures were reproduced. Twenty-eight new PostgreSQL cases passed across three session timezones, including rejection of premature reversal and protection against repeat refund submission. The full run had 643 passes, two discovery failures and four dedicated-database skips; the 26 discovery cases and four dedicated cases passed in separate follow-ups. See the linked acceptance record for exact run boundaries and remaining deployment/historical-data limits.

### SEC-023 — Stale booking-reminder attempts could overwrite newer work (resolved locally)

- Severity: Medium (reminder reliability and worker availability; no evidence of a role or financial authorization bypass).
- Evidence: [claim and completion ownership](backend/src/workers/booking-reminder.worker.ts:23), [concurrency regressions](backend/tests/integration/booking-reminder-concurrency.test.ts), and [acceptance and rollout](backend/docs/booking-reminder-ownership.md).
- Reproduced behavior: an old worker could enqueue or cancel under a newer attempt, or overwrite its active state with a delayed failure. Crash recovery exceeded the intended retry budget; a legacy twenty-attempt row aborted the claim for other valid reminders through a database constraint violation.
- Resolution: carry attempt ownership through the existing row-locked enqueue transaction and conditional failure write. Ignore superseded attempts in result counts. Dead-letter exhausted inactive work while preserving a fresh final lease and the existing eight-attempt budget.
- Verification: six initial failures reproduced; all eight final concurrency cases and 57 related booking, clock, worker and authorization tests passed. No schema/API change or live delivery. General-worker drain/restart and historical operator recovery remain deployment/operations work.

### SEC-024 — Webhook retries could lose ownership or bypass recovery decisions (resolved locally)

- Severity: Medium (payment-processing integrity and worker availability; existing receipt deduplication and financial authorization limited the impact).
- Evidence: [worker claims](backend/src/workers/webhook-retry.worker.ts:31), [transactional result guard](backend/src/modules/payments/webhook-claim.ts:17), [financial regression tests](backend/tests/integration/webhook-financial-ownership.test.ts), and [verification and rollout](backend/docs/webhook-retry-ownership.md).
- Reproduced behavior: delayed service completions and failures overwrote newer attempts; old batches still dispatched superseded events. The exhausted-job sweep targeted fresh final leases and omitted required failure timestamps. An audited manual retry after eight attempts could fail before processing. Duplicate callbacks could bypass queue timing or dead letters. A Monnify mismatch receipt was exposed to workers before its review hold committed.
- Resolution: carry event generation/status through conditional completion in the same transaction as financial writes; stale claims roll back. Renew owned batch items before dispatch; preserve fresh final leases and valid terminal timestamps. Acknowledge duplicate callbacks without reprocessing. Preserve cumulative attempts while permitting one explicitly audited retry after exhaustion. Persist mismatch receipts and review holds atomically.
- Verification: six baseline failures; 21 new PostgreSQL cases; 125 regression tests passed, followed by 46 claim/financial/clock tests after the final SQL timestamp adjustment. OpenAPI/handbook/frontend types regenerated with unchanged payload shapes. No provider activation, live payment or deployment; restart API and general workers together.

### SEC-025 — Refund observations crossed provider boundaries or lost review state (resolved locally)

- Severity: High (financial-state integrity when a Paystack event's refund identifier matched a refund belonging to another provider; verified provider events are required).
- Evidence: [provider-bound correlation and callbacks](backend/src/modules/payments/payments.service.ts:1324), [conflict recording](backend/src/modules/payments/refund-observation.ts:23), [reconciliation state check](backend/src/workers/refund.worker.ts:126), and [database regression cases](backend/tests/integration/refund-observation-integrity.test.ts).
- Reproduced behavior: Paystack resource-ID lookup could match a Monnify refund; conflicting completed-refund observations were ignored or caused a database error. Later callbacks and in-flight polls could reopen or overwrite a review hold. PostgreSQL already prevented direct rewrites of succeeded financial fields; no successful bypass of that trigger is claimed.
- Resolution: constrain Paystack correlation to Paystack attempts, record conflicting observations without rewriting completed refunds, preserve review holds on non-success callbacks, and re-read refund status after provider polling before changing it. Existing approval, ledger uniqueness and database immutability controls remain in place.
- Verification: 14 initial failures plus three additional hold-case failures reproduced; all 21 focused refund cases pass after repair. Broader results and rollout boundaries are recorded in [refund observation acceptance](backend/docs/refund-observation-integrity.md). No new migration, provider activation, money movement or deployment.

### SEC-026 — Vehicle reservations trusted customer-supplied agreement versions (resolved locally; business content pending)

- Severity: Medium (acceptance evidence and reservation-workflow integrity).
- Evidence: [agreement validation](backend/src/modules/vehicle-sales/reservation-terms.ts), [reservation transaction](backend/src/modules/vehicle-sales/vehicle-sales.service.ts:488), [database safeguards](backend/prisma/migrations/20261011180000_vehicle_reservation_terms/migration.sql), and [HTTP/database cases](backend/tests/integration/reservation-terms.test.ts).
- Original behavior: a customer could supply any non-empty version string to reserve an agreed vehicle. No published document established what the customer accepted, and the acceptance metadata was not frozen independently of payment activity.
- Resolution: reuse Super Admin policy publication with immutable approved content, expose an owner-scoped agreement read, validate the current document under a publication lock, link the accepting customer and document, and protect that evidence in PostgreSQL. Retained original-key retries survive later withdrawal while changed requests conflict. Existing historical metadata is preserved without fabricated agreement text.
- Verification and remaining boundaries: 52-migration replay and an additive upgrade preserving four historical synthetic records passed. Backend checks and subsequent owner/customer local browser/API/database acceptance passed; see [acceptance and rollout](backend/docs/vehicle-reservation-terms.md). On 12 October the owner confirmed the business agreement remains unapproved. Approved wording and deployment remain open. No production terms, provider activation or live reservation was created.

### SEC-027 — Storage verification and body consumption lacked complete bounds (resolved locally)

- Severity: Medium (availability and safe failure handling for evidence uploads, media reads and cleanup).
- Evidence: [S3 adapter](backend/src/providers/storage/s3-object-storage.adapter.ts), [complete operation deadline and bounded reader](backend/src/providers/storage/storage-io.ts), [fault-injection tests](backend/tests/unit/storage-io-bounds.test.ts), and [real SDK/loopback HTTP tests](backend/tests/unit/storage-http-bounds.test.ts).
- Reproduced behavior: private verification had no abort deadline and buffered an entire signature response; a provider ignoring Range could exceed the intended 16 bytes. Managed reads could await cancellation indefinitely and did not cancel a body rejected by Content-Length. Provider/configuration faults were returned as invalid-file results. Eleven new assertions failed against the old code.
- Resolution: one 20-second deadline covers verification metadata and signature reads, and each managed read/write/delete operation. It aborts transport and bounds caller completion even when the transport or cancellation ignores abort. Reads enforce byte limits before collecting extra chunks and cancel discarded responses. Verification returns false for missing/invalid bytes and safe retryable `PROVIDER_UNAVAILABLE` for outages; media retains its existing error codes. No provider detail is attached to the returned error.
- Verification: all 48 tests across ten files passed, including fault injection, real SDK/loopback HTTP, private evidence replay, media confirmation/cleanup concurrency, refunds and disputes against isolated PostgreSQL. Backend typecheck/build/lint, affected formatting, secret scanning, OpenAPI validation (266 paths), mounted-route coverage (315 operations plus four infrastructure routes), regenerated frontend contracts and frontend typecheck passed. See [acceptance and rollout](backend/docs/private-storage-availability.md). No migration, real bucket call, configuration change or deployment. A timeout does not prove a remote write/delete failed; callers must retain existing reconciliation and orphan-cleanup behavior.

### SEC-028 — Concurrent refund polls could replace newer retry decisions (resolved locally)

- Severity: Medium (refund workflow integrity and availability).
- Evidence: [refund worker](backend/src/workers/refund.worker.ts:108), [callback handling](backend/src/modules/payments/payments.service.ts:1272), [additive migration](backend/prisma/migrations/20261012180000_refund_poll_ownership/migration.sql:1), and [PostgreSQL regressions](backend/tests/integration/refund-poll-ownership.test.ts).
- Reproduced behavior: due refunds were discovered without ownership; overlapping workers could poll the same record and count failures from stale snapshots. A discovered row was still polled after another process rescheduled it. A delayed failure could replace a newer pending observation's schedule and retry count.
- Resolution: claim each poll with a UUID and expiring UTC lease, recheck eligibility before provider I/O, and verify ownership under the row lock for success/failure writes. Callback decisions revoke older polls. Exhaustion retains counts and protects live claims; new internal claim fields are excluded from API responses. Conflicting observations remain auditable without rewriting settled refunds.
- Verification: the final 83-case database regression and separate 27-case security/financial-transaction follow-up passed without skips (110 tests across 16 files). All 53 migrations replayed, and an additive upgrade preserved 111 historical synthetic refunds and ledger data. Prisma, typecheck/build/lint, affected formatting, secret scanning, OpenAPI/route coverage and diff checks passed. See [behavior and rollout](backend/docs/refund-poll-ownership.md). No live provider call or deployment is claimed.

### SEC-029 — Batch refund dispatch could bypass a later review hold (resolved locally)

- Severity: High (external money movement after a dispute or review decision).
- Evidence: [dispatch worker](backend/src/workers/refund.worker.ts:44), [authorization and receipt recording](backend/src/modules/payments/refund-dispatch.ts:14), [dispute ordering](backend/src/modules/payments/payments.service.ts:1481), and [database regressions](backend/tests/integration/refund-dispatch-boundary.test.ts).
- Reproduced behavior: every batch item was marked as submitted before its network call. Later items were still sent after a dispute or review hold arrived while the first call was waiting. A late successful submission response was discarded after recovery changed the status. All four baseline cases failed.
- Resolution: claim and recheck each item immediately before submission, order dispute observations against dispatch authorization, refuse expired dispatch windows, retain late receipt identities without releasing review holds, and preserve conflicting identities as anomalies without rebinding another refund. Database retries exclude external provider calls.
- Verification: the expanded 82-case database regression and final 10-case dispatch run passed without skips (83 unique tests). The added cases prove dispute transaction ordering, expired dispatch refusal, late receipt retention, identity conflict handling and receipt-transaction retry without duplicate provider submission. Backend typecheck/lint/build, formatting, secrets, OpenAPI/route and diff checks passed. See [behavior and rollout](backend/docs/refund-dispatch-boundary.md). No external provider call, application database change or deployment is claimed.

### SEC-030 — Conflicting dispute callbacks could alter another payment's dispute (resolved locally)

- Severity: High (financial correlation and immutable outcome integrity).
- Evidence: [dispute handler](backend/src/modules/payments/payments.service.ts:1447), [database guard](backend/prisma/migrations/20261012200000_dispute_resolution_integrity/migration.sql:1), and [regressions](backend/tests/integration/dispute-observation-integrity.test.ts).
- Reproduced behavior: an existing provider dispute ID accepted a status change despite a conflicting payment reference, amount or currency. Later callbacks changed resolved metadata, and the database permitted direct outcome/time rewrites. All 14 baseline cases failed.
- Resolution: require matching recorded identity before changing an open dispute; retain conflicting observations as anomalies; preserve the first resolved row and ledger; make anomaly retention conditional on webhook transaction ownership; and enforce resolved outcome/time immutability in PostgreSQL.
- Verification: the 127-case regression and final 17-case dispute run passed without skips (128 unique tests). All 54 migrations replayed, and an additive upgrade preserved 12 historical synthetic disputes plus ledger data. Typecheck/lint/build, formatting, secrets, OpenAPI/route coverage and diff checks passed. See [acceptance and remaining provider work](backend/docs/dispute-observation-integrity.md). BG-12 provider payload/status normalization is addressed by SEC-031 below; deployed acceptance remains open.

### SEC-031 - Paystack dispute contract could reject real events or overstate a partial loss (resolved locally)

- Severity: High (financial amount and provider-state integrity).
- Evidence: [provider normalization](backend/src/providers/payments/paystack-dispute.ts), [adapter](backend/src/providers/payments/paystack.adapter.ts), [signed HTTP tests](backend/tests/integration/paystack-dispute-contract.test.ts), and [acceptance record](backend/docs/paystack-dispute-contract.md).
- Resolution: fetch every raw dispute event and durable retry from the authenticated provider API, validate environment and capture identity, map documented provider states, preserve ambiguous resolutions for review, and record only the confirmed chargeback amount. Changed reminders receive distinct receipt identities. Stale observations and resolved conflicts cannot overwrite financial history. The database additionally protects resolved chargeback amounts.
- Verification: 154 backend regression cases plus a final 41-case run (159 unique cases), six frontend unit cases, 14 browser scenarios, 55-migration replay and an upgrade preserving 12 disputes and 52 ledger entries passed. Provider test/live acceptance and deployment remain required. Unknown provider outcomes remain under review; merchant decline is not treated as a win.

### SEC-032 - Provider body buffering and cancellation could exhaust resources (resolved locally)

- Severity: Medium; availability impact depends on a slow, malformed or faulty upstream transport.
- Evidence: [shared HTTP guard](backend/src/providers/provider-http.ts:2), [bounded byte reader](backend/src/providers/provider-http.ts:47), [adversarial regressions](backend/tests/unit/provider-http-bounds.test.ts), and [real HTTP tests](backend/tests/unit/provider-http-loopback.test.ts).
- Reproduced behavior: all eight initial cases failed. Payment adapters buffered complete bodies before checking their limit, and messaging adapters could wait indefinitely on cancellation after headers. A transport ignoring abort also kept callers pending.
- Resolution: independent request deadline plus abort, streaming decoded-byte limits, non-blocking cancellation, late-header disposal and shared adoption across Paystack, Monnify, Resend and Termii. No request retries or provider activation changes were introduced.
- Verification: 36 focused transport cases within a 154-case, 14-file regression passed without skips. Typecheck, lint, build, formatting, secrets, OpenAPI/route coverage and diff checks passed. See [acceptance and rollout](backend/docs/provider-http-availability.md). Staging provider acceptance and the broader audit remain open.

### SEC-033 - Raw exceptions and request paths exposed private values in logs (resolved locally)

- Severity: High (credential and personal-data confidentiality in operational logs).
- Evidence: [safe error projection](backend/src/common/observability/safe-error.ts:78), [logger serializer and hook](backend/src/common/observability/logger.ts:7), [HTTP error boundary](backend/src/common/middleware/error-handler.ts:19), and [emitted-log regressions](backend/tests/api/logging-privacy.test.ts).
- Reproduced behavior: all 11 baseline cases failed. Default serialization retained request bodies, Prisma invocation text, nested provider causes, arbitrary exception fields and raw URL values. Character-shape checks also accepted arbitrary error names/codes.
- Resolution: safe metadata projection at the HTTP boundary and logger sinks, fixed implicit error messages, recognized metadata allowlists, preserved migration guidance and matched route templates instead of raw paths. Existing request IDs, timing, statuses, worker diagnostics and field redaction remain available.
- Verification: 16 log privacy cases within 135 tests across 12 files passed with no skips. Typecheck, lint, build, formatting, secret scan, OpenAPI/route coverage and diff checks passed. See [acceptance and rollout](backend/docs/logging-privacy.md). Historical logs and deployment were not modified.

### SEC-034 - Profile updates lacked conflict checks and retained old phone verification (resolved locally)

- Severity: Medium (contact-data and verification-status integrity; no phone-based authentication bypass is claimed).
- Evidence: [profile update](backend/src/modules/customers/customers.repository.ts), [request contract](backend/src/modules/customers/customers.schemas.ts), [database guard](backend/prisma/migrations/20261013100000_customer_profile_revision/migration.sql) and [database/HTTP regressions](backend/tests/integration/profile-revision.test.ts).
- Source review: profile text writes matched only the owner and had no revision precondition. Replacing the phone did not clear its previous verification timestamp.
- Resolution: required owned-profile revision, atomic compare/increment with transactional audit, explicit stale-write rejection, independent media revisions and phone-change verification invalidation. Browser drafts retain their original revision and require saved-value review after conflicts or uncertain outcomes, including after reload.
- Verification: 21 new cases within 74 unique passing backend regressions, 430 frontend unit tests, fresh 56-migration replay and an upgrade preserving 5,347 existing synthetic profiles. Real browser/API conflict and dropped-response recovery passed. See [acceptance and rollout](backend/docs/customer-profile-revisions.md). Deployed verification remains open; older unversioned API writers must be drained.

## Historical application review — 10 September 2026

## Executive summary

The backend is designed around an Express 5, Prisma 7, and PostgreSQL trust boundary. The reviewed release uses opaque, server-side sessions rather than browser-stored bearer tokens; synchronizer CSRF protection; default-deny role, ownership, and branch policies; mandatory MFA assurance for privileged access; strict Zod input contracts; transactional business operations; and redacted structured logging.

No credential or private-key file is tracked, and both the current-tree and Git-history secret guards pass. The new customer-review implementation supports separately rated overall-business and verified-purchase product reviews. Product eligibility, one-review-per-customer/product, moderation, and immutability are enforced in both application code and PostgreSQL. The customer-care messaging surface enforces thread ownership or staff scope, hides internal messages from customers, disables private-response caching, and uses bounded cursor polling.

No unresolved critical or high-severity application-code vulnerability was found in this pass. One npm-rated high transitive advisory remains in the Prisma CLI configuration toolchain. It is documented below because npm currently offers only an incompatible forced downgrade, not a safe upgrade. Staging still requires browser, Cloudflare/Vercel proxy, database-TLS, object-storage, and provider validation with real infrastructure.

OAuth, Google sign-in, and JWT access tokens were not added. They are not needed for the current browser application and would add token, account-linking, redirect, and key-rotation attack surfaces without replacing the existing session and CSRF requirements.

## Verified security controls

- `backend/.env` is ignored and untracked. `.env.example` contains placeholders and documented non-secret settings only.
- `npm run check:secrets` and `npm run check:secrets:history` scan for forbidden environment files, private keys, credential-bearing URLs, provider credentials, JWTs, and credential-shaped literals.
- The API disables Express fingerprinting, uses explicit trusted-proxy hop counts, Helmet, exact credentialed CORS allowlisting, bounded JSON parsing, isolated raw Paystack webhook bytes, and private/no-store API caching (`backend/src/app.ts`).
- Session cookies are `HttpOnly`, `SameSite=Lax`, path `/`, have no `Domain`, and are `Secure` in production (`backend/src/common/security/cookies.ts`). Session and CSRF values are stored only as purpose-separated HMAC hashes.
- Authenticated mutations require a session-bound CSRF header plus trusted Origin and fetch-metadata validation (`backend/src/common/middleware/csrf.ts`).
- Passwords use Argon2id. Password, token, cookie, authorization, MFA, payment, personal-data, and storage-key paths are redacted from logs.
- Privileged access requires an active user, an unexpired/revocable opaque session, role/branch policy approval, and completed MFA assurance.
- Paystack webhooks are signature-verified over their exact raw bytes before trusted parsing. Event deduplication, amount/currency/reference validation, locking, immutable ledger entries, anomalies, and four-eyes refund/manual-payment decisions protect settlement.
- Provider adapters use fixed or allowlisted HTTPS origins, request timeouts, bounded responses, redacted errors, and retry classification. Staging enforces Paystack test mode; live keys require explicit production enablement.
- Private vehicle/payment assets use validated content metadata, generated storage keys, authorization-gated short-lived access, and never return underlying object keys.
- PostgreSQL constraints and triggers protect non-negative inventory, integer-kobo totals, lifecycle transitions, append-only financial/inventory/audit history, active reservation uniqueness, review eligibility, and immutable approved review targets.

## Review and customer-care controls

### SEC-007 — Product-review eligibility and immutability

- Status: Resolved
- Severity before mitigation: High
- Evidence: `backend/src/modules/support/support.schemas.ts`, `backend/src/modules/support/support.service.ts`, and `backend/prisma/migrations/20260910101000_product_reviews/migration.sql`.
- Resolution: A product review requires a 1–5 rating, the target product, and a completed order item owned by the authenticated customer. PostgreSQL independently verifies the same relationship. A partial unique index enforces one product review per customer/product, and target/rating/content fields are immutable after creation. Only approved reviews are public, and their projection excludes customer identity.

### SEC-008 — Overall-experience review boundary

- Status: Resolved
- Severity before mitigation: Medium
- Evidence: `backend/src/modules/support/support.schemas.ts` and the review moderation service.
- Resolution: Overall experience uses the distinct `BUSINESS` review target and requires a 1–5 rating. It follows the same customer authentication, moderation, public projection, audit, and immutable-content controls as other reviews.

### SEC-009 — Customer-care message isolation

- Status: Resolved
- Severity before mitigation: High
- Evidence: `backend/src/modules/support/support.routes.ts`, `support.service.ts`, `support.repository.ts`, and `support.controller.ts`.
- Resolution: Customers can read or append only their own enquiry/complaint threads. Staff access is role- and branch-scoped. Internal messages are removed from all customer queries. Cursors must belong to the authorized thread, writes to closed threads fail, bodies and page sizes are bounded, mutations require CSRF, and message responses use `private, no-store`. Assigned staff/customer notifications use the transactional outbox.

### SEC-010 — Cross-instance real-time delivery decision

- Status: Safely bounded
- Severity: Informational
- Resolution: The initial chat experience uses five-second bounded cursor polling. It works through Vercel forwarding and multiple App Platform instances without sticky sessions or an in-memory connection registry. WebSockets or server-sent events should be introduced only with a shared event backbone, authenticated connection revalidation, origin enforcement, connection/message quotas, and confirmed proxy support.

## Residual findings and deployment validation

### SEC-011 — Prisma CLI transitive dependency advisory

**Historical finding: resolved locally on 9 October 2026 by SEC-014 above.**

- Status: Accepted temporarily; upgrade watch required
- npm severity: High; assessed runtime exposure: Low when runtime images exclude the Prisma CLI
- Dependency path: `prisma@7.10.0 > @prisma/config@7.10.0 > deepmerge-ts@7.x`
- Advisory: `deepmerge-ts` can exhaust the stack while merging attacker-controlled recursive object graphs. The application does not accept untrusted Prisma configuration objects, and Prisma CLI execution is limited to controlled development, CI, and migration jobs.
- Action: Upgrade Prisma when a compatible stable release resolves `deepmerge-ts < 8`. Do not run `npm audit fix --force`; the current proposed remediation is an incompatible Prisma 6 downgrade. Keep the migration image private and short-lived, and verify that API/worker runtime images omit the CLI.

### SEC-012 — Staging edge and browser validation

- Status: Requires deployed infrastructure
- Severity: Medium until validated
- Required checks: exact Cloudflare/Vercel/App Platform proxy topology and hop count; HTTPS redirect and forwarded-protocol behavior; PostgreSQL `verify-full` CA validation; private Spaces permissions and signed-access expiry; Paystack test-mode webhook delivery; cookie `Secure`/`SameSite` behavior; CSRF Origin/fetch-metadata rejection; cache bypass for sessions and private API responses; hosted Swagger disabled; and a nonce-based frontend CSP tested in report-only mode before enforcement.

## Verification record

The release gate includes migration replay from an empty PostgreSQL database, Prisma validation/status, strict TypeScript compilation, lint and formatting checks, OpenAPI generation/validation, unit/API/integration/security tests, current-tree and history secret scans, `git diff --check`, production builds, and container smoke tests. Results and any environment-dependent exclusions are recorded in `backend/docs/backend-completion-staging-readiness.md`.

## Service discovery security verification - 9 October 2026

API-03 adds anonymous bounded service/category reads and MFA-protected Admin/Super Admin category administration. Category writes require trusted-origin CSRF, updates require an expected version, and committed changes are audited under SERVICE_CATEGORY. Assignment validation shares a transaction lock with category archival. Staff, customer, anonymous, pending-MFA and invalid-CSRF requests were rejected in integration tests. Inactive services remain private; archived category metadata is removed from public service projections without changing service publication or bookings.

Search inputs are bounded, control-character checked and parameterized with literal wildcard escaping. Sorting is allowlisted; cursors are signed, purpose/filter-bound and checked before querying subsequent pages. Page/count reads share a repeatable-read transaction. Real PostgreSQL tests cover forged/cross-filter cursors, deleted UUID anchors, stale changes, duplicate slugs, archive semantics, 10,000 services and selective search index use. All 34 focused backend tests and 23 final browser scenarios passed; frontend unit suite: 357 passed. Prisma/type/lint/format/OpenAPI/route/secret checks passed. This is local feature acceptance, not a replacement for the outstanding full release and deployed infrastructure acceptance gates.
