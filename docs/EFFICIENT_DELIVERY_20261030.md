
### 30 October 2026: booking guidance and truthful coverage

Updated restricted booking-confirmation article to v4 with alternative-time review,
customer response and reassignment requirements. Added permission-sensitive retrieval
test; 77 units, backend/script types and scoped lint pass. Coverage checker now
detects actual pages missing from inventory; regenerated 107-route inventory and
added source-only /services/request mapping. Strict completion correctly remains
failed for 107 routes with acceptance gaps. See docs/help-learn/CONCERN_BOOKING_20261030.md
for exact evidence. Next: native rendered booking/Allie acceptance and remaining
policy/provider/completion gates. Production and feature flags unchanged.


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


### 30 October 2026: sidebar release fc318618

The owner explicitly requested deployment of finished work, superseding the earlier
brief's no-deployment instruction for verified finished batches. Signed commit
fc3186188bf876f2068434fb6a7dc346a72399fa is integrated into remote master and all
three required GitHub workflows passed for that exact commit (frontend 41123485001,
backend safety 41123512880, secret guard 41123484749). A clean Git archive export
excluded the ongoing dirty booking, payment and Allie work from the upload.

Published Vercel dpl_AP7nQwjBj956EddMVwRVmXLwhTbC; both apex and www identities
verified. Backend deployment 9c91eeff-b191-4de5-b9d5-0e6d06134d42 and all component
digests unchanged; readiness and current managed backup evidence checked against
the existing successful populated restore receipt. No migration or gate activation.

Six hosted and six public-site sidebar cases pass at 390x844, 1024x600 and 1440x900.
Checks cover inner scrolling, no scroll chaining, hidden scrollbar, action visibility,
non-overlapping form regions, catalogue-bound sticky behavior, mobile Escape/focus,
no horizontal overflow and no page errors. Desktop/mobile screenshots reviewed.
The initial fixture-oriented test passed 4/6 on real data: its two parts assertions
incorrectly expected indefinite pinning despite the single-item catalogue boundary.
A separate actual-catalogue harness verifies the correct containing-block boundary;
no product code changed to accommodate that harness. Failure evidence retained.
Twelve route/viewport/domain smoke cases pass, including BMW and Tyre Change copy
and prices. Evidence: .private/sidebar-fc318618-*.json and TEMP/aat-sidebar-fc318618-*.
The full efficient-delivery goal and uncommitted booking/payment/Allie work remain
in progress; this release does not establish their production acceptance.

# Delivery ledger — 30 October 2026

Started 2026-10-30T15:28:15Z. Goal: the full efficient-delivery brief, with the
expanded catalogue brief as design reference. Both supplied Markdown files read
completely. New scope authorises implementation of booking/payment readiness and
real AI but explicitly prohibits production deployment, merchant changes, live
charges and real customer communications for demonstration. Previous production
33fb5bd5 remains the baseline; work is isolated on codex/efficient-delivery-20261030
in the existing release worktree. No new worktree or dependency installation.

| Requirement | Current evidence | Changed location | Verification | Status |
| --- | --- | --- | --- | --- |
| Durable design, language, delivery rules | Existing quality directive retained | AGENTS.md; two referenced rule documents | Review pending | Implemented, verification pending |
| Paystack server checkout, verification, durable webhooks, reconciliation | Existing payments module and invariant document | Audit in progress | Focused and isolated integration checks pending | Not yet verified for this goal |
| Preferred-time booking without configured slots, including quotation/concern journeys | Existing service booking now accepts an offered slot or a preferred Lagos time; canonical quote price stays null | Service operations schemas/service; ServiceDetail; API contracts | 3 contract tests; 10 isolated booking integration cases; 6 focused browser cases passed | Selected-service preference implemented; concern-only path, sign-in draft recovery and preference rescheduling still missing |
| Staff confirmation, alternatives, cancellation and capacity | Existing workflows and capacity locking | Reuse; audit pending | Isolated concurrency tests required | Not yet verified |
| Genuine OpenAI Allie | Existing Responses adapter, retrieval, shared quota and conversation modules | Reuse; canonical catalogue knowledge audit pending | Provider evaluation allowance previously exhausted; no new calls authorised | Independent code audit pending; live evaluation blocked |
| Grounded role-aware Help/Learn | Existing versioned role-filtered definitions | Update with changed workflows | Eligibility/source invalidation checks required | Audit pending |
| Catalogue controls and cards | Published 33fb5bd5, prior 108 hosted checks | Preserve completed controls | New image requirements need fresh checks | Existing implementation; current goal gaps remain |
| Cover composition, tyre-changer ratio and exact About asset reuse | Published tyre changer 768x1024; BMW primary 1000x750; exact About precision-autocare component | ServicesCatalogue, ServiceDetail, service and Home styles | 24 distinct local browser cases across corrected runs; types/lint pass | Implemented and locally verified; not deployed, physical-device acceptance unverified |
| Activation and exact external prerequisites | Existing environment examples and provider docs | Consolidated handoff to be completed | Account/configuration facts must be verified without secrets | Incomplete |

