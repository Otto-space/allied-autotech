# Promotion creation recovery

The administrator creation endpoint now supports an optional `Idempotency-Key`:
`promotion-v1.<13-digit issued milliseconds>.<UUIDv4>`. Existing unkeyed clients keep
their behavior. New frontend creation always sends an explicit `isActive: false`
unless the administrator enables it during review; the API's existing default is
unchanged.

Keys are non-bearer random references scoped to the authenticated administrator.
Admin/Super Admin and verified MFA are checked on every creation, replay and receipt
read. POST also requires the existing trusted-origin/CSRF checks. No permissions were
expanded. Administrator responses use `Cache-Control: private, no-store`.

Within one database transaction, an actor/key advisory lock serializes competing
requests. The normalized request hash, promotion creation, CREATE audit and minimal
`{resourceId}` receipt commit together. Normalization includes explicit null defaults,
uppercase validated codes and canonical instants. Amounts remain exact integer-kobo
strings. Reusing a key with different normalized input returns 409
`IDEMPOTENCY_CONFLICT`. Replaying matching input returns the **current** saved record
with `replayed: true`, without creating another promotion/audit or overwriting later
edits. A first keyed response includes `replayed: false`.

The reference expires 24 hours after its issued timestamp. A future timestamp beyond
the existing one-minute clock-skew allowance or an expired reference fails with 409
`IDEMPOTENCY_EXPIRED`, including when ordinary receipt cleanup has removed its row.
An old key can never silently become a fresh creation. Invalid key syntax is 422.

`GET /admin/promotions/creation-receipts/{requestKey}` is a read-only, actor-bound
recovery operation returning `{key, promotionId}`. Another administrator's reference
does not reveal its resource. A null ID means no committed receipt is visible at the
time of the read; it does **not** prove an earlier in-flight submission cannot still
commit. The frontend keeps the creation locked and offers review/retry of the same
original reference and payload within its window. Reload never automatically POSTs.

The frontend persists the pending intent before its POST. Confirmed recovery keeps a
minimal linked receipt and removes the old form draft, so creating another offer
starts cleanly. Session invalidation redacts stored input while retaining a lock.
Corrupt, expired or unavailable recovery state stays locked for record review.
An initial definite rejection can release its own marker; rejection of a subsequent
retry cannot disprove the earlier outcome and must preserve the original marker.
408/429 and malformed/contradictory success bodies retain uncertainty.

The existing `IdempotencyRecord` model is reused; no migration, grants or runtime
ownership change is required. Release the additive API contract before the frontend.
Do not mark deployed acceptance complete from these local checks. Verify real-role
MFA/CSRF boundaries, no-store headers, proxy response loss and receipt checks in the
target environment, including preserved edits and expired-reference handling.

Focused API integration coverage is in
`tests/integration/promotion-creation-recovery.test.ts`; frontend evidence is recorded
in [the creation page report](../../frontend/docs/page-quality/work-promotion-create.md).
Database verification uses the existing isolated `_test` database and restricted
runtime role. Application/shared databases are not test targets. Existing migration
replay evidence is reused because the schema is unchanged; current `db:check` verifies
all 58 applied migrations, checksums and schema compatibility without writes.
