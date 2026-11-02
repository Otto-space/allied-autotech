# Complete live audit implementation - 2 November 2026

The complete owner audit was read and reconciled with deployed runtime 9be4e66b.
The current requirement ledger is frontend/docs/UI_UX_QUALITY_REGISTER.md; this
report records a bounded implementation package, not a second backlog or a claim
that the whole site is ready. Package start: 17:31 UTC; 60-minute review: 18:31 UTC.

## Held Help contract regression and recovery - 2 November 2026

The 0c200511 source passed all exact-source CI (frontend 41523677037: 1,352 tests,
12 existing skips; backend 41523676993; secrets 41523677601), native 46/46 and
packaged 10/10. Its backend 191ab6b1-a48d-4374-84e4-e1f88e030d79 became ACTIVE
16/16 at 21:07 UTC. The new v16 service guide had 13 steps, exceeding the existing
frontend catalogue limit of 12. Final held main checks caught this: 46/49 pass;
three service/contact/search cases fail when Help results cannot parse. Frontend
candidate dpl_GmcX4zSa4XBrjf13kPgmtkEmEEmR was never assigned apex/www. The new
backend guide also affected public Help catalogue loading on the old frontend.

Restored only the four known compatible 022a8a06 backend digests; recovery deployment
157e0b25-852e-479e-af13-a8ebbada3330 is ACTIVE 16/16 at 21:18 UTC. Readiness is
200, public service-request v15 and the 12-step contract are restored. Three real
anonymous service/contact/Help-search flows pass at 320/390/1440. Fresh read-only
strict-TLS schema/least-privilege/eight-worker checks pass at 21:19:58 UTC; temporary
firewall access was removed. Source/schema comparison, exact prior CI and the fresh
21:04 backup/hash were verified before restoring images. No business records, prices,
grants, flags or schema were changed. Existing service/enquiry pages stayed available.
The prior image/guide/held-failure evidence is retained. Earlier pending source text
below is historical; the complete audit goal is still active.

The forward fix versions service-request to v17, preserving all conditions while
combining availability instructions into the existing booking step. Every reviewed
article must fit the established 12-step bound; backend response schemas and actual
anonymous HTTP assertions now enforce it. The real server public projection passes
the real frontend schema in a metadata-only check with zero database/provider calls.
Public search retains valid public FAQs when optional Help & Learn fails, gives a
partial-results retry message and continues rejecting non-public learning payloads.
New phone/desktop rendered checks exercise the complete guide and optional-source
failure/recovery with learning enabled. Exact-source release checks remain required.

## Runtime capability package - source checkpoint, 2 November 2026

Package start 20:00 UTC; review target 21:00 UTC. Published runtime remains 022a8a06
until the next verified compatible release. The full audit goal remains active.

The existing anonymous /public/capabilities endpoint now combines the actual backend
release mode with existing finance approval. It exposes account, enquiry, booking and
inspection availability; collection-only checkout requires both full mode and the
existing finance gate. Public search now ranks published manufacturer part numbers
as well as names/SKUs and displays a recorded part-number cue. No policy, provider, permission or activation flag is changed.
The same backend middleware continues to reject direct limited-mode transaction writes.

Server-rendered public pages, Help/FAQ/search, customer records/navigation and client
forms now use that current snapshot instead of build-time customer availability.
Server pages/layouts guard cart, checkout, registration and catalogue-only customer
routes; the authentication/CSP/client-forwarding proxy keeps its established checks
without adding slow policy fetches. Client checks revalidate on focus/visibility,
reconnect/pageshow and every 30 visible seconds, ignore older responses, fail closed,
and offer retry without submitting or clearing drafts. Booking and finance availability
stay separate. Existing readable records, permissions, favourites and session guards
remain. Registration also refuses an unavailable direct form event. Allie receives
current availability metadata and invalidates stored history when it changes; no AI
provider is called or enabled for verification.

The same existing verified public-service-copy projection now covers customer-owned
booking service descriptions and Allie's public service knowledge. Stored authoring,
audit history, commercial terms and exact amounts remain unchanged. Native tests check
both the safe customer description and the unchanged saved source/amount.

