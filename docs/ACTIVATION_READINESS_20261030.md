### 30 October 2026: completed source package published

Source e8a40784 is integrated into master and published to both domains with matching
backend c886268a-6929-4053-95b0-7930f054bdb7. Exact-master CI, fresh backup/isolated
restore, protected forward migration (80 total), runtime privilege checks, seven
worker heartbeats and six hosted fixture journeys have passing evidence. Capability
flags remain unchanged. Full brief and actual owner category import remain open.
See backend/docs/efficient-delivery-production-20261030.md for receipts, failures,
corrections and acceptance limits.


### 30 October 2026: Allie candidate ranking before limits

Found a recall defect: public service/product/vehicle queries selected twelve matches
by ID before downstream relevance ranking. With many weak matches, the requested
record could never reach Allie. Added parameterised database candidate ranking using
title/name/brand/make/model term coverage before description coverage, with stable
ID tie-breaking and twelve IDs per catalogue. The bounded eight-term input uses
literal substring matching, not SQL patterns or user-supplied SQL.

The SQL prefilter mirrors current public visibility; canonical ORM visibility filters
and public projections are reapplied when loading candidates. Existing follow-up
IDs, exact amounts, full faults/restrictions, four-source/8000-character context
budget, permission checks and invalidation remain intact. Empty/no-keyword requests
no longer retrieve twelve arbitrary services. Pipeline revision is public-knowledge-v3
to invalidate old conversation context on rollout. No new migration or dependency.

The new native test creates 753 public catalogue records, placing the relevant
service/product/vehicle listing after 250 weaker IDs in each catalogue. All three
rank first; full retrieval finds them within the 36-new-source cap, preserves price
and fault disclosure, returns no arbitrary result for a stopword-only query, and
excludes all three after unpublication. This is a bounded local relevance proof,
not a production latency/load benchmark. Whole-catalogue revision hashing remains
linear and production-volume performance still needs evidence.

Fresh aat_allie_ranking_fa1c0e7425_test at 127.0.0.1:49293 passed 80-migration replay,
no drift and db:check. All 18 native integration tests pass across ranking, canonical
knowledge and conversation security (20.55s). All 76 focused unit tests, backend
types, scoped lint, formatting and diff whitespace checks pass. Initial scale
fixture failed publication constraints; corrected timestamps and one vehicle per
live listing, without relaxing database rules. That failed run is not a pass.
No paid OpenAI call, application database write or deployment occurred. Both test
clusters stopped and their disposable data removed; logs retained in TEMP under
aat-allie-ranking-03f09291385842a283ef5c33741950c1 and
aat-allie-ranking-58028acd4fa24e1b987061f6dea45d1b.

Remaining: complete policy/capability source audit, native rendered booking/Allie
journeys, remaining delivery/auth acceptance, provider test-mode setup and broader
completion gates. Full objective remains active; production stays at fc318618.


### 30 October 2026: native customer-to-workforce booking journey

Added concern-booking-journey.test.ts using real HTTP middleware, sessions, CSRF,
idempotency and a fresh isolated PostgreSQL database. The test submits and replays
one customer request with an account vehicle and notes, rejects another customer's
read/alternative response, classifies through workforce assignment, proposes a time,
accepts as the original customer, reassigns for the new time and explicitly confirms
through the authorised workforce endpoint with synthetic approved capacity.

Every stage retains the booking ID, concern, vehicle and customer notes. Acceptance
clears the old assignment and stays REQUESTED; only explicit staff confirmation
makes it CONFIRMED. Quote/deposit remain unknown/null, customer reschedule quota is
unchanged and no Paystack key, model call or real notification is required.

Fresh aat_concern_journey_1f00491d6c_test at 127.0.0.1:58965 passed all 80 migrations,
no drift and db:check. All 22 HTTP integrations pass across three files (24.75s),
including the 21 existing classification/confirmation regressions. Backend types and
scoped lint pass. Native cluster stopped; disposable data removed after process/path
checks, logs retained under TEMP/aat-concern-journey-802f1cf3998545f5881437b7174b8190.

This proves API composition, not browser interaction with a real backend or provider
acceptance. Next scope: native rendered booking composition, remaining proposal
delivery/auth coverage, Allie knowledge scale and policy/capability audit, then
project-wide completion gates and exact activation checklist. All implementation
changes remain local; production remains the verified sidebar release fc318618.


