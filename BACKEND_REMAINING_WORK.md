# Allied AutoTech — Remaining Backend Work

Reviewed: 18 October 2026. Scope: the 81 locally accepted frontend milestones through administrator invoices and inline draft creation, plus the current backend implementation sources. See the [page register](frontend/docs/page-quality/README.md) and [detailed backend handoff](BACKEND_IMPLEMENTATION_GAPS.md).

This is an implementation and release checklist based on completed work. Local acceptance is not deployed acceptance. Remaining customer, Staff, Admin and Super Admin page audits may identify additional gaps. The workshop service catalogue `/admin/services` now integrates administrator search/category filters and direct reads for inline editing. Local browser/API/database checks verified paging, search, creation, editing, media and uncertain-save reconciliation. The separately addressable service detail page now also passes its local gate, including direct reads beyond the first catalogue page, reviewed edits and image management. See [catalogue acceptance](frontend/docs/page-quality/work-services.md) and [detail acceptance](frontend/docs/page-quality/work-service-detail.md). Service-category administration has now passed its [separate local gate](frontend/docs/page-quality/work-service-categories.md), including prefix/visibility filtering, paging, reviewed writes and direct-read recovery. The category detail page has also passed its [separate local gate](frontend/docs/page-quality/work-category-detail.md). Remaining dashboard page audits are separate scopes.

## Work that still needs implementation