Focused frontend capability/Help/overview tests and recovered favourite/search/proxy
units pass; initial whole-suite failures were missing explicit runtime fixtures or
server-loader mocks after the dependency change. Initial new browser failures were an
incorrect checkout-anchor expectation and an invalid synthetic response envelope without
message; those were corrected. All ten final phone/tablet/laptop/native-no-JavaScript runtime cases pass, including
finance-versus-booking, stale tabs, failure/retry and genuine offline/reconnect with
unsent draft preservation. The no-JavaScript case initially expected a client-loaded
selected-group panel; its correct server-rendered Describe a vehicle problem destination
and disabled-payment guidance pass after correcting that assumption. The final complete browser run passes 10/10; exact-source release checks remain mandatory. Existing first-failure traces are
retained; no assertion about authentication, draft content or write denial was removed.

Public home-next-step v5 and service-request v16 document the availability/recheck flow;
eligibility, semantic targets and all feature flags remain unchanged. Exact-source CI,
isolated authenticated HTTP, packaged images, held/deployed checks and current release
safety receipts are still pending at this source checkpoint. Full-mode browser cases
use a separate loopback in-memory API with no database; role data is synthetic. Current
production stays browsing/enquiries. Account-optional purchasing remains engineering
work; real accounts/providers/devices and recorded financial/operational decisions
remain separate acceptance items.

## Published audit batch - 2 November 2026, 19:42 UTC

Runtime **022a8a0609e377dcb2c794e6eb0e9f48ff90cf56** is published on apex/www as
frontend **dpl_GpKYZ8EeuUwpiuxFbzsHuARDHp9X** and matching ACTIVE backend
**d129d4df-56db-477f-9928-c84362f2d825**, 16/16 components, four verified digests,
readiness 200 and eight fresh workers. No schema, business-row, price, grant or
activation flag changed. Earlier pending/source-only statements below are historical.

Exact-source GitHub gates pass: frontend **41505612149** (1,346 passed, 12 existing
skips), backend **41505544748** and secrets **41505544949**. The isolated native
PostgreSQL run passes **48/48** authenticated HTTP checks in two newly created
CI databases with 87-migration replay, no drift and non-owner runtime roles.
Packaged images pass **10/10**; held deployment **99/99** browser cases pass with
no skips/flaky cases; the published domain passes **22/22** browser cases plus
**12** anonymous HTTP checks across both aliases. Protected role data/provider
responses in browser tests are fixtures, not real-role or delivery acceptance.
The first deployed browser invocation used the wrong working directory and failed
one fixture image lookup; the complete rerun from frontend passes all 22.

Release checks verify a fresh backup, strict TLS, schema/runtime least privilege,
worker health and restored temporary firewall rules. The same-day populated restore
at 09:33 UTC is reused only because schema/safety scripts are unchanged; it is not
a new restore rehearsal. Production writes were limited to deploying image digests.
Public learning home-next-step v4/service-request v15 and private-guide 404 pass on
both domains. Eligibility, destinations and feature flags are unchanged.

Final safe after pictures are anonymous reads of the published application, not
local fixture renders. Contact pictures were recaptured after genuine branch
options loaded. All captures made zero API writes. Real-account, provider test-mode,
physical-device/Safari and full screen-reader acceptance remain unperformed.

C: measured **25.12 GiB free** at the final preflight. Four newly published images
and existing release/rollback images, volumes and useful caches are retained.
Automatic approval review blocked recursive cleanup of two stopped task-created
failed synthetic PostgreSQL data directories with the reason "blocked by policy".
They remain untouched; this action was not retried through another mechanism.
Three separate temporary provider-auth files were removed nonrecursively.

The full audit goal remains active: authoritative runtime capability convergence
and account-optional purchasing still require implementation. Browsing/enquiries
remain the launch scope; operational/financial/provider acceptance is not inferred.

## Implemented source

- Public combined search reads only anonymous published Services, Shop, Vehicles
  and public Help sources. It groups names/destinations, ranks exact names/SKUs,
  retains query in the URL, provides view-all and independent source errors/retry,
  and keeps existing scoped searches. Native GET remains usable without scripting.