The combined scope exceeds one hour. Package 1: durable guidance and functional
preferred-time booking with focused verification. Subsequent packages: payment
readiness audit and repairs, Allie canonical knowledge/activation, precise image
changes, then full requirement audit. Package completion does not complete the
overall goal. No production gates will be enabled by these packages.

## Package 1 checkpoint (30 October, 16:55 UTC)

The one-hour target was exceeded; this is partial progress, not completion of the
package or full brief. Existing sidebar follow-up was separately rechecked with
9 live cases. Booking work now supports fixed and quotation service preferences
without configured slots. Production modes/gates are unchanged; no deployment.

Backend/frontend type checks and scoped frontend/full backend lint passed. Three
booking contract tests reject mixed scheduling and forged price/status/ownership.
All 78 existing migrations replayed on newly created empty
`aat_preferred_booking_20261030_test` at loopback port 55439 with no schema drift;
10 integration cases passed including concurrent idempotency/canonical price and
quotation preferences. Task-owned memory-backed Postgres container was stopped
and automatically removed after success; other databases/containers untouched.
No migration was added. Browser-only fixtures passed 6 cases at 390/1440 including
existing slot submission and uncertain retry. These do not prove live acceptance.
63 existing learning/provider-contract tests passed with no real provider calls.
An initial OpenAPI export lacked required environment values, then passed using
nonconnecting test-only values. An initial frontend type check used the old
contract and found old variable references; regeneration and fixes passed. A test
command named nonexistent learning files; corrected actual test paths passed.

Service-request learning article v3 and API handbook reflect conditional booking
availability and pending confirmation. Final broad service regression, full
booking requirements (concern-only intake, sign-in drafts, preferred reschedule,
entered vehicles/contact and staff alternatives), payment audit, Allie canonical
knowledge, requested image composition and final activation audit remain open.
The previous real OpenAI evaluation allowance is exhausted; no additional paid
calls or quota reset were made. Continue independently on implementation work.

Four preference cases were rerun successfully after the image fixture was corrected. Desktop receipt screenshot reviewed; the mobile capture was taken during smooth scrolling and is not accepted as final visual evidence. Reduced-motion capture and the broader responsive acceptance remain pending. Local preview stopped.


## Package 2 checkpoint (30 October, 17:36 UTC)

Selected-service booking now preserves an explicitly handed-off anonymous draft
for 15 minutes through sign-in/MFA, then requires a fresh review before submission.
Noncustomer/account-switch paths clear it. Preferred rescheduling preserves the
existing one-change and cutoff policy and returns to staff review; no slot or
technician is invented. The anonymous service enquiry remains available separately.
Learning service-request article is now v4. Concern-only intake, structured entered
vehicle/contact handling, and the staff alternative-time journey remain open.

Final frontend scoped lint/type checks passed. Sign-in/account-boundary checks:
23 initial sign-in/login units and 38 client/MFA/draft units passed; the final draft
suite passed four cases. Seven focused preference/sign-in browser cases and three
reschedule cases passed. All 42 customer booking-detail browser cases passed in
the broader run. A fresh isolated memory-backed database
`aat_booking_reschedule_20261030_test` replayed 78 migrations without drift and
passed 11 booking integration cases, then its task-owned container was removed.
No application database was used. Preferred mobile/desktop receipts were reviewed.

The first broad run stopped after a Next development JSON error. A subsequent
healthy-preview run passed 15 service cases then exposed a genuine duplicate read
on Strict Mode effect replay. A new focused unit test reproduced the defect; the
shared useResource fix now passes all 15 public/background-resource cases,
including refresh, changed paths and access denial. The service browser rerun is
pending; neither interrupted run is a full pass. The preview remains running on
127.0.0.1:3021. No production deployment or flags changed.

Payment audit: Paystack verification now requires the documented test/live domain
and the requested reference; contradictory charge.success payload statuses are
rejected. 57 provider-identity/signature/dispute units pass; 36 adjacent bounded
HTTP transport cases passed. Backend type checking and scoped lint passed. One
new mocked live-mode test initially failed because it omitted the existing live
activation gate; the test-only setup was corrected without altering that guard.
Official verification/webhook references were checked on 30 October:
https://paystack.com/docs/payments/verify-payments/ and
https://paystack.com/docs/payments/webhooks/.

Remaining payment audit includes persisted webhook environment checks, explicit
reversed-state handling and isolated full lifecycle acceptance. These repairs do
not establish complete payment readiness or real Paystack test-mode acceptance.
Allie canonical catalogue knowledge, image composition and complete activation
handoff remain required. The exhausted OpenAI evaluation allowance is unchanged.