- **Optional invoice-creation receipts (P2):** define actor/source/body-bound original-request references and authorized read-only lookup, with atomic invoice/snapshot/audit persistence if durable recovery is selected. Current invoice creation already validates exact drafts, retains uncertain locks across reload and explicitly reads current source mappings without replay or original-outcome claims. Preserve pricing, approved finance policy, deposit/refund guards and one-invoice-per-source concurrency. See [ADM-41](BACKEND_IMPLEMENTATION_GAPS.md#adm-41---durable-invoice-creation-outcome-recovery-optional-p2) and [contract](backend/docs/administrator-invoices.md). Exact invoice/source discovery, minimal searchable choices and private read auditing are implemented locally in ADM-40; they require compatible backend/frontend release and target verification.

The remaining implementation items identified by the completed page audits are:

- **Optional manual-payment decision receipts (P2):** add actor/payment/attempt/body-bound original-request receipts with atomic decision/settlement/capture/audit persistence and current authorized read-only recovery if selected. Preserve different-operator rules, current MFA, exact notes and customer projection privacy. Current manual reads never resend or prove an original outcome. Refund original-request recovery is already implemented separately in ADM-38. See [ADM-39](BACKEND_IMPLEMENTATION_GAPS.md#adm-39---durable-manual-payment-decision-recovery-optional-p2) and [criteria](backend/docs/administrator-payments.md#optional-manual-decision-original-request-receipts).

- **Optional moderation receipts (P2):** add actor/review/body-bound original-request receipts with atomic decision/audit/notification persistence and authorized read-only recovery if durable outcome recovery is selected. Current moderation retains reload-persistent uncertain locks and explicitly reads current facts without replay or original-outcome proof. Preserve exact nullable notes, terminal decisions, current role/MFA and public-field exclusion. See [ADM-37](BACKEND_IMPLEMENTATION_GAPS.md#adm-37---durable-review-moderation-recovery-optional-p2) and [criteria](backend/docs/workshop-review-moderation.md#optional-durable-outcome-recovery).

- **Full retention-hold history (P2):** add an audited account-bound cursor collection/direct lookup so reviewers can inspect and safely release older holds outside the latest 100 projection. Approval already checks all active holds and correctly blocks on an older unseen hold. Preserve existing array clients, private reasons, capability/MFA and atomic release audits. See [ADM-35](BACKEND_IMPLEMENTATION_GAPS.md#adm-35---full-retention-hold-history-management-p2) and [criteria](backend/docs/workshop-privacy-review.md#remaining-capabilities).

- **Optional privacy-review receipts (P2):** add actor/operation/request/account/body-bound original-request receipts with atomic persistence and authorized read-only recovery if durable outcome recovery is selected. The accepted UI retains pending locks through uncertainty/reload and explicitly reads current facts without replay or outcome-proof claims. See [ADM-34](BACKEND_IMPLEMENTATION_GAPS.md#adm-34---durable-staff-privacy-recovery-optional-p2).

- **Optional staff conversation receipts (P2):** add actor/operation/reference/body-bound original-request receipts and authorized read-only recovery if durable outcome recovery is selected. Current detail validates exact scoped response metadata, retains uncertain locks across reload and explicitly reads current facts without replay or proof of the original outcome. Preserve lifecycle row locks, independent versions, acknowledgement races, private notes and atomic notifications/audits. See [ADM-32](BACKEND_IMPLEMENTATION_GAPS.md#adm-32---durable-staff-conversation-recovery-optional-p2) and [criteria](backend/docs/workshop-support-conversation.md#optional-durable-outcome-recovery).

- **Handover recovery (P1):** add an authorized late-document/cancelled-delivery recovery workflow. A no-PDF handover currently cannot complete, and cancelled handovers cannot reopen or be replaced. Preserve signed evidence, payments, versions and audits. See [ADM-29](BACKEND_IMPLEMENTATION_GAPS.md#adm-29---recover-handovers-missing-evidence-or-cancelled-delivery-p1) and [criteria](backend/docs/workshop-vehicle-sale-detail.md#remaining-implementation).

- **Optional purchase-detail receipts (P2):** add actor/operation/body-bound original-request receipts with atomic domain/history/audit persistence and authorized read-only recovery if selected. Current UI safely reconciles through explicit reads without replay or proof of the original outcome. See [ADM-30](BACKEND_IMPLEMENTATION_GAPS.md#adm-30---durable-purchase-detail-mutation-recovery-optional-p2).

- **Optional inspection-transition receipts (P2):** add actor/reference/body-bound receipts and authorized read-only outcome recovery if durable recovery is selected. The accepted inspection workflow already retains pending locks through uncertain responses/reload and explicitly reloads the current page without replay or proof of the original outcome. Preserve current assignee/branch checks and atomic versions. See [ADM-27](BACKEND_IMPLEMENTATION_GAPS.md#adm-27---durable-inspection-transition-recovery-optional-p2) and [criteria](backend/docs/workshop-inspections.md#optional-durable-outcome-recovery).

- **Optional vehicle-detail mutation receipts (P2):** add actor-bound, operation-specific original-request receipts and authorized read-only outcome recovery if durable recovery is selected. The accepted detail already locks uncertain changes through reload and supports explicit current-read reconciliation without replay or outcome-proof claims; existing safe photo retry remains independent. See [ADM-26](BACKEND_IMPLEMENTATION_GAPS.md#adm-26---durable-vehicle-detail-mutation-recovery-optional-p2) and the [contract](backend/docs/vehicle-stock-detail.md#remaining-optional-capability).

- **Optional vehicle stock creation receipts (P2):** implement actor-bound original-request references, atomic record/audit/receipt persistence and authorized read-only recovery if durable outcome recovery is selected. The accepted form already survives uncertain saves/reload with a pending lock and explicit manual stock reconciliation; it does not claim a proven request outcome. Preserve current Staff branch scope and acquisition privacy. See [ADM-24](BACKEND_IMPLEMENTATION_GAPS.md#adm-24---durable-vehicle-stock-creation-recovery-optional-p2) and [criteria](backend/docs/vehicle-stock-creation.md#frontend-workflow-and-recovery-boundary).

- **Stock-specific query semantics (P2):** body/specification, featured, price and sort parameters inherited by the staff query schema are currently accepted but ignored by its repository. Define multi-listing record semantics and implement them, or introduce a compatible reviewed stock-specific contract that rejects unsupported fields. The accepted index offers working filters only. See [ADM-23](BACKEND_IMPLEMENTATION_GAPS.md#adm-23---stock-specific-query-semantics-p2-implementation-follow-up) and [acceptance criteria](backend/docs/vehicle-stock-discovery.md#remaining-query-contract-gap).

- **Original delivery-VAT breakdown (P1 finance follow-up):** the order read exposes saved aggregate VAT but no original products/delivery split. Finalise the recorded-breakdown contract and approved rounding treatment, then integrate it across checkout, orders and financial documents without rewriting historical totals. See [ADM-15](BACKEND_IMPLEMENTATION_GAPS.md#adm-15---original-delivery-vat-breakdown-finance-follow-up-p1) and [owner-policy boundaries](OWNER_POLICY_DECISIONS.md). External courier fee collection and invoice publication details remain open.

- **Marketing delivery:** approve Q12, then implement the campaign, consent and unsubscribe behavior described in item 4. Preference storage already exists; it does not activate delivery.
- **Privacy execution:** approve Q13, then implement the authorized deletion/anonymization workflow described in item 5. Request intake and review already exist; approval does not mean deletion has run.
- **Optional service-creation recovery (P2):** implement an administrator-scoped original-request receipt if durable recovery of an interrupted save is required. The current frontend supports manual catalogue reconciliation and prevents automatic replay. See [ADM-03 and acceptance criteria](BACKEND_IMPLEMENTATION_GAPS.md#adm-03---durable-service-creation-recovery-optional-p2).
- **Optional service-category creation recovery (P2):** add administrator-scoped original-request receipts if durable recovery of interrupted category creation is required. Manual category-list reconciliation remains supported. See [ADM-05](BACKEND_IMPLEMENTATION_GAPS.md#adm-05---durable-category-creation-recovery-optional-p2).
- **Optional product-creation recovery (P2, current page audit):** product creation has no original-request receipt. Add atomic product/audit/receipt persistence and explicit authorized recovery if this capability is required. The frontend manual-reconciliation controls have passed local page acceptance; durable receipt recovery remains optional. See [ADM-08](BACKEND_IMPLEMENTATION_GAPS.md#adm-08---durable-product-creation-recovery-optional-p2).
- **Compatibility conflict protection (P2 reliability enhancement):** add an observed revision to compatibility updates/removals and compare it atomically with the write. The current frontend checks freshness before submitting, but another administrator can change the record between that check and the mutation. Product `expectedUpdatedAt` and image `mediaVersion` do not protect compatibility writes. See [ADM-09](BACKEND_IMPLEMENTATION_GAPS.md#adm-09---atomic-compatibility-conflict-protection-p2).

- **Optional product-category creation recovery (P2):** creation has no original-request receipt. The accepted editor locks uncertain saves through reload and requires manual reconciliation before a new draft. Add atomic category/audit/receipt persistence and explicit authorized recovery if required. See [ADM-12](BACKEND_IMPLEMENTATION_GAPS.md#adm-12---durable-product-category-creation-recovery-optional-p2).

### Implementation acceptance checklist

The following are proposed implementation tasks, not features already verified or authorization to activate policy-dependent behavior. Backend, frontend and QA share delivery; the business owner supplies the two policy decisions.

| Task                                      | Dependency                                                            | Required acceptance evidence                                                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing delivery                        | Approved Q12 content, consent policy, sender and unsubscribe behavior | Withdrawal before dispatch prevents delivery; consent history and transactional-message rules remain intact; provider outcomes are observed.                                     |
| Privacy execution                         | Approved Q13 retention, holds, exceptions and execution authority     | Isolated tests prove account scope, preservation of protected records, current hold enforcement, authorization, and truthful outcomes after interruption/retry.                  |
| ADM-03 service creation recovery          | Optional reliability scope selected                                   | A dropped committed response can be explicitly recovered after reload with exactly one service and audit; concurrent keys, body mismatch, actor isolation and expiry are tested. |
| ADM-05 category creation recovery         | Optional reliability scope selected                                   | Equivalent recovery evidence for one category and audit, including changed permissions and no false success for an uncommitted request.                                          |
| ADM-08 product creation recovery          | Optional reliability scope selected; product page locally accepted    | Equivalent recovery evidence for one product and audit; preserve category eligibility and keep later media operations separate.                                                  |
| ADM-09 compatibility conflicts            | Reliability scope selected                                            | Concurrent updates/removals compare an observed revision atomically; stale requests leave the record and audit unchanged, with draft-preserving browser recovery.                |
| ADM-12 product-category creation recovery | Optional reliability scope selected; category page locally accepted   | A dropped committed response recovers exactly one category and audit; test duplicate keys, body mismatch, authorization, expiry and uncommitted outcomes.                        |

For each selected API change, deliver request/response validation, authorization, transactional behavior, OpenAPI, regenerated frontend types, explicit UI recovery and API/browser evidence together. Any necessary schema change also requires the forward-migration and isolated replay workflow in [database safety](backend/docs/database-safety.md). Endpoint names and receipt storage for these optional extensions remain design decisions.

Other recorded limits are optional extensions: appointment-slot creation uses manual read reconciliation after an uncertain save, and customer aftercare history is bounded to the latest 100 records. Durable slot-creation recovery or browsing older aftercare history would require separate contracts and acceptance criteria if selected. See [slot acceptance](frontend/docs/page-quality/work-slots.md) and [aftercare recovery](backend/docs/aftercare-request-recovery.md).

Marketing and privacy execution remain conditional on their approved policies. The release backlog below covers capabilities with local implementations that require coordinated release or target-environment verification. Maps is a deferred configuration task, with no missing backend endpoint.

## Service administration contracts and remaining integration

The `/admin/services` audit identified two contracts, now implemented with local API/database and catalogue-browser acceptance. Search/category controls and direct reads for inline editing are integrated. The separate detail route is also locally accepted; deployment remains pending. Existing creation, versioned editing and image management remain supported.

| Reference | Implemented backend capability                                                                     | Remaining work                                                                           | Acceptance                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ADM-01    | Administrator text/category filters with compatible UUID pagination.                               | Deploy API before dependent frontend; verify target environment. Owners: deployment, QA. | Local API and browser checks cover URL filters, pagination/history and full-catalogue search.   |
| ADM-02    | Admin/Super Admin `GET /admin/services/{serviceId}` with current revision and safe image metadata. | Deploy API before dependent frontend; verify target environment. Owners: deployment, QA. | Direct/reloaded detail URLs, revision checks, failure/recovery behavior and media pass locally. |

See [contract behavior and local evidence](backend/docs/admin-service-catalogue.md) and [service administration criteria](BACKEND_IMPLEMENTATION_GAPS.md#service-administration---next-page-source-audit). Verification passed 41 distinct tests, including selective search over 10,000 synthetic services using an existing GIN index. No new migration was added. These contracts are prerequisites for the dependent UI; do not substitute public-only discovery or filtering one downloaded page.

## Category administration contract and release

**ADM-04 is locally implemented and integrated:** `GET /admin/service-categories/{categoryId}` supplies current administrator fields and revision independently of paging, including inactive/empty categories. The category catalogue and separately addressable detail page use it for reloadable editing, pre-save checks and explicit interrupted-save recovery. Deploy this additive API before its dependent frontend and verify the target environment.

The [category-detail gate](frontend/docs/page-quality/work-category-detail.md) adds 83 passing production-browser scenarios, 18 unit cases, 27 responsive/state captures and real browser/API/database verification of direct reads, the filtered-services link, reviewed deactivation and lost-response recovery. A separate fresh isolated test database replayed all 58 migrations and passed `db:check`; restricted runtime privileges were verified. No new backend endpoint or migration was needed. The remaining implementation items above are unchanged.

[Local acceptance](backend/docs/admin-service-categories.md) includes 25 backend cases, 84 distinct production-browser scenarios across the page and shared regressions, 18 frontend unit cases and real browser/API/database checks. Under the updated database rules, a fresh isolated PostgreSQL 18 database replayed all 58 migrations and passed `db:check`; application tests used a restricted role with separate index-maintenance credentials. No schema migration was added, existing application data/grants were not changed, and no backup/restore rehearsal or deployment was performed.

## Implementation and release backlog

### Administrator payments contracts and release

**ADM-38 is implemented and integrated locally:** audited private administrator list/current-payment reads, staff-only reviewer-note/eligibility metadata, atomic exact manual-decision responses, requester-bound refund replay and read-only original-refund recovery using existing storage. Safe refund projections omit internal hashes, encrypted beneficiaries, object keys and reconciliation tokens. Existing role/MFA, four-eye, settlement, refund commitment and policy checks remain authoritative. No schema/migration or permission expansion is required. See [contract](backend/docs/administrator-payments.md) and [page acceptance](frontend/docs/page-quality/work-payments.md).

Gate 80 records 49 distinct production browser cases, 17 focused final confirmation/recovery/focus checks, seven units, six API/database scenarios, 14 backend boundary cases, 28 final Axe scenarios and 31 exact source hashes. Connected production Edge/API/PostgreSQL verified four UI writes/four UI mutation audits, a competing owner decision stopped before UI dispatch, 28 new READ audits, one capture and one REQUESTED refund without a refund-transfer ledger entry. Lost manual/refund responses recovered without replay; customer note privacy, untouched snapshots, all role boundaries and temporary-session cleanup passed. Original fixtures/owners/grants and unchanged database safety evidence were reused. No application/shared database, schema/migration, existing grant, backup/restore, push or deployment operation occurred. **Remaining:** coordinated compatible backend/frontend release and target-environment evidence/role/policy/provider/worker checks. ADM-39 is optional durable manual-decision recovery. Invoices, refund decisions, exceptions and disputes retain separate page gates.

### Review moderation contracts and release

**ADM-36 is implemented locally:** compatible exact review filtering, a private Admin/Super Admin direct read with READ audits, atomic safe moderation responses and explicit old-note clearing when approval omits a note. Existing terminal-state/CAS, MFA, customer notifications and public privacy boundaries remain intact. No schema, migration or permission expansion is needed; release the additive backend/OpenAPI/generated types with the dependent frontend. See [contract and rollout](backend/docs/workshop-review-moderation.md).

[Gate 79](frontend/docs/page-quality/work-review-moderation.md) records 38 production browser cases, six units, five API/database scenarios, 21 final Axe scans, native fidelity and 21 matching source hashes. Connected production Edge/API/PostgreSQL verified three UI decisions plus one competing external decision, four decision audits/notifications, lost-response recovery without replay, customer/public privacy and unchanged profile/untouched-review hashes. The 31 administrator READ audits are cumulative across reused-actor API/browser verification. The actual isolated test target/restricted runtime were verified; owners/grants and all 28 original paging fixtures were preserved. Unchanged migration/privilege checks were reused. No shared/application database, schema/migration, grant, backup/restore, push or deployment operation occurred. ADM-37 is optional durable recovery; deployed acceptance and remaining finance/organisation pages remain separate.

### Product administration contracts and release

The `/admin/products` audit exposed two prerequisites now implemented and locally verified: **ADM-06**, a private administrator product read independent of list paging, and **ADM-07**, an optional observed-timestamp update precondition checked under the product row lock. Existing clients remain compatible; only clients supplying the precondition receive stale-snapshot protection. The accepted editor sends it. See [contract, compatibility limits and verification](backend/docs/admin-product-catalogue.md).

All 20 focused/related backend cases passed, along with static, generated-contract and build checks. The product catalogue now passes its [local frontend gate](frontend/docs/page-quality/work-products.md): 62 distinct browser scenarios, 40 unit cases, 43 captures, 35 Axe scans, static/build checks and real browser/API/database verification. A separate fresh isolated PostgreSQL 18 database replayed 58 migrations and passed `db:check` with verified restricted runtime privileges. The editor uses direct reads and sends the observed timestamp; creation and edit reconciliation and media recovery are verified. **Remaining:** deploy API before frontend and verify the target environment. No schema migration or application-data change occurred for these prerequisites. The accepted frontend count is now 57: [administrator product detail](frontend/docs/page-quality/work-product-detail.md) also passes its local gate. It adds no required endpoint or migration. ADM-09 records the separate compatibility concurrency enhancement; deployment verification remains open.

**ADM-08, optional P2:** product creation has no original-request receipt. If durable recovery is required, add administrator-scoped creation receipts with atomic product/audit persistence, body binding, explicit recovery and concurrency/expiry/permission tests. Until implemented, the accepted editor locks uncertain creation through reload and requires manual catalogue reconciliation before a new blank draft. Details are in the [product backlog](BACKEND_IMPLEMENTATION_GAPS.md#adm-08---durable-product-creation-recovery-optional-p2).

### Product-category administration contracts and release

**ADM-10 and ADM-11 are locally implemented and integrated:** literal name-prefix filtering, private administrator direct reads, optional atomic observed-timestamp updates, and a shared category lock for product updates protect the deactivation/activation boundary. The accepted editor sends the timestamp and preserves drafts on conflict. Existing clients remain compatible; omitted preconditions do not protect against stale edits.

The [backend contract](backend/docs/admin-product-categories.md) records 34 passing focused/related cases and generated API checks. The [frontend gate](frontend/docs/page-quality/work-product-categories.md) records 72 passing category/product/navigation browser cases, 31 unit cases, static/build checks, 39 captures, 25 dedicated Axe scans and real browser/API/database acceptance. Two fresh isolated test databases replayed all 58 migrations and passed database safety checks with verified restricted runtime roles. No schema migration or existing application-data/grant change occurred. **Remaining:** deploy API before frontend and verify the target. Optional creation receipts are ADM-12. No backup/restore rehearsal or deployment was performed.

### Previously identified implementation and release items

Priorities are proposed: P1 requires completion before activating the affected capability; P2 is an optional reliability enhancement to an existing supported workflow. Policy-dependent capabilities must remain disabled until their business requirements and implementation are approved.

| Item                                                     | Current status                                                        | Priority             | Responsible roles                             |
| -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| Audit event/filter completeness                          | Locally verified; matching API/frontend release pending               | P1 before release    | Backend, frontend, QA                         |
| Operational jobs pagination and monitoring types         | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Durable support request recovery                         | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Durable aftercare original-request recovery              | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Durable support reply recovery                           | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Notification preference conflict protection and recovery | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Marketing delivery                                       | Disabled; policy and implementation required                          | P1 before activation | Business owner, backend, QA                   |
| Privacy deletion/anonymization execution                 | Disabled; policy and implementation required                          | P1 before activation | Business owner, policy reviewers, backend, QA |

### 1. Complete customer support creation release

**Affected page:** `/dashboard/support`.

**Current status:** implemented and locally verified. Customer enquiry/complaint creation now binds the normalized original request to a customer- and operation-scoped key. The record, audit, complaint policy work and receipt commit atomically. Explicit frontend recovery survives reload, returns the current owned record and never repeats creation or deadline assignment after a committed request. See [support creation recovery](backend/docs/support-creation-recovery.md) for the contract and evidence.

**Remaining:** release the matching API/frontend together and verify in the target environment. Older clients must reload to send the required key. No new migration is needed. Anonymous contact recovery and support replies remain separate; provider delivery is not established by local persistence or browser tests.

### 2. Complete support reply recovery release

**Affected pages:** enquiry and complaint conversations at `/dashboard/support/[kind]/[supportId]`.

**Current status:** implemented and locally verified. Original reply keys are scoped to customer, conversation kind/ID and normalized contents. The reply, audit, notification/outbox intent and receipt commit together. Explicit recovery rechecks current ownership, returns an already committed customer-visible message after closure and works independently of history pagination. New replies to closed conversations remain rejected.

**Remaining:** release matching API/frontend contracts together and verify in the target environment. Older customer clients must reload to send the required key. No migration is added. Staff reply contracts remain unchanged, and notification enqueue does not establish provider delivery.

**Evidence:** [reply recovery contract and local verification](backend/docs/support-reply-recovery.md), [backend integration tests](backend/tests/integration/support-reply-replay.test.ts), and [real browser recovery](frontend/tests/e2e/support-reply-real.spec.ts).

### 3. Complete notification preference release

**Affected page:** `/dashboard/notifications` and the existing shared preference contract.

**Current status:** locally verified. Expected-version checks and original-request recovery now have migration replay/upgrade, API/database, frontend and production-browser evidence in [notification preference recovery](backend/docs/notification-preference-recovery.md). Recovery preserves a later withdrawal and appends no duplicate consent/audit.

**Remaining:** drain older writers, deploy migration 57 and the regenerated client, then release matching API/frontend together and verify in the target environment. Older clients omit the required revision/key and must reload. Marketing remains disabled.

**Acceptance:** competing sessions cannot silently overwrite each other; original-key recovery adds no second consent record or audit; changed bodies, expired keys and foreign actors fail safely. Replaying an earlier consent must not reinstate consent withdrawn later. Verify lost-response recovery, current-state presentation, cancellation and no automatic browser replay.

**Evidence:** [request schemas](backend/src/modules/notifications/notifications.schemas.ts), [receipt implementation](backend/src/modules/notifications/preference-write.ts), [migration](backend/prisma/migrations/20261013110000_notification_preference_revision/migration.sql), and [original page acceptance](frontend/docs/page-quality/customer-notifications.md).

### 4. Marketing delivery after policy approval

**Existing behavior:** preference saving records consent; marketing enqueue and dispatch remain disabled. Security and transactional messages are separate. A saved preference does not activate campaigns.

**Dependency:** obtain approved content, consent wording/version, sender identity and unsubscribe behavior under owner decision Q12.

**Implement after approval:** authoritative policy and consent handling, approved campaign and unsubscribe contracts, withdrawal checks at dispatch, auditable changes and delivery outcomes. Preserve historic consent and mandatory-message behavior. Do not activate marketing by merely removing its guards.

**Acceptance:** withdrawal before dispatch prevents delivery; repeated processing follows the defined delivery contract; consent history remains intact; mandatory messages retain their separate rules. Verify actual provider acceptance in the target environment.

**Evidence:** [owner decisions](backend/docs/owner-decision-checklist.md), [notification service](backend/src/modules/notifications/notifications.service.ts), [delivery worker](backend/src/workers/notification.worker.ts), and [detailed criteria](BACKEND_IMPLEMENTATION_GAPS.md#marketing-delivery-and-preference-contracts---policy-dependent-follow-up).

### 5. Privacy execution after policy approval

**Existing behavior:** owner-scoped request intake/history and authorized review already work. `APPROVED_PENDING_POLICY` is a review outcome, not completed deletion. Destructive retention remains disabled.

**Dependency:** agree record-specific retention rules, start events, exceptions, protected financial/audit records, media/backups, holds and execution authority under owner decision Q13. No retention duration or deletion deadline is assumed here.

**Implement after approval:** a separately authorized, auditable execution workflow with policy/hold checks at execution time, restart/retry handling and explicit partial/deferred/completed outcomes. Define media and session consequences before exposing execution controls.

**Acceptance:** use an isolated disposable database. Only permitted records of the intended account are affected; protected records remain intact; new holds block execution; unauthorized or insufficiently assured callers fail closed. Interrupted/repeated runs neither bypass protections nor falsely report completion.

**Evidence:** [privacy routes](backend/src/modules/policies/privacy.routes.ts), [capability projection](backend/src/modules/policies/policies.service.ts), [completed privacy page](frontend/docs/page-quality/customer-privacy.md), and [detailed criteria](BACKEND_IMPLEMENTATION_GAPS.md#privacy-execution---policy-dependent-future-capability).

### 6. Complete aftercare original-request recovery release

**Affected page:** `/dashboard/orders/[orderId]/aftercare`.

**Current status:** implemented and locally verified. Both intake endpoints now bind the normalized original operation and payload to a customer/order-scoped key. Request, audit and receipt commit atomically. Explicit browser recovery survives reload and returns the current owned original request after rejection or outside the latest-100 history window. Recovery does not create another request or change stock, order state or refund settlement. Local evidence includes 20 backend cases, 474 frontend unit cases and 62 unique production-browser cases.

**Remaining:** release the matching API/frontend together and verify in the target environment. Older customer clients must reload to send the required key. No migration is needed. The latest-100 history contract remains bounded; older-history browsing would require a separate owned pagination contract.

**Evidence:** [aftercare recovery contract and verification](backend/docs/aftercare-request-recovery.md), [API/database tests](backend/tests/integration/aftercare-replay.test.ts), and [real browser recovery](frontend/tests/e2e/aftercare-real.spec.ts).

### 7. Complete operational jobs pagination release

**Affected page:** `/admin/processing-jobs` for Admin and Super Admin; typed monitoring is also available to `/admin`.

**Current status:** the backend now honors a signed, actor/filter-bound cursor across both job sources; Next/Previous navigation is enabled. The original page boundary survives retry or removal of its row. Job, retry and status response contracts are explicit in OpenAPI and regenerated frontend types. This is live pagination; refreshing page one is necessary to see jobs that moved to newer positions.

**Remaining:** release the matching API/frontend together and verify deployed traversal. Older clients must reload because operational-job cursors are now opaque rather than UUIDs. No migration or provider activation is required.

**Evidence:** [contract and local verification](backend/docs/operational-jobs-pagination.md), [integration cases](backend/tests/integration/operational-jobs-pagination.test.ts), and [real browser cases](frontend/tests/e2e/operational-jobs-real.spec.ts).

### 8. Release complete audit event support

**Affected page:** `/admin/audit` for Admin and Super Admin.

**Current status:** fixed a contract mismatch that could reject an entire page containing existing failed-login, booking-slot or service-category events. Backend filters use the database enums; frontend options/parser cover them completely and are checked against OpenAPI. The audit page response is now explicitly typed. Local verification passed 17 backend cases, six frontend unit cases and nine production-browser cases.

**Remaining:** deploy the matching API before the frontend and refresh existing administrator tabs. No migration or permission change is required. Verify mixed-event reads and filters in the target environment.

**Evidence:** [audit event contract and verification](backend/docs/audit-event-contract.md).

## Implemented capabilities with release work remaining

Operational alert scans now advance through disputes, refunds, payments and paid vehicle holds beyond the first 100 unresolved records, using durable checkpoints. Release migration 58 and the matching general worker, then verify progress and restart recovery in the target environment. See [scan behavior and local evidence](backend/docs/operational-alert-scans.md).

**Operational alert local verification completed:** after PostgreSQL recovered and host disk space became available, a new isolated database replayed all 58 migrations with no Prisma schema difference. All six dedicated scan tests passed with their explicit flags enabled and no skips. The earlier interrupted database and failed replay remain preserved as evidence. Target-environment migration, worker permissions, progress and restart acceptance remain release requirements; see the linked report.

Media deployment correction: the general worker now receives the storage configuration needed for cleanup, and production images include Sharp's required optional binaries. Local configuration/install checks passed; all four Linux images built and all eight container tests passed. Real Spaces verification remains pending. Configure worker storage before releasing the stricter startup guard. See [the evidence and rollout requirements](backend/docs/media-runtime-deployment.md).

Media orphan discovery now skips assets whose cleanup jobs are already pending, so delayed retries and active leases cannot block later orphan scheduling. All 66 media regression cases passed. A separate local working-tree general-worker image also built and passed offline runtime probes. Release still requires the normal clean-commit image build and target-environment verification. See [orphan discovery progress](backend/docs/managed-media.md#orphan-discovery-progress-12-october-2026).

Do not rebuild these capabilities: BG-01–BG-10 and API-01–API-05 have recorded local acceptance. BG-11 reservation agreements and BG-12 Paystack dispute handling also have local implementation evidence. Profile text revisions, review-source discovery and durable review submission recovery have separate acceptance reports. Their exact contracts and release dependencies are linked from the [detailed handoff](BACKEND_IMPLEMENTATION_GAPS.md).

| Reference | Remaining work                                                                                                                 | Required completion evidence                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BG-11     | Obtain approved reservation wording, effective date and provenance; publish through the authorized flow and verify deployment. | Customer sees current approved terms; acceptance and original-key reservation recovery work without duplicate holds.                                                                                       |
| REL-01    | Configure private storage, upload CORS/host allowlisting, migrations and cleanup workers.                                      | Deployed upload/confirm/read/replace/remove for profile, garage, service, product and stock media; ownership enforcement; failed replacement preserves the old asset; cleanup preserves referenced assets. |
| REL-02    | Verify the active workshop handling branch and enquiry/complaint notifications.                                                | Synthetic support record persists against the intended branch and configured provider delivery is observed. API receipt alone does not prove delivery.                                                     |
| REL-03    | Release accepted backend/frontend contracts, migrations and worker repairs in their documented order.                          | Target-environment account/MFA/recovery, private documents, reservation, payment sandbox and server-confirmed financial outcomes; denied role/owner paths and healthy workers.                             |
| CFG-01    | Configure Maps when the owner has a key and a verified location.                                                               | Correct embedded map after configuration; address and external directions remain usable beforehand. No backend Maps endpoint is required.                                                                  |

**Confirmed address:** 133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria. Pizza Jungle is inside Kilimanjaro; use “beside Kilimanjaro” as the landmark. No Maps key or verified Place ID has been supplied. CFG-01 remains deferred.

## Recommended sequence and completion record

1. Release the locally verified preference revision/recovery contract in the documented order.
2. Release the matching support creation, reply and aftercare recovery API/frontend contracts after their local gates and verify them in the target environment.
3. Obtain marketing/privacy policy decisions before implementing or activating those capabilities.
4. Complete release verification for locally accepted features and record the outcome in the target environment.

For each item, record the assigned owner, deployed revision, target environment, prerequisites, test results and evidence links. Keep local and deployed acceptance separate. Use synthetic records and omit credentials or customer data from evidence.

The original handoff was a documentation-only source review. Subsequent preference and support creation implementations and verification are recorded in their linked acceptance reports; other entries retain their original evidence boundaries. No business policy or deployed setting was activated.

This 13 October handoff refresh checked the page register, current product routes/editor and backend contract, marketing guard and privacy capability. Historical test counts above come from their linked reports; this documentation refresh did not rerun database tests, apply migrations, verify backups, perform a restore rehearsal or deploy the application. The subsequent product frontend gate now has separate browser, visual and real-API acceptance in its linked report; that evidence does not establish deployed acceptance.

## Product-category detail acceptance — 17 October 2026

The separately addressable [product-category detail page](frontend/docs/page-quality/work-product-category-detail.md) passed gate 59 on 17 October 2026, reusing ADM-10/ADM-11 without another endpoint or migration. Its 43 detail/catalogue browser cases, 31 unit cases, static/build checks, 36 responsive/state captures and real browser/API/database acceptance passed. A fresh isolated PostgreSQL 18 database replayed 58 migrations and passed database safety checks using a restricted runtime role. Existing application data/grants were preserved; no backup/restore rehearsal or deployment occurred. No new backend implementation gap was identified; optional category-creation receipts remain ADM-12 and target-environment verification is open.

## Order discovery acceptance — 17 October 2026

The missing exact order-number filter is now implemented as ADM-13, using the existing unique index and branch-scoped order API. Private cache headers, query validation and role-specific projection are verified. [Gate 60](frontend/docs/page-quality/work-orders.md) records browser, responsive, accessibility, API and isolated database evidence. This closes the identified list-discovery gap locally; deployment remains open. No new schema or migration, application-data change, backup/restore rehearsal or deployment occurred. Order detail and aftercare are the next separate audits.

## Operational order detail acceptance — 17 October 2026

[Gate 61](frontend/docs/page-quality/work-order-detail.md) now integrates server-supplied usable transitions (ADM-14), private direct/status responses and reviewed versioned mutations with lost-response recovery. Browser, visual, unit, API and isolated database evidence is linked there. No schema, shared database write, backup/restore rehearsal or deployment occurred. The order read still exposes aggregate saved VAT; ADM-15 records the original products/delivery VAT breakdown as a finance follow-up with the owner-policy boundaries above. Aftercare is the next separate page gate.

## Operational aftercare acceptance ? 17 October 2026

[Gate 62](frontend/docs/page-quality/work-aftercare.md) now integrates the private direct saved-request recovery endpoint and assigned active Staff branch rule (ADM-16). Browser, unit, visual, API and isolated database evidence is linked there. Deploy the additive API before the matching frontend and verify role/branch, explicit recovery and private-cache behaviour in the target environment. No schema, shared database write, backup/restore rehearsal or deployment occurred. Latest-100 history remains bounded; ADM-15 remains a finance follow-up. Product inventory is the next separate page audit.

## Product inventory acceptance ? 17 October 2026

[Gate 63](frontend/docs/page-quality/work-inventory.md) integrates literal recorded-part name/SKU search, private list responses and reload-persistent creation reconciliation through the existing unique branch/product lookup. ADM-17 records the additive search contract and release order. Twenty-six browser scenarios, four unit and ten backend cases have passing evidence, with responsive/Axe, real browser/API/database and static/build checks recorded in the report. No endpoint, schema, shared database write, backup/restore rehearsal or deployment was added. The preceding isolated test database and its unchanged migration-safety evidence were reused. Target-environment acceptance remains open; inventory detail is the next separate gate.

## Inventory detail acceptance ? 17 October 2026

[Gate 64](frontend/docs/page-quality/work-inventory-detail.md) verifies named stock facts, reviewed movement/reservation/release/threshold actions, current-access/snapshot checks, receipt validation and reload-persistent pending locks. Existing same-key in-memory retries remain available; explicit saved-record reconciliation never replays a mutation or claims an unproven outcome. ADM-18 records private detail/history/reservation/mutation responses and release acceptance. Twenty-seven browser scenarios, four unit cases, one new backend boundary case, real browser/API/database checks, responsive/Axe and static/build checks have passing evidence. Unchanged stock regression and migration-safety evidence were reused. No endpoint/schema migration, shared data/grant change, backup/restore rehearsal or deployment occurred. Promotions is next; deployed and application-wide acceptance remain open.

## Promotions discovery acceptance ? 17 October 2026

[Gate 65](frontend/docs/page-quality/work-promotions.md) integrates literal name/code search, configuration/type filters, persistent paging and complete responsive promotion facts. ADM-19 records the additive query contract and private administrator responses. Twenty-two browser scenarios, four unit and three backend cases have passing evidence, alongside responsive/Axe, real browser/API/database and static/build/contract checks. The live discovery check preserved all synthetic promotion rows with zero promotion writes, usage or audit additions. No database schema migration, shared data/grant change, backup/restore rehearsal or deployment occurred. Release the additive API query before its frontend. Promotion creation and detail are the next separate audits; deployed and application-wide acceptance remain open.

## Promotion creation acceptance - 17 October 2026

[Gate 66](frontend/docs/page-quality/work-promotion-create.md) closes the local uncertain-creation gap with reviewed actor-bound retries and read-only receipt recovery, including nullable codes. ADM-20 documents the additive contract in the detailed handoff. Twenty-three browser scenarios, four unit and four backend cases have passing evidence, alongside responsive/Axe, native concept comparisons, static/build/contract checks and real browser/API/database acceptance. Three POST attempts created two promotions and two CREATE audits; replay preserved later edits and receipt recovery added no write. The existing receipt model is reused, with no schema/grant change. Current db:check passed all 58 migrations and schema compatibility; unchanged replay evidence was reused. Deploy the additive receipt API before the frontend and verify response loss, role/MFA/CSRF and private headers on the target. No shared database write, backup/restore rehearsal or deployment occurred. Promotion detail is the next separate audit; deployed/application-wide acceptance remains open.

## Promotion detail acceptance - 17 October 2026

[Gate 67](frontend/docs/page-quality/work-promotion-detail.md) verifies named direct reads, complete exact facts, reviewed expected-version edits, fresh access/snapshot checks and reload-persistent uncertainty with read-only recovery. Thirty-six browser scenarios, four unit and three backend cases have passing evidence, plus responsive/Axe/native comparisons, real browser/API/database and static/build checks. ADM-21 records a discovered constraint mismatch: zero fixed discounts/caps were accepted by the API but failed in PostgreSQL. Forward migration 59 widens only those two checks; checkout still rejects a zero payable discount and negative values remain forbidden. The migration, schema note and API regression are committed as dd995b8.

Release that forward migration through npm run db:migrate before claiming zero-value support on another target. Locally, the guarded command created/verified a fresh backup and preserved before-after data hashes for six domain tables; current db:check passed. All 59 migrations separately replayed on a new empty _test database, and restricted runtime privileges were rechecked without grant changes. No shared/application database write, push, deployment or restore rehearsal occurred. [Backend rollout contract](backend/docs/promotion-detail-recovery.md). Vehicle stock is next; deployed/application-wide acceptance remains open.

## Vehicle stock discovery — local acceptance and follow-up

[Gate 68](frontend/docs/page-quality/work-vehicle-stock.md) verifies persistent supported filters, complete responsive records and independent role/branch/privacy boundaries. Thirty-one distinct browser cases, six unit and three API/database cases, 17 Axe scans, native fidelity and real production browser/API/PostgreSQL checks have passing evidence. ADM-22 adds literal matching, listed/unlisted filtering and private staff responses without schema changes. Deploy this API behavior before the dependent UI and verify the target.

**ADM-23 still requires implementation:** inherited specification/featured/price/sort query parameters are not applied by the staff repository. The working index does not expose them. Backend/product own semantics and a compatible contract; QA must prove every accepted or rejected field and stable multi-listing paging. The contract document specifies scope and acceptance. Vehicle creation and detail are the next separate frontend gates. No shared database/grant change, backup/restore operation, push or deployment occurred.

## Vehicle creation — local acceptance and optional recovery

[Gate 69](frontend/docs/page-quality/work-vehicle-create.md) verifies all permitted fields, current access/branch checks, complete review and exact response matching before photo-editor navigation. Twenty-six distinct browser, six unit and three API/database cases have passing evidence, plus 20 final Axe scans, native fidelity, 18 matching source hashes and real browser/API/PostgreSQL checks. Three UI submissions created three records and three CREATE audits; interrupted-save reload and manual reads never replayed a POST. Staff cost omission, branch reassignment and direct cross-branch/Customer/anonymous boundaries passed.

The API now rejects a stock number that exceeds 40 characters after uppercase normalization, before persistence. Deploy this validation with the frontend and verify the target. **ADM-24 remains optional implementation:** original-request receipts are absent; the supported manual reconciliation does not prove the earlier request's outcome. No schema or migration is needed for the completed correction. Current db:check passes 59 migrations; unchanged replay/privilege evidence was reused. No reset, shared data/grant change, backup/restore operation, push or deployment occurred. Vehicle detail is the next separate page gate.

## Workshop vehicle detail — local acceptance and document responses

[Gate 70](frontend/docs/page-quality/work-vehicle-detail.md) verifies named complete facts, guarded specifications/listing/evidence workflows, exact timestamps and role privacy. All 32 distinct browser cases, 43 focused units, three API/database scenarios, 20 new-page Axe scans, native fidelity and 22 matching source hashes have passing evidence. Real production browser/API/PostgreSQL verified seven UI mutations, independent versions, preserved maximum cost/milliseconds and committed-lost-response recovery without replay.

**ADM-25 is implemented locally:** document creation/review now return the existing dates, assessment reason and creation metadata required for strict receipt validation. Deploy this additive projection with the detail UI, then verify the actual environment. No schema migration is needed. **ADM-26 remains optional implementation:** actor-bound original-request receipts for other detail mutations. Explicit current reads do not prove the original outcome; existing photo retry safety remains independent. See the [backend contract](backend/docs/vehicle-stock-detail.md).

Before fixture writes the actual isolated `_test` target was verified and restricted runtime credentials reused. Unchanged 59-migration db:check, replay and privilege evidence was reused. No shared/application database, grant, migration, backup/restore, push or deployment operation occurred. Next separate page gate: vehicle inspections `/admin/inspections`. Application-wide and deployed acceptance remain open.

## Workshop vehicle inspections — local acceptance and optional receipts

[Gate 71](frontend/docs/page-quality/work-inspections.md) verifies persistent status/branch filters and cursor history, complete named requests and reviewed scheduling/progress. Twenty-eight distinct browser cases, six new unit cases, three API/database scenarios, 18 final Axe scans, native fidelity and 20 matching source hashes have passing evidence. Connected production browser/API/PostgreSQL verified 25+3 reloadable paging and five UI transitions/five STATUS_CHANGE audits, including Admin scheduling/rescheduling/completion, committed-lost-response read recovery without replay and Staff self-assignment/reassignment boundaries.

No backend implementation change was required for this supported workflow. **ADM-27 remains optional:** durable original-request receipts for inspection transitions. Preserve existing atomic versions, active assignee/branch eligibility and current-role recovery authorization. The [contract](backend/docs/workshop-inspections.md) records scope and acceptance criteria. Current-read reconciliation does not prove the original request outcome.

The actual isolated `_test` target was verified before fixture writes and restricted runtime credentials reused. Unchanged 59-migration db:check/replay/privilege evidence was reused. No shared/application database, schema, migration, grant, backup/restore, push or deployment operation occurred. Next: vehicle sales `/admin/vehicle-sales`, followed by transaction detail. Application-wide and deployed acceptance remain open.

## Workshop vehicle sales discovery — local acceptance

[Gate 72](frontend/docs/page-quality/work-vehicle-sales.md) verifies complete read-only purchase records, exact saved asking/agreed/reservation values, current role/branch scope, reloadable filters/cursors and named detail links. Twenty distinct browser cases, four units, three API/database scenarios, 20 Axe scans, native fidelity and 16 matching source hashes have passing evidence. Connected production browser/API/PostgreSQL verified 25+3 paging, filters, named detail/Back and unchanged transaction snapshots, with zero mutation requests/audits and one expected privileged READ audit.

No new backend implementation gap was identified for this index. Existing durable-receipt, policy, finance and deployed-release work remains separate. The [API projection contract](backend/docs/workshop-vehicle-sales-discovery.md) records supplied fields and the absence of a current payment ledger. Existing isolated database/replay/privilege setup was reused without schema/grant changes, backup/restore, push or deployment. Next separate gate: `/admin/vehicle-sales/[transactionId]`.

## Workshop vehicle purchase detail — local acceptance and recovery gaps

[Gate 73](frontend/docs/page-quality/work-vehicle-sale-detail.md) verifies guarded direct records, exact amounts/dates/history, reviewed notes, stable drafts, independent versions, signed evidence and reload-persistent uncertainty protection. Twenty-nine browser cases, seven units, three API scenarios, 18 final new-page Axe scans, native fidelity and 22 matching source hashes have passing evidence. Connected production Edge/API/PostgreSQL verified six changes and six transaction mutation audits, including lost-response recovery without replay. A read-only follow-up corrected the harness's assumption about handover audit entity IDs without repeating mutations.

ADM-28 locally completes returned public history, safe evidence-presence metadata and a clear missing-evidence completion conflict. **ADM-29 remains P1:** late evidence attachment and cancelled-handover recovery need product/backend definition. **ADM-30 is optional P2:** durable original-request receipts. See [contract/criteria](backend/docs/workshop-vehicle-sale-detail.md). No schema/migration, shared/application database, grant, backup/restore, push or deployment change occurred. Unchanged database safety evidence was reused; synthetic policy fixtures are not business approval. Next separate page gate: customer records `/admin/customers`.

## Workshop customer directory — locally accepted, no new backend gap

[Gate 74](frontend/docs/page-quality/work-customers.md) passed on 18 October 2026. Existing administrator/MFA-protected directory search, normalized prefix/profile-ID lookup, status/verification filters, registration sort and bound opaque cursors support the complete responsive list. Private reads retain minimal collection/result-count audits. Nineteen distinct browser cases, five units, 22 existing API/database cases, 19 final Axe scans, native fidelity and 11 matching source hashes have passing evidence. Connected production Edge/API/PostgreSQL verified 25+3 paging/reload/Back, combined filters, exact profile/detail navigation, unchanged customer snapshots, zero domain mutations and seven privacy READ audits. The final continuation reused existing customer fixtures; read-only verification corrected an audit-harness field without repeating the completed flow.

No new backend implementation, endpoint, permission or schema/migration change was required. See [API boundary and rollout checks](backend/docs/workshop-customer-directory.md). Existing handover, policy, finance, receipt and release gaps remain separate. The actual isolated `_test` target and restricted runtime credentials were verified before fixture writes. Unchanged 59-migration replay/db:check/privilege evidence was reused. No application/shared database, grant, backup/restore, push or deployment change occurred. Next separate gate: customer detail `/admin/customers/[customerId]`; application-wide and deployed acceptance remain open.

## Workshop customer detail — locally accepted, no new backend gap

[Gate 75](frontend/docs/page-quality/work-customer-detail.md) passed on 18 October 2026. Existing administrator/MFA-protected summary and seven domain-checked related collections support the named read-only detail. Exact money/dates, full references, independent verification, honest nulls and URL activity/cursor history now use complete responsive groups. Twenty browser cases, five units, 17 final Axe scans, native fidelity and 14 exact plus one formatter-equivalent production source comparisons have passing evidence. The unchanged 22 directory API cases were reused from gate74. Connected production Edge/API/PostgreSQL verified 25+3 garage paging/reload/Back, all seven collections, unchanged vehicle snapshots, zero domain mutations and 17 minimal privacy READ audits.

No new backend implementation, endpoint, permission or schema/migration change was required. See [projection/privacy/rollout boundaries](backend/docs/workshop-customer-detail.md). Existing handover, policy, finance, receipt and release gaps remain separate. The actual isolated `_test` target and restricted runtime were verified before synthetic fixtures; existing customer records were reused. No application/shared database, grant, backup/restore, push or deployment change occurred. Unchanged migration/privilege evidence was reused. Next separate gate: staff support `/admin/support`; conversation detail and deployed/application-wide acceptance remain open.

## Workshop staff support discovery — locally accepted, no new backend gap

[Gate 76](frontend/docs/page-quality/work-support.md) passed on 18 October 2026. Existing role/MFA/branch-protected enquiry and complaint collections support the complete read-only queue. Explicit supported filters and category/cursor history survive reload/Back; strict association/scope validation, honest failures and independent pickers preserve protected contact data. Twenty-eight production browser cases, five units, three API/database scenarios, 18 final Axe scans, native fidelity and 16 exact source hashes have passing evidence. Connected production Edge/API/PostgreSQL verified 25+3 paging/reload/Back, filtered complaint/date, conversation return, unchanged full support hashes, zero domain mutation requests, 13 administrator READ audits and role/reassignment boundaries. Continuation reused preserved support fixtures after a harness selector was scoped to queue pagination.

The frontend now accepts existing nullable owned-complaint name/email fields and retains all StaffPicker form defaults while allowing an optional filter. No backend implementation, endpoint, request contract, permission, schema or migration change was required. See [API/privacy/rollout boundary](backend/docs/workshop-support-discovery.md). Existing policy/provider delivery/finance/handover/receipt/release gaps remain separate. Actual isolated `_test` target and restricted runtime were verified before fixture writes; unchanged migration/privilege evidence was reused. No application/shared database, grant, backup/restore, push or deployment change occurred. Next separate gate: staff conversation detail `/admin/support/[kind]/[supportId]`.

## Workshop staff conversation detail — locally accepted

[Gate 77](frontend/docs/page-quality/work-support-detail.md) passed on 18 October 2026. ADM-31 implements closure-serialized staff replies, closed first-acknowledgement rejection and safe scoped message/acknowledgement outcome metadata, without endpoint/request/schema changes. Deploy these additive backend changes with the dependent frontend. Exact reviewed replies, independent versions, preserved drafts and reload-persistent no-replay reconciliation are locally accepted. ADM-32 above records optional durable original-request recovery.

Thirty-nine production browser cases, seven units, five API/database scenarios, 21 final Axe scans, native fidelity and 20 exact source hashes pass. Connected production Edge/API/PostgreSQL verified 50+3 reloadable history/Back, nine UI writes/nine mutation audits, 23 privileged READ audits, a committed lost response saved exactly once, unchanged foreign record and role/reassignment boundaries. See [contract, recovery criteria and rollout limits](backend/docs/workshop-support-conversation.md). The actual isolated test target and existing restricted runtime were verified before fixtures; unchanged migration/privilege evidence was reused. No application/shared database, schema, migration, grant, backup/restore, push or deployment operation occurred. Privacy review, moderation, finance, policy/provider delivery and deployed/application-wide acceptance remain separate.

## Workshop privacy review — locally accepted

[Gate 78](frontend/docs/page-quality/work-privacy.md) passed on 18 October 2026. ADM-33 implements compatible staff query filters, minimal private READ audits, deterministic hold reads, account protection/approval serialization and exact once-only release outcomes. No endpoint, permission, schema or migration change is needed. Deploy the matching backend/OpenAPI/generated frontend together. ADM-34 records optional durable recovery; ADM-35 above records full hold history beyond the existing latest 100 projection. Actual deletion/anonymization remains dependent on approved retention policy and a separate execution workflow.

Thirty-one production browser cases, six units, five API/database scenarios, 20 final new-page Axe scans, native fidelity and 21 exact source hashes pass. Connected Edge/API/PostgreSQL verifies 25+3 reloadable paging/Back, combined filters/selection, four successful changes/four mutation audits plus one correctly blocked approval, 35 READ audits, exact release, approval without deletion, monotonic dates, lost-review recovery without replay and access boundaries. See [contract and release limits](backend/docs/workshop-privacy-review.md). The actual isolated test target/restricted runtime were verified; existing owners/grants and application/shared data were preserved. No schema/migration, existing-grant, backup/restore, push or deployment operation occurred; unchanged migration/privilege evidence was reused. Next: review moderation. Finance, organisation, retention approval and deployed/application-wide acceptance remain open.
