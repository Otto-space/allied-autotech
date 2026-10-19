# Administrator payment review and refund-request recovery

Implementation for the separate `/admin/payments` page gate 80. Production browser
and connected acceptance are recorded in the page report when complete. This contract
does not establish completion of invoice, refund-decision, exception or dispute pages.

## Discovery and authorization

`GET /staff/payments` preserves existing status, provider, exact customer UUID and
cursor/limit semantics. Provider means any matching attempt; every attempt on the
matching payment remains in its projection. Records retain newest createdAt/UUID
ordering. Counts in the UI refer to the loaded page, not a global financial total.

New `GET /staff/payments/{paymentId}` reads a current payment independently of list
paging/status. Only Admin/Super Admin with verified MFA are permitted, matching the
existing router/operator rules; Staff has no finance/evidence/refund access. No new
capability grant, role or branch permission is introduced. Direct UUID/empty-query
validation rejects unsupported scope and missing records return 404.

Both reads use private no-store responses and minimal privileged READ audits.
Collection audits record the collection/result count; detail audits bind the payment
reference. Reasons, payer/contact information, filter values and evidence are not
copied into READ audit metadata. Audit writes are part of private read handling,
not financial domain mutations.

The staff-only projection adds `updatedAt`, exact `manualReview.reviewerNote` and
actor-specific `manualReview.canReview`. The flag is true only for pending evidence
submitted by another operator; the server independently enforces separation of
duties at write time. Submitter/reviewer identity, customer ID, storage object keys
and provider secrets are excluded. Existing customer projections are unchanged and
do not gain these staff note/eligibility fields.

## Exact manual-decision response

The existing manual review route retains its pending-row compare-and-swap and
different-operator rule. Required clean reviewer notes, CSRF, role/MFA, settlement
locks, capture accounting and terminal-state checks remain authoritative.

The response now reads the safe staff projection inside the same transaction as
the decision, settlement and audit. The client validates payment/source identity,
original attempt/evidence facts, exact decision/note, reviewedAt and approved
attempt verification/payment timestamps before reporting success. Other attempt
facts remain scoped. The confirmation identifies the one decided attempt; historical
reviews are not labelled as the latest decision. No payment source is claimed fulfilled
merely because evidence was approved. Manual approval does not initiate a charge.

Fresh own identity/current payment and a complete snapshot precede the UI's single
flight. A competing terminal decision stops before dispatch, with database CAS as
the final guard. Cancellation retains focus/drafts without an unnecessary read.
Unknown results lock through reload; explicit current reads never resend or prove
the original manual-decision outcome. Definite rejection and unsent preflight remain
distinct. Only the confirmed operation's scoped draft is cleared.

## Actor-bound original refund recovery

Existing refund creation continues to bind an idempotency key to an attempt and
exact amount/reason. Replay now also requires the original requester, preventing a
different administrator from obtaining/replaying another actor's original result.
Existing valid same-actor/same-body retries remain compatible. Create/replay return
the explicit safe refund queue projection; idempotency hashes, beneficiary encryption,
object keys and reconciliation tokens are excluded. Committed amounts, disputes,
approved policy, captured-amount limits and different-operator approval remain intact.

New read-only `GET /staff/payments/refunds/original-request` accepts the exact
`paymentAttemptId` query and original `Idempotency-Key` header. It requires current
Admin/Super Admin/MFA access. A matching request must belong to the current requester;
another requester receives 404. A found response is `{found:true,refund:<safe current
record>}`. Absence returns `{found:false,refund:null}` and **does not prove an in-flight
request failed**. The operation never submits or mutates a refund. Private no-store
READ audits omit the raw key, hash and financial reason.

The UI preserves minimal actor/role/payment/attempt/operation metadata, original
reference and a SHA-256 body fingerprint across reload, without copying payer data
or the private reason into that marker. A recovered record must match actor,
attempt and the canonical original amount/reason fingerprint. Its current status
is displayed; requesting a refund never implies funds were returned.

