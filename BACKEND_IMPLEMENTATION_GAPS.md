# Allied AutoTech — Backend Implementation Gaps

For a concise implementation backlog with priorities, owners and acceptance criteria, see [Remaining Backend Work](BACKEND_REMAINING_WORK.md). This detailed handoff retains historical requirements and acceptance evidence.

**Implementation update (9 October 2026):** BG-01 through BG-10 are implemented and locally accepted. The [original implementation handoff](backend/docs/backend-gaps-handoff.md) covers BG-01 through BG-06; the payment and financial-document acceptance records below cover BG-07 and BG-08. BG-09 (customer current-care overview) has also passed its separate local backend and frontend gate. BG-10 fixes quotation expiry and has passed its backend regression and static checks. API-01 through API-05 also have recorded local acceptance. Deployment and integration checks remain open.

Prepared: 30 September 2026

**BG-12 implementation update (13 October 2026):** Paystack disputes now use authenticated provider lookup, capture correlation, conservative resolution mapping and separate confirmed chargeback amounts. Backend, frontend unit and browser acceptance has passed; deployment boundaries are recorded in [Paystack dispute acceptance](backend/docs/paystack-dispute-contract.md).

Last reviewed: 12 October 2026, following the completed Booking creation, Home, expanded Vehicles, Shop and Services listing milestones, expanded Vehicle, Product and Service detail, expanded Customer Care, public Reviews, About, Help index and Help articles, Quotation authoring/review, Vehicle inspection/enquiry creation, Cart/checkout, Customer order detail/payment-request handoff, dedicated Customer payment detail, Invoice/receipt documents, Saved items/favourites, Product cart confirmation drawer/notifications, Login, Registration, Forgot-password recovery requests, Reset password, Email verification/resend, MFA challenge/enrollment/recovery codes, Customer and Staff/admin account security, Customer dashboard overview, Customer bookings list, Customer booking detail (including BG-10 quotation-expiry repair), Customer orders list, Customer payments list, Customer invoices list, Customer garage/vehicles list, Customer vehicle photo detail, Customer inspection history, Customer vehicle purchases list, Customer vehicle purchase detail, Customer profile, Customer privacy requests, Customer notifications, Customer reviews, Customer care list, Customer care conversations, Customer order aftercare, Work-dashboard overview, Workshop bookings, Workshop booking detail, and the owner's workshop-landmark confirmation.

Basis: completed frontend milestones, recorded backend acceptance, and read-only review of the current backend routes, schemas and exported OpenAPI contract.

Status: BG-01 through BG-10 have recorded local acceptance evidence, including the [payment report](frontend/docs/page-quality/payment-detail.md) and [invoice/document report](frontend/docs/page-quality/invoice-detail.md). BG-11 has recorded backend, contract and local frontend/browser acceptance; approved business wording and deployed verification remain outstanding. Remaining work also includes deployed integration verification and Maps configuration. Verification is limited to the source review and local checks in the linked capability and page reports; staging has not been verified.

**Remaining delivery:** BG-01 through BG-10 and API-01 through API-05 have recorded local acceptance. BG-11 implementation now has separate local acceptance; approved reservation wording and deployed verification remain open. The service-discovery record below now includes API-03 implementation, frontend integration and real browser/API/database acceptance. REL-01 through REL-03 cover deployment and integration verification; CFG-01 covers Maps configuration when available. Remaining page audits may identify additional implementation gaps. Use the actionable backlog below for ownership and acceptance criteria.

**Security follow-up (9 October):** new proxy-address and Next.js advisories and compatible transitive updates were addressed; backend full-tree and frontend production-dependency npm audits now report zero advisories. Frontend lint tooling retains the unpatched SEC-015 brace-parser advisory. See the [dependency security follow-up](security_best_practices_report.md); its release regression and the broader application/deployment audit are separate from discovery feature acceptance.

**Availability repair (9 October):** SEC-016 maps confirmed Prisma driver connection failures, including the reported `ECONNREFUSED` and raw-query adapter errors, to the existing safe 503 `DATABASE_UNAVAILABLE` response. Unrelated errors keep their existing behavior; mutations are not retried automatically. Forty focused mapping/real refused-connection/HTTP foundation cases passed. OpenAPI now documents dependency-unavailable responses across all 308 operations; exported artifacts and frontend types are regenerated and validated. This handles an outage correctly but does not restore a stopped or unreachable database.

**Provider HTTP availability (13 October):** SEC-032 replaces whole-response payment buffering with streaming byte limits and gives payment/email/SMS requests an independent wall-clock deadline. Slow or broken cancellation cannot hold callers indefinitely. All 154 regression cases across 14 files passed, including 36 focused transport cases using real loopback HTTP streams. No schema or frontend change was required. See [verification and rollout](backend/docs/provider-http-availability.md).

**Log confidentiality (13 October):** SEC-033 removes raw exception bodies, messages, nested causes, database invocation text and URL parameter values from newly emitted operational logs. Recognized error metadata, request IDs, timing and route templates remain available. All 135 regression cases across 12 files passed, including 16 emitted-log privacy cases. No migration or frontend change is required. See [acceptance and rollout](backend/docs/logging-privacy.md).

**Review boundary:** this handoff covers the fifty accepted frontend milestones through workshop booking detail and the current implementation sources. Remaining dashboard routes may reveal further gaps. Existing acceptance counts below are linked historical evidence, not tests rerun for this documentation update. Source code and test files alone do not establish completed acceptance.

**Full backend regression:** 853 cases passed in the complete database-enabled Vitest run on a fresh 55-migration database. The four intentionally isolated owner/workshop cases also passed, for 857 distinct passing cases and no failures. A separate schema comparison exposed four missing service-search index declarations; these are now reconciled, and migration replay automatically checks schema drift. Backend static/build/contract checks and the zero-advisory dependency audit passed. See the [completion audit](backend/docs/backend-completion-audit.md) for evidence, scope and remaining contract/deployment work; this does not close the overall goal.

## What still needs to be delivered

This is the current assignment summary. Detailed criteria and source links follow below. Local acceptance means the recorded local checks passed; it does not establish deployment readiness.

| ID     | Status                                                             | Work remaining                                                                                                                                                                                                                       | Responsible roles                    | Completion evidence                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BG-11  | Implementation locally accepted; approved content open             | Obtain approved business wording, effective date and provenance. Owner publication, explicit customer review, cancellation, one reservation and lost-response replay after withdrawal have real local browser/API/database evidence. | Business owner, deployment, QA       | Approved content and target-environment reservation acceptance; local evidence is in the agreement report.                                                                                                                                                 |
| BG-12  | Implemented; local verification recorded, deployed acceptance open | Authenticated Paystack dispute lookup, provider status/resolution mapping, partial chargeback amounts, repeated reminders and review visibility in both queues.                                                                      | Backend, QA, deployment owner        | 159 unique backend cases, six frontend unit cases and 14 browser scenarios passed; 55 migrations replayed and historical financial data preserved. Browser and rollout evidence: [Paystack dispute acceptance](backend/docs/paystack-dispute-contract.md). |
| REL-01 | Deployment verification open                                       | Configure private object storage, upload CORS/host allowlisting and cleanup workers; verify all five managed-image capabilities and private file availability.                                                                       | Deployment, backend, QA              | Real deployed upload, confirmation, authorized read, replacement, removal and cleanup; failed replacement preserves existing media; unauthorized reads fail.                                                                                               |
| REL-02 | Deployment verification open                                       | Verify the active workshop handling branch and configured enquiry/complaint notification delivery.                                                                                                                                   | Operations, backend, QA              | Persisted support record against the correct branch plus observed provider delivery; an API success alone is insufficient.                                                                                                                                 |
| REL-03 | Deployment verification open                                       | Release locally accepted migrations/contracts/worker repairs in their documented order; verify accounts, MFA, recovery, documents, reservations and server-confirmed payments.                                                       | Deployment, backend, QA              | Target-environment role/owner isolation, email and MFA journeys, private document reads, provider sandbox outcomes and healthy workers.                                                                                                                    |
| CFG-01 | Configuration deferred until available                             | Configure the restricted Maps key and verify the location; preserve address-based directions in the meantime. No backend Maps endpoint is needed.                                                                                    | Business owner, frontend, deployment | Correct workshop map when configured; usable fallback before configuration; approved landmark remains “beside Kilimanjaro.”                                                                                                                                |

**Already implemented locally:** BG-01 customer directory; BG-02 profile photos; BG-03 garage images; BG-04 service images; BG-05 product binary uploads; BG-06 stock-image management; BG-07 checkout availability; BG-08 invoice/receipt documents; BG-09 current-care overview; BG-10 quotation expiry. API-01 through API-05 also have recorded local acceptance. Preserve these implementations and use their linked reports for release verification instead of rebuilding them.

**Business inputs still required:** approved reservation agreement content, effective date and provenance for BG-11 (publication authority is Super Admin); Maps configuration when available for CFG-01. The confirmed workshop address is **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. Pizza Jungle is within Kilimanjaro and must not replace the approved landmark in customer-facing copy. No verified Place ID has been supplied.

