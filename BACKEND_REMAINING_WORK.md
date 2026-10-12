# Allied AutoTech — Remaining Backend Work

Reviewed: 12 October 2026. Scope: the 48 locally accepted frontend milestones through work-dashboard overview, plus the current backend implementation sources. See the [page register](frontend/docs/page-quality/README.md) and [detailed backend handoff](BACKEND_IMPLEMENTATION_GAPS.md).

This is an implementation and release checklist based on completed work. Local acceptance is not deployed acceptance. Remaining customer, Staff, Admin and Super Admin page audits may identify additional gaps. Work-dashboard overview `/admin` has passed its local page gate; the next frontend audit is workshop bookings `/admin/bookings`. Existing overview and operations endpoints cover its requirements; no additional backend endpoint or migration is needed. See the [overview acceptance](frontend/docs/page-quality/work-overview.md).

## Implementation backlog

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

### 3. Complete notification preference acceptance

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
