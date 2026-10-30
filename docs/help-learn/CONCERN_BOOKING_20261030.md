# Concern booking contract — 30 October 2026

Canonical workflow: ServiceOperationsService createBooking and assignBooking.
A concern intake carries branch, preferred time, policy version and a bounded
customerConcern instead of a slot/service ID. It creates REQUESTED with no price,
service, slot, assignment or deposit. Existing customer ownership, CSRF, idempotency
and 7–14 day policy checks apply. Staff classification uses the existing authorized
assignment action, selects an active NGN service and copies canonical pricing.
Confirmation still requires classification, duration, assigned staff and approved
capacity. Classification preserves the original concern.

Article service-request version 8 remains public and conditional on the real form
being available. It does not claim that the unfinished customer intake form has
shipped. No guide target, eligibility permission, practice operation or feature flag
was broadened. Existing source hashing includes the article version.

12 isolated booking integration tests and 47 focused backend units passed, including
concern ownership, duplicate submission, refusal of unclassified confirmation and
canonical classification; 2 local browser cases cover customer detail at 390/1440.
Customer form and staff classification controls are implemented locally with partial rendered acceptance. Entered vehicle/contact fields, alternative-time proposals and complete acceptance remain implementation work. No production migration/publication.

Staff classification checkpoint: existing assignment form now requires an eligible
published service with configured duration for an unclassified concern. Both fixed
and quotation-required services are supported. Explicit review sends serviceId,
assignedStaffId and expectedVersion through the existing assignment API. Until
classification, confirmation is not offered. Original concern persists; classification
never confirms or charges. Article v6 explains this distinction; public eligibility,
practice and flags are unchanged. Three rendered cases pass (390/1440 concern flow
plus existing permission/resource-review confirmation); 14 focused guidance units
pass. Local fixtures only, no production mutation or publication.

Account-entry checkpoint: shared booking details now embeds the existing vehicle
and contact editors with explicit saves and preserved booking inputs. Article v7
clarifies these saves update the account and do not submit the booking. Two local
390/1440 journeys including both editors and scoped Axe pass, plus three existing
Garage/profile regressions and 14 guidance units. Embedded-editor failure/account
switch and direct service-page coverage remain separate acceptance. No publication.

Alternative proposal backend checkpoint: article v8 conditionally explains explicit
accept/decline, unchanged existing appointment until response, staff confirmation
still required after acceptance, and no fee/customer-reschedule debit. API ownership,
versioning and isolated replay/integration evidence are in the delivery ledger.
Controls and full acceptance remain pending; no publication/eligibility change.

Alternative controls now use the existing reviewed staff/customer actions described
by article v8. Four phone/desktop journeys plus two scoped Axe runs pass; fourteen
isolated booking integrations include disrupted acceptance. No guide target or
eligibility expansion. Full timing/permission-loss acceptance remains open.

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

## Staff alternative guidance and route inventory — 30 October 2026

Booking-confirmation article v4 now explains Propose another time, the explicit
review/send step, customer acceptance or decline, reassignment and capacity review
before confirmation. It does not imply a fee, payment, capacity reservation or
automatic confirmation. Existing BOOKING_CONFIRM plus booking-read scope eligibility
is unchanged (canonical permission is BOOKINGS_READ); public and partially entitled
accounts cannot retrieve the article. Article versioning invalidates old context.

The coverage checker now compares actual frontend page files against the saved
inventory. Its first run correctly rejected missing app/services/request/page.tsx.
Regenerated inventory preserves earlier evidence and discovers 107 routes. The new
route maps to service-request with source-only acceptance, existing mocked/browser
and native HTTP evidence, and explicit real-backend rendered acceptance gap.

77 focused Allie/learning unit tests, backend and script type checks, scoped lint and
formatting pass. Structural coverage passes for 107 routes. --require-complete exits
nonzero because all 107 still have recorded Revision 4 acceptance gaps; this expected
rejection is not treated as successful completion. No provider call, feature gate,
database write or deployment. Full policy/capability and rendered coverage remain
unfinished; this is a concrete repair of the newly changed booking guidance.

## Native rendered concern booking — 30 October checkpoint

Fixed early-entry loss by disabling concern fields while initial identity is unresolved;
status and account-check retry remain explicit. Fresh native isolated
aat_concern_browser_68bba3e031_test (port 55162) passed 80 migrations,
no drift and db:check. Two real-browser/HTTP/database cases passed in 62.14 seconds
at 390/1440, proving concern/owned-vehicle preservation, review before write, one saved
REQUESTED booking, no fabricated service/deposit, dashboard navigation and reload.
No browser API mocks in those two cases. Evidence TEMP/aat-native-concern-browser-20261030.

Screenshot inspection found low-contrast concern copy on the dark booking card;
moved it below heading/status and used a readable light foreground. Two scoped Axe
and rendered checks passed at 390/1440. Native browser tests remain distinct from
fixture transport-recovery checks and production/provider verification.

Fixture review/uncertain-retry case passed at 390px; initial 1440px run failed because
webpack.js could not load (browser ERR_NO_BUFFER_SPACE). Retained failure diagnosis;
isolated rerun passed in 17.1s. This is environmental failure evidence, not a clean
first-pass matrix. Backend types and oxlint passed (an accidental ESLint invocation
failed because the backend uses oxlint; corrected command passed). Four task-created
native test clusters were confirmed stopped and their data removed (307,800,418
logical bytes); logs retained. End-of-cycle C: reserve passed at 23.12 GiB.

## Owner group clarification

Service-request article v9 explains the difference between a broad service group
and an individual priced service, including active empty groups. Four guidance
units pass. Public category discovery/detail acceptance passes 25 native HTTP cases;
see ../OWNER_SERVICE_STRUCTURE_20261030.md for actual scope and pending customer
context integration. This content remains source-only until release gates pass.

## Owner group authoring guidance

New restricted article owner-service-groups v1 maps to the actual admin review/apply
workflow. It explains reuse, inactive preservation, unassigned Tyre Change mapping,
stale review and uncertain-result recovery. Seventeen combined role/catalogue units
pass; public/customer/staff and unverified admin do not receive this article. No new
guide target, practice write or feature flag enabled. Full evidence and pending public
category context are in ../OWNER_SERVICE_STRUCTURE_20261030.md.

## Customer group discovery and enquiry — 30 October 2026

Services now renders published categories from the existing API, with responsive
group cards, maintained descriptions and an empty-group enquiry route. Contact
verifies the category ID before prefilling its canonical name and stable link.
Untrusted query names/redirects are ignored. This uses the existing GENERAL enquiry
message and draft flow; structured booking category persistence is still pending.
No invented service, price, availability or production category import.

Eight enquiry units and two rendered fixture journeys at 390/1440 passed; scoped
Axe, refresh preservation, navigation and overflow were checked, with screenshots
reviewed under TEMP/aat-service-groups-ui-fixed-20261030. The first fixture run used
the wrong message selector and failed; the corrected rerun passed (35.8s).
Service-request guidance is v10; seven catalogue/planner units, full backend types
and backend lint passed during release preparation. Generated API declarations
were regenerated without formatting, honoring frontend/.prettierignore.

The owner explicitly requested publication on 30 October. This supersedes the
earlier brief's deployment prohibition, but does not enable gated capabilities or
authorize real charges. Production publication still requires exact-master CI,
compatible backend rollout and the documented database backup/recovery gates.
Ordering/media authoring, structured booking group context and Allie group sources
remain unfinished. This is local evidence, not a production acceptance claim.