If no original record is visible, the lock remains. An operator may explicitly
review the immutable retained request or restore its exact scoped draft fields and
review the original body/key after reload. A changed body is stopped before dispatch.
This reuses existing backend idempotency and advisory/attempt locks; it does not
invent a new request or automatically retry. A found original response clears only
the affected refund draft. Redacted/unavailable references require explicit manual
reconciliation rather than an invented proven outcome.

## Private evidence and failures

Private evidence retains explicit short-lived authorized access, CSRF, READ audits,
allowlisted URL validation, expiry and unavailable-storage states. It is not public
and is not automatically shared with the customer. The optional document-component
denial callback is used here to clear the protected payment workspace on 401/403;
existing callers that omit it keep their behavior. Absent evidence 404 remains a
document-specific failure.

Temporary collection failures retain labelled known facts with changes/paging
disabled. An unloaded page does not claim zero records. Denied private collection,
profile, evidence or original-refund reads clear protected cards, forms and receipts.
Access recovery is independent of selection. Blocked pending storage stops dispatch.

## Verification and rollout boundary

[Gate 80](../../frontend/docs/page-quality/work-payments.md) is locally accepted.
It records 49 distinct passing production browser cases, 17 focused final UI
confirmation/recovery/focus checks, seven units, 28 final Axe scenarios, native
concept comparison, 31 matching source/dependency hashes and the production build.
Twenty-three unchanged navigation regressions passed separately in development.

Connected production Edge/API/PostgreSQL verified four UI writes: three manual
decisions and one refund request, with four UI mutation audits. One competing owner
decision produced the fourth total manual-decision audit and stopped the UI before
dispatch. There were 28 new administrator PAYMENT/REFUND READ audits above the
pre-run baseline, one capture entry and one REQUESTED refund with no refund-transfer
ledger entry. Lost responses recovered without replay; exact original refund facts,
customer note privacy, unchanged customer/profile and 24 untouched payment/order/
attempt snapshots, all roles and owned temporary-session cleanup passed. The final
frontend focus/copy refinement reused this unchanged backend/database evidence;
no financial writes or fixtures were repeated for it.

Six initial API/database scenarios passed: scoped 25+3 discovery/private audits;
direct reads/roles/MFA/query/missing references; exact approval/one capture/private
customer projection; required notes/CSRF/four-eye/concurrent rejection; same-key
actor/body-bound refund replay/one audit; and serialized over-refund prevention.
The expanded original-refund lookup assertions then passed in a focused continuation,
reusing the original 28 paging fixtures, identities and branch. Fourteen existing
payment policy/schema/webhook/HTTP boundary cases also passed.

The initial new fixture's MFA timestamp preceded its database-default session creation
timestamp; its explicit earlier createdAt was corrected before financial fixtures
were created. No database constraint was weakened. Normal CI creates its own isolated
fixtures; explicit private QA export/reuse is optional and not a hardcoded local path.

Before fixture/session writes the actual isolated target was verified as
`127.0.0.1:55480 / allied_work_aftercare_20261017_test`, using the existing restricted
runtime. Owners and existing grants are preserved. No schema/migration/client-model
change is needed. Unchanged 59-migration replay, db:check and runtime-privilege evidence
is reused. No application/shared database, backup/restore, grant, push or deployment
operation is performed; no new restore rehearsal is claimed.

Deploy the compatible backend/OpenAPI/generated types with the dependent frontend.
Verify target roles, private caching, configured evidence storage, approved financial
policy and real provider/worker delivery separately. Request acceptance is not refund
execution or deployed acceptance.

## Optional manual-decision original-request receipts

Current response validation and explicit current-payment reads do not provide durable
manual-decision original-request lookup. If selected, define actor/payment/attempt/
body-bound references and authorized read-only recovery. Commit decision/settlement/
capture/audit/receipt atomically; preserve different-operator rules and current MFA.
Prove lost responses, concurrent decisions, changed bodies, other actors, revoked
access, expiry, no duplicate capture/audit and unchanged customer note privacy. Deliver
the generated contract and explicit UI recovery together. Any new storage must follow
the mandatory forward-migration workflow. Refund recovery above already uses existing
storage and remains a separate implemented capability.
