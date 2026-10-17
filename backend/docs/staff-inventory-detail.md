# Inventory detail access, private responses and frontend recovery

Locally verified 17 October 2026 with frontend
[gate 64](../../frontend/docs/page-quality/work-inventory-detail.md).

The Staff inventory router now explicitly applies `Cache-Control: private, no-store`
to authenticated/authorised router responses, including direct inventory, history,
reservations and successful stock/threshold mutations. The list's existing private
behaviour is retained. No endpoint, response field, schema or migration was added.

Existing service rules remain authoritative: assigned active Staff branch, role/MFA,
current stock and reservation expiry, atomic balances, idempotency fingerprints and
versioned threshold updates. Administrators retain historical inactive-branch reads.
Inventory movements do not create customer orders, invoices or payments. New
reservations require an active branch and product; frontend availability follows
those existing rules without inventing restrictions on physical stock movements.

The frontend checks a fresh record/current identity before POST/PATCH, rejects
changed review snapshots and validates returned scope, balances and operation
receipts. Same-request in-memory retries retain the original body/key and use the
existing idempotent backend path. Minimal account/inventory session markers persist
unknown-outcome locks through reload. Read-only reconciliation loads current stock,
reservations and recent history, never replays a write and does not claim to identify
which request changed stock. The existing recent-history window is not a durable
original-request receipt lookup. Threshold updates remain versioned, without
automatic replay. Interrupted original-request retries and timeout/throttled
responses retain the pending lock; a rejected retry cannot prove that the original
request did not commit. The same response handling is used for inventory creation.

One new database-enabled boundary case passed: permitted detail/history/reservation
reads, private headers, foreign Staff denial, private versioned threshold response,
inactive Staff branch denial and administrator historical access. Eight unchanged
phase-four stock/API/policy regression cases have passing evidence from gate 63;
their business implementation did not change and they were not rerun unnecessarily.

Real production-browser/Express/PostgreSQL verification passed Staff stock receipt,
reservation, release and threshold update; cancellation with zero writes; committed
receipt-response loss with same-key replay; a second committed-response loss with
reload lock and explicit read recovery. Six mutation attempts produced five audited
changes and four stock transactions. On-hand finished at 12, reserved at zero and
threshold at eight; no customer order was created. Customer reads were denied and
all inspected reads were private no-store. Browser errors were zero. The initial
helper stopped on an ambiguous label locator; its corrected run completed.

Backend lint/typecheck and scoped formatting passed. The mounted routes, request
schemas and generated OpenAPI/type shapes are unchanged, so no contract regeneration
or unrelated migration replay was required. Frontend browser/unit/static/visual
evidence is recorded in gate 64. Deployed role/branch, cache and recovery acceptance
remain open.

Verification used only the preceding gates' isolated
`allied_work_aftercare_20261017_test` database on `127.0.0.1:55480`, with target
identity checked before helper writes. Existing 58-migration replay, db:check and
restricted-runtime verification were reused because the schema did not change.
Domain fixtures remain preserved; helpers remove only their own synthetic sessions.
No application/shared/staging/production data or grants changed. No migration,
backup operation, restore rehearsal, off-device recovery verification or deployment
occurred.