### 17:50 UTC verification update

Paystack charge events now require a recognised domain and successful transaction
status. Durable event storage and retry preserve the domain; disabled providers
pause recovery, different-mode retries retain a dead-letter event without business
writes, and legacy events without a domain use authoritative verification. Final
backend types/lint/format checks and 60 relevant provider/security units pass.

Two new empty memory-backed test databases each replayed all 78 migrations without
drift. The initial parallel payment run passed 28 and failed four refund cases;
the worker suites share the queue and a different-mode retry case can consume other
files' events. Running the three suites sequentially on the fresh isolated
`aat_payment_environment_sequential_20261030_test` passed all 32, including legacy
lookup, stored-mode mismatch, claim ownership and refund controls. Use
`vitest run --no-file-parallelism` for these shared-queue integration suites. Both
task containers were stopped and automatically removed. No application data,
production settings or merchant state changed. Reversed-state handling and broader
payment lifecycle acceptance remain unfinished.

The repaired service browser run passed 38 cases, including all ten responsive
layout/accessibility widths, then stopped on an outdated quotation helper expecting
a branch dropdown when the sole branch is correctly shown as a fixed choice.
The helper now verifies the labelled branch and still asserts its submitted ID;
the 320px quotation case passes. The remaining 28-case enquiry/recovery/MFA matrix
is running, not yet accepted. Resource-hook type/lint and 15 unit checks pass.

ACTIVATION_READINESS_20261030.md now records exact configuration names, callback and
webhook URLs, remaining operational/account checks and unfinished implementation.
It explicitly does not claim that only credentials remain. About's exact approved
asset is CampaignArtwork artwork="precision-autocare" (/brand/r2 derivatives);
service detail still uses technician-original.webp and must be updated after the
frozen booking verification. No image implementation is claimed yet.


### Final booking acceptance checkpoint (30 October, 17:59 UTC)

All 66 distinct service-detail cases now pass across corrected runs: 38 main cases,
26 remaining cases, then the two repaired FAQ/metadata checks. The final four-case
run additionally rechecked 320px accessibility/no duplicate reads and account-change
clearing. The quotation helper now matches the sole-branch fixed display, retaining
the exact submitted branch assertion. FAQ acceptance now expects pending staff review
for quotation bookings. The metadata case required local-only SITE_INDEXING=enabled
and SITE_ORIGIN=https://alliedautotech.test; production indexing was not changed.
The interrupted and failed runs remain evidence, not passing runs.

Final diff review found a related disabled-to-enabled resource lifecycle gap. A new
unit test reproduced stale seed reuse; the repair retires that seed on disable or
session invalidation. All 16 resource lifecycle units pass. Latest four rendered
regressions passed after this correction. The 390px quotation form and preferred
receipt were visually reviewed. Phone/desktop emulation is not physical-device or
screen-reader acceptance. Previous 42 customer-booking-detail cases remain separate
recorded evidence. No live booking/enquiry was created.

The local preview currently uses existing dependencies at 127.0.0.1:3021 with API
fixture origin 127.0.0.1:5021 and full local launch mode. Its processes are task-owned;
no production or other-task server was stopped. Full-goal work remains active:
concern-only intake and entered details, staff alternatives, reversed payments and
full lifecycle audit, canonical Allie knowledge/access tests, requested cover-image
composition/About asset reuse and final activation acceptance.

## Image composition checkpoint — 30 October 2026

The requested image package is implemented. Public Services cards follow recorded
image dimensions, limiting photograph height to 420px through proportional card
width. Service detail follows the same source ratio with a 520px limit. Both use
cover with a centered focal point; matching frame/source ratios preserve the
entire subject without letterboxing or distortion. Public API reads confirmed the
actual tyre-changer photo is 768x1024. The authentic local equipment photo was
visually inspected and used only in browser fixtures; published media is unchanged.
Home vehicle photos now use cover in the existing moderate 4:3 frame; the actual
published primary photo was rechecked at 1000x750. Missing-image fallbacks remain.

Service detail now reuses About's exact CampaignArtwork precision-autocare asset,
including its responsive derivatives, approved alt text and uncropped 4:5 layout.
It is bounded to 380px width. The old technician-original asset remains on disk;
only the unintended placement was replaced. No image was generated or retouched.