### 30 October 2026: workforce concern classification and final authorization

Concern-only jobs can now be classified during the existing JOBS_ASSIGN workflow.
Staff select a current published NGN service with duration and an eligible technician;
canonical fixed pricing or unknown quotation is retained, with original concern text
and REQUESTED status unchanged. The UI reviews service and technician before saving
and validates the receipt against the chosen service, original concern and status.
No booking confirmation, payment, new capability or consequential automatic action.
The restricted job-assignment learning article is version 2.

The assignment transaction now rechecks both lead and technician authorization after
audit/notification writes, before returning its receipt. This closes expiry during
awaited work; denied final access rolls back the transaction. Native HTTP regression
coverage proves one assignment under competing technician/time classification and
rollback when either participant's responsibility expires during audit processing.

Fresh loopback aat_classification_guards_c3f2250e0e_test at 127.0.0.1:55680 passed
80-migration replay, no drift and db:check. All 21 HTTP integrations pass: seven
classification cases plus fourteen workforce booking confirmation/proposal cases
(21.21 seconds). Backend types and scoped lint pass. The initial PowerShell 5 runner
stopped on ordinary Prisma stderr; it shut down safely and is not counted as passing.
The successful current-shell rerun used a separate fresh isolated target. PostgreSQL
Web Crypto experimental and pg concurrent-query deprecation warnings were emitted;
no application failure occurred. No real database or provider was used.

Earlier classification UI evidence remains two mocked 390/1440 browser cases and
one existing assignment regression; these are not native end-to-end acceptance.
Native customer-to-workforce composition, broader proposal delivery/auth acceptance,
Allie scale/policy coverage and external provider setup remain open. Latest production
remains sidebar commit fc318618; classification changes are local and uncommitted.

# Activation readiness — 30 October 2026

This is a preparation checklist, not permission to enable or publish anything.
The current implementation brief prohibits production deployment, merchant changes,
real charges and real customer communications for demonstration. No secrets belong
in this document. See EFFICIENT_DELIVERY_20261030.md for implementation evidence.

## Paystack

Set provider settings in the backend API and worker hosting environment, using the
existing secret manager. Never put the key in the frontend/Vercel public variables,
Git, chat, callback query strings or logs. Existing names from backend/.env.example:

| Setting | Preparation | Current acceptance |
| --- | --- | --- |
| PAYSTACK_SECRET_KEY | Server-only test secret for isolated test-mode acceptance; separate live secret only for an approved activation | Account/key access not verified in this goal |
| PAYSTACK_MODE | disabled until configured; test for acceptance; live only in production | No settings changed |
| PAYSTACK_LIVE_ENABLED | Remain false until separately approved live activation | No enablement |
| DEPLOYMENT_ENV | Production required by the existing live-mode guard | Source guard verified; hosted settings not rechecked here |
| PAYSTACK_CALLBACK_URL | Production frontend https://alliedautotech.com/payments/complete; isolated staging uses its own frontend origin | Route exists; provider redirect acceptance pending |
| PAYSTACK_REQUEST_TIMEOUT_MS | Existing default 8000 | Bounded transport tests pass |
| PAYSTACK_MAX_RESPONSE_BYTES | Existing default 262144 | Bounded response tests pass |
| PAYMENT_RECONCILIATION_ENABLED | Existing worker control; enable only with reviewed reconciliation scheduling and monitoring | Operational acceptance pending |

Register the public HTTPS webhook in the matching Paystack dashboard environment:
https://api.alliedautotech.com/api/v1/webhooks/paystack . This is the direct backend
route recorded in deployment documentation, not a frontend proxy. Its current
external reachability, dashboard registration and merchant configuration have not
been verified for payment acceptance. Preserve raw request bytes and the existing
x-paystack-signature HMAC SHA512 validation. API and worker configuration must agree.

Before test-mode acceptance, verify the merchant account can initialise hosted
checkout in NGN, the intended callback/webhook are configured, and staff have the
existing permission/MFA access for exceptions. Use an isolated test database and
provider test instruments. Verify canonical prices, ownership/CSRF, unknown returns,
duplicate callback/webhook, wrong amounts/currency/reference/mode, delayed outcomes,
expired holds, notification failure and bounded recovery. A browser success redirect
alone must never allocate funds or confirm a booking.

