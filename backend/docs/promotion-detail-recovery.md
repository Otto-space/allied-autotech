# Promotion detail and zero-value configuration

`GET /admin/promotions/{promotionId}` and versioned
`PATCH /admin/promotions/{promotionId}` retain their existing contracts. Admin/Super
Admin, verified MFA, trusted-origin/CSRF protection for writes and private no-store
responses remain required. There is no new endpoint or permission expansion.

The frontend now directly reads and validates the requested record rather than
relying on a catalogue page. Before a reviewed PATCH, it checks current active
administrator identity and a fresh complete record snapshot. A changed snapshot
blocks submission and preserves the draft. The backend row lock and expectedVersion
check independently serialize competing writes; exactly one matching version wins.
The frontend validates the returned identity, version, amounts, dates and settings.
A confirmed response updates the overview without a redundant GET. Late reads from
before that write cannot replace its newer observed version. Denied/not-found reads
still remove private facts.

Uncertain PATCH results retain an owner/role/record-scoped pending marker containing
only the expected version. Reload does not clear it or resend a request. Explicit
Load current settings checks permission and reads the saved record, replaces the old
form draft and loads that observed version. This does not prove whether the earlier
operation committed. Every subsequent edit is reviewed and still uses the backend
version check. Older recovery reads and unavailable/corrupt storage fail closed.
408/429, malformed and contradictory success responses remain uncertain; a definite
first rejection releases only its own marker.

## Constraint correction

The existing API/form contract accepts nonnegative integer kobo, and checkout
already rejects a discount that evaluates to zero. Integration testing exposed that
two database checks still required strictly positive fixed discounts/caps, producing
500 for an otherwise valid zero configuration.

Forward migration
[`20261017153000_promotion_zero_value_configuration`](../prisma/migrations/20261017153000_promotion_zero_value_configuration/migration.sql)
widens only those comparisons from `> 0` to `>= 0`. Existing positive rows stay
valid. No rows, columns, tables, history or snapshots are removed or rewritten.
Negative amounts remain forbidden. PromotionUsage snapshot constraints and checkout
eligibility behavior are unchanged. Configuring zero does not grant a zero-value
promotion redemption.

The migration, schema note and API regression test are committed together as
`dd995b8c0d15444b5cf2d0d3e0db795b25c3007f`, as required by repository policy. The
Prisma client was regenerated. On the existing isolated test target, the reviewed
migration ran through **npm run db:migrate**, with verified fresh backup evidence,
history/checksum validation and post-migration schema checks. Before/after counts
and whole-table data hashes matched for Promotion, PromotionUsage, AuditLog, Order,
Invoice and InventoryTransaction. Restricted runtime ownership/DDL/TRUNCATE/role
flags were rechecked without changing grants.

All **59 migrations** also replayed on a separately created empty `_test` database,
and its `db:check` passed. These are local safety checks, not a production restore
rehearsal. Existing fixtures and both isolated databases were preserved. No shared
or application database was modified.

## Release acceptance still required

Deploy this compatible migration through the guarded migration command before
claiming zero-value configuration works on another environment. Confirm the exact
target and separate migration/runtime credentials; verify the required fresh backup
and schema/history checks. Replacing a CHECK takes a table lock and validates rows,
so review the target's promotion-table size and deployment lock window. Never edit
an applied migration or bypass drift/backup checks.

Before shared/production rollout, verify encrypted off-device backups, retention,
PITR where supported and a restore rehearsal into a separate database. The local
archive index/hash check does not establish recoverability. No shared rollout,
provider acceptance or production restore has been performed by this page gate.

Focused API coverage is in `tests/integration/promotion-detail.test.ts`; the
[frontend acceptance report](../../frontend/docs/page-quality/work-promotion-detail.md)
records exact browser, visual, real API/database and code-quality evidence.