Verification: seven new/adjacent composition cases passed (390/1440 plus supporting
sections at 320/390/768/1536); 13 service layout, keyboard/Axe, missing/failed-photo,
long-content and section-navigation cases passed (layout widths 320–1536); four
Home and service edge cases passed in the final corrected run. Total: 24 distinct
passing cases across runs, not one uninterrupted green suite. Initial Home cases
failed stale expectations for zero-naira formatting and duplicate hydration reads;
updated checks preserve exact price and single server-read assertions and now require
no duplicate browser reads. A service edge case measured during search replacement;
it now waits for the committed URL and settled aria-busy state. Portrait/landscape/
low-resolution and long-name coverage remains, with no assertion removed to hide
an application error. Screenshots of actual equipment and approved campaign artwork
were inspected at phone/desktop sizes. Browser-only synthetic catalogue records are
not real inventory acceptance. Browser plugin unavailable; existing Edge/Playwright
used at http://127.0.0.1:3021. No physical phone/Safari acceptance is claimed.

Frontend tsc, scoped ESLint, formatting and git diff --check passed. C: reserve
passed at 23.75 GiB. Existing warm preview/dependencies reused, no installation,
Docker build, cache deletion, production change or real customer submission.

Full goal remains active: concern-only booking/entered vehicle and contact details,
staff alternative workflow, reversed payment handling/full payment audit, canonical
Allie knowledge and access/invalidation tests, complete activation acceptance.
Exact external prerequisites remain in ACTIVATION_READINESS_20261030.md; this work
is not ready for activation and is not merely awaiting keys.

## Reversal ingestion checkpoint — 30 October 2026

Paystack's current verification documentation explicitly defines reversed as a
refund or chargeback outcome: https://paystack.com/docs/payments/verify-payments/ .
The adapter previously rejected this recognised status. It now preserves reversed
in the provider port. An unallocated reversed attempt retains gatewayStatus and
one deduplicated provider observation, enters the existing verification hold and
puts the payment in REQUIRES_REVIEW. A subsequent stale success cannot allocate
held funds. No refund, capture ledger entry, order payment or booking confirmation
is inferred from reversal alone. Existing successful capture facts remain immutable;
post-capture conflicting observations retain the existing anomaly path.

44 provider-unit cases and all 10 webhook financial integration cases passed. The
new integration case verifies duplicate reversal observations, review status,
unchanged unpaid order, zero ledger/refund writes and blocked later success.
A new memory-backed aat_reversal_20261030_test database on loopback port 55439 was
verified empty before all 78 migrations replayed with no drift. Only this task's
container was stopped/auto-removed. Existing Docker images, databases and caches
were retained. Backend typecheck, full lint and scoped formatting/diff checks pass.
An initial test command ran from the repository root, selected a temporary npx
runner and failed environment setup before tests; it is not passing evidence.
The corrected backend command used the installed Vitest 5.0.0 with --no-install.
No dependency manifest, schema, production setting or live payment was changed.

This closes recognition and unallocated-funds safety, not the entire reversal
requirement. Explicit customer reversal messaging, post-settlement reversal/refund/
chargeback reconciliation and full lifecycle acceptance still require work. Do not
claim payment readiness or only-key setup. The full booking, canonical Allie and
activation scope remains active.


## Filter sidebar scroll repair — 30 October 2026

Owner-reported sidebar scrolling audited on live Parts and Vehicles, then repaired
in the existing efficient-delivery worktree. Live short catalogues constrained the
sticky rail; the desktop form also exceeded its frame by 2px. Desktop rails now
have a moderate 640px maximum, shrink for short viewports, and size the form to
the frame. Only filter fields scroll; the frame clips overflow and the inner
scrollbar is hidden using standard and WebKit rules. Apply/clear controls remain
visible. Sticky positioning remains bounded by the catalogue so it cannot cover
the footer. Mobile modal/focus/selection semantics and card images are unchanged.

Six final local Edge/Playwright cases passed at 1440x900, 1024x600 and 390x844 for
both catalogues: wheel scrolling over results leaves the pinned panel/field offset
stable, inner scrolling and end-of-list overscroll leave the page stable, action
buttons remain visible, mobile Escape restores focus, no horizontal overflow or
page errors. Screenshots inspected. First run passed 5/6: collapsed mobile Parts
fit naturally, so the test was corrected to expand More product details before
requiring scroll movement; the full corrected six-case run passed. Browser plugin
unavailable; existing Playwright fallback used at http://127.0.0.1:3021 with the
read-only discovery fixture. This is synthetic local acceptance, not physical
phone/Safari or deployed acceptance. Source typing, scoped lint/format and diff
checks passed. Evidence: %TEMP%/aat-sidebar-20261030-final/.

No dependency install, Docker resource, database write or production publication.
Disk reserve passed before checks (23.51 GiB) and after (23.50 GiB). Existing broader
booking/payment/Allie work remains pending; this checkpoint does not close it.


## Customer reversal and worker checkpoint — 30 October 2026