Live activation is NOT complete: merchant activation/settlement eligibility,
provider test-mode acceptance, webhook delivery, worker scheduling, monitoring,
backup/restore evidence and the complete implementation audit remain unverified.
Do not infer account eligibility or settlement configuration from a present key.
No real charge or refund is authorised by this checklist.

## OpenAI / Allie

Configure server-side OPENAI_API_KEY and ALLIE_OPENAI_MODEL independently of
Paystack. Confirm the OpenAI project has Responses access, the selected model is
available to that project, sufficient billing and an owner-approved spend limit.
Do not use a model name in documentation as proof of account access.

HELP_LEARN_AI_ENABLED stays false until reviewed activation. Existing app validation
also requires HELP_LEARN_ENABLED and ALLIE_AI_DAILY_TOKEN_LIMIT of at least 32000;
the default zero prevents allocation. ALLIE_AI_GLOBAL_CONCURRENCY defaults to 2.
Set these API/worker values consistently; do not change the public help, guide,
practice or live-support gates merely to enable AI. Frontend help visibility uses
NEXT_PUBLIC_HELP_LEARN_ENABLED and needs its own reviewed release configuration.

The existing adapter requests store:false. This does not promise zero provider
retention. Review actual account data controls and customer notice before exposure.
The earlier isolated evaluation allowance is exhausted (120 reservations including
three unused); do not reset it or make more paid calls under that approval. A new
bounded allowance is required for additional real-model evaluation. Independent
mocked/provider-contract testing remains available. Canonical catalogue retrieval
and the full access/invalidation audit are still implementation work, not key setup.
See help-learn/ALLIE_PROVIDER_SETUP.md for the existing secret-handling procedure.

## Booking and operations

The implemented mode is a booking request pending staff confirmation. Fixed-price
services use canonical prices; quotation prices remain unknown until approved.
Requests do not depend on a configured Paystack account. Preferred Lagos times do
not imply a free slot or staff allocation. Branches, opening hours, closures,
service duration/buffers and real staff/resource capacity must be reviewed by the
business before confirmed schedules can be accepted. Never invent those values.

Selected-service preferences, sign-in recovery and permitted preferred rescheduling
have focused evidence in the delivery ledger. Concern-only API/storage and nullable-safe readers now have isolated/local evidence.
The customer concern form, account-based vehicle/contact entry dialogs and staff
classification controls are implemented locally. Concern review/retry, embedded
account editing and account-switch/uncertain-save recovery have focused browser
fixture evidence. Direct selected-service-page editor acceptance, full auth/MFA and
policy/error coverage, workforce classification entry points and full notification/capacity acceptance
remain unfinished. The
alternative proposal backend/migration and staff/customer controls now have isolated
integration and local browser evidence, including disrupted acceptance. Workforce and full notification acceptance remain application work, not
credential requirements. The disk reserve was restored after owner cleanup; every
substantial stage still requires its own preflight. The new
forward migrations are not committed or applied to an application database; follow
backend/docs/booking-concern-migration-20261030.md before any future rollout.
No operational or financial feature flag has been enabled. Existing confirmation,
cancellation and notification rules remain authoritative.

## Overall status

Not ready for activation. The current task still requires application implementation,
full verification and approved operational configuration; it is not only waiting for
keys. Keep payment, AI and booking evidence distinct from production acceptance.

## Alternative appointment guard acceptance — 30 October 2026

A fresh loopback-only `aat_alternative_guards_20261030_test` database was created in
an auto-removing, memory-limited postgres:18 container using the existing image.
Target identity was verified before writes; the migration runner independently
required zero public tables. All 80 migrations replayed, Prisma found no drift,
and db:check passed. All 17 owner booking integration cases passed (29.41 seconds).
New cases verify missing MFA, revoked BOOKING_CONFIRM and changed staff branch
reject proposal writes; out-of-window proposals and expired acceptance fail without
changing the booking; an expired proposal can still be declined; an intervening
booking revision invalidates both answers even when the client supplies the newest
version. Backend type checking and scoped oxlint passed. Test container stopped and
auto-removed; C: reserve passed at 22.96 GiB. No application database, real notification,
provider call, feature flag or deployment was used.