Additional source-confirmed contract limitations, their implementation scope and acceptance criteria are listed under [Deferred backend capabilities](#deferred-backend-capabilities). They are separate from release verification and do not invalidate the accepted workflows.

### Backend implementation follow-ups

The table distinguishes locally implemented contract work from proposed extensions. Remaining proposals are not implemented capabilities or newly established release blockers. Business-dependent features remain disabled until their policy requirements are resolved. The review items came from the completed [customer-reviews gate](frontend/docs/page-quality/customer-reviews.md); source discovery and durable submission recovery have since been implemented with separate evidence.

| Reference                                 | Priority / dependency             | Implementation remaining                                                                                                                   | Owner                                         | Detailed acceptance criteria                                                                                             |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Profile conflict protection               | Locally implemented               | Release the profile revision migration and matching API/frontend; verify deployed conflict recovery.                                       | Backend, frontend, QA                         | [Profile text conflict protection](#profile-text-conflict-protection---optional-enhancement)                             |
| Privacy execution                         | Policy approval required          | Define and implement separately authorized, auditable execution after retention rules are approved. Intake and review already exist.       | Business owner, policy reviewers, backend, QA | [Privacy execution](#privacy-execution---policy-dependent-future-capability)                                             |
| Marketing delivery                        | Policy approval required          | Implement approved campaign/consent/unsubscribe behavior and enforce withdrawal at dispatch. Saving a preference does not enable delivery. | Business owner, backend, QA                   | [Marketing delivery and preference contracts](#marketing-delivery-and-preference-contracts---policy-dependent-follow-up) |
| Preference conflict protection and replay | Locally implemented               | Release migration 57 with the matching API/frontend; verify deployed conflict and recovery behavior.                                       | Backend, frontend, QA                         | [Preference recovery acceptance](backend/docs/notification-preference-recovery.md)                                       |
| Review submission replay                  | Locally implemented               | Release the required request-key contract and matching frontend; verify deployed original-request recovery.                                | Backend, frontend, QA                         | [Review submission recovery](#review-submission-recovery---optional-enhancement)                                         |
| Review source discovery                   | Locally implemented               | Release the private source endpoint and matching frontend; verify deployed availability and draft restoration.                             | Backend, frontend, QA                         | [Source discovery acceptance](backend/docs/review-source-discovery.md)                                                   |
| Support creation replay                   | Locally verified; release pending | Customer-scoped original-request recovery now prevents duplicate enquiry/complaint creation; deploy matching API/frontend.                 | Backend, frontend, QA                         | [Support creation replay](#support-creation-replay---optional-enhancement)                                               |
| Support reply replay                      | Locally verified; release pending | Original customer reply recovery now prevents duplicate messages, audits and notification intents, preserving ownership and closure rules. | Backend, frontend, QA                         | [Support reply replay](#support-reply-replay---optional-enhancement)                                                     |

Implement selected contract changes before dependent UI, update OpenAPI and generated types, and record database/API/browser evidence. Keep the deployment tasks above open until verified in their target environment.

## Delivery checklist based on completed work

**Dispute observation integrity (12 October):** SEC-030 prevents conflicting payment references, amounts or currencies from settling an existing dispute and preserves its first resolved outcome/time. Conflicts remain auditable, and losing webhook ownership rolls back their anomaly writes. The 127-case regression and final 17-case dispute run passed (128 unique cases), as did static/contract checks, 54-migration replay and an upgrade preserving 12 historical synthetic disputes and all ledger rows. See [acceptance and rollout](backend/docs/dispute-observation-integrity.md). Apply the guard migration and deploy matching API/workers after draining older versions. BG-12 provider normalization is now implemented with separate [acceptance evidence](backend/docs/paystack-dispute-contract.md).

**Refund dispatch boundary (12 October):** SEC-029 prevents a delayed batch from submitting a refund after a dispute or review hold, claims each item immediately before its call and preserves late provider receipts without releasing review. Database retries cannot repeat the provider submission. The 82-case regression and separate final 10-case dispatch run passed (83 unique cases), with static/contract checks. See [behavior and rollout](backend/docs/refund-dispatch-boundary.md). Deploy matching API/general workers together after draining older processes; no migration beyond SEC-028 is added. Live provider acceptance remains open.

**Refund poll ownership (12 October):** SEC-028 gives each due provider reconciliation a UUID claim and UTC lease, prevents stale success/failure responses from changing newer decisions, preserves live claims at the retry limit and keeps worker fields out of API responses. The final 110 tests across 16 files passed, along with static/contract checks and all 53 migrations. An additive upgrade preserved 111 historical synthetic refunds and ledger data. See [acceptance and rollout](backend/docs/refund-poll-ownership.md). Drain old API/general workers, apply the new migration and release matching generated clients and code together. Live provider and broader backend acceptance remain open.

**Storage operation bounds (12 October):** SEC-027 adds complete 20-second deadlines to private verification and managed image reads/writes/deletes, limits signature reads to 16 bytes even when a provider ignores Range, and cancels oversized or stalled bodies without awaiting broken cancellation. Provider faults return safe 503 errors; invalid evidence retains validation behavior. All 48 focused unit/HTTP/PostgreSQL regressions and static/contract checks pass. See [acceptance and rollout](backend/docs/private-storage-availability.md#complete-storage-operation-bounds---12-october-2026). Deploy the API and worker repair together; no migration is needed. Live Spaces configuration remains deferred under REL-01.

**Webhook ownership and retry repair (11 October):** SEC-024 makes completion conditional on the claimed event generation inside financial transactions, protects fresh final leases, skips stale batches, and makes the existing audited manual retry usable after automatic exhaustion without resetting history. Duplicate callbacks preserve queue decisions, and Monnify mismatch receipts/review holds commit atomically. Twenty-one new cases and 125 regression tests pass, with 46 final claim/clock checks. See [behavior, contract and rollout](backend/docs/webhook-retry-ownership.md). Drain/restart API and general workers together; deployment and historical recovery remain open.

**Booking-reminder ownership repair (11 October):** SEC-023 prevents delayed attempts from enqueueing, cancelling or recording failures under a newer claim. Exhausted crash recovery cannot abort a valid reminder batch, and a fresh final lease remains protected. Eight new PostgreSQL cases and 57 related tests pass. See [behavior, verification and rollout](backend/docs/booking-reminder-ownership.md). No migration/API change; drain and restart general workers. Historical recovery remains open; SEC-024 subsequently repaired payment-webhook ownership.

**Database deadline repair (9 October):** SEC-022 standardizes application connections and runtime SQL on UTC, protecting authentication/MFA cleanup, idempotency retention, shared rate limits, reminders, webhook retries and operational/refund timestamps from PostgreSQL session-zone changes. An additive migration fixes the refund trigger's clock while preserving its authorization checks. See [clock behavior, tests and rollout](backend/docs/database-time.md). Apply the migration and restart API/workers; historical shifted values are not automatically rewritten.

**Messaging concurrency repair (9 October):** SEC-021 prevents stale notification/account-email worker completions and failures from overwriting a newer claim, skips superseded items in an old batch, and makes paired notification transitions atomic. Explicit UTC scheduling/leases pass tests under UTC, Lagos and New York database sessions. See [worker behavior, acceptance and rollout](backend/docs/notification-retries.md#messaging-worker-ownership-repair--9-october-2026). No migration or frontend contract change. SEC-022 subsequently repaired the remaining runtime SQL clocks; historical stranded-job recovery remains open.

**Notification retry repair (9 October):** SEC-020 makes the existing Admin/Super Admin retry action reset notification outbox and delivery records atomically, supports valid zero-attempt dead letters and preserves consent checks, cumulative attempts and provider keys. Inconsistent or completed deliveries fail without a partial change. Ten new database/HTTP cases and 30 existing worker/security/contract tests pass. The dashboard now exposes zero-attempt retries. See [retry behavior, verification and remaining boundaries](backend/docs/notification-retries.md); live delivery and legacy stranded-state recovery are not claimed.

**Private storage integrity repair (9 October):** SEC-019 removes automatic fabricated upload/download URLs and unconditional private-file verification when no bucket is configured. Runtime returns a safe 503; document/payment/handover checks preserve database state, and test fixtures explicitly inject matching bytes. The focused 34-test gate, expanded database check, OpenAPI tests and static/contract checks pass. See [private storage acceptance](backend/docs/private-storage-availability.md). No migration or new frontend workflow is required. Actual Spaces setup remains deferred under REL-01.

**Confirmation lifecycle repair (9 October):** SEC-018 prevents delayed confirmation retries from rewriting already removed images and makes cleanup wait for a verified write/attachment transaction before checking references. Five new concurrency/expiry tests and the existing media/worker checks pass together (65 total). See [confirmation acceptance and rollout](backend/docs/managed-media.md#confirmation-and-cleanup-serialization-9-october-2026). Deploy the API and general worker together after draining older processes. No new migration or frontend contract is required; actual Spaces acceptance remains under REL-01.

**Media cleanup repair (9 October):** SEC-017 fixes stale workers completing or rescheduling a newer cleanup request and claiming jobs from an outdated deadline. Six PostgreSQL concurrency/retry cases and 54 existing media/worker regressions pass together; backend typecheck/build/lint/format/secret checks pass. See [cleanup acceptance](backend/docs/managed-media.md#cleanup-concurrency-regression-9-october-2026). Deploy the updated general worker; no new migration or frontend contract is required. Live storage acceptance remains under REL-01, and the broader backend audit remains open.

**Current booking-detail audit:** BG-10 was found during real database verification: the quotation-expiry worker incremented the immutable document `version`, causing PostgreSQL to reject expiry and interrupt the worker. The implementation now advances `revision` and preserves document version/amounts; the focused repeat-run/audit regression and ten existing booking-policy, deposit and settlement-locking checks pass (11 total). Backend TypeScript, lint and build checks pass. The booking-detail page gate is locally accepted, including real customer API/browser transactions. See [booking-detail acceptance](frontend/docs/page-quality/customer-booking-detail.md). No migration or endpoint change is required; deploy the updated worker with the backend release.

Use the IDs below when creating implementation or release tickets. An unchecked item means its stated acceptance evidence is still outstanding; it does not mean an existing endpoint must be rebuilt.

- [x] **BG-01–BG-06 — implementation and local acceptance:** customer directory and the five managed-media capabilities have recorded completion. Preserve their contracts and regression coverage.
- [x] **BG-07 — payment checkout availability:** owned detail projection, OpenAPI export, frontend types, provider visibility and local acceptance are complete. Retain regression coverage; deployed provider acceptance remains under REL-03.
- [x] **BG-08 — invoice and receipt documents:** owner-authorized document projections, private PDFs, verified-settlement receipts and frontend download/share integration passed local acceptance. Deploy the migration, bundled fonts and backend contract, then verify target-environment behavior under REL-03.
- [x] **BG-09 — customer current-care overview:** owner-scoped current care, contract/types, isolated backend tests, browser/visual checks and real API/proxy acceptance are complete. Deploy backend before frontend; target-environment verification remains under REL-03.
- [x] **BG-10 - quotation expiry revision:** preserve immutable document version/amounts, advance concurrency revision, and audit expiry once. Eleven actual database regressions and backend type/lint/build pass. Deploy the updated expiration worker; no migration or endpoint change is needed.
- [ ] **BG-11 — approved vehicle reservation terms:** backend, contract and frontend/browser acceptance are recorded. Approved business content and deployed verification remain open. Without an applicable approved document, new online agreement acceptance remains unavailable. See the implementation criteria below.
- [ ] **REL-01 — deployed media acceptance:** configure the private storage integration and verify real upload, confirmation, authorized reads, replacement, removal and cleanup for each media resource.
- [ ] **REL-02 — deployed customer-care acceptance:** verify the active handling branch, persisted support record and actual configured notification delivery. An API receipt alone does not establish delivery.
- [ ] **REL-03 — deployed account/payment acceptance:** verify role and customer isolation, session/recovery behavior, provider sandbox outcomes and server-confirmed payment state.
- [ ] **CFG-01 — Maps configuration, when available:** supply the restricted Maps key and verify the workshop location. Retain **beside Kilimanjaro** in the address and directions. A verified Place ID is not currently available; address-based directions remain supported.
- [x] **API-01 — vehicle discovery locally accepted:** bounded make/model options, exact filtered totals, authenticated pagination, frontend integration and real API/database/browser verification passed. Deployment verification remains open.
- [x] **API-02 — Shop discovery locally accepted:** catalogue-wide category/brand/compatibility options, exact totals, signed paging and price/availability filters passed local database, frontend and production-browser acceptance. See the [Shop discovery report](frontend/docs/page-quality/shop-expanded.md). Deployment verification remains open.
- [x] **API-03 — service discovery locally accepted:** server search, reusable administrator-managed categories, bounded options, sorting, signed pagination, exact totals and frontend integration have recorded local acceptance. Deploy the migration and backend before the dependent frontend; verify the target environment. See [service discovery](backend/docs/service-discovery.md).
- [x] **API-04 — inspection/enquiry retry local acceptance:** backend receipts and frontend recovery passed nine PostgreSQL scenarios, 353 frontend unit tests and 48 browser scenarios. A real browser/API check dropped each committed creation response, reloaded, retried the original key/body and verified one record and one audit per action. See [acceptance evidence](backend/docs/vehicle-creation-retries.md). Deploy backend before frontend and verify the target environment.
- [x] **API-05 — saved-vehicle pagination locally verified:** bounded customer read and frontend integration preserve the legacy array contract, availability and ownership. Verified customer-bound cursors, deletion between pages, empty/final pages and account changes. Deploy the index migration and backend before the dependent frontend.

**Current audit boundary:** forty-one expanded frontend milestones through customer profile have local acceptance records, including [Cart/checkout](frontend/docs/page-quality/cart-checkout.md), [Order detail](frontend/docs/page-quality/order-detail.md), [Payment detail](frontend/docs/page-quality/payment-detail.md) and [Invoice detail/documents](frontend/docs/page-quality/invoice-detail.md). [Saved items/favourites](frontend/docs/page-quality/saved-items.md) now have local acceptance using the existing APIs. Remaining account/role dashboards still require their own audits. Their presence in the brief does not establish a missing backend contract. Add gaps only after inspecting applicable routes, schemas and authorization.

**Creation retry boundary:** the two creation endpoints accept an optional `Idempotency-Key`; callers without it retain previous behavior without duplicate protection. The frontend saves the reviewed intent and key in tab-scoped session storage and offers verified reload recovery. Backend retention is 24 hours; the client uses 23 hours. Expired, redacted or cross-device intents require history recovery, while inaccessible browser storage requires restoring storage before a new send. A new key is a new intent, not a guarantee against duplicate creation. See API-04 below.

**Refund observation repair (11 October):** SEC-025 restricts Paystack refund correlation to its own provider, preserves completed refund records and ledger entries, retains conflicting observations as anomalies, and prevents later pending/failed callbacks or delayed polls from clearing review holds. All 21 focused PostgreSQL cases pass. See [behavior, regression evidence and rollout](backend/docs/refund-observation-integrity.md). No new migration or payload shape; deploy API and general workers together. Live provider acceptance and the broader audit remain open.

## Purpose and scope

Use this handoff to plan remaining backend and deployment work without rebuilding capabilities that already exist. Preserve existing authentication, authorization, response envelopes, CSRF protection, idempotency, concurrency handling and domain rules.

The redesign identified six gaps. All six now have backend routes, frontend integration and recorded local acceptance. The original requirements below are retained as historical acceptance baselines; they must not be treated as a new list of absent endpoints. Paths omit `/api/v1`. Current contracts are authoritative where they differ from the original proposals. Later page audits identified optional discovery enhancements, documented separately below.

| ID    | Originally identified capability                        | Current implementation                                                                 | Remaining work             |
| ----- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------- |
| BG-01 | Admin customer directory and aggregate customer details | Real directory and bounded related-record reads; local acceptance recorded             | Retain regression coverage |
| BG-02 | Customer profile photo                                  | Managed upload, replacement and removal; initials fallback                             | Verify deployed storage    |
| BG-03 | Customer garage images                                  | Owner-only gallery, order, cover and removal                                           | Verify deployed storage    |
| BG-04 | Service image management                                | Editor, public image projections and local acceptance recorded                         | Verify deployed storage    |
| BG-05 | Direct product image upload                             | Binary upload and hosted-image management; local acceptance recorded                   | Verify deployed storage    |
| BG-06 | Editing/removing attached stock vehicle images          | Metadata, ordering, cover, replacement, removal and preview; local acceptance recorded | Verify deployed storage    |

### Current status and release boundaries

- **BG-01 — locally verified:** mounted administrator-only directory and related-record reads have recorded local acceptance. See the implementation audit below for the actual contract and results; this is not a deployment claim.
- **BG-02 and BG-03 — locally verified, staging pending:** managed profile and garage media now exist. Their contracts and local evidence are documented in [Managed image lifecycle](backend/docs/managed-media.md). Real object-storage configuration and end-to-end staging checks remain outstanding.
- **BG-04 and BG-05 — locally verified, staging pending:** service media and product binary uploads have separate recorded backend, frontend and browser acceptance results in [Managed image lifecycle](backend/docs/managed-media.md). Product hosted-image management remains compatible. These records do not certify deployed storage.
- **BG-06 — locally verified, staging pending:** stock image mutations, authenticated preview and frontend integration have recorded local lifecycle, branch/role, concurrency and publication checks. See [stock-media acceptance](backend/docs/managed-media.md#stock-vehicle-images-bg-06). Existing upload, hosted/legacy image and non-image asset behavior remain supported. Deployed storage remains unverified.
- **Contact — no new submission endpoint required:** public enquiries and complaints already have backend routes. Branch setup and Maps configuration are tracked separately below.
- **Verification scope:** the original redesign handoff records completed frontend checks. The later Contact refinement passed its separate page gate; see its milestone report for scoped browser and real API evidence. Customer-directory implementation has its own acceptance record and must not inherit either frontend completion claim.

Suggested ownership: backend owns DTOs, authorization, persistence and media lifecycle; frontend owns integration after the contracts are available; deployment owners configure storage and Maps and verify the deployed integrations. No implementation is considered complete solely because an endpoint or button exists.

### Remaining delivery order

BG-08 and BG-09 are locally accepted. Deploy the BG-09 current-care projection before its dependent frontend; it requires no migration. For BG-08, deploy its reviewed migration and backend contract before the dependent frontend; package the licensed runtime fonts and verify authenticated JSON/PDF reads and denied access in the target environment. The release tasks below remain open.

1. **Verify deployed overview and payment availability:** deploy BG-09 before the customer overview frontend and verify owner isolation, empty/current/historical states, private caching and representative-volume latency. Deploy the locally accepted BG-07 contract before its dependent frontend and verify the configured provider list in the target environment under REL-03.
2. **Verify deployed media:** configure private object storage, frontend upload-host allowlisting, CORS and the cleanup worker. Apply reviewed migrations through the normal deployment process. Exercise actual upload/read/replace/delete and failure recovery in staging; injected storage tests do not satisfy this gate.
3. **Complete Contact configuration:** verify the deployed active handling branch and provider delivery. Add the Maps key when available; the address-based fallback already works without a Place ID.
4. **Verify deployed account and payment integrations:** exercise the existing role/session, payment-provider sandbox and email/recovery flows under REL-03. Record server-confirmed outcomes and failed or unauthorized paths in the target environment.
5. **Deploy the quotation-expiry repair and retain regressions:** include BG-10 in the backend worker release. Verify that an issued quotation expires once, advances `revision`, preserves document `version` and amounts, and leaves the worker healthy. Preserve all ten completed capabilities and keep backend acceptance separate from each frontend page's visual acceptance gate.
6. **Release accepted discovery and API extensions:** preserve API-01 through API-05 local acceptance. Deploy accepted index migrations and backend routes before their dependent frontend, then verify discovery, saved-vehicle traversal and owner isolation in the target environment. Existing compatible routes remain supported.

### Actionable remaining backlog

Priority P1 means required implementation or release verification for the affected integration. P2 means an optional product enhancement; it does not block the current supported browsing experience. These priorities are proposed for planning.

| ID     | Priority / owner                              | Remaining task                                                                                                                                                                | Acceptance evidence                                                                                                                                                                                                           |
| ------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BG-07  | P1 — backend + frontend + QA                  | Implemented locally; preserve owned payment-detail availability and its regressions. Deployed provider checks remain under REL-03.                                            | Enabled provider names only; private uncached read; ownership enforced; exported contract and frontend types agree; unavailable providers are not offered; initialization rechecks current eligibility.                       |
| BG-08  | P1 — deployment + QA                          | Local implementation complete: deploy the invoice snapshot migration, bundled PDF fonts and four document routes before the dependent frontend.                               | Target-environment ownership, settlement eligibility, private cache headers and browser downloads pass; see REL-03.                                                                                                           |
| BG-09  | P1 - deployment + QA                          | Deploy the current-care overview contract before its dependent frontend; no migration required.                                                                               | Owner isolation, private caching, current/empty/historical states and representative-volume latency verified in the target environment.                                                                                       |
| BG-10  | P1 - deployment + backend + QA                | Deploy the repaired expiration worker; no migration or endpoint change required.                                                                                              | Expiry advances revision once, preserves document version and amounts, produces one audit, and does not interrupt the worker.                                                                                                 |
| BG-11  | P1 — business owner + backend + frontend + QA | Obtain approved agreement content and verify deployment of the locally accepted publication, review and reservation flow.                                                     | Current approved terms are readable; invalid acceptance cannot create a hold; acceptance evidence is immutable; original-key retries do not duplicate reservations; contract, database and browser checks pass.               |
| REL-01 | P1 — deployment + backend                     | Configure private object storage, signed-upload host allowlisting, CORS, migrations and the general cleanup worker. Verify all five media resources against deployed storage. | Real browser upload/confirm/read/replace/remove succeeds; invalid replacement preserves existing media; unauthorized personal reads fail; unpublished public media is inaccessible; cleanup retries retain referenced assets. |
| REL-02 | P1 — backend + operations                     | Verify the deployed active handling branch and existing enquiry/complaint delivery.                                                                                           | A synthetic submission persists against the intended branch and its configured notification delivery is observed. Record API receipt separately from provider delivery.                                                       |
| REL-03 | P1 — QA + deployment                          | Verify existing role/session, payment-provider sandbox and email/recovery integrations in staging.                                                                            | Record real integration outcomes, unauthorized requests and server-confirmed payment state. This is verification of existing features, not a request for replacement endpoints.                                               |
| CFG-01 | When available — owner + frontend/deployment  | Configure the Google Maps key and verify the workshop location. No key or verified Place ID has been supplied.                                                                | The keyed map matches the approved address; the existing address and external directions remain usable without it. No backend Maps endpoint is required.                                                                      |
| API-01 | P2 — deployment + QA                          | Locally accepted discovery/facet contracts, migration and frontend integration; deploy backend before frontend and verify the target environment.                             | Local evidence covers visibility, make/model relationships, bounded traversal, authenticated cursors, exact totals, real API/browser flows and representative query performance.                                              |
| API-02 | P2 - deployment + QA                          | Locally accepted Shop discovery/options and price/availability filters; deploy backend before frontend.                                                                       | Verify public visibility, exact counts, scoped compatibility, unreserved stock semantics and authenticated traversal in the target environment.                                                                               |
| API-03 | P2 - deployment + QA                          | Local implementation complete; deploy `20261009140000_service_discovery` and backend before frontend, then verify target-environment discovery and category management.       | Active-service visibility, category permissions/archive semantics, literal search, signed traversal, exact totals and administrator assignment pass in the target environment.                                                |
| API-04 | P2 - deployment + QA                          | Local backend/frontend acceptance complete; deploy backend before frontend and verify target-environment recovery.                                                            | Real dropped-response/reload retries returned the same persisted record with one audit. Account changes, changed bodies, unavailable storage and expired intents have regression coverage.                                    |
| API-05 | P2 — deployment + QA                          | Local implementation and acceptance complete; deploy the saved-vehicle index migration and backend before the dependent frontend.                                             | Target-environment owner isolation, bounded traversal, unavailable-listing exclusion, deletion between pages and legacy array compatibility pass.                                                                             |

For REL-01, the existing configuration uses `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` and frontend `ASSET_STORAGE_HOSTS`. Configure secrets through the deployment secret manager. The detailed staging procedure is in the [implementation handoff](backend/docs/backend-gaps-handoff.md#19-missing-credentialsinfrastructure-and-remaining-verification).

API-01 through API-03 have mounted routes, exported OpenAPI and recorded local backend/frontend acceptance. Each extension requires current OpenAPI, regenerated frontend types, authorization/visibility and pagination tests, and frontend loading/empty/error integration. Do not derive global facets or totals from a single page.

API-04 extends existing mutations rather than adding another creation route. Backend, frontend and real browser/API/database recovery have local acceptance. Compatibility, retention and verification are recorded in [the retry contract](backend/docs/vehicle-creation-retries.md).

### Handoff and closure evidence

BG-07 and BG-08 have local acceptance; retain regression coverage and track deployed payment/document checks under REL-03. API-01 through API-05 need deployment verification. REL-01 through REL-03 remain deployment tasks; CFG-01 is a configuration dependency. Reopen a completed BG item only for a reproduced defect or newly agreed requirement.

For each remaining item, record the assigned owner, target environment, deployed revision, prerequisites, actual result and evidence link. Verification records should identify the tested workflow and resulting record or request ID without including credentials or customer data. Close an item only when its acceptance evidence above is recorded; an API receipt alone does not establish email delivery, and a local storage fixture does not establish deployed storage readiness.

**Confirmed workshop configuration:** use **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. Pizza Jungle is inside Kilimanjaro; do not substitute “beside Pizza Jungle” in customer-facing copy. The owner has not supplied a Maps key or verified Place ID. Preserve the address panel and address-based directions until the embedded map can be configured and checked. This does not create a backend endpoint requirement.

Optional discovery enhancements below are separate from the remaining deployed-media verification. The page-by-page frontend quality work remains tracked in its [milestone register](frontend/docs/page-quality/README.md).

### Completed-page coverage

The [workshop booking detail audit](frontend/docs/page-quality/work-booking-detail.md) reuses existing booking, capability, quotation and work-order contracts. Hiding unassigned-staff mutation controls, keeping drafts during a temporary access-read failure, and responsive line items are frontend corrections. Real isolated browser/API/database checks verified work-order creation and completion, exact mutation audits, explicit lost-response recovery without replay, and role/branch/CSRF boundaries. No backend endpoint, permission or migration was added. Provider notification delivery remains a separate deployed check.

The [workshop bookings audit](frontend/docs/page-quality/work-bookings.md) uses existing `GET /staff/bookings`, `/staff/profile`, `/admin/branches` and `/admin/staff` contracts. Exact Lagos-date bounds, 25+1 paging, status filtering, work-role access and branch isolation passed real local browser/API/database checks. URL recovery, display validation, mobile records and stale/error handling are frontend improvements. No new backend endpoint, permission or migration is required. The separate workshop booking detail acceptance is recorded below; the list acceptance does not by itself close that route or deployed verification.

The [page-quality register](frontend/docs/page-quality/README.md) records **fifty locally accepted milestones**, through [Workshop booking detail](frontend/docs/page-quality/work-booking-detail.md) on 12 October. These cover the accepted public, commerce, authentication, account-security and customer-dashboard surfaces listed in the register, including notifications, reviews and customer care. The [expanded coverage register](frontend/docs/page-quality/expanded-brief.md) identifies reassessments against the 7 October brief. Earlier paragraphs and test counts below retain their individual historical scope; they must not be read as the current total. Remaining customer, Staff, Admin and Super Admin routes still require their own page gates; appointment slots `/admin/booking-slots` is next. This document does not certify the entire frontend or deployment as complete.

The expanded Vehicle detail audit reused the existing saved-vehicle, enquiry and inspection APIs. A real isolated API/database run verified one persisted save, one `ENQUIRY` and one `REQUESTED` inspection, including the Lagos-time conversion and refresh. Seven account-isolation regressions passed. Hiding customer mutation controls from anonymous and work accounts was a frontend correction, not a missing backend permission or endpoint. Appointment confirmation remains a separate workflow; a request receipt does not establish a confirmed appointment.

The expanded Product detail audit reused the existing public catalogue, cart and favourites contracts. Real isolated API/database verification confirmed total-quantity replacement, rejection of an over-stock quantity without changing the cart, a persisted favourite and refresh. Role visibility, complete quantity validation messages and stale account-draft clearing were frontend fixes. Delivery guidance follows the existing checkout/fulfilment contract and does not promise a fixed fee, delivery date or universal coverage. No new mandatory backend endpoint was identified; deployed media and checkout/provider release checks remain separate.

The [expanded Service detail audit](frontend/docs/page-quality/service-detail-expanded.md) reused the existing public service list with `limit=3`, excluded the current service and displayed at most two other records. This is a bounded public read, not a category recommendation contract. Real isolated API/database checks verified one `REQUESTED` booking with an owned vehicle and no deposit, plus one anonymous `SERVICE` enquiry recorded as `OPEN`. Sixty service/booking browser scenarios, seven account regressions and two server-rendering checks passed. The existing published description remains the source for service scope; separate symptoms, inclusions and category relationships are not supplied and are not fabricated. No additional mandatory backend endpoint was identified.

The [expanded Customer Care audit](frontend/docs/page-quality/contact-expanded.md) passed its local gate with 74 Contact/shared-support browser scenarios, seven Maps policy tests, six existing backend safeguard tests, actual enquiry/complaint persistence and negative API checks. Displaying the already-returned UUID and routing account shortcuts by role were frontend changes. A CSP defect that would block configured Google Maps was corrected with a Contact-only, configured-key frame allowance; it was not a missing backend endpoint. The live keyed embed and notification delivery remain unverified under CFG-01 and REL-02. See the [scoped security record](frontend/docs/page-quality/contact-security.md) for precise coverage and limits.

The [expanded public Reviews audit](frontend/docs/page-quality/reviews-expanded.md) reused the existing approved-review list, customer submission and administrator moderation APIs. All 23 new public-page browser scenarios passed; all 19 existing workflow scenarios have passing evidence after correcting one Staff test to permit the shared shell's own-profile read. A real isolated API/database flow verified pending creation, approval/publication, rejection exclusion, private-field exclusion, customer isolation, CSRF, role/MFA denial and stale-version rejection. No new mandatory endpoint was identified. Global rating aggregates are not supplied by the current contract; the page displays actual individual ratings and current-page counts. Dashboard visual acceptance and deployed verification remain separate.

The [expanded About audit](frontend/docs/page-quality/about-expanded.md) passed all 19 browser scenarios, ten responsive widths, six accessibility scans and final build/static checks. It preserves approved company content and equipment assets through server-rendered content and native disclosures. Its unmocked browser visit made only the shared session request; no content API or mutation was needed. The confirmed Kilimanjaro address and address-based directions need no new backend endpoint.

The [expanded Help index audit](frontend/docs/page-quality/help-expanded.md) passed all 24 new browser scenarios and two existing regressions, with ten-width, accessibility, session-transition and no-JavaScript checks. Search operates across the complete local FAQ collection; role-aware actions reuse existing support/security routes. Its unmocked visit made only shared session reads. No new backend endpoint or CMS was needed. The subsequent [Help article gate](frontend/docs/page-quality/help-article-expanded.md) passed for all twelve variants and the unavailable state. A shared frontend action policy now keeps article/index role behavior aligned; real server-rendered breadcrumb/canonical and 404 checks passed. These changes required no backend contract or data-model change.

The Cart/checkout page has passed its expanded local gate, including mobile access, review-before-write, server amounts, same-key recovery, fresh cart checks and session isolation. Real isolated collection and delivery orders, stock reservations, idempotent replay, changed-body rejection, CSRF and cross-customer denial were verified. No new backend endpoint was required. The preflight is not an atomic cart-version guarantee; order creation still uses current server stock/prices and payment follows a separate total review. The dedicated payment page has now passed its separate gate. Invoice detail, private PDF downloads and sharing have now passed their [separate local gate](frontend/docs/page-quality/invoice-detail.md). Saved items/favourites have now passed their separate local gate. The Product cart confirmation drawer and scoped notification refinement have now passed their separate local gate. Authentication and the accepted account-security pages are covered by their later reports below; remaining account/dashboard/role pages still require their own audits. Inspect existing support, review, content, commerce and document contracts before proposing new backend work; this handoff does not claim those future audits are complete. Add any concrete gap or reproduced defect with its contract, owner and acceptance criteria. Do not expose private document URLs merely to implement sharing, or fabricate paid receipts from frontend state.

| Completed surface                          | Backend handoff                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact and Customer Care                  | Existing enquiry/complaint APIs are integrated. Verify the deployed handling branch and notification delivery under REL-02; retain the address fallback until CFG-01 can be configured.                                                                                                                                                                                 |
| Vehicles listing and Vehicle detail        | Public inventory, detail and media reads are available. API-01 discovery has local acceptance; deployed discovery and stock-media lifecycle verification remains open.                                                                                                                                                                                                  |
| Shop listing and Product detail            | Existing catalogue, detail, cart and saved-item APIs are available. API-02 discovery has local acceptance; deployed discovery and product-media verification remains open. Checkout and provider verification are separate from product-page acceptance.                                                                                                                |
| Services listing and Service detail        | Existing service reads, pricing filters, availability, booking requests and service enquiries are integrated and locally verified. API-03 discovery and category management are locally accepted; deployed service-media verification remains under REL-01. Booking creation passed its local gate; Quotation authoring/review has also passed its separate local gate. |
| Booking creation and Home                  | Both completed milestones reuse existing contracts. Booking creation persists a request without requiring a deposit. Home displays real public catalogue and review data. No new mandatory endpoint was identified.                                                                                                                                                     |
| Public Reviews                             | Approved public reads, customer submission and administrator moderation already exist. Publication and permissions have local API/database evidence. Global rating aggregates are not supplied; individual ratings and current-page counts remain supported.                                                                                                            |
| About                                      | Approved company content, equipment disclosures and contact information are rendered from repository content. No content-management endpoint is required for the completed page.                                                                                                                                                                                        |
| Help index and all twelve article variants | Local article content, search and topic filtering reuse repository data. Account actions follow the validated session and role. Support submission and private account workflows retain their existing contracts and separate acceptance gates.                                                                                                                         |

The [Quotation authoring/review audit](frontend/docs/page-quality/quotation-form.md) reuses the existing booking-bound create, replace, issue, void and expiry APIs. The server calculates part prices/tax, checks revisions and sets the acceptance deadline. Restricting quotation controls to assigned staff or authorised administrators, and correcting Help copy to describe anonymous enquiries, were frontend fixes. Real isolated API/database checks verified draft creation/replacement, issuance, customer acceptance, voiding, server-time expiry, draft privacy and negative authorization/CSRF/MFA/revision cases. No new mandatory endpoint was identified; full customer/staff booking-page redesigns and deployment verification remain separate.

The [Vehicle inspection/enquiry creation gate](frontend/docs/page-quality/inspection-enquiry-form.md) reuses `POST /customers/vehicle-inspections` and `POST /customers/vehicle-transactions`. Its original review, reference and uncertain-outcome acceptance predates retry support. API-04 now adds optional actor-scoped idempotency and verified frontend reload recovery to those same routes. Real local API/browser/PostgreSQL checks confirm original-ID recovery after committed responses are dropped, with one record and audit per action. Cross-device and global exactly-once creation are not promised. Customer/staff history and transaction dashboard gates remain separate.

The [Customer order detail gate](frontend/docs/page-quality/order-detail.md) reuses existing owned order reads, complete bounded payment-history reads, idempotent payment-intent creation and version-checked cancellation. Real local acceptance verified the server amount, same-key payment replay, reuse after reload, cancellation with reserved-stock release, CSRF and customer isolation. No new endpoint was needed. The payment list has no order filter, so the frontend checks bounded pages and fails closed if history cannot be fully read; target filtering is a possible later optimization. Dedicated provider controls and invoice document downloads/sharing have now passed their separate local gates. Deployed verification remains open under REL-03.

**Implementation decision:** BG-01 through BG-10 and API-01 through API-05 have local acceptance. REL-01 through REL-03 require deployed integration verification; CFG-01 requires configuration when available. Continue auditing the remaining application pages before adding further gaps.

### Login and registration — no new backend gap

The [Login acceptance record](frontend/docs/page-quality/login.md) reuses existing login, CSRF and session contracts. Frontend response validation, password visibility/clearing, safe continuation and account-change cancellation have local acceptance. Real synthetic customer and work-account sessions verified customer continuation, MFA handoff, generic failed-authentication responses and trusted-origin enforcement. Existing backend eligibility, throttles and MFA policies remain authoritative.

The [Registration acceptance record](frontend/docs/page-quality/register.md) reuses existing `POST /auth/register`, strict field validation, trusted-origin enforcement, throttling and generic duplicate-email responses. Local database checks confirmed unverified customer/profile creation, hashed passwords, one verification token and queued notification per new account, with no session. The combined registration/Login/shared-auth run passed 71 browser scenarios; ten backend identity tests passed. The real registration retry reached the existing rate limit, which was preserved. Email delivery was disabled during QA: a queued event does not establish delivery.

**Remaining delivery task (REL-03):** verify actual verification-email delivery and token consumption/expiry in the target environment, alongside deployed cookie/proxy and recovery-provider behavior. Remaining authentication/security pages still require their own frontend gates; they are not automatically missing backend endpoints.

### Forgot-password requests — no new backend gap

The [Forgot-password acceptance record](frontend/docs/page-quality/forgot-password.md) reuses `POST /auth/password/forgot`. Existing generic responses, active/verified eligibility, prior-token revocation, hashed tokens, encrypted notification events, trusted-origin enforcement and throttling remain authoritative. Real isolated API/database checks confirmed eligible and ineligible responses, one current token after two requests, encrypted queued events, no session creation and enforced 429/403 outcomes. Invalid fields are covered by the backend HTTP boundary suite.

Frontend Retry-After handling, response states, field borders, accessibility, account-change cancellation and responsive layout needed no new backend endpoint. All 99 combined auth browser scenarios passed; 28 recovery checks passed again on the final CSS build. Provider email delivery and the complete deployed reset journey remain open under REL-03. The separate reset-password page has now passed its local gate; email verification/resend have also passed their joint local page gate; MFA has also passed its local route gate; Customer account security is next.

### Reset password — no new backend gap

The [Reset-password acceptance record](frontend/docs/page-quality/reset-password.md) reuses existing `POST /auth/password/reset`, strict validation, trusted-origin enforcement, atomic token consumption, Argon2 password updates, session revocation, cookie clearing and audit logging. The final build passed 133 combined auth browser scenarios, 93 frontend unit checks and 11 backend identity checks.

A real isolated Express/browser/database run verified reset success, expired/revoked/replayed-token rejection, common-password rejection, cross-origin denial, two revoked prior sessions, one audit record, cookie clearing and old/new-password login outcomes. Test tokens were seeded with the production HMAC helper; browser reset requests were forwarded to the temporary real server. No provider email was sent and no existing API rate limit was reset. Deployed email-link delivery and the complete target-environment recovery journey remain under REL-03. No new endpoint, schema or migration is required for the completed page.

### Email verification and resend — no new backend gap

The [Email-verification acceptance record](frontend/docs/page-quality/verify-email.md) covers both workflows on `/verify-email`, using existing `POST /auth/email/verify` and `POST /auth/email/resend`. No new endpoint, schema, migration or authentication behavior is required. The final build passed 169 combined auth browser scenarios, 104 frontend unit checks and 11 backend identity checks.

Real isolated browser/API/database acceptance verified an encrypted resend outbox event, old-token revocation, successful new-token consumption, emailVerifiedAt, EMAIL_VERIFIED audit, no automatic session creation, invalid/replayed-token rejection, trusted-origin enforcement, generic resend responses and server rate limiting. Login failed before verification and succeeded afterward. Email delivery remained disabled; deployed registration/verification email delivery and the complete account journey remain under REL-03. Resend is part of this completed page, not an outstanding separate route.

### MFA sign-in, enrollment and recovery codes — no new backend gap

The [MFA acceptance record](frontend/docs/page-quality/mfa-expanded.md) covers `/mfa` and its existing setup state. Existing session/CSRF, challenge, TOTP and WebAuthn endpoints support the redesigned flows; no new backend endpoint, schema or migration is required. The final build passed 228 combined browser scenarios, 54 scoped frontend unit checks and 13 backend identity/WebAuthn checks.

Real isolated browser/API/database acceptance verified TOTP enrollment and a fresh challenge, TOTP/recovery replay rejection, recovery-code use, pending-session enrollment denial, and virtual-security-key enrollment/authentication against the actual backend verifier. It confirmed encrypted TOTP storage, ten hashed recovery codes, replacement of prior codes, and session-token/CSRF renewal on the same session record, with the old cookie rejected. Deployed-origin and physical-device MFA verification remain under REL-03. Customer account security subsequently passed its separate gate below. Staff/admin account security subsequently passed its separate route gate recorded below.

### Customer account security - no new backend endpoint required

The [customer-security acceptance record](frontend/docs/page-quality/customer-security.md) covers `/dashboard/security`: password changes, owned session management, MFA factor removal and recovery-code replacement. All 37 customer/shared-staff browser scenarios passed, alongside 45 frontend unit checks, 11 backend identity checks and the final build/static checks. Actual browser/API/database acceptance verified persisted mutations, password-reset invalidation, token/CSRF renewal, old-cookie/password rejection, CSRF enforcement and account isolation.

A real-data integration defect was fixed in the frontend: newly issued sessions return nullable `lastUsedAt`, as permitted by the database/service. The parser now accepts null and shows **No activity recorded** in lists and reviews. This required no backend endpoint, schema or migration change. Existing restrictions remain: deleting the current session is rejected, other-account session deletion has no effect, privileged accounts must retain an active factor, and recovery codes are returned privately once.

**Remaining delivery work:** REL-03 still requires target-environment cookie/proxy/session and MFA acceptance. Staff/admin account-security presentation subsequently passed its separate gate below; it is not an unimplemented backend capability.

### Staff/admin account security - no new backend gap

The [staff/admin-security report](frontend/docs/page-quality/admin-security.md) records local acceptance for `/admin/security`: 59 combined browser scenarios, 45 frontend unit checks, 11 backend identity checks and production/static checks. Staff, Admin and Super Admin browser scenarios preserve the final-factor restriction, explicit second-factor removal review, private recovery-code downloads and MFA/session redirects. Existing APIs operate only on the signed-in account.

Actual browser/API/database acceptance verified administrator password/session/MFA changes and direct final-factor rejection for ADMIN and STAFF. Super Admin has browser coverage and read-only policy confirmation; its existing single-owner database safeguard was retained, and no real owner mutation journey is claimed. No endpoint, schema or migration was added. REL-03 still covers deployed account/session/MFA acceptance; customer overview and remaining dashboard/role pages retain separate frontend gates.

### Product cart confirmation drawer and notifications — no new backend gap

The [cart drawer acceptance record](frontend/docs/page-quality/cart-drawer.md) reuses the existing customer cart quantity-replacement and favourites routes. The modal displays the validated returned cart and subtotal; it does not reserve inventory or create checkout. Exact amount/identity checks, private-result clearing and keyboard handling are frontend responsibilities. Real isolated API/database/browser evidence verified repeated quantity replacement, customer isolation, CSRF, persisted favourites and no order creation. No new endpoint or migration was required. Shared notification styling is integrated; unrelated notification-producing workflows and deployed session behavior retain their separate verification requirements.

### Customer vehicle purchases list - no new required backend gap

The [vehicle purchases list acceptance record](frontend/docs/page-quality/customer-purchases.md) covers `/dashboard/vehicle-transactions` using existing customer-only `GET /customers/vehicle-transactions`. The contract supplies all 12 statuses, cursor pagination, transaction reference, exact string-kobo asking/agreed prices, listing identity, creation date and vehicle image metadata. The frontend uses safe public image handling, honest missing-image fallback, page-only counts and existing owned progress links.

All 55 browser scenarios passed, with 16 final responsive/accessibility/keyboard repeats, 21 backend tests, 15 frontend tests and final build/static checks. Real isolated API/browser/PostgreSQL acceptance verified owned 10+2 pagination, all statuses, reload, exact large prices, missing-image fallback, correct detail navigation, archived-listing history, foreign-cursor and customer isolation, privileged-role403, anonymous401 and invalid-query422. No UI mutations were made.

Search, arbitrary sort and global totals are absent from this list contract and are not presented as working features. No new endpoint, schema or storage capability is required for the accepted list. Public-image visibility still governs archived/unavailable listing photos. The dedicated purchase detail workflow has its own next page gate; existing local list acceptance does not certify reservation, settlement or handover redesign. Deployed storage and session/payment integrations remain under REL-01/REL-03.

### Customer inspection history - no new required backend gap

The [inspection-history acceptance record](frontend/docs/page-quality/customer-inspections.md) covers `/dashboard/inspections` using the existing customer-only `GET /customers/vehicle-inspections` contract. It supports six status filters, bounded cursor pagination, preferred/scheduled times, notes/cancellation reasons and the projected report summary, inspected date, odometer, condition score and primitive findings. URL history and readable Lagos times require no backend change.

Sixty distinct browser scenarios have passing evidence (59 in the combined final run plus its one successful navigation retry), alongside 21 backend tests, 14 frontend tests and final build/static checks. Real isolated API/browser/PostgreSQL acceptance verified owned 10+2 pagination, reload, all six statuses, archived-listing history, report fields, private storage-key exclusion, foreign-cursor isolation, privileged-role denials, anonymous 401 and invalid-query 422. No UI mutations were made.

The current API provides no global count, listing-image projection, customer status mutation or report-file download for this history. The page uses page-only counts, inline details and existing customer-care navigation. These absent optional capabilities are not newly required implementation gaps. Creation already has its separate accepted workflow. Deployed session/integration acceptance remains under REL-03; vehicle purchase list/detail and remaining dashboard routes retain separate page audits.

### Customer vehicle photo detail - no new required backend gap

The [vehicle photo detail acceptance record](frontend/docs/page-quality/garage-photos.md) reuses the existing BG-03 owner-only gallery, signed upload preparation, exact-token attachment replay, descriptions/order, cover and removal contracts. All 58 browser cases, 15 final responsive/accessibility repeats, 12 backend media/garage tests, nine frontend upload/resource tests and build/static checks passed. Real isolated browser/API/PostgreSQL acceptance transferred actual file bytes through local HTTPS storage and verified persisted edits, private image decoding, independent prepared uploads, lost-response replay without duplicate attachment, deterministic replacement cover, CSRF and owner/version enforcement.

No new endpoint, migration or backend change was required for this page. The frontend blocks writes while data is stale and disables uploads with a clear notice when storage is unconfigured; that fallback was verified after restoring the preview environment. Local HTTPS byte storage is not deployed object-storage acceptance: bucket policy, frontend host allowlisting, CORS and cleanup remain REL-01. Remaining customer pages retain separate audit gates.

### Customer garage/vehicles list - no new required backend gap

The [customer garage list](frontend/docs/page-quality/customer-garage.md) passed its separate local gate on 9 October 2026. Existing customer vehicle collection/detail and create/update/delete routes support the completed interface. Real browser/Express/PostgreSQL checks verified 12 owned records across pages of 10 and 2, persisted normalized creation with one audit, editing, cancellation and confirmed deletion. Foreign cursors, detail reads and mutations returned 404; privileged roles returned 403; anonymous reads returned 401; missing CSRF returned 403 and invalid mileage returned 422. Reads remained private and omitted ownership fields. No new endpoint or migration is required.

The list supplies no global count, search, sorting choices or image projection; the interface uses page counts and existing Manage photos links. An unconfirmed mutation is not automatically resent. BG-03 already provides owned gallery operations, but `/dashboard/vehicles/[vehicleId]` retains a separate frontend page gate. Deployed storage verification remains under REL-01 and session integration under REL-03. Local fixtures do not establish deployed object-storage acceptance.

### Customer invoices list - no new required backend gap

The [customer invoices list](frontend/docs/page-quality/customer-invoices.md) passed its separate local gate on 9 October. The existing owner-scoped API supplies issuance/creation and due dates, source references, exact totals, deposit credits and authoritative status, with filtering and cursor pagination. Real API/browser/PostgreSQL checks verified 12 owned invoices across pages of 10 and 2, draft exclusion, status filtering, detail navigation, private caching and denied scope overrides, foreign details and privileged-role access. The frontend preserves URL state and rejects malformed or draft responses; no endpoint, migration or new permission is required. Download and settlement behavior retains the separate invoice-detail acceptance scope; deployed verification remains open under REL-03.

### Customer payments list - no new required backend gap

The [Customer payments list gate](frontend/docs/page-quality/customer-payments.md) passed locally on 9 October. The existing authenticated customer list already supplies creation dates, purposes, target IDs, exact amounts and authoritative payment status, with status filtering and cursor pagination. The frontend now exposes those fields, preserves filters across reload and handles private-data invalidation without introducing payment mutations. Real API/browser/PostgreSQL checks verified 12 owned records in pages of 10 and 2, status filtering, detail navigation, private caching and denied cross-customer/role access. No endpoint, migration or new permission is required. This does not close deployed provider or session verification under REL-03.

### Customer orders list - no new required backend gap

The [customer orders list](frontend/docs/page-quality/customer-orders.md) passed its separate local gate using the existing customer-only list/detail API. Status, pagination, item snapshots, collection/delivery context and exact totals need no new endpoint. The frontend list parser now accepts the existing nullable historical branch relation. Fifty-eight distinct browser scenarios have passing evidence, alongside fifteen existing backend checks, five resource tests, final build/static checks and real API/database/browser acceptance. The real API denies Staff, Admin and Super Admin, rejects customer-scope overrides, hides foreign details and returns private uncached reads. No backend code or migration was required; deployed integration remains under REL-03.

### Customer bookings list - no new required backend gap

The [customer bookings report](frontend/docs/page-quality/customer-bookings.md) records local acceptance for `/dashboard/bookings`: 51 combined browser scenarios plus one background-refresh case, five frontend resource tests, five backend policy/boundary tests and actual API/database/browser acceptance. The route reuses `GET /customers/bookings` with actor-derived ownership, status filtering and cursor pagination. Status, page size and cursor traversal now survive URL reload and browser navigation; UI-only history is excluded from API queries.

Existing contracts supply vehicle, appointment, branch, deposit, quotation and work-order context. The UI reports current-page counts, distinguishes requested times, hides stale rows after manual failure and labels retained data after a background failure. It does not invent customer search, date sorting or global totals, which the API does not expose. No new backend endpoint or migration was needed. Detail-page transactions remain a separate gate; target-environment verification remains under REL-03.

### Customer current-care overview — implemented locally

**Backlog ID:** BG-09. **Priority:** P1. **Owner:** backend for the projection and ownership rules; frontend and QA for dashboard acceptance; deployment owners for target-environment verification. **Status:** implemented and locally accepted on 8 October 2026. Deployment remains pending. See the [customer overview report](frontend/docs/page-quality/customer-overview.md).

**Original gap:** historical customer aggregates could not independently show current vehicle care. Inferring live state from date-filtered recent records could hide an active booking or payment request.

**Implemented contract:** `GET /customers/overview?from&to` includes an owner-scoped `care` object for customer responses. Staff and organisation responses omit it. Ownership comes from the authenticated actor; undeclared query parameters are rejected. Existing private/no-store caching, repeatable-read consistency and historical aggregate date semantics are retained. No migration or new write endpoint is required.

| Field                      | Selection and meaning                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `currentBooking`           | Most recently updated owned `IN_PROGRESS` booking, with actual requested/confirmed/started timestamps.                                                                              |
| `nextBooking`              | Earliest future owned `REQUESTED` or `CONFIRMED` booking; requests are not presented as confirmed.                                                                                  |
| `vehicle`, `vehicleSource` | Owned vehicle linked to the focused current/upcoming booking, otherwise latest owned garage addition. A malformed cross-customer relation cannot expose another customer's vehicle. |
| `quote`                    | Latest issued, unexpired quotation for an owned booking. Money remains an exact minor-unit decimal string.                                                                          |
| `payment`                  | Latest unexpired `REQUIRES_PAYMENT` request, or `PROCESSING`/`REQUIRES_REVIEW` request. Request amount is not an inferred debt balance or settlement.                               |
| `order`                    | Latest owned order with actual status and collection/delivery method; no invented delivery estimate.                                                                                |
| `inspection`               | Earliest upcoming confirmed/rescheduled appointment, otherwise earliest future requested inspection. `dateKind` distinguishes scheduled from preferred time.                        |
| `notification`             | Latest unexpired notification for the authenticated user; minimal title/timestamps, without marking it read.                                                                        |

Absent records are `null`; `vehicleSource` is `NONE` without a vehicle. Nine fixed selection calls return at most one record each, with deterministic timestamp/ID ordering. Minimal projections exclude staff notes, VIN and notification bodies. See the [implementation](backend/src/modules/overview/customer-care.ts), [response schema](backend/src/modules/overview/customer-care.schemas.ts) and [OpenAPI contract](backend/src/modules/overview/overview.openapi.ts). Exported OpenAPI and generated frontend types are updated.

Acceptance and release checklist:

- [x] Eight isolated PostgreSQL overview tests passed, including ownership, empty accounts, expired records, exact money, historical/current separation, query rejection and role separation.
- [x] OpenAPI export/validation, mounted-route coverage, generated frontend types and backend type/lint/format checks passed.
- [x] Fifty-eight final browser scenarios passed, including customer overview and shared overview/navigation regression. Ten customer widths, four customer Axe scans, short screens, invalid responses and late-session responses passed.
- [x] Actual browser/API/database reads verified current care alongside empty historical totals, exact large money and owned quotation navigation. A separate unmocked frontend-proxy login/empty-account check passed.
- [x] Final frontend build/static checks, six focused unit tests and the page report passed. Concepts, fidelity decisions and index review are recorded there.
- [ ] Deploy the backend contract before the dependent frontend and verify cookies, caching, customer isolation and realistic-volume latency under REL-03. Existing indexes were reviewed, but small-fixture EXPLAIN timings do not establish production capacity.

### Invoice and receipt documents — implemented locally

**Backlog ID:** BG-08. **Priority:** P1. **Owner:** backend for persistence, authorization and PDF generation; frontend for document presentation/download/sharing; QA and deployment owners for target-environment acceptance. **Status:** implemented and locally accepted on 8 October 2026. Deployment remains pending.

**Original gap:** customer invoice reads had financial summaries and directly attached payments, but lacked a document projection, historical billing/itemization snapshot and PDF routes. The invoice page had no download/share controls. Uploaded payment evidence could not serve as a company receipt.

**Implemented contracts:** paths omit `/api/v1`. See [billing routes](backend/src/modules/billing/billing.routes.ts), [payment routes](backend/src/modules/payments/payments.routes.ts), [document schemas](backend/src/modules/billing/document.schemas.ts) and [OpenAPI definitions](backend/src/modules/billing/documents.openapi.ts).

| Operation        | Mounted route                                          | Behavior                                                                                                                                                         |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoice document | `GET /customers/invoices/{invoiceId}/document`         | Owned, non-draft invoice; historical itemization or explicit legacy fallback; persisted totals; direct and source-linked payment requests and eligible receipts. |
| Invoice PDF      | `GET /customers/invoices/{invoiceId}/download`         | Private PDF attachment generated from the same authorized document model. Void invoices are clearly labeled.                                                     |
| Receipt document | `GET /customers/payments/{paymentId}/receipt/document` | Owned payment with a selected successful, verified settlement attempt and matching amount/currency.                                                              |
| Receipt PDF      | `GET /customers/payments/{paymentId}/receipt`          | Private confirmed-payment PDF; completed refunds are separate and do not change the original amount received.                                                    |

**Completed implementation and local acceptance:**

- [x] Integer-kobo totals and line reconciliation come from server records. [Document snapshots](backend/src/modules/billing/document-snapshot.ts) are written inside both invoice-creation paths; a database trigger prevents later mutation. Legacy records are not fabricated or silently backfilled.
- [x] [Document service](backend/src/modules/billing/documents.service.ts) enforces customer ownership before document generation, excludes drafts, and resolves order/vehicle-source payments without double counting. Pending reports, unverified attempts and duplicate/anomalous captures cannot generate receipts. Partial payments do not imply full invoice settlement.
- [x] [PDF renderer](backend/src/modules/billing/document-pdf.ts) uses local licensed fonts, bounded content, repeatable page identity and numbered footers. It fetches no remote HTML or assets. PDF responses include sanitized attachment names, private/no-store caching, `nosniff` and document identity headers.
- [x] [Frontend download handling](frontend/lib/api/document-download.ts) verifies identity, content type, signature and size. [Share controls](frontend/app/components/document-actions.tsx) use native file sharing with explicit user activation and a download/authenticated-link fallback. Session changes clear prepared private files; cancellation does not claim delivery.
- [x] OpenAPI and generated frontend types agree. Backend lint/types/build, 39 focused backend tests, frontend lint/types/production build, 16 focused frontend unit tests and 41 final invoice browser scenarios passed. Earlier order-detail regression coverage also passed; exact scope is recorded in the page report.
- [x] Synthetic isolated API/database checks verified ownership/role denial, draft privacy, snapshot immutability, linked settlement, JSON and PDF downloads. A real authenticated browser downloaded both PDFs from the local API with no page errors. One-page invoice/receipt, void and six-page long-description PDFs were inspected, alongside ten responsive browser widths.

**Required deployment work:** apply [migration `20261008140000_invoice_document_snapshot`](backend/prisma/migrations/20261008140000_invoice_document_snapshot/migration.sql) before the dependent backend. It has been applied only to isolated QA. Regenerate Prisma during build and deploy backend before frontend. Package [runtime fonts and license](backend/assets/fonts/README.md); the Dockerfile copies `assets`. Verify customer/role denial, draft privacy, settled and pending receipts, attachment headers, proxy/cookie behavior and browser downloads in the target environment under REL-03. Runtime PDF generation needs neither object storage nor a Maps key.

**Limits:** 200 invoice lines/payment requests, 50 PDF pages and 4 MiB per PDF; exceptional histories fail for account review rather than being silently truncated. Receipt refunds reflect completed refunds at generation time. Native recipient delivery, persistent public links, document email delivery, staff exports and legal/tax certification are outside this implementation. Receipt shortcuts elsewhere in the account remain subject to separate integration review.

**Acceptance record:** [Customer invoice detail and financial documents](frontend/docs/page-quality/invoice-detail.md). Local acceptance is not deployed acceptance.

### Payment checkout availability — implemented locally

**Backlog ID:** BG-07. **Priority:** P1 for dedicated payment-page acceptance. **Owner:** backend and frontend, with QA acceptance. **Status:** contract export, frontend integration and local acceptance passed on 8 October 2026. No deployment or successful provider transaction is claimed.

**Evidence:** the existing [provider registry](backend/src/providers/payments/payment-provider.registry.ts) already determines enabled providers from server configuration and registered adapters. The payment-page audit found that the customer read did not expose that decision, while the prior UI offered both online providers. Existing payment initialization, verification, manual reporting and provider adapters are present; they do not need replacement.

**Implemented contract:** extended `GET /customers/payments/{paymentId}` with `checkoutProviders: Array<"PAYSTACK" | "MONNIFY">`. An empty array means online checkout is unavailable. Return only provider names after the existing customer ownership check, with `Cache-Control: no-store`. Do not return credentials, merchant configuration or checkout URLs through this field. Availability is configuration information, not a guarantee of provider health or permission to pay.

The working tree contains the [service projection](backend/src/modules/payments/payments.service.ts), [controller cache header](backend/src/modules/payments/payments.controller.ts), [OpenAPI registration](backend/src/modules/payments/payments.openapi.ts), frontend parsing and the [availability unit tests](backend/tests/unit/payment-checkout-availability.test.ts). The exported OpenAPI document and regenerated frontend types include `checkoutProviders`. Twenty focused backend tests, 38 frontend unit tests, browser scenarios and a real isolated API/database flow have passing evidence in the [payment-detail report](frontend/docs/page-quality/payment-detail.md). This is local acceptance, not deployment certification.

**Local acceptance criteria — passed:**

- [x] Verify disabled, Paystack-only, Monnify-only and both-enabled configurations, including an enabled mode with an absent adapter. Return only configured, registered providers.
- [x] Verify another customer's payment remains inaccessible, anonymous requests are rejected, and Staff/Admin/Super Admin cannot use the customer-only read. Confirm the response is uncached and contains no provider secrets.
- [x] Export and validate OpenAPI, check mounted-route coverage, regenerate frontend types and verify the documented response against the actual API.
- [x] Complete frontend integration: missing availability fails closed, disabled Monnify is not offered, and provider controls update from fresh server data. Preserve manual reporting where eligible; unavailable online checkout must not imply that a payment was received.
- [x] Preserve and test server-side checks for current amount, payable target, expiry, ownership, idempotency and competing attempts. A provider enabled during a read may be disabled before initialization; that later request must fail safely.
- [x] Verify provider-specific trusted checkout destinations, expired or malformed checkout responses, same-key recovery after uncertain initialization, server-authoritative verification, and cancellation of pending work after navigation or session changes.
- [x] Record passing focused backend and browser tests plus the dedicated payment-page acceptance report. Keep real deployed provider credentials, callbacks/webhooks and reconciliation verification under REL-03.

**Dependencies and rollout:** this extends an existing response and needs no new database table or migration. Deploy the verified backend contract before enabling dependent frontend controls. Older responses without the field must leave online controls unavailable. The change must not enable a provider, introduce booking deposits, change authoritative amounts or relax existing payment permissions.

### Inspection and vehicle-enquiry retries — optional API enhancement

**Backlog ID:** API-04. **Status:** backend/frontend implemented and locally verified on 8 October 2026, including real browser/API/PostgreSQL lost-response recovery; target-environment verification remains open. **Owner:** deployment + QA. **Priority:** P2; history recovery remains supported outside the retry window or on another device.

**Evidence:** the [customer vehicle-sales routes](backend/src/modules/vehicle-sales/vehicle-sales.routes.ts) and [OpenAPI registration](backend/src/modules/vehicle-sales/vehicle-sales.openapi.ts) accept an optional `Idempotency-Key` for both creation routes, preserving existing callers. [The creation helper](backend/src/modules/vehicle-sales/creation-idempotency.ts) serializes matching requests and commits the domain record, audit and receipt together. [Nine PostgreSQL integration scenarios](backend/tests/integration/vehicle-creation-idempotency.test.ts) pass, covering concurrency, ownership/operation isolation, conflict, rollback, cleanup, canonical dates and authenticated HTTP boundaries. OpenAPI and frontend generated types have been regenerated. The [request-creation report](frontend/docs/page-quality/inspection-enquiry-form.md) links the subsequent recovery acceptance; [the retry contract](backend/docs/vehicle-creation-retries.md) records current browser and real API/database evidence.

**Frontend acceptance:** [vehicle actions](frontend/app/components/vehicle-actions.tsx) sends the saved key and restores pending intents after reload. [The recovery helper](frontend/lib/api/vehicle-creation-retry.ts) validates actor, listing, operation and age and protects account changes, corrupt storage and expiry. All 353 frontend unit tests passed, including [focused storage coverage](frontend/tests/unit/vehicle-creation-retry.test.ts). All 48 vehicle-detail browser scenarios were verified across full and focused runs, including desktop/mobile recovery and account isolation. A separate actual API/browser run dropped HTTP 201 responses and verified original-ID recovery plus one PostgreSQL record/audit per action. See the linked retry acceptance for exact environment, commands, artifacts and limitations; this is not deployment certification.

**Customer impact:** after a lost response, retrying the original retained key and body can recover the created record. Submitting with a new key, omitting the key or retrying after receipt cleanup can create another record. Tab-scoped storage does not provide cross-device recovery; customers must use account history when a valid saved intent is unavailable.

**Implementation and remaining integration requirements:**

1. Extend the two existing creation contracts with a documented `Idempotency-Key` header. Specify compatibility for current callers, key validation, retention and behavior after expiry; do not silently require a new header from existing clients.
2. Scope each key to the authenticated customer and operation. Bind it to a canonical representation of the validated request. Same-key, same-body retries return the original record; changed-body reuse returns a documented conflict.
3. Persist the domain record and idempotency result atomically. Enforce uniqueness in the database so simultaneous requests and process restarts cannot create duplicate records for the same retained key.
4. Authenticate and authorize every replay. Recover a completed result without treating later listing unavailability or a now-past requested time as a new creation attempt. Do not reveal another customer's receipt.
5. Define in-progress and failed-attempt behavior, cleanup, and recovery after a lost response. Reuse existing idempotency infrastructure where suitable. Any associated audit or notification work must avoid duplicate effects on replay.
6. Export the updated OpenAPI contract, regenerate frontend types and integrate retries using the original key and reviewed body. Define how that key is recovered after a reload; cross-device recovery needs an explicit authenticated recovery design. A new key remains a new attempt, so do not promise global exactly-once creation.

**Acceptance criteria:**

- A request whose response is dropped can be retried with the original key/body and returns the original persisted ID.
- Concurrent identical attempts produce one domain record and the documented replay response.
- Reusing a retained key with changed input returns a conflict without another record.
- Keys cannot be replayed across customers or operations; missing session, invalid CSRF and unauthorized access retain existing denial behavior.
- Committed replay works after the requested time passes or the listing changes availability; genuinely new requests still apply current domain validation.
- Tests cover rollback, restart, key expiry, in-progress recovery and any notification/audit deduplication. Existing callers remain compatible according to the published migration plan.

Backend compatibility, retention, cleanup and completed local recovery acceptance are documented in [the retry contract](backend/docs/vehicle-creation-retries.md). Real committed-response loss, reload, identical-key/body replay and one persisted record/audit per action were verified. Changed-body conflicts, account changes, unavailable storage and expiry are covered by focused database/unit/browser tests. Deploy the backend contract before the dependent frontend and verify the expiration worker in the target environment. No new migration is required. This extension does not confirm an appointment, reserve a vehicle or initiate a payment.

### Saved-vehicle pagination — optional scale enhancement

**Backlog ID:** API-05. **Priority:** P2. **Remaining owner:** deployment + QA. **Status:** implementation and local backend/frontend/browser acceptance complete.

**Original limitation:** `GET /customers/saved-vehicles` reads the customer's entire visible shortlist and returns an array. The previous UI paged that array locally. That legacy route remains compatible; the [Saved items UI](frontend/app/components/saved-items.tsx) now uses the new bounded endpoint.

**Implemented contract:** `GET /customers/saved-vehicles/page?limit=12&cursor={opaqueCursor}` returns `{ items, nextCursor? }` in the existing envelope. Default 12, maximum 50; strict scalar query values. The query fetches at most `limit + 1` saved records and returns at most `limit`. Ordering is saved-record UUID ascending, matching the legacy route, supported by the `SavedVehicle(customerId, id)` index in migration `20261008160000_saved_vehicle_pagination`. Every read requires CUSTOMER authorization and filters by the authenticated customer, AVAILABLE listing and active branch. Returned listings retain the existing public projection; no private stock fields or storage credentials are added.

**Cursor and concurrency behavior:** the cursor contains an immutable saved-record boundary authenticated with a purpose-separated HMAC and bound to the customer profile. Malformed, forged or cross-customer cursors return 422 `VALIDATION_FAILED` without reading another customer's shortlist. Deleting or hiding the boundary record does not invalidate it. Reads use `id > boundary`, so unchanged visible records are not duplicated; this is not a snapshot. Inserts or newly visible records before the boundary require returning to page one. Token-hash key rotation also requires returning to page one. No total count or chronological ordering is implied. The UI preserves independent collection positions, keeps Previous available on an empty final page and provides a first-page recovery action on paging errors.

**Acceptance criteria:** bounded database reads and responses; complete traversal without duplicates; empty and final pages; deletion between pages; publication/availability changes; malformed and cross-customer cursors; anonymous/role denial; account switching during paging; compatibility for existing array consumers. Keep counts page-specific unless an authoritative total is explicitly added. This enhancement does not authorize exposing unavailable listings, creating wishlists for other roles, changing reservation rules or adding bulk mutations.

**Current local acceptance:** all 47 migrations replayed against a separate empty test database; four new real database/HTTP scenarios cover traversal, deletion, visibility, all roles, strict queries and cursor isolation. Three focused unit tests check signatures, input limits and bounded query shape. The backend default suite passed 220 tests (289 database-gated tests skipped); the four new database tests ran separately. A subsequent three-test OpenAPI handover run verified the new contract, 304 mounted operations and 256 paths. Frontend type/lint/format checks, 353 unit tests and an isolated production build passed. All 43 saved-items browser scenarios were verified across the main run (42 passed) and the corrected account-verification scenario rerun (one passed). Real browser/API/database verification independently proved 12 + 1 paging, tab preservation, persisted removal, empty-final-page handling and Previous recovery. See [the scoped report](frontend/docs/page-quality/saved-items.md). Existing save/remove APIs need no replacement. Deploy migration `20261008160000_saved_vehicle_pagination` and backend before frontend; deployed acceptance remains under REL-03.

## BG-01 — Admin customer directory and detail views

**Current status:** implementation and local acceptance recorded. This section preserves the original requirements; the implementation audit below describes the routes and evidence. The criteria below preserve the original acceptance baseline; they do not indicate outstanding implementation.

### Existing capability

`GET /admin/staff/candidates?email=...` finds eligible staff-promotion candidates by exact email. It is not a general customer search endpoint and must not be repurposed. Existing operational records expose only their authorized customer projections.

### Original implementation requirements

- Add an Admin/Super Admin customer listing with server-side search, filters, sorting and deterministic cursor pagination.
- Define permitted search fields, including name, email and phone. Explicitly document normalization, matching rules, query limits and indexed query strategy.
- Return the minimal table projection: stable customer ID, display name, permitted contact information, existing account status and registration date. Include branch associations only if the domain supports them; do not invent a single customer branch.
- Return pagination metadata consistent with existing APIs. If total counts are exposed, document their meaning and whether they are exact.
- Add an authorized customer detail projection for profile and related garage, bookings, quotations, orders, payments and support records. Reuse existing projections where possible and paginate each collection; avoid an unbounded aggregate response.
- Define which fields each role may read. Do not expose password hashes, sessions, MFA secrets, recovery codes, reset tokens or unrelated sensitive internal fields.
- Keep customer impersonation, account suspension and role promotion outside this read-only directory scope unless separately specified. Admin must not gain the ability to assign Super Admin.

### Original proposed API additions

| Method | Proposed path                                | Purpose                                                                                               |
| ------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/admin/customers`                           | Search/filter/sort and page through authorized customer rows                                          |
| GET    | `/admin/customers/{customerId}`              | Read the permitted customer summary                                                                   |
| GET    | `/admin/customers/{customerId}/{collection}` | Optional separately paginated related records; define an explicit allowlist of collections in OpenAPI |

**Authorization:** Admin and Super Admin within existing policy boundaries. Ordinary Staff and Customers must be denied general directory access. Related records must independently enforce their existing access rules.

**Original acceptance criteria**

- Search runs against real persisted customers and supports empty, no-results and invalid-query responses.
- Stable sorting and cursor traversal do not duplicate or omit records in an unchanged dataset; behavior under concurrent changes is documented.
- Invalid customer IDs, deleted/unavailable records and unauthorized access use existing response conventions.
- Detail collections remain bounded and enforce role/record visibility.
- Tests cover all four roles, sensitive-field exclusion and query performance on representative data.

## BG-02 — Customer profile photo

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. Actual routes are `POST /customers/profile/photo/upload`, `PUT/DELETE /customers/profile/photo`, and owner-authorized `GET /customers/media/images/{imageId}`. Profile reads include `mediaVersion` and nullable `photo`. See [managed-media evidence](backend/docs/managed-media.md). The requirements below describe the original gap and remain the acceptance baseline.

### Existing capability

At the original audit, `GET/PATCH /customers/profile` supported personal/contact/address metadata and exposed `CustomerProfile.avatarUrl`, but provided no managed media mutations. The lifecycle described below has since been implemented through separate photo routes.

### Original implementation requirements

- Add owner-bound image upload preparation and confirmation, using the shared media rules below.
- Add an optional photo projection to the profile response, including stable image ID and an authorized display URL or access mechanism.
- Support atomic replacement and removal. A failed replacement must leave the current photo intact.
- Schedule cleanup of replaced/deleted objects without deleting shared or still-referenced assets.
- Keep profile photos private by default; explicitly authorize any administrative visibility rather than making the storage bucket public.

**Proposed endpoints:** `POST /customers/profile/photo/upload`, `PUT /customers/profile/photo` to confirm a validated upload ticket, and `DELETE /customers/profile/photo`.

**Authorization:** the authenticated customer owns the profile. The client must not choose another customer's owner ID.

**Original acceptance criteria**

- Upload, replacement and deletion are reflected after a fresh profile read.
- Cross-account access, ticket substitution and expired/replayed tickets are rejected.
- Invalid uploads do not replace the current photo; deletion restores the initials fallback.
- Personal image URLs follow documented privacy, expiry and cache rules.

## BG-03 — Customer garage images

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. The four routes proposed below now exist, with owner-only image reads, up to 12 images and version-checked mutations. See [garage lifecycle and evidence](backend/docs/managed-media.md#bg-03-private-garage-galleries). The requirements below remain the original acceptance baseline.

### Existing capability

At the original audit, `/customers/vehicles` and `/customers/vehicles/{vehicleId}` supported customer-owned vehicle metadata CRUD only. Owner-scoped media has since been added. Garage records remain distinct from staff stock vehicles.

### Original implementation requirements

- Add an owner-scoped image collection to garage vehicle detail responses.
- Support upload preparation, confirmation, alt text, display order, primary/cover selection and deletion.
- Publish the permitted formats, size/dimension limits and maximum image count in the contract.
- Define deterministic ordering, primary selection when the cover is removed, and cleanup when a garage vehicle is deleted.
- Enforce ownership for image reads as well as writes. Garage images must not appear in public marketplace listings automatically.

**Proposed endpoints:**

- `POST /customers/vehicles/{vehicleId}/assets/upload`
- `POST /customers/vehicles/{vehicleId}/images`
- `PATCH /customers/vehicles/{vehicleId}/images/{imageId}`
- `DELETE /customers/vehicles/{vehicleId}/images/{imageId}`

**Original acceptance criteria**

- The owner can attach, reorder, select a cover and remove images, with changes surviving refresh.
- Another customer's vehicle/image IDs and tickets cannot be read or mutated.
- Concurrent edits cannot silently overwrite ordering or create multiple primary images.
- Count limits, deletion cleanup and cover fallback have explicit tests.

## BG-04 — Service image management

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. Actual routes use `GET /admin/services/{serviceId}/images`, `POST /admin/services/{serviceId}/assets/upload`, `PUT /admin/services/{serviceId}/image`, and `PATCH/DELETE /admin/services/{serviceId}/images/{imageId}`. Separate administrator preview and public active-service image reads exist. Mutations use `Service.version`. See [current service contract and evidence](backend/docs/managed-media.md#service-image-checkpoint-bg-04); the original proposed paths below are superseded by that contract.

### Existing capability

At the original audit, `GET/POST /admin/services` and `PATCH /admin/services/{serviceId}` managed service records without media. The current implementation adds separate media routes and nullable public image projections, as described in the status note above.

### Original implementation requirements

- Add an optional service image projection and authorized upload/confirmation, replacement, alt-text editing and removal.
- Use a single primary image unless a service gallery is explicitly required; avoid introducing an unsupported gallery assumption.
- Include the approved image in public service list/detail responses according to existing service visibility rules.
- Define whether replacing media is immediately visible or follows an existing publication workflow. Uploading an object must not bypass service visibility controls.

**Proposed endpoints:** `POST /admin/services/{serviceId}/image/upload`, `PUT /admin/services/{serviceId}/image`, `PATCH /admin/services/{serviceId}/image`, and `DELETE /admin/services/{serviceId}/image`.

**Authorization:** Admin/Super Admin with existing service-management access. Do not implicitly grant ordinary Staff or Customers media administration.

**Original acceptance criteria**

- Authorized users can upload, replace, edit alt text and remove service images.
- Public reads expose only media allowed by service visibility policy.
- Services without images continue to render through the existing icon fallback.
- Failed uploads or replacements preserve the previously valid service record and image.

## BG-05 — Direct product binary uploads

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. The two upload/confirmation routes proposed below now exist. `Product.mediaVersion` supports gallery concurrency, uploaded and hosted images have distinct projections, and existing metadata/removal routes handle both sources. See [product contract and evidence](backend/docs/managed-media.md#product-binary-upload-checkpoint-bg-05). The requirements below preserve the original acceptance baseline.

### Existing capability

- `POST /admin/catalog/products/{productId}/images` accepts approved hosted image metadata: `url`, `altText`, `sortOrder`, `isPrimary`.
- `PATCH/DELETE /admin/catalog/products/{productId}/images/{imageId}` already supports metadata updates and removal.
- The original audit found no direct binary upload preparation/confirmation contract. That gap has since been implemented; retain working hosted-image CRUD alongside the new binary workflow.

### Original implementation requirements

- Add product-bound signed upload preparation, or an equivalent backend-mediated binary upload.
- Add a token-confirmation operation that verifies the uploaded object before attaching it to the product.
- Preserve the existing hosted-URL creation contract. Prefer a separate confirmation endpoint, or document a backward-compatible discriminated request that accepts exactly one of an approved URL and an upload ticket.
- Feed confirmed uploads into the existing image ordering, primary selection, edit and removal behavior.
- Distinguish backend-owned uploaded objects from externally hosted images so deletion only removes objects the application owns.

**Proposed additions:** `POST /admin/catalog/products/{productId}/assets/upload` and `POST /admin/catalog/products/{productId}/images/confirm`. Existing hosted-URL endpoints remain supported.

**Authorization:** preserve existing catalogue image administration permissions and any product scope restrictions.

**Original acceptance criteria**

- A selected local file becomes a persistent product image only after successful confirmation.
- Existing hosted-URL image creation, ordering, primary selection and deletion remain compatible.
- Invalid, expired or wrong-product tickets cannot create image records.
- Removing externally hosted metadata does not attempt to delete an external object.

## BG-06 — Editing/removing attached stock vehicle images

**Current status:** implemented with recorded local acceptance; deployed storage verification remains. `PATCH/DELETE /staff/vehicles/{vehicleId}/images/{imageId}` and `GET /staff/vehicles/{vehicleId}/images/{imageId}/content` are integrated with the stock editor. The update schema requires `expectedVersion` plus at least one change and supports nullable alt text, display order and primary selection. The [stock-media acceptance record](backend/docs/managed-media.md#stock-vehicle-images-bg-06) reports 13 stock-media integration tests, six media HTTP tests, two live stock browser scenarios and all 12 existing stock browser scenarios passing. These are recorded prior results using isolated storage, not tests rerun by this documentation review.

### Existing capability

- `POST /staff/vehicles/{vehicleId}/assets/upload` prepares a signed upload.
- `POST /staff/vehicles/{vehicleId}/images` confirms an `assetToken` with `altText`, `sortOrder` and `isPrimary`.
- `GET /public/vehicles/images/{imageId}` serves media through the public proxy subject to existing visibility rules.
- At the original audit, existing images had no PATCH/DELETE routes. These operations and their frontend integration are now implemented with recorded local acceptance.

### Original implementation requirements

- Add `PATCH /staff/vehicles/{vehicleId}/images/{imageId}` for permitted alt-text, order and primary-selection changes.
- Add `DELETE /staff/vehicles/{vehicleId}/images/{imageId}` for authorized removal.
- Apply the existing stock role, branch, record and publication rules to the new mutations; a `/staff` prefix alone is not an authorization check.
- Enforce image-to-vehicle binding and the repository's concurrency conventions. Keep primary selection and ordering transactional.
- Define whether deleting the last image of a published listing is allowed, and the primary fallback when deleting the current cover.
- Support replacement through verified new attachment followed by removal of the old image, or a documented atomic operation. Never delete the old image before a replacement is confirmed.
- Define public proxy/cache behavior and storage cleanup after removal.

**Original acceptance criteria**

- Authorized stock users can edit existing image metadata, change the cover, reorder and remove images.
- Unauthorized branches/roles and mismatched vehicle/image IDs fail closed.
- Stale updates produce an explicit conflict instead of overwriting newer changes.
- Failed replacement preserves the previous image; deleted images no longer appear in listing responses.
- Publication constraints and public cache invalidation are tested.

## Shared media implementation requirements

The shared managed-media infrastructure is now implemented for profile, garage, service, product and stock vehicle resources. Reuse it for future extensions instead of building another ticket/storage/cleanup system. The following requirements remain the baseline; live storage verification is still required.

Extend the existing signed asset infrastructure where appropriate. Do not route unrelated resources through stock vehicle authorization merely to reuse an upload URL.

1. **Preparation:** bind the upload ticket to the authenticated principal, resource, purpose, permitted MIME type, size and checksum. Return expiry and the precise upload method/headers required by storage.
2. **Validation:** enforce actual byte size, file signature/decodability, dimension limits and checksum at confirmation. A client-supplied extension or MIME type is insufficient. Define image transformations and metadata stripping appropriate to personal images.
3. **Confirmation:** verify the object and bind it to one authorized resource. Document single-use ticket behavior and the response to an idempotent retry after a lost response. Storage transfer alone must not create a visible image record.
4. **Read model:** return stable image IDs, alt text, ordering/primary status where applicable, dimensions and a safe display URL/access method. Do not leak storage credentials or upload tickets in normal read responses or logs.
5. **Consistency:** retain existing CSRF, idempotency and version-check conventions; specify the mutation version source and how callers recover from conflicts or uncertain outcomes.
6. **Privacy/publication:** personal profile/garage media requires owner-authorized reads; service/product/stock images follow catalogue/listing visibility. Do not expose private documents through public image proxies.
7. **Lifecycle:** clean up expired unattached uploads, replaced images and deleted-resource assets. Make cleanup retryable and safe for retained references. Define cache invalidation and retention behavior.
8. **Limits and errors:** publish per-resource file/count limits and machine-readable failure codes using existing envelopes. Cover invalid media, oversized files, expiry, permission denial, stale versions, rate limits and storage outages.
9. **Audit:** record permitted actor/resource mutation metadata through existing audit facilities without recording file contents, secrets or signed URLs.

## Contract, persistence and delivery checklist

This is the original delivery baseline, not the current backlog. Implementation and local evidence for all six capabilities are recorded in the [handoff](backend/docs/backend-gaps-handoff.md); outstanding work is listed in the actionable backlog above.

- Inspect current models and infrastructure before selecting new tables or fields; add reviewed, backward-compatible migrations only where required.
- Add validated DTOs, policy checks, repository/service/controller logic and routes within the existing module architecture.
- Extend module OpenAPI definitions and regenerate `backend/docs/api/allied-autotech.openapi.json`.
- Add unit/integration tests for ownership, all relevant roles, concurrency, idempotent retries, validation and storage failures.
- Regenerate frontend API types through the existing `api:types` command after the contract is finalized.
- Integrate real customer search and supported media actions into the redesigned frontend, retaining loading, empty, error, conflict and permission states.
- Run backend contract/tests and frontend lint, type checking, tests and build; verify browser flows against staging rather than fixtures alone.

The original six-gap criteria above are acceptance requirements, not a current list of absent endpoints. Follow the remaining delivery order at the top of this document and retain links to each capability's actual verification record.

## Deployment verification — separate from missing features

Local verification includes controlled browser fixtures and real API/database checks against isolated local environments, as specified in each linked capability and page report. These checks do not establish deployed provider or storage readiness. The following are staging integration checks, not proof that additional backend features are missing:

- Verify all four roles with suitable staging accounts, including direct unauthorized requests and cross-customer isolation.
- Exercise signed uploads against real configured storage, including CORS, allowlists, expiry, cleanup and public/private access boundaries.
- Verify existing payment-provider sandbox, email delivery, cookie/session and recovery flows against deployed services.
- Retest gallery/profile updates after reload and public cache refresh; confirm that failed storage transfers never create successful attachments.

Existing booking requests, quotations, checkout/payment authority, MFA, support history, notifications and local Help articles are outside these six implementation gaps. Preserve their current behavior and do not introduce booking deposits or expose disabled payment providers as part of this work.

### Contact and workshop configuration

The current Contact page uses existing `POST /public/support/enquiries` and `POST /public/support/complaints` routes. These routes validate real submissions and return an accepted receipt; they are not missing backend features. Attachment upload is not part of the public submission contract and must not be added to the form without a separately specified backend capability.

| Item                   | Remaining action                                                                                                                                                                                                       | Completion evidence                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active handling branch | Confirm the deployed backend contains the correct active branch and that public branch reads expose it. Enquiries/complaints require an active handling branch; vehicle enquiries derive it from the selected listing. | A real submission creates the intended support record against the correct branch. An empty dataset shows a recoverable empty state.                                                  |
| Google Maps embed      | Configure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with appropriate API/referrer restrictions, then rebuild and verify the embedded map. The owner has no key or verified Place ID yet.                                       | The map loads at the correct workshop in each configured environment; without a key, the existing address panel and external Maps links remain usable.                               |
| Workshop address       | Retain **133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria**. The owner confirmed that Pizza Jungle is within Kilimanjaro and that the site must say “beside Kilimanjaro.”                    | Visible address, map query and directions agree with the approved address. A Place ID or coordinates are used only after verification.                                               |
| Contact acceptance     | Local page gate passed, including browser, real API/database and shared-component checks. Deployed provider delivery and the keyed map remain separate configuration checks.                                           | See the [expanded Customer Care report](frontend/docs/page-quality/contact-expanded.md) for current results and limitations; local acceptance is not deployed delivery verification. |

The Maps item is frontend/deployment configuration, not a requirement for a new backend Maps endpoint. A Place ID is optional while the address query is used. The existing fallback permits the page to work before a key is supplied.

### Vehicle discovery metadata — optional API enhancement

**Backlog ID:** API-01. **Status:** implemented and locally accepted on 9 October 2026; deployment verification pending. **Remaining owner:** deployment + QA. **Sources:** [mounted routes](backend/src/modules/vehicles/vehicles.routes.ts), [discovery schemas](backend/src/modules/vehicles/vehicle-discovery.schemas.ts), [repository](backend/src/modules/vehicles/vehicle-discovery.repository.ts), [frontend query integration](frontend/lib/vehicle-discovery.ts), and [exported OpenAPI](backend/docs/api/allied-autotech.openapi.json).

**Original limitation:** the accepted [expanded Vehicles listing audit](frontend/docs/page-quality/vehicles-expanded.md) used `GET /public/vehicles`, exact-name make/model fields and a current-page count. That earlier acceptance does not cover the new discovery extension.

**Present in the working tree:** anonymous `GET /public/vehicles/discovery` and `GET /public/vehicles/facets`, strict schemas, bounded repository queries, authenticated cursors, migration `20261008170000_vehicle_discovery_indexes`, exported OpenAPI and frontend query changes. Discovery returns `items`, optional `nextCursor` and `totalMatches`; facets return bounded make/model options. Both default to 20 and permit at most 50 records. Model options require a make. The legacy public listing route remains mounted.

**Local acceptance:**

- Ten database integration cases and two cursor unit cases passed: AVAILABLE/active-branch visibility, public projections, all four sorts with ties, exact totals, case-folded make/model option traversal, literal wildcard handling, query validation, tampering/filter binding, deleted anchors and legacy UUID compatibility.
- A controlled concurrent write proved page/count repeatable-read consistency. A 10,000-listing fixture measured 94.6 ms for a filtered inventory page/count and 229.6 ms for the combined option traversal checks on local PostgreSQL. These measurements are local evidence, not a production latency guarantee. Price/year/visibility changes can move records between separate page requests.
- Twenty-five existing vehicle boundary/security/sales/OpenAPI regressions passed; 48 migrations replayed into a new isolated test database. Backend type/lint/format/secret checks, Prisma validation, OpenAPI validation and 306-operation route coverage passed. Generated frontend types match the exported contract.
- Frontend unit suite: 354 passing. Production build passed. All 25 Vehicles browser scenarios passed, including options/error recovery, totals, reload/history, filters and 320–1536px responsive/accessibility checks. A real production-preview/API/PostgreSQL flow traversed two distinct 12-item pages among 10,000 matches, restored page two after reload, paged make options and selected make/model filters yielding five matching vehicles without page errors.
- Evidence and environment limits are recorded in the [expanded Vehicles report](frontend/docs/page-quality/vehicles-expanded.md). Deploy migration `20261008170000_vehicle_discovery_indexes` and the backend before its dependent frontend, then verify the target environment.

Saving and inspection mutations retain their separate permission and transactional boundaries. Local acceptance does not establish deployed storage, provider or production performance acceptance.

### Shop discovery metadata — optional API enhancement

**Backlog ID:** API-02. **Status:** implemented and locally accepted on 9 October 2026; deployment verification pending. **Remaining owner:** deployment + QA. **Sources:** [discovery contract](backend/src/modules/catalog/product-discovery.schemas.ts), [repository](backend/src/modules/catalog/product-discovery.repository.ts), [mounted routes](backend/src/modules/catalog/catalog.routes.ts), and [Shop acceptance](frontend/docs/page-quality/shop-expanded.md).

**Implemented contract:** additive anonymous `GET /public/catalog/products/discovery` and `GET /public/catalog/facets`. Existing product/category/detail routes remain supported. Discovery returns safe public products, exact `totalMatches` and an optional signed cursor, with existing filters plus inclusive `minPriceKobo`, `maxPriceKobo` and `availability=in_stock|out_of_stock`. In-stock means unreserved stock at at least one active branch; out-of-stock includes missing inventory. Quantities and reservation counts remain private. Both products and their categories must be active.

Options cover category, brand, compatibility make and make-scoped model names backed by public products, including out-of-stock products. Empty categories and null models are omitted. Search is a literal case-insensitive prefix. Category values are UUIDs; name values are case-folded and deduplicated. Optional category scoping is supported for other option fields. Limits default to 20 and cap at 50. Cursors bind endpoint/filter/sort and survive deleted anchors; legacy UUID product links require a visible matching anchor. Each page/count uses one repeatable-read transaction; edits can move products between separate requests. The original substring product search now escapes literal percent/underscore/backslash consistently with exact-name filters.

**Local evidence:** 49 migrations replayed in a new isolated database, including `20261009100000_product_discovery_indexes`. Eleven new database cases passed across four sort orders/ties, visibility, literal inputs, bounded options, compatibility relationships, stock/price filters, cursor tampering/deletion, concurrent page/count reads and 10,000 products. Fourteen existing catalogue/security/migration/OpenAPI regressions passed. OpenAPI and mounted-route checks passed for 308 operations/260 paths; frontend types regenerated. Frontend unit suite: 355 passing. Production build/type/lint/format checks and all 28 Shop browser scenarios passed. The real API/browser flow traversed distinct 12-product pages among 10,000 matches, searched categories globally, returned 50 brand/price matches and one available make/model/year match, and preserved filters after reload on mobile. Local 10,000-product timings were 185.1 ms for a 12-item page plus exact filtered count and 69 ms for traversing 100 brand options; these are observations, not production guarantees.

Deploy migration and backend before the dependent frontend, then verify the target environment. The separate dependency-security follow-up and deployed storage/provider checks are not implied by Shop feature acceptance.

### Service discovery

**Backlog ID:** API-03. **Status:** implemented and locally accepted on 9 October 2026; deployment verification pending. **Owner:** deployment + QA. **Sources:** [contract and rollout](backend/docs/service-discovery.md), [query schemas](backend/src/modules/service-operations/service-discovery.schemas.ts), [repository](backend/src/modules/service-operations/service-discovery.repository.ts), and [Services assessment](frontend/docs/page-quality/services-expanded.md).

Added anonymous `GET /public/services/discovery`, `GET /public/services/categories`, and `GET /public/services/categories/{categoryId}`, plus administrator category list/create/update operations at `/admin/service-categories`. Existing service list/detail/media/booking routes remain supported. Search is a bounded literal case-insensitive substring across name and descriptions; pricing/category filters, three deterministic sort orders, signed filter-bound cursors and exact totals operate over the same active-service dataset. Page and count share a repeatable-read transaction. Unknown duration sorts last. Public category options are bounded and backed by active services.

Categories are reusable admin-managed records with active state, optimistic versions, CSRF/MFA enforcement and audit events. Assignment accepts active categories only; archiving removes public grouping without unpublishing services or changing bookings. Existing services remain uncategorized until assigned. Public service reads suppress archived category metadata. Service edits can preserve an unchanged archived assignment.

The Services frontend consumes discovery for server rendering and client navigation, with search, paged category options, pricing, sorting, exact totals, URL history/reload and cursor recovery. Admin and Super Admin navigation expose category management and service assignment. No service categories are invented or derived from one fetched page.

**Local evidence:** all 50 migrations replayed into a new isolated database, including `20261009140000_service_discovery`; 34 focused discovery/service-flow/media/security/OpenAPI/migration tests passed. Cases cover all four roles, MFA/CSRF, stale edits, category archive semantics, literal inputs, signed/legacy cursors, concurrent page/count consistency and indexed search over 10,000 services. Prisma validation, backend type/lint/format/secret checks, 314-operation OpenAPI/mounted-route coverage and generated frontend types passed. Frontend units: 357 passing; production build and targeted type/lint checks passed. All 23 Services browser scenarios passed against the final production preview, including real API/database flows for Admin and Super Admin category creation/assignment/archive, public search/options pagination/sort/history/reload, and ten-width accessibility/recovery checks. Desktop and mobile screenshots were inspected.

Deploy the migration and backend before the dependent frontend. The application database has not been migrated by this isolated verification. Real storage/provider and deployment acceptance remain separate.

## Repository evidence and frontend handoff

- [Exported API contract](backend/docs/api/allied-autotech.openapi.json)
- [Customer routes](backend/src/modules/customers/customers.routes.ts) and [schemas](backend/src/modules/customers/customers.schemas.ts)
- [Directory routes](backend/src/modules/customers/customer-directory.routes.ts) and [directory contract](backend/src/modules/customers/customer-directory.openapi.ts)
- [Profile read projection](backend/src/modules/customers/customers.repository.ts) and [data models](backend/prisma/schema.prisma)
- [Catalogue routes](backend/src/modules/catalog/catalog.routes.ts) and [schemas](backend/src/modules/catalog/catalog.schemas.ts)
- [Product binary media routes](backend/src/modules/catalog/product-media.routes.ts) and [managed-media contracts and acceptance](backend/docs/managed-media.md)
- [Service routes](backend/src/modules/service-operations/service-operations.routes.ts) and [schemas](backend/src/modules/service-operations/service-operations.schemas.ts)
- [Stock vehicle routes](backend/src/modules/vehicles/vehicles.routes.ts) and [schemas](backend/src/modules/vehicles/vehicles.schemas.ts)
- [Stock image mutation schemas](backend/src/modules/vehicles/stock-media.schemas.ts) and [service implementation](backend/src/modules/vehicles/stock-media.service.ts)
- [Storage adapter](backend/src/providers/storage/s3-object-storage.adapter.ts)
- [Support routes](backend/src/modules/support/support.routes.ts) and [schemas](backend/src/modules/support/support.schemas.ts)
- [Identity routes](backend/src/modules/identity/identity.routes.ts)
- [Original redesign gap summary](frontend/docs/redesign-backend-gaps.md)
- [Completed frontend handoff](frontend/docs/redesign-handoff.md)

This document records the implementation work required. It does not authorize changes to role boundaries, existing domain rules or unrelated deployment files.

## Implementation audit — 30 September 2026

This section preserves the earlier BG-01 implementation checkpoint. Statements below about missing media infrastructure describe that checkpoint, before BG-02 through BG-06 were completed. Use the current status table and [managed-media record](backend/docs/managed-media.md) for present media capabilities and verification boundaries.

The supplied brief refers to `Pasted markdown(6).md`; that filename is absent from the workspace and attachment directory. This repository document contains the matching six-gap specification and was read in full before implementation.

Existing infrastructure: npm lockfiles per application; Express 5 controllers/services/repositories; Prisma 7 and PostgreSQL; secure session authentication with privileged MFA; strict Zod validation; shared error/success envelopes; PostgreSQL-backed production rate limiting; transactional audit events; OpenAPI export, validation and route-drift checks; Next.js 16 with generated OpenAPI types, authenticated API client, resource loading, cursor pagination, feedback, upload and mutation-review components.

Discrepancies and reuse boundaries:

- `CustomerProfile.avatarUrl` already exists and is returned by profile reads, but it has no authorized upload/replacement lifecycle. It is not evidence of a completed profile-media feature.
- Stock asset tickets are encrypted and bound to actor, vehicle, kind, object key, MIME, size, checksum and expiry. The S3 adapter validates metadata and a short signature prefix, but does not fully decode images, strip metadata, or delete objects. Existing workers provide a runtime to extend; an object cleanup lifecycle is missing.
- The object-storage fallback reports synthetic success when no bucket is configured. New media functionality must fail closed outside explicit injected test adapters.
- Existing Admin/Super Admin operational read policies are cross-branch; branch restrictions apply to ordinary Staff. Customer profiles have no branch relationship. Directory access must not grant Staff these administrative reads.
- New directory reads use minimal projections and separate bounded collections. No counts, media access, impersonation or account mutations are included.

BG-01 contract: `GET /admin/customers`, `GET /admin/customers/{customerId}`, and explicit `GET` collection routes ending in `vehicles`, `bookings`, `quotations`, `orders`, `payments`, `enquiries`, and `complaints`. Customer IDs are profile IDs. Name/email prefix searches require two characters; phone prefixes require three digits; exact ID search requires a UUID. Queries trim/collapse whitespace and lowercase text; phone matching removes punctuation without guessing country codes. Empty search is supported. Search field, status, email verification and registration-date sort are allowlisted. Default page size is 25, maximum 50. Directory cursors bind filters and sorting, carry the last registration timestamp and unique account ID, and remain usable if the preceding row disappears. They do not provide snapshot isolation: concurrent matching inserts/updates can affect subsequent pages. Related collections use ascending record IDs and independently validate customer-bound cursors. Read audits contain collection/result count, not search text or contact values. Responses are private and uncached.

Persistence: `20260930010000_customer_directory_indexes` adds prefix expression indexes, an account registration index, and customer/record composite indexes without adding extensions or changing existing records. Expression and partial indexes are maintained by SQL; representable composite indexes are declared in Prisma.

BG-01 capability verification complete: the full 43-migration history replayed successfully into the new isolated `allied_bg_gaps_20260930_test` database. Initial directory integration tests passed (22), unit tests passed (6), and 5,000-customer PostgreSQL EXPLAIN checks confirmed name/phone/email index use (1). OpenAPI validation and mounted-route coverage passed. Frontend directory/detail integration and generated types are present. Five Playwright scenarios passed against the real isolated API with synthetic accounts; error/empty/loading responses were explicitly controlled for those UI-state checks. The real-data browser flow passed again after compact-spacing changes. Desktop (1440px) and mobile (390px) screenshots were inspected, with no page overflow. Frontend production build/standalone packaging, targeted lint/format checks, and backend/frontend type checks passed. Frontend unit regression: 161/163 passed in parallel, with the two timeout cases passing unchanged in a one-worker rerun. At this historical checkpoint, BG-02 through BG-06 were still outstanding; all six now have recorded local implementation acceptance as stated above.

Environment: local PostgreSQL is available. Real object storage is not configured (`OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` absent; an endpoint is also needed for non-AWS storage). Staging uploads/CORS/cleanup have not been verified. Browser QA uses an isolated local API/test database and a separate frontend copy because another development server is running in the shared workspace. Existing contact/support edits are outside this implementation and are preserved.

## BG-11 — Approved vehicle reservation terms and acceptance validation

**Status:** local implementation accepted on 12 October; approved business content and deployment remain open. Identified during the customer purchase detail audit on 11 October 2026, separately from previously accepted BG-01 through BG-10. The purchase-detail redesign passed its own local frontend gate; the agreement workflow has separate acceptance below.

**Original finding:** at the purchase-detail audit, [`ReservationInput`](backend/src/modules/vehicle-sales/vehicle-sales.schemas.ts) accepted a non-empty `termsVersion` and literal `termsAccepted: true`, and the reserve service stored that version without validating an approved customer-readable agreement. The existing reservation/refund policy snapshot was not an agreement document.

**Current implementation and evidence:** [`reservation-terms.ts`](backend/src/modules/vehicle-sales/reservation-terms.ts), the owned agreement-read route, reservation validation and the [additive migration](backend/prisma/migrations/20261011180000_vehicle_reservation_terms/migration.sql) now have [recorded backend acceptance](backend/docs/vehicle-reservation-terms.md). The generated contract exposes current terms, historical accepted terms and a legacy indicator, with document version, revision, title, plain-text body, content hash and effective date. Fifty-nine combined tests, 52-migration replay and a historical-record upgrade check passed. Those backend checks alone do not establish frontend acceptance; separate frontend/browser/API evidence is recorded later in the same report. Approved business content and deployment remain outstanding.

**Customer impact:** the frontend now displays the applicable approved agreement, requests explicit acceptance, and retains the original request for safe recovery after reload. Where approved content is absent, customer-care guidance remains. Payment requests never accept terms or extend a hold.

**Owners:** business owner supplies the approved reservation agreement; backend owns publication/version validation and immutable acceptance evidence; frontend owns readable review/acceptance after the contract exists. Do not invent legal wording or silently approve sample terms.

**Implementation and acceptance:**

- [ ] Obtain approved customer-readable agreement content, effective date and provenance. Publication uses the existing Super Admin authority and assigns an immutable policy UUID; customers cannot approve versions.
- Owner confirmation, 12 October: the agreement is **still awaiting approval**. No business wording is authorized for publication yet.
- [x] Provide a read endpoint for the applicable published agreement with stable version and content identity. Fail closed when no approved version exists. Document the contract and generate frontend types.
- [x] In the existing reservation transaction, require the applicable approved version and explicit acceptance; reject arbitrary, stale, unpublished or withdrawn versions before changing listing availability or creating a hold. Preserve owner checks, CSRF, optimistic version checks and existing hold/concurrency rules.
- [x] Save immutable acceptance evidence tied to the exact document content/version, customer and purchase. A later publication must not alter historical evidence.
- [x] Preserve idempotent replay of an already accepted reservation even if the published agreement subsequently changes. Reusing a key with different terms/body must conflict.
- [x] Test no-document, missing acceptance, forged/stale versions, publish/reserve concurrency, foreign purchases, roles, two customers reserving one listing, retained-response replay and historical evidence retrieval with actual database/API tests. Browser-level lost-response recovery remains part of the frontend acceptance below.
- [x] Integrate the readable agreement into a separate explicit reservation review. Real Edge/API/PostgreSQL verifies cancellation creates no hold, acceptance creates one reservation and original-key replay after withdrawal/reload preserves evidence. A separate browser test confirms payment requests leave consent unchecked and send no reservation. See the linked report for scope and fixture corrections.

No backend implementation or approved business terms were added in the purchase-detail visual pass itself. The subsequent backend implementation now has [recorded acceptance evidence](backend/docs/vehicle-reservation-terms.md): all 52 migrations replayed, an additive upgrade preserved four historical synthetic acceptances without inventing document links, 59 combined tests passed, and backend/contract/frontend-type checks passed. Existing Super Admin policy authority governs publication. The owner publication interface and customer review/recovery now have separate local browser/API/database acceptance (12 October). Approved business wording remains open, so BG-11 is not complete. REL-03 still requires deployed reservation/session/payment verification after local acceptance.

## Customer vehicle purchase detail — local frontend acceptance

The [purchase detail page](frontend/docs/page-quality/customer-purchase-detail.md) passed its separate local gate on 11 October, the fortieth expanded frontend milestone. The existing owned detail projection supplies real photo references, exact prices, recorded deadlines/terms, history and handover. No new read endpoint is needed for those fields. The UI preserves complete payment-history checks, CSRF, fresh preflight validation and original-key recovery. Real browser/API/PostgreSQL verification confirmed a lost response followed by replay leaves exactly one payment request for 50000001 kobo, does not change purchase progress, and respects customer/role/CSRF boundaries. Eighty-five browser scenarios, eighteen final repeats, twenty-one backend tests, fourteen frontend tests and build/static checks pass. See the report for evidence and final visual corrections.

BG-11 still requires approved business content before new online reservation agreement acceptance becomes available in an application environment. Synthetic local policy approval is test setup only. No production terms, live settlement or deployed integration acceptance is implied; REL-01 through REL-03 remain open.

## Customer profile - existing backend capability, local frontend acceptance

The [customer profile page](frontend/docs/page-quality/customer-profile.md) passed its local gate on 12 October 2026, the forty-first expanded frontend milestone. Existing owner-scoped profile reads/updates and BG-02 managed photo routes support the completed experience; no new backend endpoint or migration is required. The page sends only changed contact fields, retains CSRF and session checks, blocks mutations against stale reads and reconciles uncertain metadata writes before another save. Profile photos retain private reads, byte validation, expected media versions and original-token confirmation retry.

Sixty-two browser scenarios, 23 backend regressions, 13 frontend tests, full frontend lint and the production build passed. Real browser/API/PostgreSQL and isolated HTTPS byte storage verified persisted contact changes, one audit after a lost metadata response, upload/replacement/removal, invalid-image preservation, lost-confirmation retry, private read revocation and owner/role/CSRF/version enforcement. The preview's unavailable-storage fallback also passed after removing the QA host setting.

**Contract update:** profile text now has its own `profileVersion`; PATCH requires `expectedVersion` and atomically rejects stale writes. The editor preserves the original draft revision across reloads and requires explicit saved-value review after conflicts or uncertain outcomes. Photo `mediaVersion` remains independent. Durable server replay is not provided. See [profile revision acceptance](backend/docs/customer-profile-revisions.md). Deployed media and account verification remain under REL-01 and REL-03. This acceptance does not close BG-11 or certify remaining dashboard routes. Customer privacy requests, notifications and reviews have since passed their separate gates; customer care has also passed its list gate below. Customer-care conversations have also passed their gate below. Customer order aftercare and work-dashboard overview have since passed their local gates; the next frontend audit covers workshop bookings `/admin/bookings`.

## Deferred backend capabilities

Source review: 12 October 2026. These are limitations of the current contracts, not newly completed work or missing endpoints needed to use the existing profile and privacy-request workflows. Proposed extensions need a defined scope before implementation. No application code, policy, migration or runtime setting was changed by this documentation update.

### Profile text conflict protection - optional enhancement

**Status: implemented locally.** `PATCH /customers/profile` requires `expectedVersion` from the owned read's `profileVersion`, compares and increments it atomically with the contact update and audit, and returns 409 `STALE_VERSION` without writes on conflict. Phone replacement clears the previous number's verification. Photo `mediaVersion` remains independent. The frontend preserves the original draft baseline/revision and uncertain-outcome marker across reloads, shows fresh saved details for review and requires an explicit save after keeping changes. No unversioned bypass or automatic replay is provided.

**Sources:** [profile input schema](backend/src/modules/customers/customers.schemas.ts), [profile service](backend/src/modules/customers/customers.service.ts), and [accepted profile page](frontend/docs/page-quality/customer-profile.md).

**Remaining owner:** deployment + QA. Drain older unversioned API writers, apply `20261013100000_customer_profile_revision`, regenerate clients and release the matching API/frontend contract. Existing browser clients must reload.

**Local evidence:** 74 unique backend cases and 430 frontend unit cases passed. All 56 migrations replayed with a clean schema comparison; an additive upgrade preserved all previous data across 5,347 synthetic profiles. Real API/browser verification exercised competing sessions and dropped committed responses. Detailed counts, browser evidence and release boundaries are recorded in [customer profile revisions](backend/docs/customer-profile-revisions.md).

**Deployed acceptance:** verify two-session conflict protection, draft persistence/review, phone-verification invalidation and independent photo changes against the released environment. Preserve optional-field clearing, ownership, role denial, CSRF and changed-field auditing.

### Privacy execution - policy-dependent future capability

**Current behavior:** `GET` and `POST /customers/privacy-requests` provide an owner-scoped, paginated history and intake for `ANONYMIZATION` or `DELETION`. Intake returns an existing non-rejected request of the same kind without replacing its explanation. Authorized reviewers use the staff review and retention-hold routes. Review requires the explicit `PRIVACY_REVIEW` capability and MFA, including for Super Admin; active holds or unresolved disputes block approval. The status `APPROVED_PENDING_POLICY` records a decision, not completed deletion. The capability projection explicitly keeps `destructiveRetention.enabled` false.

**Sources:** [privacy routes](backend/src/modules/policies/privacy.routes.ts), [capability projection](backend/src/modules/policies/policies.service.ts), [owner decision checklist, Q13](backend/docs/owner-decision-checklist.md), and [owner implementation matrix](backend/docs/owner-implementation-matrix.md). Existing [privacy workflow tests](backend/tests/integration/privacy-workflow.test.ts) describe intake isolation, duplicate suppression, capabilities, holds and concurrent review; they were inspected for the initial handoff, then rerun against an isolated database during the subsequent [customer privacy gate](frontend/docs/page-quality/customer-privacy.md).

**Dependency / owner:** business owner and appropriate retention-policy reviewers must define the record-specific rules, start events, exceptions and approval process. Backend then owns any approved execution workflow; frontend and QA own accurate progress and outcome presentation. No deletion schedule or retention duration is supplied or assumed here.

**Implementation scope after approval:** agree the executable policy and data coverage first, including protected financial/audit records, media, backups and unresolved holds/disputes. Define a separately authorized, auditable execution workflow with restart/retry behavior and explicit outcomes before exposing an execution action. Recheck policy and protections at execution time; review approval alone must not schedule or perform destructive work. Document new contracts and compatibility requirements before implementing dependent UI.

**Acceptance:** approved synthetic scenarios affect only the intended account and permitted records; protected records remain protected; newly applied holds prevent execution; unauthorized roles and missing assurance fail closed. Interrupted or repeated processing must not falsely report completion or bypass protections. Verify the agreed media/session consequences and distinguish completed work from deferred retention in customer-facing status. Use an isolated disposable database for destructive acceptance tests.

**Frontend boundary:** the current page may submit a request and display its actual review status. It must not promise automatic deletion, completed anonymization or a deadline that the backend and approved policy do not provide. The customer privacy page has now passed its separate [local visual/browser/API gate](frontend/docs/page-quality/customer-privacy.md). That acceptance covers intake and review history; it does not provide or approve destructive execution.

## Customer privacy requests - local frontend acceptance

The [customer privacy page](frontend/docs/page-quality/customer-privacy.md) passed its local gate on 12 October, the forty-second expanded milestone. Existing owner-scoped intake/history and capability-protected reviewer routes support this experience. No new endpoint or backend implementation was required. The UI now requires confirmation, preserves duplicate-request semantics, blocks stale writes and reconciles uncertain outcomes through explicit history refresh and acknowledgement without automatically replaying intake.

Sixty browser scenarios, four backend integration tests, five resource-refresh tests, lint and the final production build passed. Real Edge/API/PostgreSQL verified exact persistence, one creation audit, duplicate explanation preservation, lost-response/reload recovery, private paging, owner/role/CSRF checks, explicit reviewer capability, active holds and stale review conflicts. Approved review still left the account intact. The deferred privacy-execution capability above remains policy-dependent; this page gate does not close it or establish deployed acceptance. Customer notifications have subsequently passed their separate gate. Customer reviews have since passed their separate gate below. Customer care has also passed its list gate below. Customer-care conversations have also passed their gate below. Customer order aftercare has since passed its local gate below. Next frontend audit: workshop bookings `/admin/bookings`.

### Marketing delivery and preference contracts - policy-dependent follow-up

Source review: 12 October 2026, during the [customer notification page gate](frontend/docs/page-quality/customer-notifications.md), now locally accepted. Existing customer/staff inbox, single-read, read-all and optional preference routes are implemented. No replacement endpoint is required for those workflows.

**Current boundary:** [notification service](backend/src/modules/notifications/notifications.service.ts) rejects marketing enqueue, the delivery worker blocks marketing dispatch, and [capabilities](backend/src/modules/policies/policies.service.ts) report marketing disabled. Saving an optional marketing preference records consent but does not activate campaigns. Security and transactional delivery remain separate; optional operational delivery is on by default. Actual email/SMS delivery still depends on contact information and configured providers.

**Required before marketing activation:** the business owner must approve content, consent wording/version, sender identity and unsubscribe behavior under [Q12](backend/docs/owner-decision-checklist.md). Backend implementation must retain these approvals as authoritative policy, enforce consent and withdrawal at dispatch, document unsubscribe and campaign boundaries, and replace the pending wording reference only through an approved, auditable process. Preserve historic consent records. Do not enable marketing by removing a guard or by treating a frontend preference as business approval. QA must verify withdrawal before dispatch, mandatory-message separation, repeated delivery handling and real provider acceptance in the target environment.

**Preference concurrency and recovery (locally verified):** expected-version checks, required original request keys, transactional receipts and migration 57 now have API/database, migration/upgrade, frontend and production-browser acceptance. Recovery returns the original applied revision with current state and cannot reinstate a later withdrawal. See [contract, evidence and coordinated rollout](backend/docs/notification-preference-recovery.md). Original notification-page counts below are historical. Marketing remains disabled; deployed acceptance is separate.

## Customer notifications - local frontend acceptance

The [customer notifications page](frontend/docs/page-quality/customer-notifications.md) passed its local gate on 12 October 2026, the forty-third expanded milestone. Existing owned inbox, read and preference routes support the completed page; no new backend endpoint or migration was required. The interface preserves full-account read-all scope, explicit marketing preference consent, mandatory-message separation, CSRF and current-session checks. Stale reads block writes, and unknown outcomes require explicit refresh and acknowledgement without automatic replay, including after reload.

All 52 browser scenarios, the three selected backend notification/consent cases, six security/template unit cases, five resource-refresh cases, full frontend lint and the final production build passed. Real Edge/API/PostgreSQL verification confirmed 25+2 owned paging, read-all across filtered and expired records, cancellation, one consent/audit after a dropped committed response, withdrawal history and owner/role/CSRF/private-cache boundaries. The report records an unrelated broader-suite review fixture failure caused by the isolated database's missing service-category column; it does not claim the whole backend suite passed.

Marketing execution remains policy-dependent. Preference concurrency/replay has since been implemented with the separate acceptance above. Deployed email/SMS acceptance remains open under REL-02/REL-03. This page does not enable marketing, certify provider delivery or complete the remaining dashboard routes. Customer reviews have since passed their separate gate below. Customer care has also passed its list gate below. Customer-care conversations have also passed their gate below. Customer order aftercare has since passed its local gate below. Next frontend audit: workshop bookings `/admin/bookings`.

## Customer reviews - source-audited contract follow-ups

These findings originated in the customer-reviews source audit. The page has separate [local frontend/browser/API acceptance](frontend/docs/page-quality/customer-reviews.md). Source discovery and durable submission recovery have since been implemented; each subsection links its later verification and rollout requirements. Original findings are retained below as history.

**Existing contract:** authenticated customers can list their own reviews and submit through `GET` / `POST /customers/support/reviews`. Overall-business reviews do not require a completed transaction. Product, service, order and vehicle-purchase reviews require the matching completed, owned source. Creation validates that source and writes the review and audit in a serializable transaction. New reviews start `PENDING`. The database permits only one review per order item, booking, order or vehicle transaction, and only one product review per customer/product across purchases; rejection does not release that unique source. There is no customer edit/delete route in the current review router. Preserve these rules unless a separate product decision changes them.

**Evidence:** [customer review routes](backend/src/modules/support/support.routes.ts), [request validation](backend/src/modules/support/support.schemas.ts), [source validation and creation](backend/src/modules/support/support.service.ts), [review repository](backend/src/modules/support/support.repository.ts), [Review model](backend/prisma/schema.prisma), and [current completed-record picker](frontend/app/components/review-source-picker.tsx).

### Review submission recovery - optional enhancement

**Current status: locally implemented.** The API now requires a customer-scoped original request key; receipt, review and audit commit atomically, with a 24-hour replay window and current moderation in the response. The browser retains the original request across reload and requires explicit recovery confirmation. See [contract, verification and coordinated rollout](backend/docs/review-submission-replay.md). The original finding below is retained as history.

**Original limitation, now addressed locally:** review creation previously had no durable idempotency contract. If the database committed but the response was lost, another overall-business submission could create a second review. Transaction-source uniqueness prevented a second source-linked review but did not identify the original result through replay. The accepted original-key contract above now addresses this; deployed acceptance remains separate.

**Original priority / owner:** P2, backend + frontend + QA. The former history-only recovery remains appropriate for requests predating the new contract or without a valid recovery intent. Valid original-key recovery now follows the linked accepted contract and requires explicit confirmation; no automatic POST replay is provided.

**Implementation scope if selected:** define an actor- and operation-scoped request key, bind it to the normalized review body, and atomically persist the request outcome with the review and creation audit. Specify key retention, expired-key behavior, concurrent requests and the replay response. Reusing a key for different content must conflict. Keep authorization, CSRF, rate limiting, completed-source validation, unique source constraints and moderation rules. Update OpenAPI and generated types before adding frontend original-key recovery.

**Acceptance:** a dropped committed response followed by reload and original-key replay returns the same review identity with one review and one creation audit. Concurrent same-key requests do not duplicate creation; changed content conflicts without writes; another customer cannot retrieve or replay the result. Cover all five target types, already-reviewed sources, moderation between initial submission and replay, and retention expiry. Verify the recovery flow with a real isolated database/API and browser, rather than relying only on mocked responses.

### Review source discovery - optional enhancement

**Current status (13 October): locally implemented.** The private, bounded `/customers/support/review-sources` endpoint and frontend selection/preflight use database eligibility, including the existing one-review-per-customer/product constraint. Later-page draft selections resolve through an owned lookup on reload. See [contract and verification](backend/docs/review-source-discovery.md). The original finding and acceptance scope below are retained as history; deployed acceptance remains open.

**Original limitation (resolved locally):** the picker reads completed orders, bookings and vehicle transactions from their existing collections. Those collections are not a contract for unreviewed sources. A completed source may already have a review and therefore fail creation. A single page of review history cannot establish availability across all completed records.

**Proposed priority / owner:** P2, backend + frontend + QA. The current UI can accurately label the options as completed records and retain authoritative submission validation; a new endpoint is not required merely to restyle this page.

**Implemented scope:** define either a dedicated owner-scoped source collection or an additive availability projection on existing collections. Specify supported target types, stable pagination and whether reviewed records are excluded or carry an explicit unavailable reason. Product reviews must resolve to order items, service reviews to bookings, order reviews to orders and vehicle-purchase reviews to transactions. Business reviews remain independent of transaction selection. Do not invent a customer resubmission or deletion policy to free a previously reviewed source.

**Acceptance:** incomplete and foreign records never appear as available; previously reviewed sources follow the documented behavior for pending, approved and rejected reviews; product items and whole orders remain distinct targets. Traverse multiple pages without using partial frontend history as the source of truth. A source changing after selection or a competing submission must still be rejected safely during creation. Verify bounded queries, private projections, ownership, pagination, empty/error states and generated-contract compatibility before integrating the picker.

## Customer reviews - local frontend acceptance

The [customer reviews page](frontend/docs/page-quality/customer-reviews.md) passed its local gate on 12 October 2026, the forty-fourth expanded milestone. Existing review, completed-source and moderation routes support the experience. No backend endpoint or migration was required. The form preserves actual eligibility rules, current-session/CSRF validation and confirmation; unknown outcomes survive reload and require explicit history reconciliation without automatic replay. Completed records are not described as guaranteed unreviewed sources.

All 57 browser scenarios passed, with passing evidence for all 20 final layout/accessibility/draft checks after two unchanged timeout rechecks. Five resource-refresh tests, the focused backend review case, lint and the final build passed. Real browser/API/PostgreSQL verified all five review types, cancellation, 20+1 owned paging, exactly one creation/audit after a dropped committed response, incomplete/foreign/already-reviewed source rejection, role/CSRF/private-cache boundaries, moderation and public-field isolation. Fifty-five existing migrations replayed into a fresh isolated test database; no application database was migrated. The report preserves fixture corrections and final-repeat timing anomalies rather than claiming every run passed.

Durable submission replay has since been implemented with separate [contract and verification](backend/docs/review-submission-replay.md). Source discovery has since been implemented with separate [contract and verification](backend/docs/review-source-discovery.md). Local review acceptance does not close REL-01 through REL-03, approve business policies or certify the remaining dashboards. Customer care has also passed its list gate below. Customer-care conversations have also passed their gate below. Customer order aftercare has since passed its local gate below. Next: workshop bookings `/admin/bookings`.

## Customer care creation - contract follow-up

Source audit: 12 October 2026, during the `/dashboard/support` frontend gate. The [customer-care list gate](frontend/docs/page-quality/customer-care.md) has passed local acceptance. The customer creation recovery extension below is now locally verified; deployed acceptance remains separate.

### Support creation replay - optional enhancement

**Existing capability:** customer-owned enquiry and complaint list/create/detail/message routes are implemented. Six enquiry types and the supported complaint transaction sources retain branch resolution, owner checks, strict body validation, CSRF and rate limits. Customer-safe projections omit contact and internal-message fields. No new endpoint is required for the redesigned customer-care list and form.

**Current status:** implemented and locally verified. The existing creation routes require `support-create-v1.<timestamp>.<UUID v4>` keys and return the safe current owned record with `replayed`. Actor/operation-scoped receipts bind normalized bodies and commit atomically with the support record, audit and complaint policy work. Same-key concurrency, changed-body conflicts, 24-hour expiry after cleanup and current ownership checks fail safely. Replays preserve later record state and the original deadline snapshot after branch/source availability changes.

**Frontend:** account-scoped original request storage supports explicit review and recovery after reload. No automatic POST occurs on reconnect or navigation. Session changes redact retained private contents; expired or legacy state retains history reconciliation. Matching OpenAPI/generated types and frontend/API release are required. No migration is added. Anonymous contact and reply recovery remain separate; REL-02 provider delivery still requires deployed evidence.

**Evidence:** [support creation recovery contract and local acceptance](backend/docs/support-creation-recovery.md), [backend integration tests](backend/tests/integration/support-creation-replay.test.ts), [real browser recovery](frontend/tests/e2e/support-creation-real.spec.ts), and [customer-care design specification](frontend/docs/page-quality/customer-care-oct-concepts/README.md).

### Support reply replay - optional enhancement

**Current status:** implemented and locally verified. Customer message POSTs require an original `support-reply-v1.<timestamp>.<UUID v4>` key, scoped to actor, conversation kind/ID and normalized message. Message, creation audit, assigned-staff notification/outbox intent and receipt commit atomically in a serializable transaction with an owned conversation row lock. Concurrent duplicates return one message; changed contents and expired keys fail safely.

**Access and lifecycle:** every replay rechecks current conversation ownership and restricts the receipt projection to the original customer author and customer-visible message. Revoked ownership and foreign/internal receipt resources cannot disclose message content. An already committed reply can be recovered after closure; a new reply cannot be added to a closed conversation. Recovery is independent of message pagination. The 24-hour expiry remains enforced after receipt cleanup.

**Frontend and release:** the original key/body is retained in account/conversation-scoped session storage before sending. Explicit review and confirmation recover it after reload; no navigation/reconnect event automatically POSTs. Session changes redact private text, unavailable conversation reads block recovery, and success clears the corresponding draft and refreshes history. Legacy/expired markers retain manual reconciliation. OpenAPI/generated types and matching API/frontend must release together; older clients must reload. No migration is added and staff reply contracts are unchanged.

**Evidence:** [reply recovery contract and verification](backend/docs/support-reply-recovery.md), [backend integration cases](backend/tests/integration/support-reply-replay.test.ts), and [real browser/API/database recovery](frontend/tests/e2e/support-reply-real.spec.ts). Provider delivery remains a separate REL-02 gate.

## Customer care - local frontend acceptance

The [customer-care list and creation page](frontend/docs/page-quality/customer-care.md) passed its local gate on 12 October 2026, the forty-fifth expanded milestone. Existing enquiry/complaint routes support the redesigned page. No backend endpoint, schema or migration was added for this frontend gate. Account/category drafts, fresh-session checks, confirmation, stale-read blocking and reload-persistent unknown-outcome recovery preserve server authority without automatic replay.

All 111 browser scenarios passed, followed by 19 passing final CSS/accessibility checks. Six backend safeguard cases, five resource-refresh cases, scoped lint/format and the final production build passed. Real browser/API/PostgreSQL verified all six enquiry types and four complaint source choices, authoritative branches/statuses, 20+1 owned paging, cancellation, one support record and creation audit after a dropped committed response, owner/role/CSRF isolation and private no-store projections. All 56 current migrations replayed into a fresh isolated test database; no application database was migrated. Eleven responsive widths and eight states were captured; native desktop and mobile comparisons confirmed the final layout.

Durable customer support creation recovery is now locally verified as described above; coordinated deployment remains pending. REL-02 still requires observed delivery against the configured workshop branch; local persistence does not certify provider delivery. CFG-01 remains deferred until Maps configuration and a verified location are available, with the confirmed landmark beside Kilimanjaro preserved. Customer-care conversations have also passed their gate below. Customer order aftercare has since passed its local gate below. Next: workshop bookings `/admin/bookings`; remaining application and deployed integration acceptance stays open.

## Customer-care conversations - local frontend acceptance

The [customer enquiry/complaint detail routes](frontend/docs/page-quality/customer-care-detail.md) passed their separate local gate on 12 October 2026, the forty-sixth expanded milestone. Existing owned detail and paginated message endpoints support the design. Customer replies retain exact payload/CSRF validation, current-session and fresh closed-record checks, confirmation, account/conversation-scoped draft recovery, stale-read blocking and explicit reconciliation of unknown outcomes across reloads. No production backend endpoint, schema or migration was changed for this gate.

All 143 production browser cases passed, including shared staff support, public Contact and the customer-care list. Five resource-refresh cases, six backend safeguard cases, scoped lint/format, TypeScript and the final production build passed. Real browser/API/PostgreSQL verified 50+1 customer-visible paging, cancellation with no write, persisted replies on resolved records, one message/audit after a dropped committed response, reload/manual reconciliation without replay, closed-before-confirmation rejection, private no-store projections, foreign-owner 404, privileged-role 403, CSRF 403, forged internal visibility 422 and anonymous 401. The existing isolated customer-care test database was used with providers disabled; sessions/API/browser were cleaned up. The report records the corrected bounded-message projection assumption and the disabled-draft restoration fix.

Durable customer reply recovery is now locally verified as described above; coordinated deployment remains pending. REL-02 still requires observed notification delivery against the deployed configuration. Eleven responsive widths, native 1505x1045 and eight states passed visual checks; this does not certify the remaining dashboard routes or deployed integrations. Customer order aftercare has since passed its local gate below. Next: workshop bookings `/admin/bookings`.

## Customer order aftercare acceptance ? 12 October 2026

The [customer order aftercare page](frontend/docs/page-quality/customer-aftercare.md) is the forty-seventh locally accepted frontend milestone. It preserves the existing owned read/intake endpoints, same-kind non-rejected duplicate rule and customer-safe decision projection. Approval does not itself change order status, inventory or refund settlement. The page adds reviewed fresh reads, account/order-scoped drafts, a reload-persistent uncertain-outcome marker and explicit manual reconciliation. No production backend code or migration was changed for this page.

Evidence includes 51 production browser cases, ten final responsive/long-content repeats, five final read/recovery repeats, six backend cases, five resource-refresh cases, all 57 migrations in an isolated database, real browser/API/database persistence and denied owner/role/CSRF paths, full frontend lint and the final build. Eleven widths and eight states were checked. This is local evidence; REL-01 through REL-03 and deployed financial/provider outcomes remain open. Next: workshop bookings `/admin/bookings`.

### Aftercare original-request recovery - optional enhancement

Implemented with the coordinated API/frontend contract in [aftercare request recovery](backend/docs/aftercare-request-recovery.md). Both existing intake routes bind a 24-hour key to the customer, canonical order identity, operation and normalized original payload. Receipt, request and audit commit atomically. Recovery rechecks ownership and returns the current customer-safe original request after later rejection, without another request/audit or changes to stock, order state or refund settlement. The existing non-rejected same-kind deduplication rule remains intact.

The frontend retains the original request before POST and requires explicit confirmation to send or recover it. Reload/reconnect never automatically resend. Changed accounts redact private contents; unavailable ownership reads block recovery. Legacy and expired markers retain manual reconciliation. Customer history remains limited to the latest 100 records; original-key recovery reads its owned request directly and does not depend on that list.

Local verification passed 20 backend cases, 474 frontend unit cases and 62 unique production-browser cases, including real lost-response recovery and database effect counts. Coordinated deployment remains pending. No migration or pending policy/provider activation is introduced. Older-history browsing would require a separate owned pagination contract if needed. See the [remaining-work checklist](BACKEND_REMAINING_WORK.md) for release priorities.

## Work-dashboard overview acceptance ? 12 October 2026

The [work-dashboard overview](frontend/docs/page-quality/work-overview.md) is the forty-eighth locally accepted frontend milestone. Existing `/staff/overview` and administrator-only `/admin/operations/status` supply the required role-scoped aggregates, queues, reconciliation, worker heartbeat flags and unresolved alerts. This page required no production backend change or migration. The frontend now validates returned scope/date ranges and monitoring records, discloses stale reads and clears private data on access loss.

Passing evidence covers 73 distinct browser scenarios, ten frontend unit tests, five backend overview integration cases, real browser/API/PostgreSQL checks for STAFF, ADMIN and SUPER_ADMIN, thirteen widths, eight states, full lint and the final build. Two timed-out final checks passed unchanged on repeat; their cause remains unconfirmed. Heartbeat display does not certify provider delivery. REL-01 through REL-03 remain open, and the next frontend gate is workshop bookings `/admin/bookings`.

## Operational jobs pagination and monitoring contract - 12 October 2026

A follow-up source audit found that processing jobs returned a cursor without applying it, which forced the frontend to disable pagination. The API now uses signed, actor/filter-bound keyset paging across both physical queues with a deterministic timestamp/ID/source order. The frontend enables Next/Previous and resets paging on filter changes. Original boundaries remain usable after retry or deletion of the cursor row; concurrent changes still require refreshing page one.

The existing job, retry acknowledgement and monitoring responses now have explicit OpenAPI schemas and regenerated frontend types. Heartbeats and bounded unresolved alerts use explicit database projections. No migration, privilege expansion or change to retry/worker policy is introduced. See [contract and verification](backend/docs/operational-jobs-pagination.md). Coordinated deployment and target-environment acceptance remain pending.

## Audit event/filter completeness - 12 October 2026

The audit API omitted existing LOGIN_FAILED and BOOKING_SLOT filter values, and the frontend additionally rejected SERVICE_CATEGORY events. A valid event could therefore make an entire audit page fail parsing. Backend filters now derive from Prisma enums; frontend options and parsing include every value, with an OpenAPI contract-completeness regression. The existing private response projection is explicitly typed without widening permissions or exposing actor/request secrets.

Local evidence: 17 backend cases, six frontend unit cases, nine production-browser cases, static checks and an isolated production build. Deploy the API before the frontend and refresh existing administrator pages. No migration is added. See [audit contract and verification](backend/docs/audit-event-contract.md). Deployed acceptance remains pending.
