# Workshop review moderation contract

Reviewed 18 October 2026. `/admin/reviews` is a global Admin/Super Admin queue
with inline moderation. Verified MFA is required. Staff and Customers cannot read
the queue or direct moderation record; there is no additional capability grant.
Public/customer review creation, sources and original-request recovery are separate.

## Compatible discovery and current-record access

`GET /staff/support/reviews` keeps oldest-first createdAt/id ordering, supported
status and targetType filters, UUID cursor and the existing 50-record maximum.
Status defaults to PENDING. It adds optional exact `reviewId` filtering. The UI
requests 25 records and persists filter/cursor/selected-review state in the URL,
without forwarding client selection/trail fields to the API. Counts are page-local.

New `GET /staff/support/reviews/:reviewId` returns the same complete safe staff
projection independently of the current queue page/status. This supports current
state preflight and reconciliation after moderation removes a pending entry.
It requires the same administrator/MFA boundaries and an empty query. Collection
and direct reads are private, no-store and retain minimal privileged READ audits.

The shared staff projection includes customer first/last names, full review/source
references, named product/service, related order item/order number/booking completion/
vehicle purchase number, rating/content/status/version and exact timestamps. It
does not add customer account IDs, email, raw private media or moderator identity.
The UI does not invent customer links, purchase codes, profile photos, totals or
verified-purchase claims. Optional missing facts use honest labels.

## Atomic decisions and exact notes

Existing expectedVersion CAS and PENDING-only transitions remain authoritative.
Exactly one competing moderation can update the review and append STATUS_CHANGE
audit/notification records. Rejection requires a non-empty customer-visible note;
approval may omit it. Omitted note now explicitly records null rather than retaining
an unreviewed old pending note. This applies only to an intentional new moderation
request; no historical review backfill or automatic data rewrite is performed.

The safe mutation response is read inside its existing domain/audit/notification
transaction, before commit, rather than through a separate post-commit query. It
preserves all immutable feedback/source fields and returns status, version+1,
moderatedAt and exact selected nullable note. It omits customer/customerId and
moderator identity. Approval allows public display of review content. Moderation
notes remain private customer-account responses and are excluded from public reads.
An in-app notification is persisted; actual email delivery is not established here.

No schema, migration, permission expansion or destructive maintenance is required.
Deploy the compatible query/direct-read API and generated OpenAPI/frontend types
with the dependent frontend. No reopening, editing a terminal decision, bulk action
or unsupported public review detail route is introduced.

## Frontend review and recovery

Active own administrator identity gates private reads. Strict records validate the
requested reference, target-specific linked identities, unique chronological pages,
filters and advancing cursors. Full comments/source facts remain readable. Stable
moderation forms preserve fields on version changes and require an explicit reload.

A parent single-flight guard rechecks own access and the exact current review before
sending. It verifies full immutable content/source, current version, decision, note
and moderated timestamp in the response. A competing terminal decision stops before
dispatch. Cancellation retains focus/drafts and does not fetch the queue again.
Definite API rejection differs from an unsent preflight. Terminal entries are read-only.

Uncertain outcomes retain minimal owner/role/review/version metadata across reload.
Session invalidation redacts values while retaining the lock. Explicit current-review
read rechecks authorization, replaces only the affected draft and never resends or
proves the original outcome. A record that left the current filter is shown as a
complete read-only current record, with supported navigation back to its status queue.
Temporary failures retain labelled facts with decisions disabled; denied reads clear
protected feedback, saved results and forms. Queue access can recover independently
of a selected review reference.

## Optional durable outcome recovery

Current response validation and current-record reads are not durable original-request
receipts. If durable recovery is selected, define actor/review/body-bound original
references, retention and authorized read-only lookup. Persist decision/version,
audit, notification and receipt atomically. Recheck current role/MFA on lookup and
preserve terminal states, exact nullable notes and public-field exclusion.

Prove committed/uncommitted lost responses, parallel requests, changed bodies,
different actors, role/MFA revocation, expiry and exactly one intended decision,
audit and notification. Deliver contracts and explicit UI recovery together. Use
the mandatory forward-migration workflow if new storage is required.

## Verification and rollout boundary

Final gate 79 adds 38 passing production browser cases, six units, 21 final Axe scans,
native concept comparison, 21 matching source/dependency hashes and the production
build. Connected production Edge/API/PostgreSQL verified three UI decisions with
three administrator mutation audits, plus one competing Super Admin decision and
four total audits/notification records. A terminal competing change stopped the UI
before dispatch. Current-read recovery after a committed lost response sent no second
write. Customer notes stayed private from public feedback. All 28 customer-profile
and 24 untouched-review hashes matched. There are 31 cumulative administrator READ
audits across the reused actor's API/browser verification, not a browser-only delta.
See the [complete page evidence](../../frontend/docs/page-quality/work-review-moderation.md).

Five focused API/database scenarios cover oldest-first 25-record paging plus the
remaining three owned fixtures, exact filters/date, direct read/private audits,
Admin/Super Admin access, Staff/Customer/anonymous/unverified-MFA rejection, atomic
complete receipts, omitted old-note clearing, public-field exclusion, concurrent CAS
with one audit/notification, required rejection notes, CSRF and terminal-state rules.
The public-read assertion uses the supported maximum 50; its initial fixture error
was corrected without weakening the API. The continuation reused all 28 paging
fixtures and existing test identities, preserving owners and grants.

Normal tests create their own isolated fixtures. Optional private QA fixture export/
reuse is controlled by explicit environment variables; tests do not require a local
Windows attachment path. The actual isolated `_test` host/port/database is verified
before any fixture write. No application/shared database, schema, migration, grant,
backup/restore or deployment operation is part of local page work. Existing unchanged
migration replay, db:check and runtime privilege evidence is reused; no new restore
test is claimed. Deployed notification/storage/role acceptance and the rest of the
application remain separate.