- A real customer calendar uses owned authorised month queries with stable paging,
  half-open Nigeria-time boundaries and safe customer projections. Preferred,
  proposed, confirmed and cancelled records stay distinct. A proposal can appear
  in another month without becoming a confirmed appointment. Today/month/date
  controls, native dialog close/Escape/focus, details and offline/session clearing
  are implemented. Only current confirmed future times count down; expiry changes
  wording, never booking status. No appointment or capacity record is fabricated.
- Optional invitation adds Enable notifications using the existing subscription
  function, plus Not now and existing settings. No prompt occurs until Enable.
  Declined permission and failed/successful operations have visible feedback.
- Limited-mode service groups lead to the verified canonical enquiry context;
  empty Orders/Bookings no longer promise unavailable checkout/booking actions.
- Public copy uses ordinary language; filter help is shorter, specialist vehicle
  filters collapse without losing active/error/pending/URL semantics. Contact has
  one location block and an accessible map fallback. Vehicle secondary specs omit
  duplicates/meaningless blanks while preserving exact price, AC fault, owner
  statements and inspection status. No source listing or commercial row is edited.
- The product editor identifies actual missing family-specific information and
  provides explicit edit/media actions. Oils require grade/volume; replacement
  parts require relevant condition/classification/evidence. Stock is not fitment.
- Public learning advances home-next-step to v4 and service-request to v15 with
  unchanged eligibility, guide targets and activation flags.

The published Admin/Super Admin operational repair, owner-only/independent finance
controls, existing fitment review, record-table primitives, favourites, control
radii, carousel and approved asset/price placement remain in place. Later owner
instruction that laptop hover continues hero autoplay takes precedence over the
older audit hover-pause suggestion; manual/focus pause still persists until Play.

## Verification and retained failures

Environment: installed Edge/Playwright fallback, fresh disposable browser contexts,
loopback Next preview 3103/in-memory read-only API 5024. No application session,
customer database, provider delivery or real operational write. Local dependencies
contain Next 16.3.8 whereas the lock/source requires 16.4.3; final locked CI/build
and held-hosted checks remain mandatory. No duplicate dependency installation.

- Backend and frontend TypeScript passed; scoped frontend ESLint/backend oxlint
  and formatting passed before final source freeze. Exact-source CI pending.
- Seventeen focused frontend units pass (query routing/privacy/ranking/failure,
  calendar Nigeria/leap/year boundaries, family-specific gaps and countdown expiry).
- Seventy focused backend units pass: catalogue learning/public launch (63) and
  service-operation security (7). No database connection is used by these units.
- Two authenticated calendar HTTP cases were added to the existing fresh isolated
  PostgreSQL CI job: ownership, paging, half-open bounds/proposals, private notes,
  anonymous denial and invalid/forged range/identity rejection. Not yet run locally.
- Initial combined browser suite: 43/45 passed. JS-disabled combined results stayed
  in the streamed suspense fallback: fixed by rendering awaited result HTML before
  the page response, with a client submission status. The subsequent search suite
  passes that case; rapid repeated Escape/Back initially ran before the restored client form was ready. Added an explicit Close search action using the existing hydration primitive; two independent full-history repeats now pass after the visible control becomes enabled.
- Screenshot inspection exposed the new calendar inheriting the booking list's
  two-column mobile table CSS despite earlier Axe/overflow passes. Fixed the shared
  source by scoping record styles to .booking-table and giving the calendar its own
  seven-column geometry. Final 14 calendar browser cases pass across 320/360/390/
  430/768/1024/1280/1366/1440, including visible seven-column geometry, keyboard,
  error/inconsistent recovery, cross-month proposals, offline/reconnect and session
  invalidation. Two further delayed-month/touch-to-details cases pass (16 distinct calendar cases). Scoped Axe passes at 320/1440. Final screenshots were inspected.
- New service/contact/search journeys pass at 320/390/1440 with zero API writes;
  progressive filters pass at 320/1440 with exact URL values and hidden-error focus.
  Operator details/editor/reflow pass at 320/375/430/768/1440 plus missing-info actions
  and exact-money/null-record regression. Four roles pass search focus/forced colours
  and sidebar recovery in synthetic fixtures. Actual role acceptance is unavailable.
- An earlier 320px navigation was aborted while development source was changing;
  the unchanged repeat and subsequent full journey passed. No assertion was weakened.