Customer details/history now show Reversal reported ahead of the old success label,
retain Originally confirmed amount, remove the secondary Payment confirmed heading,
and explain that refund/chargeback review is needed before paying again. Checkout
is blocked for the indicator; server verification holds remain authoritative.
Customer projection exposes only reversalReported, never anomaly details or IDs.

Reconciliation now treats reversed provider amounts as unknown (null/excluded), not
zero funds returned. The worker shares verification's deduplicated observation and
review hold under the run lease and a freshly locked attempt; confirmed captures,
orders, ledgers and refunds remain unchanged. Worker observations reach the same
customer indicator. Wrong references cannot attach a reversal to this payment.

Verification: 41 integration cases passed across payment-reconciliation and webhook-
financial-ownership. Coverage includes actual successful webhook capture followed
by worker reversal, repeated worker/verification dedupe, uncaptured hold/stale-success
blocking, immutable financial history, privacy and wrong-reference rejection.
Fresh aat_reversal_worker_20261030_test on loopback 55439 was verified empty; all 78
migrations replayed with no drift. Task container auto-removed. Existing database,
Docker images/volumes/caches and other work were preserved.

27 backend units passed (payment availability/security and learning/Allie roles).
Three final browser fixture cases passed: customer history and details at 390/1440,
with reversal copy, no new checkout, no Payment confirmed heading and only the
expected provider-check request. Screenshots inspected under
%TEMP%/aat-reversal-final-20261030/. Browser plugin absent; reused local Edge/
Playwright at 127.0.0.1:3021. No real payment, message or provider request. Backend
lint/types and API export/types passed; frontend scoped lint/types/format and all 20 checkout guard units passed. The
existing Vite configuration emitted a future-loader compatibility warning; no
warning suppression or dependency change was made. Final disk reserve: 23.45 GiB. Article no-live-lookup version 3 and its checkpoint
in help-learn/PAYMENT_REVERSAL_20261030.md preserve existing access and flags.

This supersedes the earlier note that customer reversal messaging and worker
observation handling were unimplemented. Full payment lifecycle/operational
acceptance remains open, alongside concern-only booking, entered vehicle/contact,
staff alternatives, canonical Allie knowledge and the complete activation audit.
No deployment, merchant configuration, live charge or AI enablement occurred.


## Concern booking contract checkpoint — 30 October 2026

The existing Booking model now supports null serviceId with a separate bounded
customerConcern. New forward migration 20261030190000_booking_concern_intake adds
that nullable column, relaxes serviceId nullability and checks that an unclassified
record has a meaningful concern. Existing data/foreign keys remain intact. The
exact SQL bytes are reviewed in the protected migrator; changed/renamed SQL is
rejected. Preservation/compatible reader rollout plan:
backend/docs/booking-concern-migration-20261030.md. This migration is uncommitted
and has NOT been applied to any application/shared/production database.

CreateBooking accepts a concern plus branch/preferred time, retains null price and
service and creates REQUESTED under existing ownership, policy and idempotency.
Existing authorized assignment can classify it using an active canonical service;
confirmation refuses unclassified concerns and still requires staff/capacity.
Customer/staff/workforce booking parsers and read screens tolerate null service and
show Vehicle concern plus its description on detail. Service-review eligibility
excludes records without a service. Versioned learning checkpoint is
help-learn/CONCERN_BOOKING_20261030.md (service-request v5, conditional wording).

Verification: fresh aat_concern_intake_20261030_test verified empty at loopback
55439; all 79 migrations replayed with no drift, npm run db:check passed. All 12
owner-booking-policy integration tests passed, including concern retry dedupe,
ownership, null price/no deposit, refusal of confirmation/assignment before
classification, canonical assignment then capacity-confirmation, and preservation
of an existing booking. Only the task container was stopped/auto-removed.
47 backend units passed (contracts, migration guard, learning/Allie roles); backend
types and lint passed. Frontend types, scoped lint and 13 workforce units passed.
Two local browser fixture cases passed for unclassified customer details at
390/1440 without runtime errors or overflow. Browser plugin absent; reused local
Edge/Playwright. Initial generation/export lacked DB configuration and safely
failed; explicit local non-connecting placeholder settings corrected generation.
An intermediate frontend type check exposed nullable workforce assumptions; these
were fixed and final typing passed. No dependency change or live provider calls.

This is a verified contract/read-path package, NOT the finished customer booking
journey. Next: customer concern entry/review/sign-in recovery, entered vehicle and
contact details, staff classification controls and proposed alternatives, then full
journey acceptance. Canonical Allie knowledge and provider/operational activation
acceptance remain open. No production deployment or feature activation.

## Concern customer form — review and retry checkpoint

