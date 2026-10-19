# Workshop privacy review contract

Reviewed 18 October 2026. Route `/admin/privacy` is a capability-protected global
queue and inline review/retention workspace. Customer intake/history is separate.
Every Staff/Admin/Super Admin reviewer needs active PRIVACY_REVIEW and verified MFA;
role alone does not authorize access. No deletion/anonymization executor is enabled.

## Compatible discovery and privacy

`GET /staff/privacy-requests` retains cursor/limit and adds optional `kind`, `status`
and exact account `userId` filters. Customer queries remain unchanged. Newest-first
ordering uses createdAt/id; the UI requests25 records and uses persistent supported
filters, cursor trails and selected-request URL state. The API exposes references,
explanation, kind/status, creation/review timestamps and customer-visible review note;
the UI does not invent account names/contact data or aggregate totals.

`GET /staff/retention-holds?userId=...` still returns the latest 100 account holds,
including released entries, with deterministic createdAt/id ordering. It is a capped
projection, not proof that no older active hold exists. Approval checks all active
account holds and unresolved disputes independently of this displayed subset.

Both privileged collections now use private,no-store responses and minimal READ
audits: collection and returned result count, plus the exact account reference when
scoped. Explanation, response and hold reasons are not copied into read audits.
Mutation audits retain their existing documented purpose and fields.

## Lifecycle corrections

Privacy approval and account hold creation/release now share the existing
`privacy:<userId>` transaction advisory lock. Review retains its PrivacyRequest row
lock and exact `expectedReviewedAt` CAS; timestamps advance monotonically, including
milliseconds. A concurrent committed protection is visible before approval checks.
This serializes these privacy/retention operations; no claim is made that unrelated
financial dispute mutations use this lock.

Hold release checks the affected active row count. A competing or already released
hold returns409 without a second UPDATE audit or a claim that another justification
was recorded. A successful release adds safe `userId`, `releasedAt` and the exact
audited `releaseReason` beside existing `id`, enabling scoped/body validation.
Hold creation, release and review remain atomic with their audits. No schema,
migration, destructive operation or permission expansion is needed. OpenAPI and
frontend generated request/response types must ship with the compatible changes.

## Frontend guard and recovery boundary

Active own identity/capability gates all private reads. Exact requested account,
query, unique records/cursor and hold scope are validated. Temporary failures retain
labelled facts with writes blocked; denied permission, queue or hold reads remove
protected request content. The selected review/hold workspace keeps fields mounted
on timestamp changes and requires explicit response-field reload before re-review.

One parent review/single-flight guard coordinates customer-visible review, private
hold creation and documented release. A fresh actor/current filtered page/account
hold read precedes each write. A moved/missing request or changed review stops before
dispatch; no unsupported direct request read is invented. Exact scoped saved data,
review timestamp, customer note and audited release justification are validated.

Unknown outcomes retain minimal owner/role/request/account/operation markers across
reload; session invalidation redacts marker values while preserving the lock.
Explicit current queue/holds reconciliation replaces this page's unsaved fields
without replay or proof of the original outcome. Current response metadata is not
a durable original-request receipt. Approval records a decision only, leaving the
account and personal information intact.

## Remaining capabilities

- Optional durable mutation recovery needs actor/operation/request/account/body-bound
  original-request references, retention and authorized read-only lookup. Persist
  domain/timestamp/audit/receipt atomically and recheck current capability/MFA. Prove
  committed/uncommitted lost responses, parallel requests, changed bodies, different
  actors, revoked grants and exactly one mutation/audit. Deliver contracts and an
  explicit recovery UI together, using the mandatory forward-migration workflow if
  new storage is required.
- Full hold-history management needs an audited account-bound cursor collection or
  compatible direct lookup. The current latest 100 projection can omit an older
  active hold, which still correctly blocks approval. Preserve existing array clients,
  deterministic ordering, private reasons, full release scope and atomic audits.
  Prove >100 mixed active/released rows, paging, revoked grants, cross-account access
  and safe release of an older active hold. Do not silently claim all protections are
  displayed or bypass approval checks to work around the cap.
- Actual deletion/anonymization remains dependent on separately approved retention
  policy and an authorized execution workflow. No destructive executor is part of
  this page gate or implied by APPROVED_PENDING_POLICY.

## Verification and release boundary

Five new isolated API/database scenarios cover 25+3 filtered paging, exact account/
status/kind, minimal read audits/private headers, role/grant boundaries, monotonic
review CAS without deletion, exact hold creation/release, one audit under concurrent
release, a held-account-lock concurrent protection/approval race, and an older active
hold outside the displayed100 still blocking approval. Test fixtures verify the
actual isolated `_test` database before writes and preserve existing owners/grants;
only newly created reviewer grants are used.

Deploy the compatible backend and generated contract changes with the frontend and
verify capability/MFA, private reads, status/hold races, forms and recovery in the
target environment. No application/shared database, schema, migration, existing
grant, backup/restore or deployment operation is part of local page work. Unchanged
migration replay, db:check and runtime privilege evidence is reused; no new restore
test is claimed. Business retention approval and deployed/application-wide acceptance
remain separate.
