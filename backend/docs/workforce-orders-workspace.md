# Managed workforce order workspace

Implemented locally on 20 October 2026. Route `/admin/workforce/orders`, [milestone 109](../../frontend/docs/page-quality/workforce-orders.md). Deploy the compatible API before its frontend; deployed acceptance remains open.

## Contract and boundaries

`GET /staff/workforce/orders` combines current branch scope with optional literal `q` (1–120 printable characters), order status and fulfillment method. Existing UUID cursor paging remains, with default 25 and maximum 50 records. Search covers order numbers and product names; `%`, `_` and backslash are treated literally. The projection includes named branch, order reference, state, fulfillment method, payment-recorded timestamp, version, created/updated timestamps, product names/quantities and server-computed `availableNextStates`. It also returns current workforce access and server evaluation time.

`GET /staff/workforce/orders/:id` adds recorded confirmation, processing, readiness, completion and cancellation timestamps. A shared parent lock protects the current scoped read. Both endpoints require active managed access, MFA and ORDERS_READ, send private/no-store responses and atomically record minimal READ audits. Operations, Customer Service and Sales Supervisor retain their existing branch-scoped read permissions. Customer contacts, money amounts, policy/payment identifiers and internal notes are excluded.

Existing `PATCH /staff/workforce/orders/:id` requires ORDERS_PREPARE, CSRF, expectedVersion and a trimmed 10–1,000-character preparation reason. It takes the parent update lock before checking current branch, version, recorded payment, COLLECTION method and preceding state. Only CONFIRMED → PROCESSING → READY is supported. The atomic update and audit return current detail plus exact `action: prepare`, actor, previous version/status and reason. No release, delivery, cancellation, refund, payment or inventory action is added. No role/grant, schema or migration change is needed.

## Client guarantees and limits

Search, filters, paging and selected order use validated URL state. Missing, failed or mismatched access/detail responses hide private facts and actions. Harmless refresh retains preparation drafts; changed records require explicit adoption. Review shows the exact next state and reason, checks fresh access/current detail, then validates the returned receipt before showing success.

A minimal actor-bound request fingerprint is persisted before dispatch. Lost/malformed responses and post-dispatch 408/429 outcomes stay locked through reload; current inspection and independent reconciliation are required before releasing the browser lock. No automatic resend occurs. This does not provide a durable original-operation receipt or cross-device recovery; that remains an enhancement. Current record state alone cannot prove which interrupted request produced it.

## Verification and preservation

Six distinct API scenarios have passing evidence across guarded runs. Two initial setup transactions rolled back completely after synthetic delivery fields and terminal-state timestamps failed existing constraints. Once corrected, sequential preparation and concurrency/rejection cases passed with three retained updates. Read tests exposed and fixed a genuine route bug: generic list parsing rejected the new order filters before the dedicated schema ran. A disabled identity correctly returns 401 rather than the test's initial 403 expectation. The remaining scope test was redirected to an untouched fixture after earlier successful updates changed its original expectation. Successful mutations were never replayed.

Aggregate API evidence records 13 successful reads, three updates and 16 audits, unchanged original rows and unchanged owned financial/item fields, with zero owned temporary sessions. The final files are `workforce-orders-api-{completed,remaining,scope}-evidence.json` under `C:/Users/PC/.codex/`; setup rollback evidence is also retained.

Connected production Edge/Express/PostgreSQL verification at 430/1440px confirms real 25+8 paging/reload, exact preparation receipts, one normal update and one committed-lost-response recovery without replay. Two PATCH requests and 22 audited reads produce 24 audits. Original records and the two changed orders' financial/item fields remain hash-unchanged outside the intended preparation fields. Both orders advance once to PROCESSING/version 1; temporary sessions are removed. Evidence: `workforce-orders-real.json`, its guarded checkpoint/before files and screenshots. Do not replay the completed mutation harness.

The actual isolated target was verified before writes as `127.0.0.1:55480 / allied_work_staff_workforce_20261019_test`. Runtime privileges exclude superuser, role/database creation, replication, bypass-RLS, database/table ownership and TRUNCATE. Existing unchanged 60-migration replay/db:check evidence was reused. Synthetic order fixtures are populated; payment, refund and invoice tables in this target are empty, so this gate does not prove populated financial-ledger preservation. No application/shared database, schema/migration, existing grant, backup/restore, external provider, push or deployment operation ran.

Frontend evidence includes 24 page browser cases, nine affected regressions, nine units, seven responsive widths/Axe, four native/full-page comparisons and healthy final captures. Backend/frontend types, focused lint/format, generated contracts, 315-path OpenAPI validation, 370-operation coverage plus four infrastructure routes, production build and ten matching runtime/generated source hashes pass.