The new /services/request form is implemented locally behind the existing full-launch gate. It collects concern, workshop, preferred Lagos time, optional saved vehicle and notes; account contact details remain the contact source. Review precedes submission. Fixed service/price/deposit are not invented. A session readiness race was fixed by blocking review until the account check resolves. Submission rechecks customer identity/MFA, and uncertain results freeze edits and reuse the same request body/idempotency key. Service and concern sign-in drafts are separately consumed, expire after 15 minutes, and exclude account records/payment facts/redirects.

Eight draft units pass, including both draft kinds, expiry/account invalidation and prohibited fields. Two local Edge/Playwright cases pass at 390/1440: no mutation before review, simulated connection failure, frozen edit, same-key retry, saved request wording, no page errors/overflow. Phone receipt screenshot inspected. First browser run failed on an exact label locator and was stopped; corrected accessible-role/button locators passed both cases. Browser-only responses, no real booking/API/provider write. TypeScript and scoped ESLint pass; formatting repaired after final selector changes. Evidence: temporary aat-concern-form-final. Disk before 23.28 GiB, after 23.25 GiB.

This does not complete concern acceptance: rendered sign-in/MFA/account-change and policy/error/accessibility coverage, entered contact/vehicle fields beyond account/notes, staff classification/alternatives UI, and notifications/capacity acceptance remain. Existing larger payment/Allie/activation gaps remain as listed in ACTIVATION_READINESS_20261030.md. No deployment, migration application, live feature enablement or paid model call.

## Staff concern classification checkpoint

Connected the existing staff assignment form to backend concern classification.
Reused SlotCatalogPicker with an explicit concern mode that includes quotation
services with configured durations; default fixed-slot semantics remain intact.
A version-bound selection and current resource availability are required before
review. Confirmation is hidden for unclassified records. The review explains that
assignment does not confirm or charge; request includes canonical service ID,
staff ID and expectedVersion, never a client price. The original concern remains
visible after classification. Existing server permission/capacity guards unchanged.

Three local Edge browser cases pass: 390/1440 classification from an unassigned
concern through explicit review, and existing confirmation permission/resource
review. Fixture writes only. Selected quotation-required service remains REQUESTED;
no premature status write. Phone receipt inspected. Fourteen backend guidance units
pass after updating the expected service-request version from 5 to 6 and asserting
classification is not confirmation/quotation approval/payment. Frontend type and
scoped lint checks pass. Initial lint apostrophe and stale article-version assertion
were corrected; no failed run counted as acceptance. Evidence: temporary
 aat-concern-classification. No dependencies installed or production action.

Remaining: entered vehicle/contact details, alternative-time proposals, workforce
entry-point integration, stale/permission-loss/pagination classification coverage,
customer sign-in/MFA/policy/error/accessibility acceptance and full notifications/
capacity audit. Payment/Allie/activation gaps remain; this does not complete the goal.

## Vehicle and contact entry inside booking

Reused the existing GarageVehicleEditor and ProfileForm in booking account-detail
dialogs, rendered outside the booking form with submit propagation stopped. The
booking draft stays mounted. Explicit vehicle save selects the returned canonical
vehicle; explicit profile save updates the account using its existing expectedVersion
and stale/uncertain recovery. Opening either editor rechecks customer identity;
account-change reset closes editors and removes loaded private details. Uncertain
vehicle saves block another creation until vehicles are reread. No parallel account
schema/API or implicit booking submit. Both service and concern forms share this
component; direct service-form acceptance of the new controls remains open.

Two final local 390/1440 browser journeys pass: edit phone with exact versioned
PATCH, create vehicle once, preserve concern, select returned vehicle ID, review,
uncertain booking submission and same-key retry. Scoped Axe scans pass for both
dialogs at both widths; phone screenshots inspected. Initial screenshot review
found public pages lacked dashboard input borders; booking-scoped control/focus
styles now fix that without altering existing dashboard styling. Three existing
Garage/profile browser regressions pass (normal create/edit, account-change late
feedback, stale-profile review/rebase). Fourteen guidance units pass with article
service-request v7 explaining account save versus booking submit. Evidence folders:
%TEMP%/aat-booking-account-final and aat-booking-account-regression.

These are browser-only fixture mutations; no real account, vehicle or booking was
written. No deployment/flag/provider changes. Remaining full scope includes proposed
alternative appointments, workforce classification integration, booking auth/MFA/
error/permission acceptance, notifications/capacity audit and payment/Allie readiness.
Embedded-editor uncertainty and account-change rendered coverage still needs its own
acceptance beyond the shared dashboard regression checks.

## Embedded booking editor recovery acceptance

Three new local 390px browser cases pass: uncertain vehicle POST disables duplicate
save and new creation until an explicit saved-vehicle refresh; switching accounts
with either contact or vehicle editor open closes the dialog, clears the prior
customer's displayed profile and booking inputs, and releases body scrolling. No
booking writes occur in these cases. Browser-only fixtures; no real account changes.
Evidence: %TEMP%/aat-booking-editor-recovery. This closes the embedded-editor checks
explicitly left pending by the prior checkpoint, not full authentication acceptance.