These are isolated service/database checks, not full HTTP authentication, physical
phone or production acceptance. Workforce integration, notification delivery and
canonical Allie knowledge retrieval remain implementation work. No additional paid
model evaluation is authorised under the exhausted previous allowance.

## Allie public service knowledge — 30 October 2026

Implemented canonical public Service retrieval in the existing Allie conversation
pipeline. Search reads only active services, uses the existing serviceSelect public
projection, bounds question terms to eight and new matches to twelve, and re-reads
up to twenty-four prior source IDs for bounded follow-ups. No catalogue write, URL
fetch, private record, stock claim or appointment availability inference is added.
Fixed prices retain integer minor-unit precision; quotations remain unknown. Complete
conditions are preserved; passages exceeding 6000 characters are omitted rather than
cropped. The established four-source/8000-character model budget remains intact.

Internal sources include the canonical record ID, public permission, record version,
content SHA-256, record update time and retrieval time. A database-computed SHA-256
of current public service fields supplies the conversation revision. Changes even
without a version bump, and unpublication, invalidate history through existing read,
in-flight permission checks, pre/post-provider validation and final commit checks.
The versioned canonical records remain the source of truth; no duplicated index or
new migration was introduced. Browser citation validation now permits only a service
UUID whose destination exactly matches its source, never a model-supplied URL.

Verification: 71 backend unit tests, 20 frontend conversation tests, backend/frontend
type checks, scoped lint and formatting pass. A fresh native loopback
`aat_allie_services_native_20261030_test` replayed all 80 migrations and passed
no-drift/db:check. Sixteen integration tests passed, including the fifteen existing
actual-HTTP conversation security tests and new canonical service retrieval,
quotation/price precision, draft exclusion, follow-up, edit-during-answer rejection
and unpublication checks. Provider transport was mocked; no paid call occurred.
The initial Docker run stopped at the strict native-loopback identity guard before
fixtures; it is not counted as passing. The native rerun preserved that guard.
Task Docker container removed. Native cluster stopped and its 76,976,538 disposable
bytes removed after path/link/process checks; small log retained under temporary
`aat-allie-native-f5baa113bbca441087772d0d65991ac0`. Final C: reserve: 22.94 GiB.

Remaining: public product/vehicle/business sources and full capability/policy source
coverage, service-citation rendered browser acceptance, large-catalogue retrieval
quality/performance, workforce booking integration and external provider acceptance.
Current source package is not the complete knowledge pipeline or an activation.
No flags, production deployment, actual customer message or application DB changed.

### 30 October 2026: Allie product/vehicle sources verified locally

Canonical product/vehicle retrieval now joins services, with public visibility,
exact-price/fault preservation, bounded follow-ups and catalogue-change invalidation.
71 backend units, 22 frontend units and 15 existing native HTTP conversation cases
passed; two catalogue integration cases passed after correcting a synthetic report
checksum fixture. Both fresh native targets passed 80-migration replay/no-drift and
db:check. Types/lint pass. No paid model call or production change. Business sources,
full policy/capability coverage, rendered citations and scale acceptance remain open.
See docs/help-learn/ALLIE_PUBLIC_KNOWLEDGE_20261030.md (repository root). Task test
clusters removed, logs retained, C: 22.93 GiB free. Full delivery goal remains active.

### 30 October 2026: reviewed business facts and Allie citation UI

Business-contact v1 now supplies the published address, email and care hours with
explicit workshop-availability limitations. Backend/frontend Contact allowlists are
aligned. 76 backend and 35 frontend unit cases, types and scoped lint pass. Two local
mocked browser cases pass at 390/1440: all four citation types, exact link identity,
Contact navigation/modal close/visible breadcrumbs, scoped Axe and console checks;
screenshots inspected. Initial disabled-preview and missing-branch-fixture failures
were corrected and are recorded separately. No real model/customer/production write.
See docs/help-learn/ALLIE_PUBLIC_KNOWLEDGE_20261030.md for scope and remaining work.

Workforce alternative-time endpoint and review/recovery form now have native API and
mocked browser evidence, respectively. Their combined real-session acceptance and
workforce concern classification remain unfinished; see the delivery ledger.
