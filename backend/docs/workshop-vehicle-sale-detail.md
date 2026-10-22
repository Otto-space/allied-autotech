# Workshop vehicle purchase detail

Route: `/admin/vehicle-sales/[transactionId]`. This document describes the existing
staff transaction API and the coordinated local changes verified for page gate 73.

## Read and mutation boundaries

The current active own profile gates the direct transaction GET. Staff require
their current branch; Admin and Super Admin retain their existing broader scope.
MFA, CSRF, lifecycle, transaction locks and version checks remain authoritative on
the server. Privileged direct reads produce READ audits. Responses remain private.

Negotiation and ordinary purchase progress use the transaction's expected version.
They now return the transaction **after** appending public status history and the
audit within the same transaction, so the saved receipt includes the submitted
note/reason. The UI validates identity, exact amounts, next version/status and the
new history event before displaying success. This does not add durable original-
request receipts or safe automatic retries.

Handover creation accepts recipient name/phone, odometer, keys and an optional
previously verified PDF asset token. It requires PAID and no existing handover,
locks the transaction and advances it to HANDOVER_PENDING; the new handover starts
at version zero. READY and CANCELLED advance only the handover version. COMPLETED
also advances the purchase version, completes the purchase and marks its listing
SOLD. All these mutations audit against the **transaction ID**, including handover
status changes; they do not create separate handover-entity audits.

The public handover projection now includes `hasSignedDocument`. It is derived
from the existing private object key; the raw object key and SHA-256 are stripped
by serialization. Temporary document access remains a separate authorized POST.
A pending mutation does not grant access or prevent an otherwise authorized
document read. No permanent URL or fabricated document name is returned.

Completion already requires a signed document and complete recipient details in
the database. The service now checks that requirement and returns a clear **409**
instead of allowing the database constraint to produce a 500. Creation without a
PDF remains supported. The UI explains the limit before creation and does not
offer completion when `hasSignedDocument` is false.

## Remaining implementation

**Handover recovery (ADM-29):** there is no supported late-document attachment
route. A handover created without a PDF cannot complete through the current API.
A cancelled handover cannot be reopened or replaced, and its purchase remains
HANDOVER_PENDING. Backend/product must define the permitted recovery workflow,
evidence retention and actor permissions before adding controls. Preserve signed
evidence immutability, existing payments, transaction/listing history and audits.
Do not bypass database constraints or alter records manually as a UI workaround.

Acceptance must cover verified PDF tickets/checksums, current branch/MFA checks,
concurrent attachment/status attempts, immutable existing evidence, independent
versions, cancellation/recovery and exactly one domain change/audit. Define the
necessary forward migration and data-preservation plan if existing uniqueness or
state constraints need expansion. Update OpenAPI, clients and reviewed UI together.

**Optional durable outcome recovery (ADM-30, P2):** define actor/operation/body-bound
request references, retention and authorized read-only receipt lookup. Domain
change, history, audit and receipt must commit atomically. Recovery must recheck
current role/branch scope. Prove committed/uncommitted lost responses, concurrency,
changed bodies, actor changes, expiry and exactly one change/audit. Current UI
pending markers survive reload and require an explicit current-record read; this
never resends or proves the original request outcome.

## Verification and rollout

Three isolated API scenarios verify role/MFA/private boundaries, exact negotiation
and current history/reason, stale versions, verified-PDF creation/READY/COMPLETED,
missing-PDF completion rejection and cancelled/replacement denial. Tests assert
the presence flag and absence of object key/hash. Connected production-browser/API
verification checks exact saved amounts/history, six mutations/six transaction
audits, independent handover versions, zero readings/keys and lost-response recovery
without replay. Signed-PDF browser upload/delivery and API completion are separate
checks; the connected browser fixture deliberately covers creation without a PDF.

Actual fixture target was verified before writes: `127.0.0.1:55480`, database
`allied_work_aftercare_20261017_test`, isolated-test environment and existing
restricted runtime credentials. Synthetic reservation-policy acceptance uses the
existing test helper; it does not approve business terms. Domain fixtures remain;
only owned test sessions were removed. No application/shared database, migration,
schema, grant, backup, restore, push or deployment change occurred. Existing
59-migration replay/db:check/privilege evidence was reused because schema and
migrations did not change.

Deploy the receipt-history and safe document projection/service checks with the
dependent UI and verify the actual target. Local checks do not establish deployed
acceptance, policy approval, provider delivery or recoverability.