Readiness ledger reconciled with completed code. Inspected current booking schema,
reschedule/disruption service and workforce detail: staff alternative proposal is
still absent; rescheduling alone is not counted as satisfying that requirement.
Other scope remains active, including direct selected-service editor acceptance,
full concern auth/MFA/policy/error cases, workforce entry points, notification and
capacity audit, canonical Allie retrieval and provider activation acceptance.

## Alternative appointment proposal backend checkpoint

Added nullable alternativeStartsAt/reason/version fields with an additive all-or-none
constraint in 20261030200000_booking_alternative_proposal. New POST staff alternative
and customer alternative-response endpoints reuse authentication/CSRF, booking locks,
branch ownership, BOOKING_CONFIRM/MFA, exact-version writes, audit and notification
outbox. A proposal never changes current scheduledAt/status or reserves capacity.
Accept/decline requires the owned, current proposal version; concurrent replies have
one winner. Acceptance returns REQUESTED, releases prior slot/assignment, cancels old
reminders, increments scheduleVersion, preserves money and customer reschedule count.
Decline preserves current appointment/status. Any intervening booking version change
makes the proposal stale. Timing is checked against existing booking-window policy.

Verified fresh loopback aat_alternative_20261030_test with zero public tables before
writes. Existing postgres:18 image reused, tmpfs container, no image pull/build or
shared database access. All 80 migrations replayed, no Prisma drift, db:check passed.
All 13 owner booking integration cases passed, including new confirmed-appointment
proposal preservation, wrong owner rejection, stale duplicate proposal, concurrent
acceptance, no fee/quota debit, reminder cancellation and later decline. Container
aat-alternative-20261030 was stopped/auto-removed. Generated client and API/frontend
contracts refreshed. Migration is uncommitted and not applied to any application DB;
rollout safeguards in backend/docs/booking-alternative-migration-20261030.md.

The staff/customer proposal controls are still to implement. Also pending: explicit
revocation/branch/MFA/expired/stale-by-other-action acceptance, business-disruption
interaction, staff inbox notifications, workforce integration and full rendered
proposal journeys. Article service-request v8 conditionally explains proposals;
no feature flag, production deployment, paid model call or real notification.

## Alternative appointment controls and disruption recovery

Staff detail now offers a reviewed proposed Lagos time/reason to authorised
BOOKING_CONFIRM users. Customer detail shows the version-bound proposal and
reviewed accept/decline actions through the existing ownership-refreshing mutation
flow. Outdated versions have no response actions. Acceptance wording explicitly
retains staff confirmation requirements and no fee/quota debit. Staff confirmation
and existing appointment remain separate. Acceptance of a PENDING business disruption
now records TRANSFERRED, preserving reason/history and returning REQUESTED.

Four local fixture browser journeys pass: staff proposal and customer ACCEPT/DECLINE
at 390/1440. Two further ACCEPT runs pass with scoped Axe on appointment controls;
phone screenshot inspected and redundant Lagos suffix removed as a text-only fix.
Existing quotation pre-review now uses the component clock to satisfy purity lint;
submit-time fresh quotation/time checks remain. Frontend type/scoped lint pass.
Fresh isolated aat_alternative_recovery_20261030_test verified empty, all 80 migrations
replayed, db:check/no drift passed, all 14 booking integrations passed (including
both ordinary and disrupted acceptance). Task container auto-removed. Backend type
and scoped oxlint pass. Evidence: temporary aat-alternative-ui/aat-alternative-visual.
No real customer response, message, financial operation or production deployment.

Disk limit became a new blocker after checks: 23.00 GiB before isolated run, 15.41
GiB afterwards. System paging file reports ~15.18 GiB allocated; no before measurement
proves causality. Test container removed, worktree .next/dev ~0.5 GiB; known task
outputs are insufficient to regain reserve. No Docker/WSL/system file deletion.
Further substantial writes/builds/tests stopped; owner asked to free >=6 GiB.
Small source/report updates only. Full goal still open: time-window/expired and
permission-loss proposal cases, direct selected-service editor acceptance, workforce
entry points, notification/capacity audit, Allie retrieval and activation acceptance.

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

### 30 October 2026: workforce proposal visibility

