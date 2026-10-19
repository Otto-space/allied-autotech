# Dispute handling workspace

The work queue uses the existing capability and assignment rules. `DISPUTE_MANAGE` is required for every role, including Admin and Super Admin. Staff additionally requires a primary or backup assignment. Assignment itself remains restricted to administrators. These rules are enforced independently by the backend.

## Private reads

- `GET /staff/disputes` keeps its existing strict `openOnly`, `cursor` and `limit` query and creation-order cursor semantics. A successful bounded read now records a minimal `DISPUTE_WORK_QUEUE` READ audit with returned count.
- `GET /staff/disputes/:id` returns the existing safe work-record projection, independent of the loaded queue page. It validates the UUID and empty query, checks current capability and Staff assignment, and records `DISPUTE_CURRENT` against that record. Raw source reason, evidence object key and hash are excluded.
- `GET /staff/disputes/operators` is restricted to Admin/Super Admin with the live capability. It returns only `{id,label}` candidates who are active, email verified, non-customer accounts with an unrevoked dispute-management grant. It supports bounded `limit` (1–50/default25), UUID cursor and optional trimmed `q` (1–100) matching name/email. ID order provides deterministic cursor paging. Labels reuse the existing authorized operator identity presentation. Its minimal READ audit contains resource and returned count, never the search text or candidate list.

All dispute routes set `Cache-Control: private, no-store`. Read authorization, projection and audit are performed within a Repeatable Read transaction. Existing action endpoints reject unsupported query parameters. Assignment eligibility remains independently checked inside the original locked write transaction.

## Preserved behavior

No schema, migration, existing database grant, payment calculation, provider settlement rule or ledger behavior changes. Existing optional `expectedUpdatedAt` remains compatible; the frontend always sends the current expected version. Closed history is immutable. Original evidence cannot be replaced. Actual uploaded object metadata/hash verification remains required. A provider submission receipt records staff evidence of submission; it does not prove provider acceptance or return money.

Acknowledgement and submission notes remain audit-only. A current read does not prove the original interrupted request finished or that its note was recorded. Recovery must not infer an original request receipt from matching current facts.

## Verification so far

Three focused integration cases passed on the confirmed isolated `127.0.0.1:55480 / allied_work_aftercare_20261017_test` target under restricted runtime credentials. They cover live capability and assignment boundaries, Admin/Super Admin without grants, Customer/unverified/anonymous denial, safe projection, exact maximum integer-string money, strict queries, eligible search/paging, READ audits, closed history and stale writes. Existing payments, attempts, refunds, invoices, ledger entries and pre-existing disputes were hashed and preserved. Only new synthetic operators/capabilities and two synthetic disputes were added; owned temporary sessions were removed. No application database was written.

OpenAPI validation passed for 303 paths; route coverage matched 357 documented operations plus 4 infrastructure routes. Generated frontend types were refreshed. No migration replay, target migration or restore rehearsal was rerun because there is no schema change.

Connected production Edge/API/PostgreSQL passed assignment with committed response loss and reload/reconciliation without replay, assigned-Staff acknowledgement, actual byte/hash-verified private upload and evidence attachment, provider receipt and audited evidence link. Four mutation writes produced four DISPUTE_UPDATED audits; upload preparation and evidence access were separate POSTs. Nine record READ audits were recorded. All 28 prior disputes and 38 payments/38 attempts/31 refunds/37 invoices/eight ledger rows were preserved, and all four owned temporary sessions were removed. One additional synthetic dispute was retained. Storage used an explicit in-memory test port; external S3, actual provider submission and following the generated download link were not exercised. The frontend passed [local gate 86](../../frontend/docs/page-quality/work-dispute-handling.md); deployed acceptance remains open.
