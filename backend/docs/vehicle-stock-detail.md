# Vehicle stock detail and mutation recovery

The authenticated stock detail is `GET /staff/vehicles/:vehicleId`. Staff may read
and manage their active assigned branch; Admin/Super Admin may manage historical
inactive branches where the existing mutation policy permits it. Authentication,
MFA, CSRF and private/no-store response handling remain server boundaries. Internal
acquisition cost/currency must be absent from Staff responses and requests,
including null values. Acquisition time remains available to Staff.

Vehicle specifications, listing content/price/publication and document assessment
have independent versions. A listing or document change does not increment the
vehicle specification version. Photo changes use the stock media/vehicle version
contract. Condition reports are immutable append-only records; the detail shows
only the report with the latest inspection time. Recording an older report does
not guarantee it becomes the displayed report.

## Complete document responses

Document creation now returns its saved issued/expires/verified dates and rejection
reason, in addition to ID, type, status, exact byte count, MIME, checksum, version
and creation time. Document review now returns those same dates, reason and
creation time. This is an additive repository projection correction. Existing
authorization and storage behavior are unchanged; storage object keys remain
private. Temporary authorized access is still a separate operation.

The complete response allows the frontend to check the reviewed values and new
document version before reporting success. An ID or status alone cannot confirm
the submitted assessment, dates or complete saved metadata. No schema migration,
data backfill or grant change is required. The OpenAPI response envelope is
generic; this additive projection does not change generated request contracts.

## Frontend guard and timestamp precision

The detail validates the requested identity, branch, role projection and all
displayed collections before rendering. Before a mutation it checks current own
profile/access and the relevant domain snapshot. Independent listing/document
updates do not unnecessarily invalidate a specification review. Existing backend
expectedVersion checks remain necessary because another write can occur after
the preflight. A confirmed newer observation cannot be replaced by an older read.

Every submitted specification is reviewed. If an existing acquisition timestamp's
visible minute was not changed, the serializer preserves its original seconds and
milliseconds exactly. An explicit edited minute uses Lagos time. Creation keeps
its existing minute-based behavior and exact integer-kobo serialization.

A minimal owner/role/vehicle-scoped pending marker is verified in session storage
before sending. Uncertain, malformed, mismatched, 408/429 or interrupted responses
keep mutations locked through reload. Current-read reconciliation explicitly
replaces this page's drafts and releases the lock; it never resends a change or
claims the observed record proves the original request outcome. Definitive first
rejections can clear only their own marker. Corrupt/unavailable recovery storage
fails closed. Authorized temporary document access remains a separate read.

Photo attachment retains the existing safe retry of the original prepared request
and asset reference. Other vehicle/listing/document/report writes do not acquire
same-key replay guarantees merely by using this UI guard.

## Remaining optional capability

Durable original-request receipts for detail mutations remain an optional P2
extension (ADM-26). If selected, define actor/reference/body binding, operation
coverage, retention, authorization after role/branch changes and read-only outcome
lookup. Persist domain changes, audit and receipt atomically. Prove committed and
uncommitted lost responses, concurrency, mismatched bodies, actor isolation and
exactly one mutation/audit on new isolated test databases. Extend rather than
weaken existing photo receipt semantics. Use the mandatory reviewed forward
migration workflow if receipt storage needs schema changes.

See the [frontend local acceptance](../../frontend/docs/page-quality/work-vehicle-detail.md).
Deployment and deployed-environment acceptance remain open.
