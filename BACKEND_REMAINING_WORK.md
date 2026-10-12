# Allied AutoTech — Remaining Backend Work

Reviewed: 12 October 2026. Scope: the 46 locally accepted frontend milestones through customer-care conversations, plus the current backend implementation sources. See the [page register](frontend/docs/page-quality/README.md) and [detailed backend handoff](BACKEND_IMPLEMENTATION_GAPS.md).

This is an implementation and release checklist based on completed work. Local acceptance is not deployed acceptance. Remaining customer, Staff, Admin and Super Admin page audits may identify additional gaps. Customer order aftercare has not yet passed its page gate.

## Implementation backlog

Priorities are proposed: P1 requires completion before activating the affected capability; P2 is an optional reliability enhancement to an existing supported workflow. Policy-dependent capabilities must remain disabled until their business requirements and implementation are approved.

| Item                                                     | Current status                                                        | Priority             | Responsible roles                             |
| -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| Durable support request recovery                         | Not implemented                                                       | P2                   | Backend, frontend, QA                         |
| Durable support reply recovery                           | Not implemented                                                       | P2                   | Backend, frontend, QA                         |
| Notification preference conflict protection and recovery | Locally verified; coordinated release and deployed acceptance pending | P2                   | Backend, frontend, QA                         |
| Marketing delivery                                       | Disabled; policy and implementation required                          | P1 before activation | Business owner, backend, QA                   |
| Privacy deletion/anonymization execution                 | Disabled; policy and implementation required                          | P1 before activation | Business owner, policy reviewers, backend, QA |

### 1. Durable support request recovery

**Affected pages:** customer-care request creation at `/dashboard/support`.

**Existing behavior:** customer enquiry and complaint creation, ownership checks, branch selection, source validation, history and auditing already exist. A lost response after a successful commit cannot be replayed using an original request key. Repeating the submission can create another record; absence from the first history page does not prove failure.

**Implement:** extend the existing customer creation operations with an actor- and operation-scoped request key bound to the normalized body. Commit the receipt, support record and creation audit atomically. Define concurrent-request handling, changed-body conflicts, retention/expiry, and authorized replay of the original result after later source or branch changes. Preserve complaint policy, rate limits, CSRF and ownership. Update OpenAPI, generated types and explicit frontend recovery together. Anonymous public-contact recovery needs a separate scope decision; customer-scoped keys do not solve it automatically.

**Acceptance:** for both enquiry and complaint creation, lose a committed response, reload and explicitly replay the original key/body. Verify one record and one creation audit. Concurrent duplicates must return the original result; changed bodies and foreign actors must fail without writes or information disclosure. Verify source/branch changes and expired keys. Provider delivery needs separate evidence.

**Evidence:** [support routes](backend/src/modules/support/support.routes.ts), [support service](backend/src/modules/support/support.service.ts), [completed customer-care page](frontend/docs/page-quality/customer-care.md), and [detailed criteria](BACKEND_IMPLEMENTATION_GAPS.md#support-creation-replay---optional-enhancement).

### 2. Durable support reply recovery

**Affected pages:** enquiry and complaint conversations at `/dashboard/support/[kind]/[supportId]`.

**Existing behavior:** owned, paginated messages and customer replies work. Closed conversations reject new replies; resolved conversations permit follow-up. The frontend preserves uncertain outcomes and offers manual reconciliation, but resending a lost-response reply can create another message and audit.

**Implement:** bind a request key to the actor, conversation kind/ID and normalized reply. Commit receipt, message, audit and any notification intent atomically. Replay the authorized original result without another message, audit or notification enqueue. Define expiry and what happens when the conversation closes or access changes after the original write. Keep internal messages private and preserve customer-only payload validation.

**Acceptance:** test both conversation kinds with response loss, reload, concurrent same-key requests, body mismatch, expiry, closed records and revoked access. One committed reply must produce one message, one audit and at most the original notification intent. Include recovery when the reply is beyond the first message page. Browser/API/database evidence is required.

**Evidence:** [message service](backend/src/modules/support/support.service.ts), [completed conversation pages](frontend/docs/page-quality/customer-care-detail.md), and [detailed criteria](BACKEND_IMPLEMENTATION_GAPS.md#support-reply-replay---optional-enhancement).

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
2. If selected for implementation, add support creation recovery, then reply recovery, with matching frontend contracts and regression evidence.
3. Obtain marketing/privacy policy decisions before implementing or activating those capabilities.
4. Complete release verification for locally accepted features and record the outcome in the target environment.

For each item, record the assigned owner, deployed revision, target environment, prerequisites, test results and evidence links. Keep local and deployed acceptance separate. Use synthetic records and omit credentials or customer data from evidence.

The original handoff was a documentation-only source review. Subsequent preference implementation and verification are recorded in the linked acceptance report; other entries retain their original evidence boundaries. No business policy or deployed setting was activated.
