# Managed workforce complaint workspace

Milestone 108; locally accepted on 20 October 2026. Route `/admin/workforce/complaints`; application-wide and deployed acceptance remain open.

## Contract and permissions

GET `/staff/workforce/complaints` preserves UUID ascending paging (limit 1–50, default 25) and adds optional trimmed printable q (1–120), priority LOW/MEDIUM/HIGH/URGENT and status OPEN/INVESTIGATING/RESOLVED/CLOSED. Search combines literal terms across subject, description and CUSTOMER-visible messages. INTERNAL message content cannot influence discovery. Minimal named branch, branchId, updatedAt, active access and generatedAt accompany existing fields.

GET `/staff/workforce/complaints/:id` returns the same scoped record, acknowledgedAt, acknowledgementDueAt, escalatedAt, resolution, resolvedAt, closedAt, latestMessageId and paged customer-visible history. History uses createdAt/id descending ordering, cursor ownership/visibility checks and a shared parent lock. Author user IDs become isOwn flags. Contacts, customer/related transaction identifiers, assignment identities and SLA policy snapshots are excluded. Each successful collection/detail read emits a result-count READ audit. Private no-store remains enforced.

POST `/staff/workforce/complaints/:id/replies` retains expectedVersion and body (trimmed 1–5000) and accepts optional expectedLatestMessageId. The parent update lock serializes with existing customer/legacy writers before scoped state/version/latest-message checks. RESOLVED/CLOSED reject replies. The message, version increment and audit are committed atomically; exact additive receipt includes actor, branch, version, current access and customer-visible message. Older callers may omit the new precondition.

Current active CUSTOMER_SERVICE branch assignments and COMPLAINTS permission remain mandatory. Existing actor/MFA/CSRF, workforce locking and denied legacy-route boundary are preserved. No new permission, grant, database schema or migration is introduced. Managed acknowledgement, priority change, assignment and resolution actions remain unsupported and are not exposed by this interface.

## Verification

Backend type/lint, OpenAPI (315 paths)/route coverage (369 operations plus four infrastructure routes) and frontend generated contracts pass. Six isolated API scenarios have passing evidence across guarded runs: role/branch/minimal projection; literal search and paging; customer-visible history/tracking/cursor ownership; exact/stale/latest-message receipts; legacy compatibility/concurrent replies; closed/resolved/CSRF/validation rejection. Three successful replies produce three UPDATE audits; fourteen reads produce fourteen READ audits. Existing domain records remain unchanged and owned temporary sessions are removed.

The initial test-helper method typo prevented mutation dispatch. Guarded resume reused the same fixtures only after zero-write and preservation verification. A final rejection-only resume corrected the test's expected validation status from 400 to the existing 422 contract. No successful domain operation was repeated. Evidence files under `C:/Users/PC/.codex/`: `workforce-complaints-api-evidence.json`, `workforce-complaints-api-resumed-evidence.json`, `workforce-complaints-api-rejections-evidence.json` and corresponding logs/fixture checkpoint.

Actual target and restricted role verified before each run: `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`, no elevated role, database/table ownership or TRUNCATE privileges. Earlier unchanged migration replay/db:check evidence is reused. No application/shared database, schema/migration, existing grant, backup/restore, external provider or deployment operation ran. Financial fixture tables are empty; this is not new proof of populated financial preservation.

Connected production browser/API verification at 430/1440px confirms 25+8 scoped queue paging, 25+3 customer-visible history paging, recorded response tracking and two replies with exact message/audit correlation. One response was intentionally lost after commit; reload retained the uncertainty lock and independent reconciliation recovered without resending. Two writes plus 28 audited reads produced 30 audits. Original records outside intended owned changes remain unchanged; all temporary sessions were removed. Evidence: `C:/Users/PC/.codex/workforce-complaints-real.json` and its retained checkpoint/captures. No successful write was repeated during handoff.

The frontend gate includes 23 distinct browser cases, eight regressions, ten units, seven responsive widths with accessibility checks, final native comparisons, type/lint/format checks and the final production build. The 11-case final affected run includes post-dispatch 408/429 uncertainty recovery. Nine current runtime/generated source hashes match the tested production snapshot.

## Remaining boundaries

Browser recovery markers prevent automatic replay in the same browser session; they are not durable server operation receipts or cross-device recovery. Current facts alone cannot prove an earlier request's outcome. A future idempotency/receipt enhancement must atomically bind actor, complaint, request body, original outcome and audit, with current-scope lookup, retention and concurrent-request tests. New storage requires the mandatory forward-migration safety workflow.

Replies are recorded in the customer conversation; no external delivery guarantee is claimed. Deploy compatible backend contracts before the frontend, then perform target-environment role/session, history/search, reply and recovery acceptance. See the [final page acceptance](../../frontend/docs/page-quality/workforce-complaints.md) and [progress record](../../frontend/docs/page-quality/workforce-complaints-progress.md).