- Early lint included CSS paths unsupported by ESLint: corrected the invocation,
  not a source failure. Early exact-optional/date-render lint/type failures were
  corrected. Metadata-only OpenAPI export needed explicit local test environment;
  corrected without connecting to any database.

No new schema, migration, customer/stock/vehicle/price/financial data, grants or flags
are changed in this package. Shared database writes and actual provider activity
are not used as demonstrations. Release gates, packaged verification, fresh backup,
recovery/read-only identity checks and deployed acceptance are still pending.

## Disk preflight interruption

The 18:44 UTC isolated-DB preflight stopped before any DB test/resource creation: C: had 17.63 GiB free (required 20.75). The task preview was stopped; no source, cache, image, database, profile or evidence file was deleted. C: subsequently measured 24.81 GiB and the same preflight passed at 18:48 UTC; the cause of the free-space recovery is not established. Memory-heavy checks will be serialized and the local preview will remain stopped during release preparation. No OS-wide reserve guarantee is implied.

## Safe visual evidence

Before images are fresh anonymous reads of current public production. After images
are the read-only local preview; vehicle photos/branch options use anonymous public
read-through handlers so the comparison has actual approved photos rather than
missing fixture assets. Sixteen settled pages returned 200 and made zero API writes.
Calendar/role images contain synthetic records only. Early screenshots containing
loading/missing fixture imagery are retained but are not final comparison evidence.

[Contact before, 320px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/before-settled-contact-320.png)
[Contact after, 320px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/after-public-contact-320.png)
[Vehicle before, 1440px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/before-settled-vehicle-1440.png)
[Vehicle after, 1440px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/after-public-vehicle-1440.png)
[Calendar after, 320px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/calendar-fixed/booking-calendar-owned-app-f0406-election-and-close-at-320px/calendar-320.png)

## Hour-boundary checkpoint

Exact-source backend CI 41504574591 and a fresh isolated native PostgreSQL run
both rejected the new proposal fixture because it omitted the required proposal
reason/version. Corrected synthetic metadata, retaining the complete-proposal
constraint and all runtime guards. The native run's other 42 cases pass (learning,
booking proposals/responses and fitment review); the corrected frozen source must
pass all 43 plus separate fake-provider push cases before acceptance is recorded.
The first native harness attempt treated Prisma's informational stderr as a
PowerShell error; output is now captured by a child runner that checks exit status.
Both task clusters were stopped and retained pending final bounded cleanup. No
shared/application target, existing grant, business row or provider was touched.

At 18:31 UTC, the source package remains unpublished while a retained notification-click fixture initially hangs on Opening your update. It subsequently passes unchanged in three repeats; development compilation was observed, and final hosted checks remain required. Four customer booking-list layout/Axe regressions and mocked push subscription/CSRF/device opt-out pass. The calendar geometry fix and native/no-JavaScript search checks pass. Next package starts 18:31 UTC, target 19:31 UTC: freeze/commit and run exact-source gates, then authoritative capability and approved guest-purchasing work. No unsafe publication or activation is used to meet the hour target.

## Operational boundary and next package

The full audit is not complete. Shared authoritative runtime capability state and
stale/unavailable transitions remain engineering work. Account-optional purchasing
is a confirmed implementation gap: current Order/Cart/checkout/payment ownership
requires a CustomerProfile/User. It is not honestly described as only a missing
payment key. Preserve those guards; a guest design needs real guest ownership,
order/payment/recovery and forward migration/integrity tests, not fake accounts.

Retain collection-only, pay-first then final fitment/availability checks, separate
paid/allocated/ready states, seven-day quote validity, disabled delivery/deposits/
reservations and existing permission/financial approval boundaries. Actual Tax/CAC,
VAT applicability, deterministic percentage rounding and workshop invoice payment
timing remain recorded owner/accountant decisions. Workshop capacity/hours and
operational ownership require reconciliation against saved approved settings.

Fresh real Admin/Super Admin/assigned Staff acceptance is unavailable because the
owner cannot access the session now; do not ask again or bypass authentication.
Controlled provider test-mode acceptance, real push/email delivery, multiple actual
devices, Safari/native phones and full screen-reader acceptance remain unperformed.
Optional AI has no new evaluation budget and must remain off. Browsing/enquiries
remain the published launch scope; the whole site is not declared launch-ready.