The existing branch-scoped workforce booking detail now returns and renders the
alternative time, reason and proposal version. The current scheduled appointment
remains separate. Current proposals say awaiting customer response; intervening
booking changes show a stale-proposal warning; resolved proposals disappear after
refresh. No mutation route, permission, guide target or eligibility changed.
OpenAPI and frontend generated types were regenerated. 11 frontend contract units,
backend/frontend type checks and scoped lint pass. Two local mocked Playwright
cases pass at 390/1440, covering refresh/current/stale/cleared states, unchanged
appointment, no writes, scoped Axe, overflow and console health. Both screenshots
were inspected. Initial browser runs caught a duplicate inserted panel; it was
removed and the unchanged assertions passed. Initial schema export needed dummy
offline environment values; no database connection or write was used.
Evidence: %TEMP%/aat-workforce-proposal-final. Production/real-role/native API
acceptance and workforce classification/proposal mutation controls remain open.
This is one verified increment; the full delivery goal remains active.

### 30 October 2026: scoped workforce proposal action

Added POST /staff/workforce/bookings/:id/alternative using the existing strict
proposal schema and shared proposal transaction logic. Managed scope, explicit
BOOKING_CONFIRM grant, MFA, branch scope and actor/workforce locks remain mandatory;
current access is rechecked after mutation before commit. CSRF and sensitive-write
rate limiting use existing workforce middleware. The narrow receipt excludes
customer/staff notes and binds the actor, booking, version and proposed time.
Legacy proposal behavior is delegated to the same helper; no new fee, capacity
reservation or confirmation. No production change or new migration.

Fresh native isolated aat_workforce_proposal_b5bf8f0c6d_test on 127.0.0.1:55110
passed 80-migration replay/no drift and db:check. All 14 workforce confirmation
HTTP integrations passed, including three new proposal cases: valid unchanged
appointment/stale retry, denied scope/grant/cross-branch and concurrent proposals.
Existing confirmation cases cover MFA/CSRF/revocation; proposal-specific expiry,
MFA/CSRF and notification rollback checks remain to be extended explicitly.
Backend types, scoped lint and OpenAPI validation (404 paths) pass. API artifacts
regenerated. Cluster stopped and its verified data folder removed (76,983,553
logical bytes), logs retained under %TEMP%/aat-workforce-proposal-1dd10883da6b4afc8e43531e4fa31baa.

Next: workforce proposal review/recovery form and concern classification through
existing permissions, followed by native and rendered acceptance. No new guide
eligibility/semantic target or published help change yet. Full delivery goal active.

### 30 October 2026: workforce proposal review and recovery

The workforce booking detail now provides a permission-gated proposed-time form,
review dialog, fresh access/record check and actor/version-bound receipt validation.
The existing recovery helper now separates confirmation/proposal keys while retaining
its confirmation default and redacting both on identity cleanup. Only reference IDs,
versions and random marker tokens are stored; customer reason/time are not persisted
in session storage. Unknown outcomes survive reload without automatic resend and
require current-record inspection and acknowledgement before another action.

15 focused contract/recovery units pass. Five local mocked browser cases pass:
390/1440 review -> explicit send -> proposal display with unchanged appointment;
lost-response reload/inspection with one write; access removal before send with zero
writes; existing 390px confirmation regression. Review-dialog scoped Axe and overflow
checks pass; success-path console checks pass; lost-response network failure is
intentional. Both review screenshots inspected under %TEMP%/aat-workforce-proposal-form.
Guard evidence: %TEMP%/aat-workforce-proposal-guards. No real booking/customer message
or production change. Backend native evidence remains the preceding 14-case run.

Article service-request v8 already covers this proposal/acceptance behavior; no new
semantic guide target or eligibility is introduced. Native end-to-end composition,
proposal-specific auth/expiry/rollback checks, workforce concern classification and
remaining full brief acceptance remain open. Full delivery goal remains active.

### 30 October 2026: concern-only workforce job read path

Found that workforce job contracts required a non-null service and renderers read
service.name directly, despite concern requests having no service. The job projection
now includes customerConcern; both response contracts accept nullable service. Queue,
detail and review labels use Vehicle concern. Original concern and additional notes
remain separately visible. Scoped job search also matches the concern text. Existing
branch/assigned-person restrictions remain intact; classification is not yet added.

15 focused job contract/detail units pass, including nullable concern and wrong-assignee
rejection. Backend/frontend types, scoped lint and 404-path OpenAPI validation pass;
API artifacts regenerated. Two local synthetic 390/1440 queue -> detail -> refresh
browser cases pass, with scoped Axe, no overflow, and console/runtime error checks.
Initial test locator ambiguity was corrected. Screenshot inspection found a missing
synthetic assignee-options response; final fixture now explicitly returns an empty
eligible list. Final evidence: %TEMP%/aat-concern-workforce-accepted; desktop screenshot
inspected. No actual technician assignment, real data write or production change.
Native concern read/search acceptance and workforce classification remain open.

Next implementation point: existing WorkforceWorkService.assign with JOBS_ASSIGN and
existing workforce job assignment UI, preserving technician eligibility, original
concern, request status and canonical service pricing. Do not route managed staff
through legacy admin assignment or grant extra capabilities. Full goal remains active.
