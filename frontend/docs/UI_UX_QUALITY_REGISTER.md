### 4 November 2026: D07 assessed remaining-work review — integrated candidate

Integrated source retains master 804eb4fc's Month/Schedule calendar, responsive
modal geometry, nonmodal filters, focus containment and complete browser coverage.
Those application files are unchanged by this batch. Combined service-request v29
preserves calendar guidance and adds the remaining-work clarification; restricted
booking-confirmation is v12. Eligibility, semantic guide targets and live flags
are unchanged; the owner resource-plan guide remains draft.

The privileged, branch-scoped Review remaining work journey records the actual
remaining minutes, cleanup, selected approved physical units and an internal reason.
It requires an actual recorded start, current qualified technician and service,
current policy, independent BOOKING_CONFIRM and scoped BOOKING_READ for managed
access. All minimum requirements and any additional units must fit the full
technician/resource/calendar/capacity window. Conflicts do not displace appointments.
The original visit, schedule version, actual start, status, money and historical
estimates/allocations remain unchanged. Legacy unknown original timing stays unknown.
An overdue unfinished review continues to block overlapping work until assessed or
explicitly completed. Completion/cancellation uses the reviewed cleanup allowance.

Customers receive only a dated remaining-work estimate, explicitly separate from
collection readiness. Private reasons, unit/actor IDs and allocation history are
not exposed. Recorded-start bookings no longer offer customer rescheduling,
disruption replacement or stale workshop alternatives even with legacy Confirmed
status. Uncertain writes retain only an owner-bound local recovery reference;
refresh and current saved-receipt inspection are required before clearing it.

Local evidence: native pass 118/118 across seven files, all 98 forward migrations
replayed and db:check succeeded on a newly owned tmpfs _test database using a
restricted CRUD runtime role. The owned container was removed; no application DB
was contacted. A rerun verifies the later integration and sequential option reads.
Frontend typecheck and 21 focused units passed after correcting the new component
test's DOM environment. Earlier native fixture failures and cross-case limiter
interference were corrected without changing permissions or production limits;
a within-journey limiter test proves the existing limit remains enforced.

Rendered acceptance is pending: the candidate adds 12 production-build browser
cases covering 320/768/1440px staff/admin reviews, lost/malformed receipts, revoked
grants/changed plans, draft preservation and the customer estimate/started-work
boundary. Browser plugin not available; use the existing isolated Playwright
workflow. No synthetic result establishes real-role or physical workshop acceptance.

Migration 20261104010000_booking_work_reviews is additive and not applied to a
shared target. Production publication remains gated by exact combined-source CI,
matching image build evidence, fresh target backup and separate populated restore,
managed backup/PITR and privilege proof, compatible backend readiness and held
frontend verification. C: last passed the 1.5 GiB check at 21.61 GiB; four-image
builds still require the justified 2 GiB allowance. Production is unchanged by
this candidate. D01-D17 remains active; actual branch/resource facts, real role
acceptance and the separate finance/provider decisions are not fabricated.

4 November exact-master gate: 9fbf3732 passed backend safety, secrets,
production checks and 223/224 browser cases. All modal, tablet-filter and About
checks passed. A customer-reschedule case correctly failed closed because its
capability request followed the production build's api.example.com placeholder
rewrite (three HTTP 500/DNS failures in the trace), while only the server-side
fixture had been pointed at loopback. The shared booking test setup now routes
browser capability reads to that same explicit loopback API; all eight callers
use it. Production capability guards and assertions are unchanged. Publication is
held for the corrected exact-master checks. Images built for 9fbf3732 are retained
as unpublished candidate evidence, not described as a production release.

4 November final regression follow-up: corrected tablet source 796d2044 passed
all calendar/shared-modal geometry checks, both tablet filters, backend safety,
production build and 223/224 browser cases. The About test raced the existing
two-frame hash-target focus transition by focusing its summary immediately after
URL change. Trace shows the keyboard event only 23ms after the anchor click.
It now explicitly asserts destination focus before exercising Enter/Space; no
application behavior or disclosure assertion was removed. Final rerun is pending.
Task-owned inactive .next/dev output (626,484,716 bytes) was removed after confirming
no running consumer or links; measured C: free space rose 21.355 to 21.939 GiB.
Source, dependencies, production caches and all release/recovery resources remain.

4 November expanded verification: source ae0f9262 passed backend safety and
secrets, frontend production checks and 222/224 rendered cases. Both remaining
failures reproduced off-centre Parts/Vehicle filter dialogs at 768px. Their older,
more-specific drawer rules overrode shared inset/margin values; those modal-only
rules now center the panels and retain safe vertical space. Desktop nonmodal
filters, all public galleries, cart confirmation, Allie, practice, order guards,
private document sharing and the seven-size calendar/invoice/notification/garage
cases passed in that run. Final corrected-source verification remains required.

4 November modal follow-up: initial source 5c938a05 passed hosted frontend
production checks (1,486 units, 12 existing skips; 187/187 browser cases). Backend
41747735572 passed native calendar/learning integration but found that the longer
service-request passage exceeded the existing 8,000-character retrieval budget.
Redundant wording was shortened; no safety limit was widened. All 24 focused
learning/retrieval tests now pass for public, customer, worker, admin and owner.

Review also found that open desktop catalogue filters are nonmodal dialog regions.
Shared styling now uses :modal, preserving their sticky placement and page scroll.
Regression coverage includes that distinction, public galleries and cart confirmation
using the existing loopback-only synthetic API. Adjacent modal fixtures now provide
valid explicit capability responses; production settings remain untouched.

Local final calendar/document run passed 20/23; all three retained loading failures
passed unchanged on the subsequent warm run. Equipment photo checks passed at four
widths, both administrator account actions passed, and the garage short-screen and
pending-save safeguards passed. All fourteen new garage/notification cases passed
at the seven required sizes. The run was stopped when disk reserve failed at 12.06
GiB; after stopping task processes, C: returned to 21.56 GiB. Cause of the transient
drop is not established. Evidence is 30 MB and retained. Learning, order, gallery
and remaining adjacent cases are now selected in remote production-build CI; do
not count the interrupted local cases as passes. No local preview remains running.

## 4 November 2026 — calendar and shared modal batch (verification in progress)

Owner direction: improve the booking calendar with familiar calendar navigation;
center modal dialogs at every size, use full safe-area width on phones, and retain
usable, deliberately styled scrolling. This is a bounded UI batch on top of
customer-attention PR #17 (master 1b4e5d15; all three exact-master gates pass).
Production was independently advanced to frontend 27e41b75; this batch is not yet
published. No launch capability, permission, business record or schema is changed.

The baseline appointment calendar rendered off-centre at 320px. A separate
seven-size invoice journey reproduced backward Tab leaving the sharing dialog.
The calendar now offers Month/Schedule, Today, readable date counts and selected
appointment details, with restrained Allied colours and a sticky close header.
Recorded requests and proposals remain distinct from confirmed appointments;
missing, offline, partial and failed requests are not presented as empty inventory
or bookable availability. Schedule omits the repeated date block within each day.
The service-request learning definition advances v27 to v28 without enabling it.

Shared native-dialog geometry covers 18 owners: booking calendar, dashboard mobile
navigation, notification preview, garage form, customer account action, mutation
review, document share, order cancellation, product image preview, product and
vehicle public galleries, equipment photo, cart update, product and vehicle
filters, Quick help, Allie companion and practice replacement. The existing
full-screen public navigation remains separate; nonmodal anchored category pickers
remain anchored. All shared consumers need representative rendered regression
checks; source coverage alone is not a pass for every workflow.

Evidence: %TEMP%/allied-calendar-modal-20261104. Existing dedicated Playwright Edge,
synthetic intercepted accounts/documents; phone contexts use mobile/touch emulation.
The required sizes are 1280x720, 1024x768, 768x1024, 430x932, 390x844, 360x800,
320x720. Earlier invoice 320px timed out during local navigation; its unchanged
warm rerun passed. Final rerun and adjacent modal checks remain in progress.
No production writes, live messages, private records or real document exports.
Physical devices, mobile virtual keyboards, screen-reader acceptance and genuine
200% zoom are not certified by these emulated checks.

### 4 November 2026: D06/D07 recorded-work capacity follow-up

Base is exact-master 8dd5e22e, retaining the newer shared UI, overview, financial and
resource changes. That master passes all three required hosted checks. Its release
remains held: the cached-build assumption failed and the 2 GiB allowance requires
22 GiB free; last observed space is about 21.8 GiB. The owned build was stopped,
old receipts archived without deletion, and production was not changed by this batch.

The next regression audit covers actual early/late starts and overdue work whose
legacy status still says Confirmed. Candidate resource/technician availability must
respect recorded work and explicit completion/cleanup, preserve allocation history
and leave independent work available. First local attempt stopped at the isolated
target proof because a new task namespace was not supported; no fixtures ran and
the owned tmpfs container was removed. The unchanged approved resource namespace
is now being used. The corrected red run reproduces seven real regressions,
with one existing late-start case passing and 25 unrelated cases skipped. The
owned tmpfs target was removed. Log: %TEMP%/aat-recorded-work-red-approved.log.

The source fix respects actual starts in technician and equipment occupancy and
keeps recorded completion/cancellation cleanup and allocation history. Its green
run was blocked before starting: C: abruptly fell to about 12.1 GiB. Docker VHDX
remains 30.16 GiB; pagefile.sys is now 27.86 GiB and changed during the interval,
making Windows paging a strong suspect without an earlier size snapshot. No
system paging setting/file or other task was modified. Verification remains
pending and will use the existing hosted exact-source safety workflow.

Staff booking-confirmation guidance is v11; its gate/target are unchanged and the
owner resource-plan guide remains draft. This is not completion of D06/D07: actual
resource facts/owner configuration, running-job estimate/resource review and legacy
operational assessment remain separate work. No financial activation, migration,
real staff assignment or physical attendance is inferred.

4 November integration checkpoint: c80b4080 passed all exact-source gates:
Frontend 41741100952 (1,486 units, 12 existing skips; 150 browser cases), Backend
41741100977 (including all five overview cases), Secrets 41741100951. Master then
advanced to 8dd5e22e with reviewed resource-aware offers. Both content histories
and implementations are retained; the combined service-request guide is v27,
with its existing twelve steps and unchanged eligibility. Exact combined-source
checks must pass again before merge/publication. No schema or launch flag changed.

4 November CI follow-up: native run 41740199625 passed migration replay,
db:check and preceding integration stages, then rejected the new closed-enquiry
fixture because its required resolvedAt timestamp was missing. The fixture now
records resolution before closure; database guards and all ownership/terminal
state assertions remain unchanged. The new attention case is not accepted until
its rerun passes. Frontend production checks pass; rendered CI is still running.

## 4 November: customer attention summaries — local verification

Current batch: owned customer attention at /dashboard. The source baseline had no
open-enquiry or issued-invoice preview and selected only the newest order, which
could hide an older collection-ready order. The focused baseline test passed its
12 existing cases and failed on the missing Open enquiry heading.

The additive API projects one own open/in-progress enquiry, one own issued invoice,
and the oldest ready collection order independently of historical date filters.
It also validates the recorded first name through the existing profile-name schema.
No email-derived identity, message bodies, billing contact data or staff notes are
returned. Old clients and servers remain compatible. No schema/migration, permissions,
consent, payment or launch flags changed. Current/rollback releases remain retained.

The UI places the genuine next steps above current care/history, avoids repeating
the same collection order in Latest order, and links to existing owned records.
Invoice totals are labelled totals, not balances; credits and confirmed payment
remain on the invoice detail. Open enquiry does not assert who must reply.
Missing data omits cards; refresh and account invalidation clear former summaries.
Service-request v26 keeps its twelve existing steps, eligibility and targets.

Checks so far: 25 frontend units, 17 learning units, frontend/backend types, static
446-path OpenAPI validation, frontend ESLint and backend Oxlint/format pass. Final
Edge and Chrome each pass seven exact viewport cases with mobile/touch contexts.
The first cold Edge desktop attempt failed during a 37.7-second dev compilation
with Router action dispatched before initialization; its trace is retained and the
unchanged warm run passes. Local Next 16.3.8 is not locked Next 16.4.3 acceptance.
Native new-record ownership/terminal-state tests and exact-source CI are pending.
No production record, real customer submission or delivery was touched.

Evidence: Temp/allied-attention-20261104/{edge,edge-final,chrome,focus-check}.
Desktop and phone captures reviewed. All seven Edge focused-link header/dock
overlap checks pass; full-page screenshots are retained. Physical devices, genuine 200% zoom, broader route/state
and real role acceptance remain open. This batch is not whole-site completion.

Previous default/photo batch is merged in PR #15 as 92f3f9fc after branch frontend
41736291656, backend 41736282971/41736291647 and secret checks passed. Its native
ownership/default/private-cover cases pass. Exact-master backend 41737877996 and
secret 41737878157 and frontend 41737877997 pass for exact master.
Neither renewed batch has been published by this task. Retain compatible release,
recoverability, both-domain and exact-source gates.
4 November final D06 source checkpoint: master 92f3f9fc's customer-overview,
private booked/default/recent vehicle selection and acceptance changes are retained
in bc911880. Independent service-request v25 edits are combined as v26, reviewed
4 November, preserving both overview clarification and resource-aware offers.
Canonical API regeneration produces no additional contract diff. Uppercase public
service/branch UUIDs now resolve to their canonical approved identities.

The final focused native run passes 26/26 on this integrated source after all 97
migrations, Prisma diff, db:check and restricted-runtime proof; the owned tmpfs target
is removed. Log: %TEMP%/aat-resource-aware-offers-canonical-native.log. Earlier
100 other native regressions passed before the canonical-ID correction; they are
not represented as a fresh full-suite run for the current composition. Post-merge
52 focused units, full backend lint/types and the final unknown-duration 404/no-slot
unit pass. Hosted exact-source PR checks must pass before merge, and exact-master
checks plus all production backup/restore/migration/runtime gates remain required.
No real account, resource, financial setting or production alias was changed.

### 4 November 2026: D06 resource-aware public offers — integrated source checkpoint

Current source combines resource discovery with master 92f3f9fc, preserving the
new Help/Allie dock, dashboard/account, image, financial and resource-authoring
fixes. No Prisma schema or migration differs from master; all 97 canonical
migrations remain. Full D01-D17 remains active. Next work includes D06/D07 ongoing
work/legacy assessment, then the remaining materials, arrival, lead-time,
collection and exception journeys; this checkpoint does not redefine completion.

Public offered times now require the currently approved resource plan, explicit
service assessment, current qualified job duty, working periods/absences and
available distinct equipment/shared spaces for preparation/job/cleanup. Discovery
reuses confirmation occupancy and maximum matching, including actual completion
cleanup, overdue unfinished work and unassessed overlapping legacy work. A single
repeatable-read snapshot covers calendar, plan, eligibility, candidate batches and
public projection. Filtering precedes output pagination and scans beyond an
exhausted batch; public output/cursors contain no resource, staff or other-customer
identities. Existing private/no-store response and booking window are retained.

Selected offers are rechecked without reserving a unit or creating payment.
Changed offers reject before a booking write. An unconfirmed preferred-time
request remains available when resources are not configured. Atomic confirmation,
original reschedule reservations, permission predicates, history and financial
safeguards remain. Workforce permission checks still precede availability errors;
existing 403 and rollback regressions were preserved rather than weakened.

Native evidence covers 125 distinct cases across runs: the preceding full run
passed the other 100 booking/resource-policy/lookup/workforce cases, and the final
resource lifecycle/discovery run passes 25/25 after correcting three fixture
assumptions. Each fresh target replayed all 97 migrations and passed Prisma diff,
db:check and restricted-runtime proof. Final log:
%TEMP%/aat-resource-aware-offers-focused-native.log. Earlier attempts retain the
fixture naming collision, SQL-expression cast error, permission ordering error,
missing required legacy confirmation timestamp and tests outside the preserved
7–14 day booking window. No assertion was waived or policy changed to obtain a
pass. All task-owned tmpfs databases were removed; application data was untouched.
51 resource/learning/role units, source/scripts types, full backend lint, API
validation (446 paths/522 operations) and 3,842-file secret scan pass. API request,
response and security contracts are unchanged.

Service-request guidance is v26, with unchanged public eligibility and semantic
targets. Owner resource-plan v1 stays draft; flags remain unchanged. See
docs/help-learn/WORKSHOP_RESOURCE_AVAILABILITY_20261103.md. Exact-master hosted
checks and production publication remain pending for this composition. Actual
qualified staff/resources/shifts need factual owner configuration and real-role
acceptance. Booking readiness remains separate from invoice identity, tax and
provider/financial activation prerequisites. No new pricing, stock, approval,
provider success or real physical attendance is inferred.

3 November 22:49 UTC follow-up: native run 41733499830 passed migration replay,
db:check, types and lint, then failed two obsolete service-request v24 expectations.
Both are updated to v25; all behavior assertions remain. Seventeen combined
catalogue/booking learning tests pass locally. The database stage did not execute
in that failed run and is not counted as acceptance.
Chrome now passes all seven populated-photo/selection/account-switch scenarios.
Edge passed the earlier seven interactions after warm reruns; the subsequent
populated-photo run retained final-navigation timeouts at 360/320px. The 360px
rerun passed; 320px is being checked again. Dev-server logs also contain a transient
Unexpected end of JSON input while serving a route, plus slow chunk responses.
Do not classify those failures as verified production behavior or silently pass
them. Exact locked-build browser CI remains decisive for this batch.
Master 6432da3e passes Frontend 41731942415, Backend 41731942587 and Secrets 41731942475. The new overview work is draft PR #15, source ff1adafc before this
follow-up; neither renewed batch has been promoted by this task.

## 3 November: owned default vehicle and private overview photo

Bounded package started 22:20 UTC. Existing current-care previews, historical
separation, explicit garage defaults and private media routes were found first.
The old overview queried only the newest garage record when no booking supplied
a vehicle. A new component regression reproduced the ignored explicit default
(11 passing cases, one failing default-selection assertion).

The API now adds an optional defaultVehicle preview without changing the released
vehicle/vehicleSource meaning. Both are scoped on the server to the signed-in
customer. Each selected vehicle carries at most one existing private cover image,
ordered primary first, then saved order/id. Object keys, upload metadata, VIN and
customer IDs are not projected. The UI prioritizes a booked vehicle, then the
explicit garage default, then the legacy recent fallback. No default is guessed.
Old-server responses remain valid. No schema/migration or production data changed.

The private image uses the authenticated customer media route, no public optimizer,
fixed responsive geometry, contain sizing and an accessible failure state. Changing
vehicle or cover resets only that image's failure state. No photo uses a neutral
vehicle icon. Saved defaults never rewrite a booking or imply work has started.
Service-request guidance v25 explains this; eligibility, semantic targets, review
safeguards and live feature flags stay unchanged.

Local validation: 12 density/priority units plus six legacy/private-media contract
cases pass, five learning regressions pass, frontend and regenerated-backend types
pass, scoped backend lint and canonical OpenAPI validation (446 paths) pass. Client
regeneration was necessary after importing newer master models; initial backend
types failed on missing generated BookingRescheduleRequest/resource types, then
passed after regenerating from the unchanged current schema. Static contract export
initially lacked DB environment fields; it was rerun with unused loopback-only
values and performed no database access. No migration was run locally.

Seven Edge viewport interaction cases pass after two unchanged warm reruns for
1280/430px detail-navigation timeouts. Requests were pending during local development
compilation; those initial failures are retained. The tests exercise default,
booked and old-server states, private photo failure, refresh, auth invalidation,
a different account, keyboard detail navigation and no API writes. Phone contexts
use mobile/touch emulation. The subsequent populated-photo run uses an existing
owner workshop photograph only as intercepted test media, never seeded availability.
Evidence stays under Temp/allied-page-batch-20261103/overview*.

Populated-photo follow-up: desktop and 320px captures were inspected for natural
colour, contain sizing, wrapping and nearby detail actions. Five of seven first
runs passed; 360/320px timed out awaiting the final detail navigation. Those
failures remain recorded separately, and the locked-build CI must pass them.
The loopback fixture server was started on 5024 for subsequent checks, matching
the production-build test setup. No real backend or database is used by it.

Four native database cases, including a new two-account/default/cover/privacy case,
are added to the existing exact-target disposable CI database stage. Their execution,
the new locked-source build and broader full-page coverage remain pending. No real
customer ownership, photo storage provider, physical device or live sign-in pass is
inferred from browser interception. No application storage authorization changed.

Prior batch PR #14 merged to master 6432da3e after cbca7c94 passed all required branch
checks, including 1,476 units (12 existing skips), 136 production-build browser cases
and every backend safety stage. Exact-master runs and compatible backend/frontend
publication remain required. Production was not changed by this package. The full
renewed-brief scope ledger below remains open; this is not whole-site completion.

## Renewed briefs: integrated verification checkpoint

Source ca3d2464 passes Frontend release checks 41726745577: locked Next 16.4.3
production build, types/lint/format, 1,458 unit tests (12 existing skips), and
113/113 isolated Chromium browser regressions. Secrets 41726745554 passes.
The same backend source in 8845c4ec passes every stage of 41725720928, including
migration replay and database checks. These are branch checks, not exact-master
publication or actual-role production acceptance.

Master 27e41b75 is reconciled without discarding its booking/resource authoring,
financial behavior, test coverage or evidence. Owner resource navigation and the
new shared shell both remain. The duplicated workshop-resources testMatch entry
is consolidated to one entry; no test is removed. Required checks must rerun for
the resulting integration. Production remains unpromoted by this task.

Real browser zoom remains unverified. Dedicated Chrome Playwright
page.keyboard.press('Control+Equal') left viewport/DPR unchanged; that probe was
skipped. Native Computer Use sky.get_window / activate_window / get_window_state
on only the dedicated test window returned "Computer Use app approval timed out".
The waiting zoom test then timed out after 180 seconds; no zoom input or everyday
browser operation occurred. This is an execution limitation, not a zoom pass.
No Firefox/WebKit installation or physical-device test was performed.

## 3 November: renewed briefs — shared shell and dock verified locally

Owner scope: both newer Page by Page Improvement and Deployment and Live Chrome
Audit/Cross Browser Test Plan (2) briefs, read completely. Historical findings are
not automatically current results. The full goal remains open beyond these batches.

| Finding, route, role                                           | Reproduction and observed behavior                                                                                                          | Correction / evidence                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2 customer actions; /dashboard/support; CUSTOMER              | Released fixture: View ended at x585.81 on 390x844 and 320x720, outside the initial viewport.                                               | e075e8ba groups subject/status/View. All seven Edge and Chrome sizes pass enquiry/complaint keyboard/pointer navigation without writes.                                      |
| P2 scrolling navigation; /admin/security; SUPER_ADMIN baseline | After 500px scroll, toolbar top was -418 at 1280x720, -286 at 390x844, -262 at 320x720. Header Allie remained; no dock.                     | a3297c0b anchors desktop toolbar and two-row mobile navigation, moves Allie to shared dock and sign-out to labelled sidebar. Borderless utilities retain 44px targets/focus. |
| P2 Home dock movement; /; public                               | 320x720 hero visibility switched x264/y612/w44/h96 to x12/y634/w296/h74, reversing on upward scroll. Larger baseline sizes stayed anchored. | Removed the exact hero-conditioned CSS override. Full rectangle stays constant through down/up sections/footer/menu/help at seven sizes in Edge/Chrome.                      |
| Account identity; shared shell                                 | Existing canonical profile links and ownership validation preserved.                                                                        | Recorded-name initials replace absent/failed portraits; private image, refresh, wrong-owner and menu regressions pass.                                                       |

35/35 dedicated Edge shared-shell cases pass: four legacy roles plus Home at
1280x720, 1024x768, 768x1024, 430x932, 390x844, 360x800, 320x720. Actual dimensions
are asserted; phone contexts use mobile/touch emulation. Drawer focus/scroll lock,
collapse, overlays, forced-help-failure fallback, Escape/focus return, overflow and
customer-shell Axe checks pass. Chrome passes 14/14 Home/customer-shell cases and
7/7 support-action cases; the first desktop support navigation exceeded 15 seconds
during a 15.5-second cold route compile and passed unchanged after warmup. That
initial timeout is not a pass. Sixteen adjacent Edge profile/search/MFA/keyboard
checks pass. Scoped ESLint, Prettier, nonincremental TypeScript and diff checks pass.
Initial shell test assumptions about the availability banner at scroll zero and
contextual Home help were corrected without weakening sticky/dock assertions.

Evidence: Temp/allied-page-batch-20261103/{shell-baseline,shell-verified,chrome,
chrome-rerun,shell-adjacent}. Desktop and 320px shell captures visually inspected.
Local Home uses static images with unavailable API state, not populated inventory
acceptance. Captures include the dev indicator and truthful availability notice.
Tests are indexed and wired into existing runtime CI. Local reused Next 16.3.8 is
not lockfile 16.4.3 certification. e075e8ba Frontend 41722829983 and secrets
41722829894 pass; these do not certify the later shell commit or integrated master.

Vercel readback: apex remains source 7384abf8 / dpl_GjKGjnPCT8H56HWmikySoyYSjyxP.
None of these changes are promoted. Draft PR #14 tracks this work; newer master
financial changes must be preserved and compatible release gates resolved. Last
reserve check: 20.85 GiB free with 0.25 GiB bounded-write allowance.

### Remaining renewed-goal coverage — all still open

| Batch                                 | Existing implementation found                                                                                   | Remaining verification / implementation                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared foundation                     | Palette/type/radius/elevation tokens, mobile search, own-profile APIs, focus helpers, strict learning contract. | Real 200% browser zoom, short-height/virtual keyboard/safe-area checks and other shared consumers.                                                                                                                                           |
| Public pages/details                  | Search clarity, galleries, honest issue disclosure and URL filters.                                             | Each distinct page at seven sizes, populated layouts, combined facets/history/gallery interactions, images and measured loading.                                                                                                             |
| Customer personalization/all 15 pages | Server-owned current care, empty states, historical/current separation, no-store and invalidation tests.        | Two-account switching, selected/default vehicle/photo, open enquiries/invoices and nested states. Overview currently uses latest garage addition although CustomerVehicle already has defaultSlot; reproduce server fixtures before editing. |
| Work dashboards/details               | Scoped role navigation, own profile, nearby admin actions, invoice task disclosure.                             | All 39 named admin pages plus managed workforce and real role/branch/independent-permission denial states. Shell cases alone do not certify pages.                                                                                           |
| Authentication/system/performance     | Existing isolated security suites and recovery controls.                                                        | Full isolated lifecycle, expired/throttled/session/error states, password-manager/keyboard and measured performance acceptance.                                                                                                              |
| Browser/device                        | Installed Edge and Chrome verified for these batches.                                                           | Firefox/WebKit not installed; physical Safari/Android, real virtual keyboards and 200% browser zoom unverified.                                                                                                                              |
| Business data                         | Known catalogue evidence and approved-duration dependencies.                                                    | Real product photography, compatibility, workshop duration and duty decisions; never invent data or approvals.                                                                                                                               |
| Release                               | Verified bounded commits; production unchanged.                                                                 | Current-master reconciliation, exact-source CI, compatible backend/candidate acceptance, both-domain smoke checks and branch retirement.                                                                                                     |

## 3 November: renewed Markdown implementation goal — reconciliation in progress

The owner renewed the goal as "Read and implement the md files". The owner confirmed the two newer briefs; the newer Page by Page Improvement and Deployment brief
was read completely. Its requested end state extends the released consolidated
audit. Do not treat the earlier release as completion of this broader scope.
Desktop checkout f45efc6e is stale and has an unrelated dirty home-hero.tsx; preserve
it. Reused audit checkout 12789e4f was clean before this checkpoint.

First reproduced gap: /dashboard/support, CUSTOMER fixture on native released
assets in dedicated Edge. At verified 1280x720 the View action ended at x=1149.78;
at 390x844 and 320x720 it ended at x=585.81, outside the phone viewport. Document
width stayed within the viewport: contained table action reachability, not page
overflow. Baseline: one pass, two defect failures. Evidence: local Temp
allied-page-batch-20261103/baseline.json and results/support-baseline-* captures.

Implemented bounded correction: customer-support.tsx keeps subject, status and
View together in the first table cell; type/date remain secondary columns with a
mobile scroll hint. Existing query/category/cursor state and owned detail links
are unchanged. Scoped care-workspace.css gives View a 44px target. No backend,
permission, launch flag, Help semantic target or business data changed.

Verification: customer-support-actions.spec.ts passes all seven exact requested
pairs in dedicated Edge: 1280x720, 1024x768, 768x1024, 430x932, 390x844, 360x800,
320x720. Phone contexts use mobile/touch emulation; actual dimensions asserted.
Both enquiry/complaint actions are reachable before horizontal scrolling; keyboard
and pointer navigation render the intended record, long text/status stay with the
action, and fixtures record no writes. First cold dev run timed out on two desktop
navigations; both passed after compilation, not counted as initial passes.
Four adjacent loading/stale-history/pagination/accessibility regressions pass.
Scoped ESLint, Prettier, nonincremental TypeScript and git diff --check pass.
Inspected 320px screenshot: full subject, status and View visible together.
Evidence: Temp/allied-page-batch-20261103/{after,desktop-rerun,recovery}.

These are local API-fixture checks using reused Next 16.3.8 dependencies; lockfile
16.4.3 exact-source CI/build remains required. No real-role persistence, physical
phone, other-engine or production acceptance is inferred. Not deployed yet.

Next: reconcile shared sticky shell/dock and per-page states against current
implementation; personalization, role/API isolation and browser/device matrix
remain open. Both newer briefs were read fully. Earlier F20 in the consolidated
audit means vehicle fault disclosure; newer report F20 means customer support
actions. Use route-qualified identifiers. The full renewed goal remains open.

3 November 22:09 UTC exact-source verification follow-up: signed 7e92d780 is
verified by GitHub. Backend run 41726701704 and Secrets run 41726701665 pass.
Backend passes 97-migration replay/db:check, types/scripts/lint, 60 safety cases,
65 source/money/API cases, eight reminder concurrency, 184 booking/resource/finance
cases (four separately provisioned-workspace cases not run), 82 purchase, 90 guest,
41 Admin/owner-control cases and all later workflow stages, including final 113
Care/Allie cases. No test file was removed to obtain these results.

Frontend run 41726701652 passes lint/types, 1,476 units (12 existing skips) and
production build, but fails the final document format check. One standalone
numeric run ID followed by a period was interpreted as a list in the merged
quality register. Prettier joined it into its intended paragraph; the document
format recheck now passes. This run never executed the browser stage, so it is not
rendered acceptance. A new exact-source check must pass before any release claim.

All 521 existing OpenAPI request/security contracts and their shared components
are unchanged from d9cf9d09; the sole added path is the owner resource-reference
lookup. Prisma schema/migration bytes are unchanged. Remaining work still includes
actual resource configuration/acceptance, public offered-time resource filtering,
ongoing-work adjustments, and the full ledger. Inspection confirms D11 actual
arrival history is missing: attendanceConfirmedAt records the customer's RSVP,
not physical attendance. D16 currently permits CONFIRMED to NO_SHOW without a grace
check or required evidence. The next implementation must pair actual arrival/wait/
left history with a configurable delegated attendance check and staff-verified
missed action; a countdown or RSVP cannot substitute for physical attendance.
No record, price, live setting, data grant or deployment changed. Last reserve
check read 20.84 GiB; no local build, dependency installation or Docker write ran.

3 November 22:08 UTC integration gate review: 7e92d780 preserves both resource
editor and financial changes. Backend 41726701704 and Secrets 41726701665 pass.
Frontend 41726701652 passes 1,476 units (12 existing skips) and the production
build, then fails formatting in the merged UI_UX_QUALITY_REGISTER.md. No browser
runtime case executed in that run; no acceptance is inferred from collection or
build success. The quality register is now formatted. Exact-source checks must
pass for the follow-up commit before publication. Production remains at the
verified audit release; its backend deployment and four digests were freshly
read without mutation. Eight managed backups are listed, newest 3 November
05:22:10 UTC; that read is not a fresh release backup/restore rehearsal.
C: has about 20.85 GiB free, below the 22 GiB reviewed four-image build budget.
The conservative old/unshared/inactive/non-cachemount Docker cache filter returns
no candidates. All application databases, active source, useful caches and current
and rollback resources are retained. No build, migration or production promotion
was attempted after the failed disk preflight.

3 November 21:59 UTC merged-source check: backend types/lint pass. Seven
focused files produced 47 passes and one stale service-request v23 assertion after
the concurrent v24 started-work correction. The assertion now expects v24 while
retaining its semantic checks; affected file rerun passes 5/5. Frontend lint and
format pass, and 94 production-build browser cases are collected. The new resource
fields use shared border/surface/ink/focus/radius tokens; business data, physical
availability, financial policy and permission predicates are unchanged.

3 November 21:56 UTC concurrent-source reconciliation: origin a2d2ccf3 now
contains the same resource lookup/editor through b9c9c089 plus started-booking
cancellation and future-only reminder safeguards. Those changes, their synthetic
acceptance cases, and all existing financial source are preserved. Our merge adds
shared control/focus tokens, 768px and collapsed-laptop coverage, actual Tab/Shift+Tab,
retained overview/review/success screenshots and the corrected booking-confirmation
v10 Allie expectation. Existing started-booking browser and native checks stay in
the combined matrix; 94 browser cases are collected after integration.

The native target helper's Docker NAT branch was reviewed: it requires an exact
64-character container ID, task/name/label match, explicit isolated database name
and confirmation, Docker-proven tmpfs without persistent mounts, host loopback port,
matching actual PostgreSQL container address/port and actual database identity.
Native loopback remains unchanged; arbitrary claimed hosts are not accepted. The
new rejected-proof and native-loopback regression cases are retained. No Docker
container, real operational record, database grant or live capability was changed.
Frontend resource units 18/18 and API/capacity/finance pending regressions 38/38 pass;
backend 34 focused plus six retrieval cases pass before this merge. New merged
source checks and rendered acceptance are still required; prior results are not
claimed as evidence for changed started-booking/reminder composition.

3 November 21:53 UTC D06/D07 integrated authoring checkpoint:
selected changes from 89719302/08454401 are reconciled onto current d9cf9d09,
preserving the automatic purchase review model, financial allocations, current
Prisma schema and all existing migrations. The owner editor now has genuine
service/technician search and pagination, unavailable-reference disclosure, explicit
physical-unit condition and service assessments, qualifications, separate working
periods around breaks, dated exceptions, current/scheduled/history views, reviewed
approval and uncertain-result recovery. It does not grant duties, release existing
allocations, invent actual staff/equipment availability or activate booking/payment.
Managed owners retain the exact policy pages; Admin operational access and owner-only
policy authority remain distinct. Shared focus and control-radius tokens replace
the prepared editor's blue focus and five-pixel input corner override.

Local backend types/scripts/lint and 34 focused learning cases pass; six broader
retrieval coverage cases also pass. Local frontend lint and 18 new resource-contract,
draft/navigation cases pass. Canonical API is regenerated and validates 446 paths,
522 mounted operations and four explicit infrastructure routes. Twenty-one resource
browser cases are now in the retained production-build matrix (92 total), including
320/768/1440, expanded/collapsed laptop, keyboard focus and target size, whole-page
Axe, explicit approval/cancellation, empty/unknown inputs, search/pagination, stale
preflight, access loss, rejection, uncertain receipt/refresh recovery, future Nigeria
time, device-clock disagreement and preserved exception precision. These cases are
collected, not yet executed on this integrated source. Native lookup tests are added
to the existing isolated non-owner runtime suite; no prior test file is removed.

Browser plugin is not available; use the repository's Playwright production-build
workflow and synthetic API fixture. Local disk reserve remains above 20 GiB; no new
installation/build/Docker resource is authorised by this checkpoint. Use hosted
exact-source checks, then manually inspect retained rendered captures. Resource and
financial guidance versions/eligibility are preserved and draft owner instructions
remain unpublished. Real-role operational configuration, provider/storage/notification
acceptance and 92→97 compatible release gates remain outstanding. The full ledger,
D03/D11-D17 and original audit requirements remain in scope.

3 November 21:44 UTC bounded D02 result: signed master
d9cf9d093fc8e71f16883bbf2cc2b353da187447 is verified by GitHub and passes all
three exact-source gates: Frontend 41722772458, Backend 41722772291 and Secrets 41722772221. Frontend passes 1,458 units (12 existing skips), production lint,
types/build/format and 71/71 Chromium cases: zero skips, failures or flaky cases.
Backend passes 97-migration isolated replay/db:check, compiler/scripts/lint,
60 safety cases, 64 early source/money/API cases, eight reminder concurrency,
163 combined booking/financial cases (four separately provisioned-workspace cases
not run), 82 purchase, 90 guest, 41 Admin/full-operations/owner-control and final
113 Care/Allie cases, plus every other required stage. The earlier 63 count in
the pending checkpoint was a transcription error; the run logs show 64.

New account/guest journeys prove saved order/invoice allocations, original three-unit
quantity and unchanged totals after synthetic catalogue repricing; aftercare copies
the original allocation without charging money. Scoped STAFF/ADMIN reads, malformed
money rejection on managed and legacy approval routes, unchanged owner controls and
customer-history privacy pass. No runtime permission was broadened. Five expanded
purchase/checkout request bodies are unchanged; the only API contract extension is
optional read-only monetaryBreakdown. Canonical validation covers 445 paths/521
operations with four explicit infrastructure routes.

Seven added browser cases verify STAFF/ADMIN at 320/768/1440px, readable original
amounts, no horizontal overflow, keyboard focus, scoped automated WCAG AA checks,
zero writes, legacy review and invalid evidence without a decision form. Artifact
13273543068 is 4,090,004 bytes; SHA-256
66b0e574eddc4c30ec583a7813224fa6a30c12a5d9e64e03f55ebba2052c5c8b
was verified before safe selective extraction to runtime-ci-d9cf9d09. Manually
inspected STAFF 320px, ADMIN 768px and expanded-sidebar ADMIN 1440px screenshots:
requested 1 of 3 and saved amounts for all 3 are distinct, labels and amounts are
readable, and cards have purposeful spacing without clipped content. These are
synthetic built-app captures, not actual-role persistence or physical-device proof.
The new financial section has no equivalent retained before capture; do not claim
one. Existing slot-action before/after captures remain under 21c633af/0a61508e.

Status: this arithmetic/saved-amount batch is verified in source and isolated tests,
not deployed or live-payment activated. D17 durable refund-unit reservations,
capture/prior-refund reconciliation and execution remain unfinished; the pure helper
alone does not reserve units or transfer money. D03 staged materials/workmanship,
D11 arrival, D12-D14 collection/sourcing/private codes, D15 reminder configuration,
D16 verified no-show and remaining full-ledger requirements stay in scope. Next
bounded implementation: reconcile committed 89719302/08454401 resource-authoring
contracts/UI with current master and test them before compatible release preparation.
The wider 92→97 rollout still needs fresh target/backup/populated restore/recovery
and packaged-runtime gates. Round-off arithmetic requires no further owner decision.
Real roles, provider test mode, notification delivery, private storage, Safari/Firefox,
physical devices and full screen-reader use remain unverified where recorded.
No real records, stock, prices, flags or production deployment changed in this batch.
Final reserve check: 20.87 GiB. No local cleanup, installation, build or Docker operation occurred.

### 3 November 2026: resource authoring reconciled with current master

The signed resource lookup/editor checkpoints were cherry-picked onto current
master 3be68d5d, then merged with d9cf9d09 in b9c9c089. This preserves the newer
purchasing reviews, canonical 97 migrations, saved monetary allocations, approved
rounding rule, own-profile access, home imagery and audit fixes. The alternate
20261103103000 prototype migration stays only on the retained historical branch;
it is not merged over master. Other active page-audit work remains untouched.
Both financial and resource tests are retained in the combined CI configurations.

Pre-financial-merge source 418705dc passed all 116 native booking/resource HTTP and
database cases on an exact task-owned temporary isolated database after all 97
migrations replayed, Prisma diff and db:check passed, and a restricted CRUD runtime
was verified. The initial 107-pass run retained one Docker identity timeout;
an attempted reuse failed test authentication and was cleaned up. The final full
run passed without skips and removed its exact tmpfs container. No application,
shared or production database was written. Final log:
%TEMP%/aat-resource-current-master-native-final.log.

D09 prevents customer cancellation after a recorded start even if a legacy status
still says Confirmed; D15 skips missed one-hour reminders instead of sending them
immediately. No cutoff or proposed extra reminder interval is activated. The screen
now checks the recorded start, with two new 320/1440px refresh regressions. Public
service-request guidance advances to v24 with unchanged gates/targets. Exact-source
post-merge frontend/backend compilers, 33 focused frontend and 49 backend unit
cases, scoped frontend/full backend lint, formatting and a 3,839-file secret scan
pass. The old v23 learning assertion initially failed and was updated to the
explicit v24 definition; its final 12-case file passes. Hosted rendered checks
remain pending until recorded.
The previous 19-case editor browser result remains synthetic pre-integration
acceptance, not evidence for this new composition or real operational accounts.

Read-only Vercel checks identify both aliases at audit source 7384abf8. Its
recorded backend receipt is schema 92; no fresh backend schema probe is claimed;
this resource/97-migration composition has not been deployed. Exact-master CI,
fresh backup, populated restore, reviewed pending migrations, matching backend and
runtime/alias verification are still required. Resource-aware public offer
filtering and remaining D01-D17 items are not marked complete. Purchasing remains
separately gated; the owner's approved aggregate half-up/largest-remainder rule is
preserved, while invoice identities, VAT applicability and provider acceptance
remain separate. Historical evidence below retains its original source/migration
counts and does not supersede this current checkpoint.

3 November 21:32 UTC exact-source follow-up: 2b9bf542 signature is valid and
its secrets check 41721669591 passes. Backend 41721669595 passes migration replay,
types/scripts/lint, 63 early source/money/API checks, eight reminder cases and 162
combined cases, then fails one historical expectation that Admin cannot read an
operational order. The owner-approved Admin full-operations behaviour is preserved;
the acceptance expectation now requires 200, while scoped financial responsibility,
separate decision grants and customer-history privacy assertions remain unchanged.
No runtime permission was broadened. Source 4d90bb3b is signed and pushed.
Frontend 41721669566 fails types on a newly introduced BigInt literal under the
existing frontend target. The validator now uses BigInt(0), retaining exact integer
arithmetic and the current compiler target. These failed runs are not release gates.
A new exact-source run must pass before claiming native/browser acceptance.
Read-only Vercel refresh confirms both domains at READY source 7384abf8,
dpl_GjKGjnPCT8H56HWmikySoyYSjyxP; www retains its 308 apex redirect. This financial
package is not deployed. No data/flags changed. Reserve recheck read 21.01 GiB.

3 November 21:25 UTC integration reconciliation: remote master 3be68d5d adds the
separate audit release receipt for source 7384abf8, frontend dpl_GjKGjnPCT8H56HWmikySoyYSjyxP
and backend fb5f9ef2-8ffc-4233-9e96-4722c43350a2 at schema 92. Its documentation
and captures are preserved. This supersedes the historical schema-89 provider
snapshot, but does not publish later 97-migration master or this D02 package.
The receipt is another package's evidence; current provider identities must still
be refreshed before any rollout. Both conflicting checkpoint additions were kept.
Canonical validation also found a handbook final-newline mismatch and an obsolete
admin-only expectation for existing guest PDF downloads. The generator now emits
one final newline; the test explicitly checks the two owned guest PDF paths and
their guest-cookie boundary, retaining admin MFA requirements. Six API handover
checks pass; canonical validation covers 445 paths and 521 mounted operations.

3 November 21:23 UTC D02 implementation checkpoint (not yet a release gate):
new account and guest orders save versioned integer-kobo line allocations on the
order, invoice policy and invoice document. Existing ordered quantities and issued
history are preserved. Saved order-item order resolves equal remainders. Scoped
financial review displays the requested lines' original full-line amounts and
checks current request quantities separately; missing legacy evidence uses issued
records, while invalid saved amounts cannot authorise a financial decision.
Aftercare freezes the same allocation without consulting later catalogue prices.
The pure unit-range helper reconciles successive disjoint ranges exactly; it does
not yet reserve refunded units or implement D17 refund execution/capture/prior-refund
limits. Those integration requirements remain unfinished, not implicitly accepted.

Local checks: 136/136 backend units across nine focused files; backend types,
script types and lint pass. Frontend workforce parsing passes 10/10 units and
scoped lint passes. Canonical response contracts/types were regenerated; purchase
request bodies and database schema are unchanged. Seven new synthetic browser
cases cover STAFF/ADMIN at 320/768/1440px and legacy/invalid states; 71 total cases
are collected, but their execution and new native database journeys are pending
exact-source hosted CI. No provider, actual-role, physical-device or production
acceptance is claimed. Guide versions financial-aftercare/financial-policy-work
are v5 with unchanged eligibility and independent finance authority.

No shared migration, live feature activation, real record mutation or publication
occurred. Current source adds no migration; the accumulated 97-migration release
still needs its populated restore, backup, recovery and compatible-runtime gates.
The resource authoring work is now committed separately as 89719302/08454401 and
has not been imported. The full audit goal remains active. Last disk preflight:
20.64 GiB; no substantive local build, installation or cleanup was performed.

3 November 20:43 UTC bounded package result: signed master
0a61508efc5270f5c5eac0e296ac9144ab2fb30d passes all required exact-source checks:
frontend 41712651500, backend 41712651521 and secrets 41712651509. GitHub verifies
the SSH signature as valid. Frontend passes 1,457 units (12 existing isolated-audit
skips) and 64/64 Chromium cases with no browser skips/flaky cases. Backend passes
97-migration replay/db:check, 44 early source/money checks, eight reminder concurrency
cases, 148 combined booking/resource checks (four provisioned-workspace cases not
run), 82 purchase, 88 guest and final 113 Care/Allie checks, plus every other workflow
stage. Local broader Allie/provider fixtures pass 99/99; money suites pass 13/13.
These are isolated/synthetic checks, not real-role/provider/physical acceptance.

Artifact 13268707442 (3,632,943 bytes), SHA-256
a00768d9b0cb1b923482134c0b206dc2bed4d48e8143caf20fed0a7ca4a952e1,
was verified before safely extracting selected evidence to runtime-ci-0a61508e.
Inspected 768px slot records: whole words and the measured 8px action gap are visible.
Inspected 320px slot review: readable stacked details, visible focus and separated
controls. The phone calendar has clean copy; .ics download/confirmed-only behaviour
is checked, while real calendar-app/provider/physical-device acceptance is unperformed.
The same unobscured 768px records screenshot under runtime-ci-21c633af is the safe
before-gap comparison. No real customer/financial/stock record was altered.

The package is verified but unpublished. Shared schema rollout still needs the
fresh backup, populated restore/recovery/package/runtime gates; the earlier schema-89
rehearsal does not prove 97. Current live capabilities were not activated. Resource
authoring UI remains uncommitted in the other active worktree and is not imported.
Next package: complete D02 saved line allocations/partial-refund basis using the
approved arithmetic, preserving issued history and prior refund/capture limits;
then continue D03/D11-D17 and the remaining ledger items. Do not ask again for the
settled rounding decision. The full goal remains active, not whole-site launch-ready.
Last reserve checks read 20.97 GiB; no cleanup or substantial local build occurred.

### 3 November 2026: D06 owner resource editor — local acceptance checkpoint

Current item advances to resource-aware public offered-time filtering, then the
remaining D06/D07 operational extension/legacy-assessment workflows. Full D01-D17
remains active. Worktree allied-contact-validation-20261027 reuses signed 89719302;
no new worktree, dependency install, image build or operational record was created.

/admin/booking-resources now selects actual service/staff references, records each
physical equipment/shared-space identity once, explicit condition/categories,
service quantities or explicit no-resource assessments, actual qualifications,
split working periods and dated unavailable periods. New fields do not fabricate
people, machines, status or hours. Drafts stay in memory. Explicit branch/navigation
checks protect unsaved edits. Source, written evidence and immediate/future effective
time are reviewed before one CAS publication. Fresh account/branch/version checks
precede POST; exact provenance/actor/settings receipts precede success. Immediate
approval uses the freshly checked server clock, and recorded exception seconds and
milliseconds survive unrelated edits. Policies and booking allocations are not
rewritten by this editor.

Definitive rejections retain the draft. Unknown transport or invalid receipts block
another submission, retaining only the opaque reference/version/fingerprint through
refresh. Recovery displays fresh current/history evidence and requires explicit
acknowledgement without resubmission or attributing success from a version alone.
Access loss removes private details. Both ordinary and managed Super Admin access
are supported; managed owners retain verified-workforce gating plus independent
owner/profile/MFA API checks. Only the exact calendar/resource policy pages use that
owner path; ordinary managed administrators gain no link, data or job responsibility.
The first managed test exposed the old registry redirect and a follow-up missing
import; both were corrected and the two-role check passed. No job predicate widened.

Final evidence: frontend resource/draft/recovery/API/capacity/managed-route units
70/70, backend learning/catalogue/retrieval units 22/22, frontend/backend compiler,
scoped lint and formatting pass. The final expanded rendered suite passes 19/19 with no retries or skipped
cases: %TEMP%/aat-resource-editor-browser-accepted.log. The prior 16-case pass
and two managed-role cases are retained separately, not added to this count.
Earlier browser failures include a cold preview/label-locator problem and incomplete
synthetic notification/periodic-capability fixtures; strict console checks remain.
The final fixture handles those expected reads instead of ignoring errors.
Playwright uses installed Edge because the Browser plugin is unavailable; all
records/approvals are synthetic. Responsive approval cases cover 320/1440px, with
other state checks at their declared/default widths. No actual device, screen-reader,
hosted or operational-role acceptance is claimed. Screenshots are outside Git under
%TEMP%/allied-resource-editor-{320,1440}.png and allied-resource-overview-{320,1440}.png.

Restricted booking-confirmation instructions advance to v10. The new owner-only
workshop-resource-plan v1 remains draft and excluded from publication; owner gate,
MFA/session requirements and no-permission-grant checks are preserved. Existing
semantic guide targets and production flags are unchanged. Help checkpoint:
docs/help-learn/WORKSHOP_RESOURCE_AUTHORING_20261103.md.

No production publication, provider call, financial approval, schema migration or
new capability activation. Existing parent native 18-case lookup/policy evidence is
not a fresh browser/API/database end-to-end run for this editor. Actual staff mapping,
working equipment, spaces, qualifications and shifts still need factual owner
configuration. Public resource-aware offer filtering, in-progress estimates,
legacy/disruption recovery and remaining D03/D11/D13/D14/D16/D17 work remain.
Purchasing keeps suitability and availability BEFORE payment and stays separately
gated by its financial/provider prerequisites. Exact-master CI, compatible backend,
95-migration backup/restore/rollout safeguards and real-role acceptance remain release
gates. The existing 320px capacity-page regression also passes 1/1
(%TEMP%/aat-resource-capacity-regression.log). The owned preview and capability-only
fixture are stopped; useful warm caches and all other tasks are preserved. The disk
reserve passed after shutdown at 20.92 GiB. Development stream-abort diagnostics
from interrupted/negative-route fixture requests are retained separately; this is
not production-runtime acceptance.

### 3 November 2026: D06 resource authoring lookup and receipt foundation

Current item remains the owner resource-authoring/review interface and resource-aware
public offered-time filtering. Full D01-D17 remains active. This batch adds the
real-record lookup and strict client contracts needed by that interface; it does
not claim an editor route, rendered acceptance or production publication.

Owner/MFA-only GET /admin/policies/booking-resources/:branchId/options returns
minimal service/technician references and names, with private/no-store responses and
an atomic current-session audit. Job-duty eligibility is applied before keyset
pagination. Legacy branch staff retain existing authority; managed staff need an
active JOBS_UPDATE assignment. Revoked, future/expired, foreign, inactive and
unverified references cannot become eligible through a resource selection. Exact
reference lookup can label retired selections unavailable, without exposing contact,
login or financial fields or fabricating a replacement record.

Client contracts validate actual resource groups, qualifications, split periods,
exceptions, versioned workspace consistency and exact D06-D07 approval receipts.
Recovery stores only an opaque token, expected version and SHA-256 fingerprint;
shared session invalidation redacts every resource branch marker. No approval body,
staff schedule or written evidence is stored in browser recovery. These helpers
are prepared for the forthcoming editor; no existing customer flow is changed.

Evidence: 18/18 native HTTP/database cases across resource lookup and existing
resource-policy publication pass on fresh aat_d06_48f7fa181984_test, after all 95
migrations replayed, Prisma diff and db:check passed. Restricted CRUD runtime
credentials were used, isolation identity checked, and the owned tmpfs target was
removed. Shared databases/volumes were preserved. Earlier failed fixture-reference
and expected-status runs remain separate; 422 is the existing validation contract.
The final log is %TEMP%/aat-d06-options-native-accepted.log. Frontend resource,
capacity and API-client units pass 43/43. Backend source, scripts and the focused
native test type check pass; frontend generation/types and scoped lint pass. The
focused test compiler includes existing Express declarations and permits the same
environment index-access style as existing test helpers. Initial temporary compiler
configuration failures are not source failures or counted as passes.

OpenAPI validates 434 paths and 509 mounted documented operations plus four explicit
infrastructure routes. Export uses the existing synthetic offline environment;
the first normal export stopped for missing DB environment configuration, without
connecting or writing to a database. Formatting, diff whitespace and secret checks
pass. Existing Vite configuration/Node crypto/pg driver warnings remain separate.
C: reserve passes at 21.86 GiB. No new worktree, dependency install, Docker image
build, production write, provider call, financial approval or feature activation.

Still required: complete resource author/review/recovery UI and rendered acceptance;
resource-aware offer filtering; in-progress estimate extensions and legacy resource
assessment/disruption recovery. Actual staff/account mapping, working equipment,
shared spaces, service requirements and shifts need authorised factual configuration.
D03/D11/D13/D14/D16/D17 implementation and all unresolved D01-D17 values remain in
scope. Purchasing stays separate, with compatibility and availability BEFORE payment.

## 3 November 2026: consolidated audit deployed checkpoint

Checked application source 7384abf8 (PR #12) is live on both domains as
dpl_GjKGjnPCT8H56HWmikySoyYSjyxP. Exact-source Frontend 41695288681,
Backend 41695288523 and Secrets 41695288500 pass. Backend
fb5f9ef2-8ffc-4233-9e96-4722c43350a2 is ACTIVE with four verified digests,
readiness 200 and 13 fresh healthy worker tasks. Reviewed forward migrations
89→92 passed after fresh backup and populated restore: all 101 original-table
counts/hashes preserved; current/previous packaged runtimes compatible. Approved
temporary network access was removed and verified after every lease.
Native public acceptance: 7/7 across all seven sizes; released private-interface
fixtures: 14/14 in Edge/Chrome. These do not establish real-role persistence,
private storage, physical-device or Safari/Firefox acceptance. F02 remains
consent-suppressed with no retry. Genuine data/duty requirements and authoring
contracts remain explicit. Later booking/calendar/Allie master work is preserved
and excluded from this release. Full self-contained ledger and reviewed captures:
frontend/docs/CONSOLIDATED_AUDIT_20261103.md. Earlier pending checkpoints below
are historical; this checkpoint supersedes only this audit package's status.

3 November 20:25 UTC verification and arithmetic checkpoint: 21c633af frontend
41708675936 passes 1,457 units (12 existing skips) and 64/64 Chromium cases.
Retained artifact 13267077668 (3,613,983 bytes) is safely extracted under
runtime-ci-21c633af. Inspected 768px and collapsed-1440px slot records plus the
768px calendar: status words remain whole and calendar copy has no replacement
character. The two slot actions still touched, so their shared cell now adds an
8px gap; the updated browser case measures that gap. Its new rendered rerun is
pending; inspected screenshots do not prove this last spacing correction.

Backend 41708675927 passes 97-migration replay/db:check, eight reminder concurrency
cases and 148 combined booking/resource cases (four separately provisioned-workspace
cases remain skipped), plus 82 purchase and 88 guest cases and subsequent workflow
gates. Its final Care/Allie stage fails two guidance tests. The stale alternative
fixture now asserts preserved original staff/reminders. Auxiliary query words
such as may/have/currently had let a long public article crowd out the relevant
permitted delegation guide; retrieval now ignores those question fillers without
changing eligibility, whole passages, four-source or 8,000-character limits.
Positive provider fixtures use the current parts source version; duplicate and
obsolete sources still have explicit rejection cases. Five suites pass 99/99.
Full workflow rerun is required; this backend run is not a successful release gate.

The user approved future-order HALF_UP aggregate percentage discount/VAT and
largest-remainder refund allocation with saved-line-order ties in this chat.
Decision/checklist/ledger records now reflect that approval. Percentage promotions
use the existing integer HALF_UP helper rather than truncation; fixed discounts
and caps are preserved. Two money suites pass 13/13 for account/guest evaluation,
exact halves, non-ties, large integers, caps and VAT after discount. Saved monetary
snapshot/partial-refund allocation integration remains unfinished under D02/D17;
it is no longer an unresolved owner arithmetic decision. No existing issued
record, service price, package quantity, live finance setting or payment flag changed.

Both public aliases were refreshed through Vercel and still target
dpl_Fzq4yoEwLMH1puuvqznu9SdRAqAX / source fabbe7a600a02e002f1f4ee773dada4b5cf25697.
The local cache review found only about 0.77 GiB of compiler cache in this worktree;
it was retained as insufficient to unlock the standard build allowance. No cache,
profile, source, database, image or other task resource was deleted.

3 November 20:03 UTC continuation: signed correction 21c633af0c98f0cc7c43c710c7a74fadfab96b82
is pushed. Exact-source workflows: frontend 41708675936, backend 41708675927,
secrets 41708675909. These are pending/in progress, not accepted or deployed.
All 19 native booking test files remain in the workflow; YAML and Bash syntax
validation pass after the worker invocation split. Current working source is
recoverable, with no real records, shared migrations or live flags changed.
Next: inspect these exact runs, fix actual failures and inspect corrected rendered
badge/calendar evidence before closing this batch. Resource dashboard source is
being prepared in the other active worktree; its uncommitted UI is untouched.
D03/D11-D17 and other full-goal items remain in the ledger, not silently deferred.

3 November 19:59 UTC verification follow-up: resource source 330e7cba replayed
97 migrations and passed db:check/types/scripts/lint plus 14/14 resource lifecycle
and 9/9 policy cases under the isolated non-owner runtime. The combined booking
run has 152 passes, four failures and four provisioned-workspace skips; it is not
a passing backend gate. Three failures came from global reminder-worker assertions
consuming due reminders left by synthetic-clock resource fixtures. The worker
suite is now invoked first on the fresh schema, retains every assertion and adds
an explicit loopback guard; no fixture data is cleared. The fourth was a test's
incorrect workshop-source enum; it now asserts WORKSHOP_ALTERNATIVE from the real
contract. Native rerun is required. Secrets 41707257982 pass; frontend 41707258054
was still running at last inspection.

Downloaded 406f7814 browser artifact 13266860032 (3,364,796 bytes). Tablet calendar,
slot review and collapsed-laptop screenshots are retained under runtime-ci-406f7814.
Manual inspection found a badge breaking Required across lines and a replacement
character in calendar copy. Shared badges now prefer whole-word wrapping while
retaining long-token fallback, and slot status gets sufficient column space;
control radii and font sizes are unchanged. Calendar copy uses plain readable
words. Updated browser cases inspect whole-word layout in both laptop states,
activate review with Enter and retain unobscured badge screenshots. Local calendar
units pass 8/8, scoped lint passes, and 64 browser cases collect; this correction's
rendered rerun is pending. This is fixture evidence, not real roles/devices.

3 November 19:51 UTC exact-source follow-up: 406f7814 frontend workflow
41705432560 passes 1,457 units (12 existing isolated-audit skips), production
checks and 64/64 Chromium cases with no browser skips. Secrets 41705432562 pass.
Backend 41705432590 passes 96-migration replay/db:check and preceding source/
safeguard gates, then isolated booking tests report 115 passed, one failed and
four skipped. The skipped cases require a separately provisioned workspace; this
run does not prove that acceptance. The one failure expected the older immediate
alternative move. Its journey fixture now verifies the preserved appointment/
technician and pending request, explicit authorised approval and duplicate-decision
rejection. Explicit synthetic buffers/resources support that journey; no real
workshop facts are invented. Native rerun of this correction remains required.

The resource candidate validates 445 OpenAPI paths/521 operations, with four
explicit infrastructure routes. All four account/guest purchase/payment request
contracts and the current purchase-review model remain identical. Its new unapplied
allocation migration matches original committed bytes (SHA-256
1d410b0ce58125e6d074d2b8104963b14916b40f7da77ba9a1f262005ddfe71e).
No publication or shared migration is authorised by these partial results.

### 3 November 19:44 UTC package: actual workshop resource integration

Target 20:44 UTC. Integrated committed resource source 90ddaf49/287f5307,
selected domain tests and its unchanged forward allocation migration. Uncommitted
resource dashboard work in the other active worktree is untouched. Current
payment-review schema/automatic purchasing and strict loopback isolation helper
are preserved; no alternative purchase model or shared grants are imported.

Plans distinguish technician eligibility/working periods, distinct equipment and
shared spaces. Confirmation, rescheduling, timing review, reassignment and work
start reserve current resources atomically. Conflicts retain the original state;
eligible cancellation releases occupancy while append-only history remains.
Recorded cleanup and overdue ongoing work protect capacity. Legacy unknown work
requires review rather than invented facts. Resource policies retain owner-only
current-MFA/CSRF/version controls and cannot grant workforce permission.

Schema/client validation and backend type/script/lint checks pass. Five focused
unit suites pass 44/44. Public service guidance v23 preserves the settled D01
independent-booking sentence; restricted confirmation v9 describes reservations.
Native CI now includes resource-policy and fourteen resource lifecycle cases under
the isolated non-owner runtime role. Actual execution, migration replay, dashboard
authoring, real configuration and role/provider acceptance remain pending. No
shared migration, live record mutation, notification or capability activation.

3 November 19:42 UTC release checkpoint: correction and expanded responsive
acceptance are signed/pushed as 406f78149b7a06e881c0b00eb41f3d1acf8d0eba.
Exact-source workflows started: frontend 41705432560, backend 41705432590,
secrets 41705432562. Results are pending; do not publish from earlier green runs.

Downloaded browser artifact 13264177211 for 8bd2e173 (2,484,399 bytes), safely
extracted selected evidence and inspected changed-offer screenshots at 320/1440.
The alert is in view, the stale green approval/payment shortcut is absent, known
vehicle details reopen for a fresh check and the laptop form retains readable
columns. These are synthetic Chromium screenshots, not production/real-role or
physical-device acceptance. Evidence directory:
C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/runtime-ci-8bd2e173/.
No real order, stock, payment or notification was changed. Disk preflight passed
with 21.94 GiB free and a 0.03 GiB allowance. Full D01-D17 scope remains active.

3 November 19:37 UTC integration follow-up: frontend source 8bd2e173 passes
41702361178 with 1,457 unit cases (12 existing skips) and 54/54 Chromium cases.
The first backend failure was an old positive schema fixture missing the newly
required reschedule reason; the corrected seven-case unit suite passes without
relaxing validation. Retry 257faa0d passed the preceding database/runtime checks,
then failed the authenticated Help test because merged service guidance lost the
settled D01 unpaid-booking/checkout independence sentence. That content is restored
in service-request v22; the test remains, and 13 relevant Help units pass.

The new isolated runtime-role booking suite is moved earlier to expose its actual
native results before unrelated later gates; no required check is removed.
Browser discovery now collects 64 cases including 768px, plus collapsed/expanded
laptop slot review. Passing estimate screenshots now use the normal retained
test-artifact directory. These expanded executions remain pending; the 54-case
pass does not prove the new tablet/sidebar cases. No migration or capability was
applied/activated on a shared application target.

### 3 November 18:44 UTC package: booking/calendar integration candidate

Target 19:44 UTC. Working source integrates the committed calendar portion of
71e185d3 and booking commits e3d627ae, e9a588cd, f32ae2bd and add274bf into master
7384abf8. It preserves the approved automatic purchase engine, current purchase
history, dashboard/learning repairs and independent runtime gates. The alternative
purchase-review implementation/migration is not imported. Current database
isolation guards remain unchanged; native acceptance will run in hosted loopback.

Customer reschedules retain the existing appointment until an authorised scoped
decision switches it atomically. Reasons, withdrawal, decline, stale/conflict and
uncertain-result handling are integrated. Customer cancellation is limited to
eligible unstarted visits. Saved estimates, reasoned pre-start overrides, versioned
offers and historical timing through approved replacements are integrated.
Confirmed-arrival .ics and Google Calendar actions avoid invented completion times,
private notes, forced OAuth or promised alarms. D06 equipment/resource allocations,
in-progress overrun handling and configurable reminder delivery remain unfinished.

Four booking migrations match their original committed bytes unchanged; the full
source has 96 migrations. Schema validation/client generation, backend compiler/
script checks/lint pass. Thirty backend timing/Help units pass; the later ten-case
Help rerun overlaps that total. Frontend booking/calendar units pass 24/24 and
payment/recheck units pass 23/23; scoped lint passes. Canonical contracts validate
444 paths/520 operations. Four existing account/guest checkout/payment request
contracts are identical after resolving OpenAPI references.

A screenshot-confirmed stale confirmation is also corrected: a rejected offer no
longer retains its old green payment approval or shortcut. Account/guest forms
reopen known details for a fresh check; normal automatic purchases gain no step.
Successful new checks clear the earlier failure message. Parts Help is v14,
public service guidance v21 and restricted confirmation guidance v7.

CI is prepared for fresh isolated booking acceptance using a distinct non-owner
runtime role, no schema modification/TRUNCATE/migration-history access and no
external notification/provider calls. Production-browser discovery collects 54
cases in seven files, covering phone/laptop rescheduling, estimate review, calendar,
runtime gates and purchase regressions. These expanded database/browser executions
and the new source's full production checks remain pending.

Baseline 7384abf8 passes all required workflows: frontend 41695288681 (1,440 units,
12 existing skips, 21/21 browser cases), backend 41695288523 and secrets 41695288500.
Inspected its final 320/1440 changed-offer alert screenshots after the whole alert
reached the viewport; artifact 13261006663 is retained under runtime-ci-7384abf8.
That baseline does not prove this integration. No shared migration, real record
write, production publication or booking/payment activation occurred. The full
D01-D17 goal remains active; owner-deferred financial/calendar inputs stay separate.

## 3 November 2026: consolidated audit implementation checkpoint

Audit branch `codex/consolidated-audit-fixes-20261103` contains signed implementation
commit `76b52eaa`, reconciled with master through `f6329e33` in `8368ad71`.
Learning destination validation, own-account navigation/identity, compact mobile
search, MFA spacing, invoice discovery, nearby support/workforce row actions,
public search history and truthful vehicle/order presentation are implemented.
Local acceptance covers 128 distinct corrected browser cases across seven exact
sizes in installed Edge and Chrome; these are synthetic emulation, not real-role,
provider, storage or physical-device acceptance. Focused units passed 81/81;
integrated exact-source CI and final profile screenshots remain required.
No migration, production record write, permission change or capability activation
is introduced by this audit batch. F02 email suppression is CONSENT_WITHDRAWN:
no retry. Real product media/fitment evidence, service duration and new workforce
duties remain business inputs. Existing purchase/release work below is preserved.
Full finding dispositions and evidence: `frontend/docs/CONSOLIDATED_AUDIT_20261103.md`.
Publication is pending compatible backend/candidate checks and exact-master CI.

### 3 November: payment-offer implementation verified; final viewport evidence running

Application source 88ed8694c5292f20c3996e92c643635637219e56 passes all three
required workflows: frontend 41692215321, backend 41692215106 and secrets 41692215043. Frontend production checks pass 1,399 unit cases with 12 existing
skips. Chromium runtime passes 21/21 with no skips or flaky cases. Backend
migration replay/db:check, types/lint and all workflow stages pass, including
82 focused purchase checks and 88 guest-flow cases. This is isolated/synthetic
evidence; no real provider, role or physical-device acceptance is implied.

Artifact 13258915500 (2,149,767 bytes) is preserved locally under
C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/runtime-ci-88ed8694/.
Inspected 320/1440 guest-order screenshots: the corrected pre-payment wording,
readable controls and payment/refresh spacing are visible. Earlier 079ca9ee
screenshots provide the safe same-fixture visual baseline. Account error screenshots
were captured before smooth scrolling completed; test-only d52c8cb9590f205d7697d6e4ab1a3a26950c1c34
now requires the entire alert to reach the viewport before capture. Its frontend
workflow 41694435584 was cancelled after the consolidated audit merge superseded it.
Current master 7384abf8 includes d52c8cb9. It was fast-forwarded without losing either
implementation, and both sets of verification notes were retained. Combined frontend
41695288681 and backend 41695288523 remain running; secrets 41695288500 pass.
Earlier 88ed8694 results do not prove the entire newly combined source.
Follow-up: combined backend 41695288523 completed successfully; frontend
41695288681 remains active. The final alert-viewport evidence is still pending.

Read-only production checks at approximately 18:04 UTC confirm browse_enquiries,
checkout/new booking requests disabled and finance Draft. Four public service
records return no workbook/development-provenance wording. At 18:23 UTC the complete
public product list has one Engine Oil Filter (89fd9258-c580-43e9-9040-c7e52623e82d):
description, photos, brand and manufacturer part number are absent, and no public
compatibility records are returned. Family REPLACEMENT_PART, condition NEW and
type OIL_FILTER are present. These are precise operator follow-ups, not licence to
invent facts or suitability. No real product, stock, price or financial data changed.

Next package: integrate committed calendar/reschedule/timing work through add274bf
while retaining the current automatic purchase implementation and immutable history.
Do not import the alternative unshipped D04 table-creation migration as a duplicate.
D02/D03/D05-D17 and real operational/provider acceptance remain in full scope.
No production publication, shared migration or capability activation occurred.
Postflight C: 21.34 GiB at 18:41 UTC. Verification notes remain local for the next source batch.

3 November changed-offer feedback follow-up: f6329e33 passes the full backend
workflow 41689948148, including 82 focused purchase checks, 88 guest-flow cases and
the affected payment concurrency/provider-port/expiry regressions. Frontend
41689948280 passes compiler, lint, build and 1,398 unit cases (12 existing skips);
browser results are 19/21. The two new account error cases expected raw server text,
but the shared client correctly displays trusted mapped messages. The new
PURCHASE_OFFER_CHANGED response now has a specific safe refresh/review instruction;
the fixture deliberately supplies unrelated raw text and checks it stays hidden.
A local 45-case API/payment unit run, backend compiler/lint and scoped frontend
lint pass. Updated final browser/error screenshots and exact-source CI remain
required. The successful guest browser cases include the corrected 12px spacing
at 320/1440; their new screenshots still need visual inspection. No production
release, shared migration or capability activation occurred.

3 November 18:02 UTC follow-up: source 29b7975d backend run 41689033316 passed
migration replay, schema checks, compiler/lint and 81/82 focused purchase checks.
The new account HTTP case lacked the required trusted Origin header and stopped at
CSRF before reaching the offer check. The fixture now supplies the header; the
guard is unchanged. Later database suites did not run and are not counted as passes.
Inspected safe 079ca9ee phone/laptop cart and confirmed-state screenshots. They
exposed touching guest payment/refresh buttons; the shared approved-offer wrapper
now has explicit spacing and a rendered minimum-gap assertion at 320/1440. These
latest corrections and the final screenshot comparison still require CI.

### 3 November 17:44 UTC package: displayed-offer payment binding

Target 18:44 UTC. Account and guest payment creation now carry the identity and
revision of the checked offer displayed to the buyer. Under the existing order
lock, a new intent rejects missing/stale identity before creating any payment.
Original-key receipt recovery remains available without revalidating a revoked
offer; a supplied different offer cannot reuse that key. Initialisation still
rechecks the private financial/evidence binding, and capture accounting is unchanged.

The account retains the original body for uncertain retries and discards it on
session change. Guest checkout uses its displayed approved review directly.
There is no new staff approval, checkbox or customer screen. Existing checked
stock, ownership, amount, finance and provider controls remain authoritative.
Removed contradictory guest summary wording which placed final checks after pay.

Backend types, script types and lint pass. Review/safe-view/Help units pass 45/45;
frontend payment/suitability/staff-review units pass 27/27 and scoped lint passes.
OpenAPI export/types are regenerated; 438 paths and 514 operations still match.
New isolated account HTTP and guest cases cover missing/stale offers, exact original
receipt recovery and mismatched-key denial. Updated provider/lifecycle fixtures
explicitly read their synthetic checked offers. The 21-case browser suite now
checks transmitted offer identity and changed-offer handling at 320/1440.
Those database and browser executions remain pending CI.

Parts Help advances to v13; audience, eligibility, guide targets and flags stay
unchanged. No new migration is added in this package, no shared database or real
record is changed, and no new production publication or capability activation
occurred. Current source remains a candidate for the full D01-D17 goal. Parallel
booking/timing and dashboard work remains preserved for later verified integration.
C: about 22.2 GiB; hosted checks handle production builds.

3 November 17:14 UTC carry-through follow-up: recovered guest orders now clear
only cart lines whose saved vehicle configuration also matches. A changed or cleared
vehicle choice in another tab is retained even when product/quantity are identical.
The saved checkout receipt must confirm the requested configuration. Updated cart
units pass 23/23 (overlap the earlier 50-case run; do not sum them). Guest checkout
fixtures no longer invent a vehicle choice/approval for an unconfigured cart; the
payment journey explicitly seeds its synthetic chosen vehicle. The fixture-only
browser suite is 21 cases. Database/browser results for migration 92 are still pending.

### 3 November 16:33 UTC package: checkout vehicle carry-through

Target 17:33 UTC. Current source carries the explicit Parts-page vehicle/specification
choice into the account cart or existing browser guest cart, displays it for review,
preserves it on quantity-only edits and replaces/clears it on a new product add.
Checkout revalidates the actual selected configuration against current approved
fitment and reserves real available stock automatically when eligible. Unresolved
fitment saves the known configuration on the unpaid order for review; it is not
silently discarded. Clear-cart review now detects a changed vehicle choice.
Quantities, server pricing, promotions and guest/account ownership stay authoritative.

Forward migration 92 adds only nullable CartItem.vehicleSelection and an object
constraint. Existing rows remain NULL; no backfill, destructive operation, grant
change or shared migration was performed. Client generation used a generation-only
loopback configuration, not an application connection. Canonical OpenAPI/handbook
and frontend types are regenerated: 438 paths/514 operations still match routes.
Parts Help advances to v12 without audience or guide-target changes. Removed a
remaining guest-cart sentence that incorrectly placed suitability checks after pay.

Local backend compiler/lint, eight Help cases and 50 focused frontend cases pass.
Three added isolated cases verify account quantity/vehicle preservation and single
stock holding, honest guest unresolved configuration and stale-clear protection.
Database replay/new database cases remain pending CI. Two new browser cases at
320/1440 take a selected guest cart to its payment step (21 runtime cases total),
using explicitly synthetic API data. No provider or real business record is touched.

Previous f1f9acaf backend 41675282098 and secrets 41675281845 passed. Frontend
41675281937 passed compiler/unit/build, then stopped on quality-register formatting;
that document is formatted now. Its browser step did not run. The earlier verified
31c292dd 19/19 evidence must not be represented as a new-source browser pass.

Remaining D04: bind new payment creation to the displayed offer revision, verify
notification/real-role/provider behaviour and complete affected acceptance. D02/D03/
D05-D17 remain in the full objective. This package neither publishes nor activates
new payment/booking capabilities. Current C: about 22.68 GiB; heavy builds use CI.

### 3 November 16:32 UTC package boundary: review screens verified, final layout polish pending

Source 31c292dd passes frontend 41673219268, backend 41673219659 and secrets 41673219336. Frontend production checks include 1,386 passing unit cases and 12
existing skips; Chromium runtime is 19/19, no skipped or flaky cases. The six new
cases cover account explicit reuse/fresh checking, guest saved-pending refresh,
Admin reasoned decisions, dialog Escape/focus return and no overflow at 320/1440.
Axe checks pass on editable and approved customer states. This remains synthetic
browser/isolated database evidence; real roles, providers and physical devices
are not accepted. Migration 91 was replayed in CI only; no application DB change.

Safe artifact 13248169300 (1,679,586 bytes) is downloaded under
C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/runtime-ci-31c292dd/.
Inspected phone and laptop before/after states, guest pending and staff dialog.
The images contain synthetic fixtures. Phone selects visibly clipped long labels;
those are shortened, quotation eligibility remains beside the control, and the
confirmed panel now links directly to the payment section. Laptop part fields
use responsive columns. These final source refinements need a fresh exact-source
check and screenshots; do not extend the 31c292dd pass to untested later changes.

Still outstanding in D04: explicit displayed-offer binding on payment creation,
checkout vehicle carry-through and operational notification/role/provider acceptance.
D02/D03/D05-D17 remain in the full objective. No live purchase/booking/payment flag,
credentials, real records, owner-only permission or production release changed.
Latest C: reading 23.02 GiB; no new local build, install or database was created.

3 November 16:19 UTC verification follow-up: aed43c10 passed backend
41670149247 and frontend production checks (1,384 passed, 12 existing skips),
but browser run 41670149228 finished 15/19. All 13 availability regressions and
two guest cases passed. Two staff cases exposed shared dialog focus capture after
the opener's fieldset was disabled; two customer cases used malformed fixture
responses missing required metadata. The fixtures are corrected without relaxing
API validation. Guest acceptance now waits for the saved order refresh rather
than accepting an uncertain outcome. Shared dialog focus tests pass 6/6 locally.

Supplier controls are unavailable without an accepted quotation; their confirmation
summary includes validity and arrival dates. The additional Lagos-time supplier UI
case passes (staff suite 5/5). Editable vehicle fields now receive an explicit Axe
check in the browser. The corrected exact-source production/browser checks remain
required; no new live-role, provider or physical-device acceptance is claimed.

3 November 16:02 UTC UI follow-up: source ebc62510's frontend check stopped
at two type errors indexing the shared dynamic qualifier shape. The schema now
preserves those qualifier types at the source. New customer/staff detail reads
also expose only supply kind and genuine supplier arrival estimates; private
reviewer, evidence, supplier-reference and reservation fields remain excluded.
Local backend projection 8/8, compiler and lint pass; customer/staff/payment
fixture units pass 25/25. The next exact-source build and 19 runtime browser
cases, including six new purchase cases, remain required. No live acceptance is
claimed and no capability was activated.

### 3 November 15:32 UTC package: customer/staff review screens in progress

Target 16:32 UTC. Current source 1f573fd4 passes all three exact-source workflows:
frontend 41664863114, backend 41664863113 and secrets 41664863132. These are source,
synthetic-browser and isolated-database results, not a live activation. Source
migration 91 remains unapplied to the shared application database.

This package adds the shared account/guest suitability form and optional explicit
reuse of previous matching product configurations. Prior approval, prices and
stock promises are never copied. Unknown details can be submitted without invented
vehicle information. Successful automatic checks leave optional changes collapsed.
Pending and uncertain requests have recovery/refresh actions; current-version and
revision checks protect identical retries. Drafts are in memory and discarded on
access changes. Payment and fulfilment remain distinct.

Admin/Super Admin order detail now has the existing authorised exception decision
form: current version/revision, reason, branch stock or actual supplier confirmation
and arrival window on an accepted quotation. Existing shared review dialog is used;
Staff permissions are unchanged. Parts Help advances to v11. Local focused fixture
units pass seven customer and four staff cases; scoped frontend lint passed before
final copy refinements. A local full TypeScript attempt exhausted its 768 MiB heap;
no compiler pass is claimed for this UI. Hosted full checks and six added phone/
laptop runtime cases (19 total) with safe screenshots are pending.

Unfinished: final offer supplier estimates in safe customer projections, reviewed
customer acceptance binding, notification delivery acceptance, checkout vehicle
carry-through and all remaining D02/D03/D05-D17 requirements. No real records,
provider credentials, payment flags or owner-only permissions were changed.

### 3 November: independently closed booking links

Rendered testing found full-mode service cards still offered Request a visit
when booking was independently disabled. Shared public/customer entry points now
use booking/inspection capabilities. Fixed local 320px and 768px cases pass; the
1440px case was interrupted by the preview's disk-reserve shutdown and is unverified.
Hosted CI now reuses its production build for 13 isolated runtime regressions at
320/768/1440, including stale/error/offline/draft recovery and no JavaScript.
New-source CI results remain pending. No live flag or permission changed.

Additional first-package evidence: the final release-boundary suite passes 71/71
(including fail-closed omitted controls), and separate process/address checks pass
26/26. These runs overlap the initial 103 cases and are not a summed unique total.
Backend/Frontend TypeScript, backend script types, repository backend lint, scoped
frontend lint, formatting and diff checks pass. Review-only production template
adds only eight disabled module controls across four components; existing settings
are preserved and no live configuration changed. Source checkpoint awaits exact
CI and rendered acceptance; full D01-D17 objective remains active.

### 3 November: independent appointment/purchase controls - active source

The self-contained brief D01-D17 supersedes the earlier audit-complete scope.
D01 adds independent server controls, guarded route availability and client
validation of independently closed full-mode modules. Restricted modes and draft
recovery remain. Focused backend 103/103 and frontend 20/20 tests, both compilers
and backend lint pass. The thirteen-case rendered run was stopped incomplete
following a disk-reserve failure; no browser acceptance is claimed. Current
production remains browse_enquiries; no actual flag, policy or permission changed.
Continue pre-payment parts review, staged service charges and remaining D05-D17
operations using the existing tracker/report ledger.

### 3 November 2026: Final integrated audit publication and coverage boundary

Application fabbe7a6 is published on both custom domains and backend adc7be72
(ACTIVE16/16, schema89). Integrated held 122/122 and separate authoring/search30/30
pass with no skipped/flaky cases. Final actual public 16 HTTP/8 rendered views pass.
Phone390/laptop1366 screenshots inspected, including complete team photograph;
synthetic private aftercare320/1366 reviewed. Earlier pending-publication entries
below are historical. See the completion tracker and final audit report for receipts.

Coverage includes recorded 320-1440 widths, sidebar states, keyboard/touch, focus,
forced colours, loading/error/disabled/recovery, image stalls/failures, no-JS,
200%text reflow and three real-time carousel loops. Later owner-approved laptop
hover continues rotation; explicit/focus pause stays persistent. Shared vehicle,
fitment, product/inventory, enquiry, booking/order/aftercare primitives are covered
with fixtures. This does not establish actual-role, physical-device/Safari, full
screen-reader, provider test-mode or real push/email delivery acceptance.

Highest remaining acceptance: authorised real operator journeys, product source
information/evidence, workshop capacity decisions, financial policy and controlled
merchant/delivery tests. All transaction gates and independent/owner-only controls
remain. Browsing/enquiries published; purchasing/booking activation not approved.
No further engineering claim is inferred from build success alone.

### 3 November 2026: Home and aftercare integration checkpoint

Preserve the concurrent signed/CI-green Home merge 3ddb55f7 while integrating the
87-case aftercare acceptance and populated database recovery evidence. Only the two
checkpoint documents conflicted; both entries remain below. Global typography and
the separate Home media area need hosted acceptance on the combined source, including
the affected dashboard regressions. Backend/migration/safety inputs are unchanged;
no additional role, provider, physical-device or activation claim is made.

### 3 November 2026: Held aftercare regression acceptance and recovery gates

Signed source 80cba6c2 passes all three exact-source CI gates (frontend 1,360 passed,
12 existing skips). Its held candidate passes the complete affected 87-case browser
run with no skips/flaky cases. Synthetic 320/1366 captures were inspected; other
sampled phone/tablet/laptop widths, keyboard focus, loading/error/denied states,
draft/recovery and role boundaries in fixtures pass. The initial held
85/87 failure was an ambiguous alert selector; four focused cases and the final
87-case run pass with an overview-specific assertion, keeping both legitimate notices.
Fresh populated 87 -> 89 recovery rehearsal and runtime privilege checks pass;
production schema remains 87. Both custom domains remain on the published 333c3a22
frontend. Temporary held review access was revoked and its credential files removed.
See the current completion tracker for exact receipts, failed attempts and remaining
packaging, guarded migration, publication and actual-role/provider/device limits.

### 3 November 2026: Distinct Home photographs and semantic typography (local acceptance)

Owner brief 6.4–6.6 implemented on isolated `codex/home-photo-composition-20261103`
from `57d58e0d`, preserving other agents' dirty worktrees. Genuine photographs now
have their own 3:2 area beside laptop copy and below mobile text/CTA. Home copy
is shorter and destination-specific. Nippo heading / Quicksand interface tokens
replace conflicting concrete overrides across public, auth, Help/Learn and role
dashboard styles. No permissions, commerce capabilities, database or business
records changed. Historical AI-image source informed hierarchy only.

Local Edge acceptance passes 21 carousel cases across nine widths, 14 font cases
across Customer/Staff/Admin/Super Admin and public/auth/dialog components, eight
units, compiler and scoped lint. Final 390/1366 layout reruns pass 2/2 after copy
cleanup. Separate empty/populated/503 fixture scenarios and product retry pass.
Final all-slide phone/laptop and complete-page screenshots were inspected. Real
optimizer response bitmap dimensions/bytes were measured; no quality increase or
replacement image generation was needed. See HOME_PHOTO_COMPOSITION_20261103.md
for history, copy diff, image pipeline and exact limits. Local Next is 16.3.8;
exact-lock 16.4.3 CI, hosted acceptance and release integration remain gates.
Physical-device, true browser zoom, full screen-reader and every protected page's
real-role acceptance are not claimed. Restricted features remain unchanged.

### 3 November 2026: Guest aftercare checkpoint (unpublished)

Guest cancellation/review, original-request recovery, operator payment destinations
and shared account record presentation are implemented in the current working tree.
The latest isolated backend run passes 71/71 across nine suites, including captures
verified after cancellation; all 89 migrations and runtime privilege checks pass.
Frontend TypeScript passes. Guest/operator browser evidence is now 12/12, including
320/768/1366px and sampled Axe; 320/1366 screenshots were inspected. A separate
79-case shared regression run was interrupted below the disk reserve, after 41
logged passes and one reason-label failure; the other 37 remain unverified. The
clear cancellation label is restored and quotation requirements use a separate
helper; the repair still needs rendered verification. The overview parser now
keeps only valid guest refund order destinations while stripping unrelated resource
metadata; all 35 affected units pass after its initial 33/34 failure. Learning,
content register and CI coverage are updated. Final source/CI and release checks,
including the remaining rendered regressions, remain outstanding. No actual role,
provider refund or physical-device acceptance is claimed. See the current completion
tracker checkpoint for evidence, disk interruption and retained cleanup candidates.

### 3 November 2026: Private guest invoices and receipts verified (source only)

Quotation source 2ba96033 is signed/verified and passes frontend 41585900297
(1,356 tests; 12 existing skips), backend 41585989863 and secrets 41585900375.
The earlier merged-source frontend check failed one obsolete Help wording assertion;
the corrected three-mode test preserves optional accounts and exact review before
payment. Concurrent 72ac8471 service-description publication is preserved: those
three protected editorial updates are complete, with prices and durations unchanged.
Published application runtime remains 333c3a22 / schema 87; commerce stays closed.

Guests can open their issued parts-order invoice and download or explicitly share
its PDF, and obtain a receipt only for verified settled payment. The existing
invoice snapshot, integer totals, source ownership, refund summary and private PDF
headers/body bounds remain authoritative. Matching email never grants account
records. A draft invoice stays withheld. History remains readable in limited mode;
catalogue mode closes these reads. Account/administrator invoice layout and document
actions are shared at source. Private links grant no access by themselves.
Document preparation checks current guest identity before and after fetching;
revocation and buyer changes clear the prepared file/review. A mismatched billing
reference cannot render the guest invoice or its export controls.

Isolated guest-documents-native-4a7def24132347dfab132b0af9ee0404 passes 54/54
across six suites, including seven guest document cases, existing guest payments,
Admin invoice discovery/detail, document authority and HTTP boundaries. All 89
migrations replay; schema/no-drift, db:check and runtime non-owner/no-DDL/no-TRUNCATE
checks pass. Successful task data was removed. Guest document browser final 9/9
and unchanged account invoice 36/36 pass: 45 distinct cases across the recorded
runs, not a single 45-case invocation. Phone/tablet/laptop layouts, keyboard/share
focus, failed reads, malformed PDF, buyer mismatch/revocation and receipt download
are covered. Sampled guest sharing Axe reports zero violations. New guest screenshots
at 320/768/1366px contain synthetic information only.

Parts-fitment v7 adds document access/privacy guidance without changing its five
steps, public gate, guide targets or practice permission. Learning/terms units pass
13/13; document download and Help mode units pass 17/17. API validates 432 paths
and 507 mounted operations. Production and targeted test types, scoped frontend
lint, backend repository lint, script types, format and secret checks pass.

Guest cancellation/aftercare and operator refund-review integration remain next.
Fresh populated restore, compatible recovery images, exact-source CI and held/public
verification remain mandatory before publication. No provider/email delivery, real
role, physical-device acceptance or activation is claimed; PDF delivery here means
an explicit browser download/share with synthetic fixtures. No real financial or
customer record was changed. Full purchasing/site launch readiness remains open.

### 3 November 2026: Service description authoring completed

The restored authorized Chrome session completed three normal Review changes /
Confirm save operations on the production Services workspace. Each returned
Service saved. Only the full description was edited; names, URL names, categories,
short descriptions, active states, fixed prices and durations were preserved.

- Wheel Alignment: NGN 4,000; 60 minutes; seven-day warranty wording retained.
- Comprehensive Vehicle Diagnostics: NGN 8,000; duration remains unknown.
- Generic Lube Oil Service: NGN 8,000; duration remains unknown; the distinction
  from Basic Oil Service and compatibility/material conditions remain explicit.
- Tyre Change was not edited and still displayed NGN 1,000 and 30 minutes.

All three real public service-detail pages displayed the exact saved copy and
unchanged price/duration after the saves. Internal workbook/discount notes are
removed at their record source, not hidden by a presentation filter. Public
Wheel Alignment anchor navigation brought About this service into view without
an unwanted container outline. Safe screenshot:
C:/Users/PC/AppData/Local/Temp/aat-wheel-description-20261103.png.
No booking, payment, fitment approval, permission or policy record was changed.
These live editorial changes require no application redeployment. The previously
recorded admin-access blocker for these three edits is resolved; older pending
notes below are historical. The documentation follow-up at 8fe2ece5 passed
Frontend 41430768107, Backend 41430768169 and Secrets 41430768220.

Financial activation decisions, provider acceptance, actual operational coverage,
physical-device keyboard and full screen-reader/unsampled real-role limits remain
as listed in the mobile completion ledger and finance review packet. They are not
newly approved or claimed complete by this editorial acceptance. Disk preflight
passed at 22.56 GiB with a 0.1 GiB allowance; no builds, Docker resources or database
maintenance were needed.

### 3 November 2026: Guest quotation journey verified (source only)

Previous screen source 8e0413d6 passes exact-source frontend 41579358622
(1,356 tests; 12 existing skips), backend 41579670715 and secrets 41579358706.
Published runtime remains 333c3a22 / schema 87; transactions remain closed.

Authorised staff can issue a seven-day quotation to the actual email on an open
public parts enquiry. The encrypted notification uses the existing delivery controls.
Private guest access lists only explicitly guest-addressed offers, excluding account
records and drafts even when an email matches. Acceptance rechecks the current
revision, expiry, branch, session and CSRF, then uses shared exact-price checkout to
create one unpaid order. Unknown responses recover the original receipt; payment,
final stock allocation and collection readiness remain separate. Decline and replaced/
expired offers have explicit states. Focus refresh retains drafts; buyer changes clear
them and close reviews. Shared review confirmation also respects capability failure.

Final isolated guest-quote-flow-native-44555a97811c49c89b44d05056dc4779 passes
61/61 across six suites, including actual guest HTTP reads/acceptance/decline,
concurrent duplicate acceptance, same-email account isolation, immutable quote money,
revoked issuers, closed capabilities, fake-gateway payment and separate staff final
review. All 89 migrations replay; no drift, db:check and non-owner/no-DDL/no-TRUNCATE
runtime checks pass. Successful task data was removed by its guarded harness.
Guest browser 9/9 and existing account/Admin quotation 7/7 pass: 16 distinct local
fixture scenarios, including 320/768/1366px, keyboard, draft/identity changes, uncertain
recovery, failed reads, branch/expiry and capability loss. Sampled modal Axe checks
report zero violations. Viewport screenshots contain synthetic information only.

Parts-fitment v6 now documents optional accounts and private guest quotations while
retaining its five steps, public eligibility, guide v3 targets and practice boundaries.
Learning/quotation units pass 13/13; existing frontend cart/learning units pass 18/18.
OpenAPI validates 428 paths and 503 mounted operations. No real customer, stock,
price, email, payment, provider or production record was changed for these checks.
Actual roles, delivery, provider test mode and physical devices remain unverified.
Next: guest invoice/receipt access and delivery, cancellation/aftercare and operator
refund-review integration. Fresh populated restore, compatible recovery images,
exact-source CI and held/public verification remain release gates. No complete
purchasing or whole-site launch readiness is claimed.

### 3 November 2026: Guest cart/payment screen checkpoint (source only)

Public cart, explicit email verification, buyer-scoped history/recovery and exact
order/payment review are implemented. Native final 52/52; 18 distinct local browser
cases pass, including 320-1366px, keyboard, touch emulation, expiry, failed loads and
buyer changes. Sampled 320/1366 Axe reports have zero violations. Initial skip-link
and focus-refresh draft regressions were fixed. No real roles/providers/devices or
activation/publication are claimed. See the requirement row and existing full-audit
report; guest quotation, documents and aftercare/operator work remains next.

### 3 November 2026: Guest HTTP ownership boundary verified (source only)

Payment source 56cf0bd8 passes frontend 41572993041, backend 41572993099
and secrets 41572993042. Published runtime remains 333c3a22 / 87 migrations.

Guest API routes now use separate HttpOnly, SameSite cookies, single-use proof
bound to the requesting browser, trusted origins, IP/recipient limits and in-memory
CSRF. Account cookies, including MFA-pending sessions, cannot enter guest routes;
normal account session issuance clears guest browser cookies. Owned order listing,
original-key recovery, detail, payment preparation/initialization/verification are
wired to the shared engines. A matching email never grants account-record access.
Limited releases reject financial writes while retaining owned history and security
recovery; catalogue mode closes guest routes. No activation flag is changed.

Native guest-http-native-feeee3428b714c6594972f6a4d65b7c6 passes 50/50 across
five suites, including all 12 new HTTP cases, actual account login/session regression
and injected gateway ports. All 89 migrations replay, schema/db:check and runtime
non-owner/no-DDL/no-TRUNCATE checks pass; its task data was removed after success.
Public-launch/API/identity units pass 77/77 and the separate guest contract unit
passes 1/1. API validation passes 425 paths; all 500 documented operations match
mounted routes. Production/targeted-test TypeScript, repository lint, scoped format
and secret checks pass. Canonical API/handbook/frontend types are regenerated.

This is source and synthetic local evidence. Public guest cart, proof/review/recovery
screens, guest quotations and aftercare remain implementation work. No production
record, provider delivery or financial transaction was used. New populated restore,
compatible recovery images, exact-source CI and publication remain required. Actual
role/provider/device acceptance and recorded business decisions remain separate.

### 3 November 2026: Shared guest payment engine verified (source only)

Checkout source c104fd5b passes frontend 41570496205, backend 41570496387
and secrets 41570496259. Current published runtime remains 333c3a22 with
87 migrations and transactions closed. Guest routes and browser checkout are
not yet exposed.

Account and verified guest payments now share the existing intent, gateway,
verification and capture engine. Guest transactions require their own current
session, CSRF and owned order; account/MFA identities are never fabricated.
Amounts, currency, source expiry, original-key replay, competing attempts,
finance policy, encrypted checkout recovery and separate refund approval remain
mandatory. Paid does not mean allocated, confirmed or ready for collection.

Native guest-payment-native-d1d28bc7e2784388b8430790d40caafc passes 82/82
across eight suites, including 11 guest cases, both injected fake gateways,
existing account flows, initialization/target concurrency, capture accounting,
quotations and owner refund controls. All 89 migrations replay, schema/db:check
and non-owner/no-DDL/no-TRUNCATE runtime checks pass. Production and targeted-test
TypeScript and focused lint pass. The first run passed 81/82: a new replay test
incorrectly supplied a different key, which the existing competing-payment guard
correctly refused. The corrected test reuses the original key; no guard was relaxed.
Successful task database files were removed by their guarded harness; the failed
stopped cluster remains for investigation. No shared records, provider calls,
emails, activation flags or published deployments changed.

Next: secure guest HTTP/cookie boundary, public cart/review/recovery UI, guest
quotation acceptance and aftercare. Fresh populated restore, compatible recovery
images, exact-source CI and publication are required before release. Real-role,
provider test-mode and physical-device acceptance remain unperformed.

### 3 November 2026: Shared guest checkout core verified (source only)

Quotation source 573fb0ea passes exact-source frontend 41544725013, backend
41544724938 and secrets 41544724989; its signature is verified. Public runtime
remains 333c3a22 / 87 migrations. No guest routes or transaction flags are enabled.

Account and verified guest checkout now use one engine for current catalogue price,
branch/product eligibility, stock locks/holds, tax, discounts, invoices, immutable
contact snapshots and original-key replay. Guest proof/CSRF are rechecked under a
session row lock; guest IDs/emails/prices/totals from a body are refused. Guests use
separate ownership and never create a User or alter an account cart. Same-email
account/guest purchases share the existing per-customer promotion limit; disjoint
stock-row concurrency verifies promotion locking. Quoted totals cannot stack another
promotion. Guest reads remain scoped to their own orders, including after a limited
release closes new checkout. Catalogue mode still closes those reads.

Native guest-checkout-native-3bbaaf1cf6ae474b877cce3763cd7449 passes 52/52
across six suites, including 14 guest checks, existing account commerce, quotation,
identity/ownership and refund controls. Replay of all 89 migrations, no drift/db:check
and non-owner/no-DDL/no-TRUNCATE runtime checks pass. Fifteen commerce unit/API
boundary checks, production/targeted test TypeScript, repository lint and secret
checks pass. The first native attempt passed 51/52: Date object reference equality
in one new assertion was corrected to instant equality; no implementation guard was
relaxed. This package exceeded its hour review target; the overrun was reported.

Next required implementation is shared guest payment/verification, guest quote
issuance/acceptance, secure browser/recovery API and public cart/checkout/aftercare UI.
No complete guest purchase or provider acceptance is claimed. New populated restore,
compatible recovery images, exact-source CI and publication remain mandatory. All
unavailable real-role, provider and physical-device acceptance stays separate.

### 3 November 2026: Approved quotation validity enforced (source only)

Package started 2 November 23:03 UTC (3 November Nigeria time); review target
00:03 UTC. Ownership source 723aed01 now passes all three exact-source gates:
frontend 41541634035 (1,353 passed / 12 existing skips), backend 41541634168
(including 20 separate guest access/ownership checks) and secrets 41541634116.
Its signature is verified. Neither guest source package is published.

New parts quotations now use the actual approved seven-day policy and save its
provenance; service issuance shares the same terms helper. The authoring form
and confirmation show 7 days from issue instead of offering a custom date.
An obsolete new request with a custom expiry is rejected with a refresh message;
original-key receipt recovery keeps an existing offer's saved amount and expiry.
No issued quote, stock, price, quantity, fee, grant or activation flag is changed.
Public parts-fitment guidance advances to v5 with unchanged eligibility/targets.
Canonical OpenAPI/handbook/frontend types are regenerated without reformatting.

Final native guest-quote-native-255199c1a51b4cf8beed5f245a89e29d passes 37/37
across parts quotation, service lifecycle, booking policy and learning suites,
with 89-migration replay, no drift/db:check and non-owner runtime privileges.
Thirteen policy/learning units and seven rendered quotation cases pass. Browser
cases include customer 360/768/1280 and authoring 360/768/1366, keyboard order,
Axe, overflow and one submission; all account/provider data is synthetic.
Frontend/backend TypeScript, repository backend lint, focused frontend ESLint,
format, secret guard and 414-path API validation pass. An initial frontend lint
invocation selected the backend-only tool; actual ESLint then passed. Review-date
metadata was corrected after the native run and focused learning units pass.
Exact-source CI for this quotation fix is pending at this source checkpoint.

Production remains 333c3a22 / 87 migrations with commerce closed. Account-optional
cart, shared checkout/payment/promotion/quote/recovery and guest cancellation/operator
alerts remain implementation work. Fresh populated restore, recovery images and
actual provider/role/device acceptance remain separate; no whole-site readiness claim.
Continue the shared guest checkout work next. Report: docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md.

### 2 November 2026: Guest order/invoice ownership prepared (source only)

Guest access foundation 076fe87c passes all exact-source gates: frontend
41537902677 (1,353 passed / 12 existing skips), backend 41537902832 (including
12 guest-access cases on its own new database) and secrets 41537902804. GitHub
verifies its signature. This source is not published; current runtime stays 333c3a22.

The next source extension separates guest ownership on orders, invoices and
aftercare, binds invoices/aftercare to the same buyer as their source, makes guest
ownership/quote-recipient fields immutable, hides the internal recipient projection
and keeps genuine account ownership unchanged. Guest invoices use existing quantity,
amount and document snapshots. Account APIs do not claim guest records by matching
email. Financial request/approval authority and paid/allocated/ready separation remain.
Final native guest-owner-native-6b6d27f640984af7a7629bf0305ad4b5 passes 28/28 across
five suites, with all 89 migrations replayed, no drift/db:check and non-owner runtime
privileges. Migration/finance/refund/document unit/API checks pass 57/57. Production
and targeted test TypeScript, script TypeScript and repository lint pass. Exact-source
CI for this extension is pending at this checkpoint; no shared database was written.

Initial ownership runs retained failures: account-only invoice guard rejected guest
sources; an incomplete new SQL variable binding then broke isolated invoice creation
and was corrected; an added test was initially nested incorrectly and was relocated.
The final transactional, lock-bounded migration and changed-byte/rename review gate
checks pass. Both new migrations pin their first local LF format for portable checksums.
The reviewed name/hash exception does not waive the new populated restore rehearsal,
fresh backup, compatible recovery images or publication gates. Earlier schema-unchanged
restore evidence cannot cover this change.

Continue the full audit: shared guest checkout/payment/stock/discount/recovery,
quote issuance/acceptance, public cart and guest cancellation/operator alerts still
need integration. Parts-quotation expiry must enforce the recorded seven-day policy;
custom 1-30 day expiry is a confirmed remaining implementation defect. Keep all
commerce/booking/provider gates closed. Report: docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md.

### 2 November 2026: Guest purchase access foundation (source only)

The approved account-optional purchase work has started with a separate PurchaseGuest
identity, browser-bound encrypted single-use email proof, expiring opaque sessions,
explicit read/write CSRF checks, rotation/revocation and bounded expired-state cleanup.
No public route is mounted and no guest checkout/payment is claimed available.
User/CustomerProfile and commercial rows are unchanged. A new additive migration is
prepared, client regenerated, and a fresh isolated PostgreSQL replay passes all 88
migrations, no drift/db:check and non-owner/no-DDL/no-TRUNCATE runtime checks.
Twelve guest service/worker checks plus four existing identity/runtime HTTP checks
pass (16/16); email uses an injected fake transport only. Five identity primitive
units, production TypeScript, repository lint/secret guard and changed-file format
checks pass. The first run passed 14/15; a nonexistent MFA field in one new fixture
was corrected to the real active-factor model. Failure evidence is retained.

This foundation is not a complete guest journey and has not been published. Current
public runtime remains 333c3a22 with 87 production migrations and transaction gates
closed. Next: guest-owned orders/invoices/aftercare, shared checkout/payment pricing
and reconciliation, public cart/recovery UI and cross-owner lifecycle tests. A new
populated restore rehearsal and reviewed forward rollout are mandatory before any
schema publication; the earlier unchanged-schema restore receipt cannot cover this.
Full audit remains active; no additional owner decision or sign-in is requested.

### 2 November 2026, 21:58 UTC: Runtime capability and Help repair published

Runtime 333c3a22dde455274044331e30608f9b2cb2eef4 is published on apex/www as
frontend dpl_7WepmwodVU3tgjZKaMN3XXdiMk6Q with matching ACTIVE backend
c65d74ac-45e6-4b65-b410-fd4adc2bd25e, 16/16, four verified digests and readiness 200.
Exact-master frontend 41528634610 (1,353 passed / 12 existing skips), backend
41528634892 and secrets 41528634612 pass. Native isolated HTTP 46/46, packaged
10/10 and held browser 99/99 plus two actual anonymous guide checks pass.
Published browser checks initially passed 20/22: two vehicle discovery reads received
429 with Retry-After. After respecting that window, the affected two pass 2/2;
all 22 distinct cases are verified, not a single clean 22-case run. Two additional
actual public guide browser checks and 16 anonymous HTTP checks across both domains
pass. Protected role browser cases remain fixtures; no real-account acceptance.

Home-next-step v5/service-request v17 are live, with 12 guide steps and private
vehicle-operations 404. Shared runtime availability, separate booking/finance gates,
stale/offline draft protection, public MPN search, partial Help retry and safe owned
booking/Allie service descriptions are released. Earlier held/recovery entries below
are historical and retained. Full audit stays active: account-optional purchasing is
the next engineering item; real-role/provider/device acceptance remains separate.
No schema, business record, price, grant, policy or activation flag changed.

Fresh verified backup and pre/post strict-TLS/schema/least-privilege/eight-worker
checks pass; temporary firewall access is removed. The 09:33 UTC populated restore
is reused only for unchanged schema/safety scripts; it is not a fresh restore.
Full receipt and safe public pictures: docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md.

### 2 November 2026: Help contract recovery; runtime batch remains held

Held source 0c200511 passed CI but final browser checks caught a 13-step public guide
against the existing 12-step client contract. Apex/www were not assigned that frontend.
The backend update had exposed the incompatible guide; its four images were restored
to the previous verified 022a8a06 source. Recovery 157e0b25-852e-479e-af13-a8ebbada3330
is ACTIVE 16/16, readiness 200; public guide v15 and 320/390/1440 service/contact/Help
flows pass. Strict TLS/schema/least privilege/eight workers/firewall restoration pass.
No schema, policy, business-row, price, permission or flag changes. Exact failure and
recovery receipts are in docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md.

Forward source v17 preserves the guide content within 12 steps and enforces the shared
bound; optional learning failures retain valid public FAQs and retry. This repair is
in verification, not published. Keep the complete audit active and the existing ledger;
account-optional purchasing remains the next engineering item after safe publication.

### 2 November 2026: Runtime capability convergence in verification

The next source package derives public/Help/dashboard/form availability from the
existing backend capability endpoint and actual write-guard mode, with separate finance
and booking gates. Server page guards and stale/offline/error/retry handling preserve
drafts and readable records; direct backend write guards remain authoritative. Public
service-copy filtering also covers owned booking details and Allie knowledge without
editing stored history or amounts. Home-next-step v5/service-request v16 preserve
eligibility and flags. Source checks are recorded in docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md;
exact-source release/safety checks are pending. Published runtime remains 022a8a06.
Account-optional purchasing is the next engineering item; full audit and operational
acceptance remain open. No permission, policy, financial or activation expansion.

### 2 November 2026: Complete-audit batch published; full goal remains active

Runtime 022a8a0609e377dcb2c794e6eb0e9f48ff90cf56 is on apex/www as frontend
dpl_GpKYZ8EeuUwpiuxFbzsHuARDHp9X with matching ACTIVE backend
d129d4df-56db-477f-9928-c84362f2d825, 16/16, four digests, readiness 200 and
8 fresh workers. Exact-source frontend 41505612149 (1,346 passed / 12 existing
skips), backend 41505544748 and secrets 41505544949 pass. Native isolated HTTP
48/48, packaged 10/10, held browser 99/99, published browser 22/22 and both-alias
anonymous HTTP 12/12 pass. Protected browser cases use synthetic role records.
Fresh backup/read-only TLS/schema/privilege/workers/firewall checks pass; same-day
populated restore reused only for unchanged schema/scripts. No business records,
prices, permissions, migrations or activation flags changed. Actual public v4/v15
learning and private 404 pass; actual account/device/provider acceptance is separate.

Authoritative current scope remains the requirement ledger in the UI quality register.
Next engineering item is shared runtime capabilities, followed by coherent account-optional
purchasing. No whole-site launch-readiness claim. Genuine product facts, recorded finance
decisions and operational/provider acceptance remain outstanding. Full results, retained
failed attempts, safe public pictures and policy-blocked synthetic cleanup are recorded in
[Full audit implementation](../../docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md).

### 2 November 2026: Full supplied audit is the active scope

The complete owner audit has now been read and reconciled against deployed 9be4e66b.
The authoritative requirement ledger is the Current full-audit requirement ledger in
frontend/docs/UI_UX_QUALITY_REGISTER.md. Earlier engineering-completion statements
refer only to earlier batches. Combined Help/catalogue search, a real customer month
calendar, explicit optional Enable, public wording/filter/contact/detail improvements
and an operator information checklist are in verification. Source-only work is not
claimed published. Current gaps include runtime capability convergence, account-optional
purchasing implementation, operational policy/provider and unavailable real-role/device
acceptance. Preserve published Admin/Super Admin operations and owner-only controls.
See docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md for checks and retained failures.

### 2 November 2026: Record authoring published; engineering scope verified

Runtime 9be4e66bb10716fd0066b9de26275f1ddcf88c55 is published on apex/www as
frontend dpl_4VjxHa2jJ9rULegr61vrZCweC9WV. Matching backend
3f6e7873-4d49-4ca1-8e7c-14571ea95584 is ACTIVE 16/16 with four verified
digests, readiness 200 and eight fresh workers. No schema, business-row, price,
grant or feature-flag change.

Exact-source frontend 41486816169, backend 41486665455 and secrets 41486665465
pass. Ten packaged, 69 final held and 19 deployed-route browser cases pass.
Private vehicle-operations v2/public vehicle-enquiry v5 preserve eligibility;
actual anonymous v5 and private 404 are verified on both domains. Pre/post
TLS/schema/privileges/workers, fresh backup and restored temporary-source rules
pass; same-day populated restore is reused only for unchanged schema/scripts.

Explicit View/Edit, laptop section navigation, shared record/copy/status patterns,
phone search and Staff date/countdown indicators are released. Inspection Help
reflects the enabled enquiries release. Existing hero, service imagery/prices,
favourites, filters, owner-only controls and financial gates remain intact.
Report, retained failures, actual evidence classes and safe before/after pictures:
docs/RECORD_AUTHORING_20261102.md. The four requested engineering batches are
implemented and verified within those classes. This does not close broader Item 6
or authorise commerce/booking/AI/provider activation. Real-role acceptance is
unavailable; actual devices/delivery/financial-provider acceptance and genuine
operator content remain separate. No repeated owner sign-in request or new policy
approval is needed for this implementation. Preserve the settled queue.

### 2 November 2026: Record authoring review checkpoint (superseded)

Explicit stock View/Edit and laptop sections, shared records-table/copy/status
patterns, full-width mobile dashboard search and Staff appointment timing are
implemented over c53530c4. Inspection Help now follows the current release.
Local role/state/regression checks are recorded in docs/RECORD_AUTHORING_20261102.md.
Private vehicle-operations v2 and public vehicle-enquiry v5 preserve eligibility;
no schema, business-row, price, permission or feature-flag change. Exact-source
CI, held candidate acceptance and compatible publication were pending at this
checkpoint and are completed in the published entry above. Actual account/device/
provider acceptance remains separate.

### 2 November 2026: Current full-audit requirement ledger

The owner supplied the complete Live Audit, Owner Decisions and Codex Brief on
2 November. This ledger now governs that full audit. Earlier statements about
completion refer to the preceding objective and released batches, not this audit.
Current public runtime is 333c3a22; the published receipt above supersedes source checkpoints.
No payment, booking, AI, delivery, deposit or reservation activation is authorised.

| Requirement                                           | Evidence and changed location                                                                                                                               | Current status / acceptance remaining                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 public internal notes; F02 approved service media | Published public-service-copy projection and shared service media; approved workbook amounts/quantities/history retained                                    | Published anonymous reads/media rechecked; owned booking and Allie projections also hide internal notes without altering stored source or commercial fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| F03 truthful actions and instructions                 | Service-group enquiry CTA retains canonical context; limited-mode empty Orders/Bookings copy corrected                                                      | Published shared runtime state, server page gates and stale/unavailable draft protection; 10 loopback runtime cases plus exact CI and held/deployed verification pass; no gate activated                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F04 genuine product information                       | Product editor derives missing family-specific facts and offers explicit edit/media actions                                                                 | Published; synthetic operator/reflow checks pass. Operator must supply real facts/photos/evidence; stock never approves fitment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| F05 dashboard search focus                            | Shared brand focus, four roles, expanded/collapsed sidebar and forced colours                                                                               | Released foundation; fresh local four-role checks pass, real accounts unavailable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F06 filters                                           | Single budget helper, concise Make/Model help, collapsed specialist groups, active fields/removable scope retained                                          | Published; held and deployed 320/1440 exact URL/pending/error-focus/reload checks pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F07 customer language                                 | Public services/vehicles/oil previews, illustrative-image label and Compatibility not confirmed                                                             | Published; retain actual service names until scope naming is established                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| F08 vehicle detail                                    | Consolidated secondary specs, omitted meaningless empty fields, retained owner fault and inspection area                                                    | Published; safe genuine public screenshots and held/deployed public detail cases pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F09 Contact                                           | One location block, concise direct-contact card and accessible map fallback                                                                                 | Published; anonymous phone/desktop handoff and Axe checks pass                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| F10 vehicle authoring; shared records                 | Published explicit authorised View/Edit, horizontal laptop sections, shared records/copy/status primitives                                                  | Already released; do not duplicate Admin repair. Actual Admin/Super Admin/assigned Staff acceptance unavailable; synthetic tests are separate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5.4 compatibility evidence/review                     | Existing Vehicle compatibility workflow, relevant fields, independent review/version/draft/recovery                                                         | Preserve; no compatibility approval or permission expansion; operational role acceptance remains unavailable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6.1 public combined search                            | Server-only public Services/Shop/Vehicles/Help reads, ranking, grouped links/view-all/errors/retry, native GET and Escape/Back                              | Published; JS-disabled HTML, query recovery, Close/Escape, MPN ranking and optional Help failure/retry pass. Public FAQs remain available when learning fails; no private search                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6.2 optional alerts                                   | Explicit Enable uses existing subscription lifecycle; Not now/settings, blocked/offline/account-tab safeguards                                              | Published; mocked invitation/permission checks pass. Real device registration/delivery/revocation/multiple-device acceptance remains unverified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6.3 real customer calendar/countdown                  | Owned month API query, Nigeria boundaries, stable paging, proposals across months, semantic dates/details, offline/session invalidation, Today/Escape/focus | Published; 16 distinct calendar fixtures, CI/native authenticated isolated HTTP and held/deployed calendar cases pass; real-account acceptance unavailable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6.4 retained carousel/media/favourites/radii          | Existing approved whole-team/hero/card assets, manual/focus pause and later owner preference that laptop hover continues autoplay                           | Published; retained hero regressions pass including three real-time autoplay loops, pause/resume, slow/failed images; physical devices/Safari unverified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Operational booking                                   | Existing request/confirm, proposals, customer response, capacity/resource checks and disabled deposits                                                      | No activation; reconcile actual approved hours/resources/responsibility/policy values, isolated lifecycle regression and authorised operational acceptance remain                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Account-optional purchasing                           | Owner-approved; published commerce remains closed                                                                                                           | Source: separate guest ownership/access, shared checkout/payment and public cart/verification/history/recovery screens. Native final 52/52; 18 distinct local browser cases; three cart units plus 35 existing payment/learning regressions pass. Guest quotations now pass native 61/61 and guest/account browser 16/16 with seven-day guidance v6. Guest invoice/receipt access and explicit PDF delivery now pass native 54/54 and 45 distinct guest/account browser cases across recorded runs. Aftercare/operator integration, fresh populated restore, exact CI/publication and actual provider/role/device acceptance remain required. |
| Payment/collection/finance                            | Preserve pay-first then final compatibility/availability review, separate paid/allocated/ready states, collection-only, seven-day quote validity            | New quotation seven-day enforcement is source-only, verified 37 native / seven rendered cases; existing offers unchanged. Actual provider acceptance and verified Tax/CAC, VAT applicability, percentage rounding and service-invoice timing remain separate owner/accountant items                                                                                                                                                                                                                                                                                                                                                           |
| Release and evidence                                  | Exact master CI, packaged safety, held-hosted checks, backup/recovery/read-only DB checks and alias verification required                                   | Batch published with exact-source CI, packaged, held, deployed and safety gates above. Whole-site readiness is not established; provider/physical/real-role evidence stays separate                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Current batch evidence and safe before/after paths:
[Full audit implementation](../../docs/LIVE_AUDIT_IMPLEMENTATION_20261102.md).
Earlier reports retain original asset-placement/workbook/role/release evidence:
[Service media](../../docs/PUBLIC_SERVICE_PRESENTATION_20261102.md),
[Search/focus](../../docs/PUBLIC_SEARCH_DASHBOARD_FOCUS_20261102.md),
[Dates/alerts](../../docs/APPOINTMENT_ALERTS_20261102.md),
[Record authoring](../../docs/RECORD_AUTHORING_20261102.md).

### 2 November 2026: Photographic hero published and verified

Runtime source 485fb2c57140ea020f297878582b3ee2558d48bc is published as
frontend dpl_8qztTisCborq3CBcEQNmvpmQfr2v on both verified public domains.
All three exact-source GitHub gates passed. All 20 hosted carousel tests and
42 contrast samples passed; public smoke found three successful destinations,
no horizontal overflow and zero page errors. Whole-team proportions and downstream
sections remain covered. Physical devices, Safari, screen readers and physical
background-tab behavior were not tested. No owner decision remains for this hero.

The final owner instruction wins: laptop hover continues autoplay; focus/manual
pause persists until Play. Seven-second timing, full genuine backgrounds,
directional overlay, cleaner brand heading, subject-aware crops and restrained
44px controls are delivered. Larger mobile text grows the photo-clear area.
Backend deployment 1597c138-919c-4470-b991-0add596837f9 remains ACTIVE, 16/16,
all four digests match its manifest and readiness is 200. Backend runtime/schema/
scripts are unchanged; no migration, database write, permission or feature-flag
change was made. Other audit/authoring work retains its separate status.
Full ledger and safe screenshots: frontend/docs/HERO_OVERLAY_20261102.md.

### 2 November 2026: Shared release public acceptance complete; authoring access pending

Published runtime 6f3cf203 is verified on apex/www as frontend
dpl_7HctXP7eYBDvCc9i7TnQsiG9hYgP, with ACTIVE backend
1597c138-919c-4470-b991-0add596837f9. Exact-source frontend 41425787830,
backend 41425787658 and secret 41425787671 checks passed. The owning release
completed the protected 87-migration rollout, populated restore preservation,
fresh backup, runtime privilege and eight-worker checks; see the vehicle-operator
release report and its protected receipts. No duplicate deployment was created.

Our final public privacy acceptance passed four cases: 320/1440 on apex/www,
actual released UI with synthetic API interception and zero AI writes. Final safe
screenshots were inspected. Independent unmocked public catalogue reads using
destinationsVersion=2 returned
privacy-and-allie v2 with scheduled-cleanup wording on both domains. Public access
to privacy-work returned 404. The default legacy catalogue intentionally omits
new destinations; its omission was investigated rather than called a defect.
Reports: %TEMP%/aat-privacy-clarity-public.json and
%TEMP%/aat-privacy-guidance-public.json. www resolves to apex as configured.

Three actual public service descriptions still contain workbook/discount notes:
Comprehensive Vehicle Diagnostics (800000 kobo, duration unknown), Wheel Alignment
(400000 kobo, 60 minutes), Generic Lube Oil Service (800000 kobo, duration unknown).
Prepared description-only edits are in frontend/docs/HOME_WORKSHOP_20261102.md.
Preserve all IDs, prices, scopes, warranties and unknown durations. Chrome currently
shows Sign In and a separate MFA tab; the owner confirmed no access is available.
No alternate authentication, direct database edit or permission change was attempted.
This authoring requirement remains incomplete. The latest owner authorization allows
finishing the shared release after safeguards; that release is now completed.

Financial/operational activation remains gated by the precise existing decisions
in the policy inventory and backend/docs/finance-review-20261101.md. Native-phone,
full screen-reader and unsampled real-role acceptance remain unverified. These
limits are not replaced by the 75 local service cases or the hosted/public fixtures.
The full goal is not declared complete while the service authoring item remains.

### 2 November 2026: Admin vehicle operations and workshop regression published

Owner-approved full Admin operations are released at signed master 6f3cf203;
owner-only controls and independent financial approvals remain restricted.
Backend 1597c138-919c-4470-b991-0add596837f9 is ACTIVE, 16/16; frontend
dpl_7HctXP7eYBDvCc9i7TnQsiG9hYgP is verified on apex/www. All three exact-source
CI checks, nine packaged checks, read-only predeploy, 87-migration db:check, API
readiness and all eight worker heartbeats passed. Four digest changes only.

Admin enrollment no longer hides the operational dashboard; price history and
document review record the authenticated User without manufacturing employee
profiles. Grouped NGN is exact. Staff scope, current access, MFA, versions and
committed-sale safeguards remain. Three isolated real HTTP flows, 41 workforce
regressions and 46 distinct hosted synthetic scenarios are covered. The full
browser run passed 41/46; all five harness failures were repaired and retested
in a nine-case final run. Four price cases passed again on the published route
with synthetic accounts/records. Real signed-in authoring remains unverified.

Both forward migrations passed after a fresh verified backup and populated
restore/replay preserving all original row hashes. A second fresh backup also
restored separately. Runtime ledger permission remained restricted; read-only
verification used the migrator. Live favourite removal was traced to a successful
request before migration, with existing rate-limit expiry; neither was undone.
No account roles, financial grants or real vehicle prices were changed for QA.

The Home/About work is retained: four unmocked public smoke cases passed at
390/1440px; three live autoplay loops, hover/manual/keyboard and slow/failed-image
regressions passed. Fresh safe screenshots were captured. The three new service
full descriptions still need the prepared removal of internal workbook notes;
normal authoring awaits the owner's sign-in. Final prices/scopes remain intact.
Physical Safari and a full screen-reader journey remain untested.

Reports: backend/docs/vehicle-operator-access-20261102.md and
frontend/docs/HOME_WORKSHOP_20261102.md. Earlier in-progress entries are historical.
Other agents retain their unrelated acceptance tasks. Bounded cleanup removed
32 superseded local image references; remote/current/rollback images, warm caches,
other tasks, databases and recovery evidence were retained. C: remained above 20 GiB.

### 2 November 2026: Privacy wording passes held production-build acceptance

Reused READY candidate dpl_4ELMasQqeXkWM1dAU1tqA8FRaxnS from source
1ff4a13c20e92b2b128ffeea9a3a915641f75350; no duplicate deployment was created.
Runtime source matches our test checkout (1610e37e) across frontend app/lib/config
and backend src/schema. Candidate and test revisions are recorded separately.
Both Allie disclosure-to-Privacy-Notice journeys passed at 320px/1440px (2 passed,
zero unexpected/skipped/flaky), preserving retention, backup/provider caveats and
zero intercepted AI writes. Safe final screenshots were visually inspected:
breadcrumbs and heading visible, readable mobile/desktop layout, support controls
present. Test uses a deployment-scoped provider cookie, no copied application
session, synthetic API responses and no real messages or paid calls.

Report: %TEMP%/aat-privacy-clarity-reused-hosted.json; screenshots in the matching
-temp output directory. This establishes held frontend production-build acceptance,
not backend privacy-guidance v2 publication or actual-domain acceptance. The other
agent retains ownership of its migration/backend release. Our signed service test
commit is local pending integration after that active release; no force push or
concurrent deployment. Public aliases and backend still require fresh final checks.

### 2 November 2026: Previously skipped service detail coverage completed locally

The 70-case service SSR gap is now verified as 75 distinct passing cases after
splitting two multi-viewport cases into independently timed cases. Source under
test was 0736f246 with the scoped test corrections below. Next 16.4.3 development
preview used only 127.0.0.1:3100 and an in-memory fixture at 127.0.0.1:5021;
all submissions were intercepted. No database, real booking, message, payment,
production feature flag or provider call changed. The original preview-start
rejection is retained; this attempt was approved after explicit isolation review.

Corrected stale test expectations to include the existing service-group context;
made anonymous enquiry fixtures actually anonymous and changed role before the
session-change event. Capture/launcher checks now run independently per viewport.
Application guards and runtime behavior are unchanged. Metadata requires a local
reserved .test canonical origin and indexing-enabled test configuration; this
setting was process-local only. Scoped ESLint, formatting and diff checks passed.

Evidence, not one clean run: initial report 51 passed/3 failed/16 not run; first
focused correction 3 passed/3 failed/13 not run; remaining run 19 passed/2 timed
out; unchanged two mobile image cases then passed. Distinct passing titles across
all four reports total 75. Failed traces remain. Mobile image timeouts occurred
in navigation/scrolling; their precise timing cause is not claimed resolved.
Reports: %TEMP%/aat-mobile-service-gap[-final|-remaining|-images]-20261102.json.

Coverage includes ten widths (320 to 1536), review/edit/receipt, exact request
context, CSRF/idempotency, uncertain outcomes, account changes, MFA, sign-in draft
recovery, no-slot preferred requests, field errors, policy/rate-limit recovery,
keyboard/Axe checks, launcher hit-testing, missing/failed records, structured
identity and portrait/landscape image framing. Synthetic review/receipt and image
screenshots were inspected. This closes the local fixture gap; it is not a hosted
production-build, physical-device or real-operation acceptance claim.

Temporary preview stopped; C: reserve passed at 24.20 GiB. No Docker resources
were created or deleted. Newer independent master fixes were preserved after the
run. b06da47f passed frontend 41424046471, backend 41424151992 and secrets 41424046514. Another agent's held 1ff4a13c candidate is building; no competing
production rollout was started. Both public aliases still serve d9473ad9 and the
backend remains ACTIVE dea3489e with no pending deployment at this check.
Privacy hosted acceptance and coordinated publication remain outstanding.

### 2 November 2026: Latest integrated checks

Release recheck: integrated source 0736f246 passed frontend run 41419703086 and
secret run 41419509934. Backend run 41419509832 failed its new Admin-operations/
owner-boundary step before reaching learning retrieval. The previously observed
retrieval failures are therefore not proven resolved. No failed check was skipped
and no release was promoted. Local preview was stopped after verification.

### 2 November 2026: Privacy disclosure rendered locally; publication held

Source 7e85858c: both Allie disclosure-to-Privacy-Notice browser journeys passed
at 320px and 1440px (2 passed, no skips/retries). They verified the plain retention
wording, 15-minute/one-hour limits, backup/provider deletion caveats, successful
navigation, no horizontal page overflow and zero intercepted AI writes. Local
Next 16.4.3 development preview reused existing dependencies; the API origin was
an unused loopback port and browser requests were synthetic. This is not hosted
production-build acceptance. Separate safe screenshots were visually inspected;
Privacy Notice identity/title matched and both captures had zero pageerror events.
Console-wide and physical-device acceptance are not inferred from that check.

Exact-source backend CI 41419120858 passed the corrected privacy HTTP assertion
and failed later on two vehicle-operations retrieval assertions. Frontend run
41419120999 was cancelled. Those unrelated changes remain with their owning agent;
no guard was weakened and no new production deployment was made. Remote master
0736f246 has only subsequent workflow/integration-test changes. Apex still maps to
dpl_626aFaqfA3CNdPtKC5f25Dv3SdPL. Fresh signed-in acceptance is unavailable per the
owner's latest response; earlier read-only acceptance remains historical evidence.

Evidence: %TEMP%/aat-privacy-clarity-local.json (2 passed),
%TEMP%/aat-privacy-clarity-320.png and aat-privacy-clarity-1440.png.
Held production rendering, passing exact-source checks and compatible backend
publication remain required. Existing financial/operational activation decisions
and all previously recorded device/role limits remain open.

### 2 November 2026: Privacy guidance v2 HTTP expectation corrected

The reconciled 95a7f45c backend CI reached the real isolated learning HTTP checks:
10 passed, one failed because the public privacy article assertion still expected
version 1. The expectation now matches the deliberate v2 editorial revision;
public eligibility, private-content 404, no-store/cache and provider-deletion
assertions remain intact. New exact-source CI and held rendered acceptance remain
required. This is our privacy correction, separate from the other agent's vehicle
operations rollout. Frontend production remains d9473ad9 until release gates pass.

### 2 November 2026: Plain-language Allie privacy explanations

Brief sections 3, 4 and 14: actual /privacy inspection confirmed customer-facing
"temporary turn receipts", "expired payload" and "retention worker" wording.
Allie disclosure, Privacy Notice and backend privacy-and-allie guidance now say
"temporary reply records" and explain that removal of expired conversation data
depends on scheduled cleanup. Encryption, 15-minute/one-hour expiry, session limits,
backup policy, provider deletion caveat, optional AI and support-message boundaries
remain unchanged. Privacy Notice policy version/effective date are unchanged;
editorial learning guidance advances to v2 so source-set invalidation remains truthful.

Focused backend privacy/role-guidance: 20 passed. Mixed retrieval run: 24 passed,
two unrelated vehicle-operations retrieval failures inherited from master 616e76d8;
those remain with their owning agent. Frontend mixed run: 31 passed, one Allie
initialization timeout; unchanged Allie file rerun passed all 23. Scoped frontend/
backend lint and formatting passed. New 320/1440 browser coverage checks disclosure,
privacy-link navigation, retained caveats, no AI writes and overflow; rendered checks
and coordinated backend/frontend publication remain pending. No feature, policy,
permission, provider configuration or schema change is part of this copy correction.
Frontend TypeScript passed. Current production stays d9473ad9. Other agents' migration/release work is not taken over.

### 2 November 2026: Administrator operations and vehicle price repair in progress

Owner selected full Admin operations with owner-only controls and independent
financial approvals retained. Enrolled Admin sessions now use the operational
dashboard and route boundary; Staff assignments stay scoped. Admin/Super Admin
vehicle price history and document review use authenticated User actors without
inventing employee profiles. Properly grouped NGN input normalizes exactly.

Source-only: two forward migrations, generated Prisma, empty isolated replay and
db:check (87 migrations), three actual isolated HTTP flows and 40 focused boundary
checks passed. Frontend type check and 16 focused units passed. Original document
constraint and fixture failures are retained. Hosted/production role acceptance,
exact-source CI, populated restore rehearsal, fresh backup/protected migration and
publication remain required. No real vehicle, asking price, role or grant changed.
See backend/docs/vehicle-operator-access-20261102.md. The completed workshop Home
release is separate and remains recorded below; other releases stay with their agent.

### 2 November 2026: Collapsed invoice filter recovery published

Frontend d9473ad9cfd5643b771ed693a7c54853db672974 is live as
dpl_626aFaqfA3CNdPtKC5f25Dv3SdPL on apex and www; both identities verified.
Exact-master checks passed: Frontend 41415052847 (1,319 passing units, 12 existing
skips; production build/types/lint/format), Backend safety 41415052703 and secrets 41415052449. Held-candidate browser checks: 26 passed, zero skipped/flaky/unexpected.
All four new source-filter cases then passed on the actual public route at 320px
and 1440px with intercepted synthetic records. Actual /parts responded 200 on both
domains; www resolved to apex. Safe candidate screenshots were visually inspected.

Before: invalid source reference or missing source type stayed hidden after filters
were collapsed. After: Apply reveals the panel, focuses the correction and preserves
the draft without an invalid invoice read/write. Customer-search, changed/recovered
fitment drafts, uncertain saves and denied/inactive/mismatched access regressions
passed. Existing field focus indication remains accessible. No business record,
permission, policy, financial gate or schema changed.

Backend dea3489e-0d93-4aad-9e0d-998fae51190b from 1224d942 remains unchanged;
four image digests/readiness and absence of pending rollout verified. Eight current
managed backups and the existing separate 85-migration restore rehearsal checked;
no new restore or database write. Actual signed-in invoice/fitment inspection is
recorded below; the one unclassified browser messaging error is not called resolved.
Physical-device, independent reviewer and broader unsampled real-role acceptance
remain open. Purchasing activation still needs the recorded owner/accountant and
merchant prerequisites. The full brief is not declared complete by this batch.

Evidence: private invoice-source-{ci,candidate,prepromotion}.json; Windows Temp
/aat-invoice-source-hosted.json (26 passed), /aat-invoice-source-public-final.json
(4 passed), and /aat-invoice-source-hosted/ safe synthetic screenshots. The initial
four hidden-field failures remain documented in the baseline evidence. No Docker
resource was created or removed; final disk reserve is checked separately.

### 2 November 2026: Signed-in acceptance refreshed; source-filter release held

The authorised browser session is now available. Read-only actual invoice checks
confirmed the empty state, branch choices and customer search disclosure. Actual
fitment inspection opened and closed the untouched legacy draft without a native
confirmation; focus returned to Edit rule. Draft version 0 and all six evidence
warnings remained unchanged. No fields were edited and no record was submitted.
One asynchronous listener/message-channel console error was captured on invoices;
its cause is unclassified. The temporary agent tab was closed. No physical-device
or independent reviewer acceptance is inferred.

Source-filter commit 7f77caf4 passed backend safety and secret checks. Frontend
production compilation passed but final quality-register formatting failed; this
follow-up formats the register. Corrected hosted acceptance and publication remain
pending; runtime b72eddd8 remains the verified production release.

### 2 November 2026: Collapsed invoice source-filter recovery

Actual public-route testing with synthetic records reproduced four failures: an
invalid source reference or missing source type stayed hidden after collapsing
advanced filters, at 320px and 1440px. The first exploratory run raced the URL
transition; the corrected regression explicitly waits for the hidden state.
Source now opens advanced filters for any invalid advanced field and defers focus
until the panel is visible. Draft values and existing validation remain intact.
Four regression cases require visible/focused corrections, preserved drafts and
zero invoice reads/writes from invalid submission. Focused ESLint and TypeScript
passed; exact-source CI and corrected hosted acceptance are pending. Production
remains b72eddd8 until the release gates pass. No policy or permission changed.

### 2 November 2026: Invoice search and fitment dismissal published

Source b72eddd86106bf54a741b65cfa5eb578f92fc5e4 is published as
dpl_DqdBns92iwTfuX9qfHYgi2B4erKN on apex and www; both identities verified.
Exact-master Frontend 41411747513, Backend safety 41411865203 and repository
secrets 41411747468 passed. The held production candidate passed 22 synthetic
browser cases with no skipped, flaky or unexpected results. Two additional
320/1440px invoice runs passed and their safe screenshots were visually inspected.
Invoice search covers selection, paging, refresh, retry and collapsed invalid-reference
focus recovery; fitment covers untouched dismissal, changed evidence confirmation,
reconciled draft discard, late hydration, invalid years and uncertain saves.
Payment search and denied/inactive/mismatched role regressions also passed.
Scoped invoice Axe and overflow checks passed. These are fixture-based protected-route
checks, not actual customer or financial transactions. Public /parts returned 200
on both domains, with www resolving to the apex.

Backend remains dea3489e-0d93-4aad-9e0d-998fae51190b from 1224d942; all four
image digests and readiness matched. No runtime backend or schema difference from
that release. Eight current managed backups and the existing separate 85-migration
restore rehearsal were rechecked; no new restore, database write or grant change ran.
Financial gates remain unchanged. The owner currently lacks signed-in access;
new real-role acceptance remains pending despite historical inspection below.
Physical-device, full keyboard/screen-reader and independent reviewer acceptance
remain unverified. The broader completion brief is not declared finished.

Evidence: backend/ops/digitalocean/.private/invoice-fitment-{ci,candidate,prepromotion}.json;
Windows Temp/aat-invoice-fitment-hosted.json (22 passed) and
Windows Temp/aat-invoice-fitment-visual/ (safe synthetic screenshots).

### 2 November 2026: Home and About workshop restoration released

Public Home/About source 1224d942 is live on apex/www, frontend
`dpl_Ehmd5TkgUMnWp2CHHZoUmp7CiTZL`, matching ACTIVE backend
`dea3489e-0d93-4aad-9e0d-998fae51190b`. Authentic images, complete team and lift,
correct card media, three authoritative featured services and accessible looping
hero are published. Final amounts: diagnostics NGN 8,000; four-wheel alignment
NGN 4,000; generic oil NGN 8,000. Existing tyre unit and package boundaries preserved.

Passing hosted evidence covers 17 Home scenarios and 26 About regressions: three
full real-time loops twice, manual/focus pause and restart, touch, stalled/failed
images, no-JS, doubled text and 320?1920px layouts. Final candidate and four
unmocked public 390/1440px cases passed. Axe found no violations in tested states.
Visibility is simulated; physical Safari/Chrome, full screen reader and field
performance remain untested. One image-load timing assertion failed; two controlled
delay repetitions passed, and its regression harness is corrected. Three exact-source
CI workflows and nine packaged checks passed. No enquiry/order/booking was sent for
visual demonstration. [Mapping, failures, measured results and safe screenshots](HOME_WORKSHOP_20261102.md).

### 2 November 2026: Live fitment inspection and invoice-search follow-up

Owner restored Super Admin access. A separate Chrome tab inspected the actual
fitment queue, draft evidence, legacy editor and additional restrictions at normal
and 390x844 viewport sizes. No record was submitted, approved, retired or changed.
Refresh retained the draft at version 0 and its six evidence warnings. Legacy
Toyota/Camry labels remained explicit; missing catalogue identity and model years
were not guessed. Captured console errors/warnings: none. Temporary viewport was
reset. Native physical-phone/keyboard and independent reviewer acceptance remain
unverified. This supersedes the earlier current-access blocker, not those limits.

Observed friction: closing an untouched editor still asks about unsaved changes.
Source confirms RuleDetail always confirms and RuleEditor always enables its leave
guard. Any correction must preserve recovered drafts and changed catalogue choices;
source now distinguishes untouched editors from edits, recovered selections and
uncertain saves. New browser coverage checks silent close and cancel/discard
protection; rendered verification remains pending. No browser screenshots containing
private evidence were added to public artifacts.

Invoice filters still required a pasted customer profile identifier. A pending
source change reuses CustomerFilterPicker from payments, with named search, selection,
manual fallback and existing validation. Invoice-specific mobile/desktop recovery
tests are added; TypeScript, scoped lint and formatting passed. Rendered acceptance
and publication are pending. Visible UUID
wording in review/privacy filters and specialist invoice lookup is being replaced
with reference wording without removing exact-match safeguards.

The corrected unknown-duration slot test now passes its CI step (15 cases); the
same run fails later on two Home guidance expectations from the unrelated release.
Per the owner's instruction, that release is left to its agent. Do not claim full
CI success or take over that deployment. Source de9ea589; run 41409065023.

### 2 November 2026: Connected customer fitment acceptance refreshed

Eleven hosted Playwright cases passed against https://alliedautotech.com at
390/1440px and default desktop: catalogue choices available/empty/failed,
reviewed versus unconfirmed application guidance, technical configuration and
Back/refresh, contextual enquiry review/submission, dependent-choice retry,
saved-car editing/default reuse, off-page defaults, failed ownership preflight,
unknown-specification preservation, session loss and late-response suppression.
Account data and submissions were intercepted synthetic fixtures; this is not
real-account, backend-policy or physical-device acceptance. No real message was sent.

Two obsolete suites were corrected to current By vehicle, contextual enquiry
and Retry vehicle choices controls. Catalogue assertions now use explicit
reviewed and unknown products, instead of assuming the first live product has a
particular compatibility state. Payload, review-before-write, privacy, accessibility,
no-overflow and stale-response assertions remain. Initial runs failed on obsolete
copy/control selectors (3 failures, then 2 passes/3 failures); those are not passes.
Final run: 11 passed, no retries or skips. Scoped lint, TypeScript and whitespace checks passed before reconciliation.
Evidence: `%TEMP%/aat-fitment-connected-final-20261102.json`; screenshots and
retained preceding failure traces are in the corresponding task directories.

Runtime remains 59068ee4, already published on both domains; this batch changes
only tests and records. Follow-up b797e3b7 CI is green for all three workflows.
The broader brief remains open; fresh authorised fitment, physical-device and
external financial/operational acceptance remain explicitly unverified. Disk
reserve passed at 24.66 GiB free; no Docker resources or dependencies were created.

Reconciled with concurrent master fee9d908 without changing its runtime.
Its Home/workshop release still requires its recorded acceptance gates; the
eleven cases above prove the existing published runtime, not that newer candidate.

### 2 November 2026: Home workshop restoration in progress

The full owner brief, all original photographs and authorised workbook were inspected.
Home/About now have authentic workshop composition, three service priorities and a
progressively enhanced looping hero. Source contract permits unknown service durations
without booking-slot eligibility. Focused frontend checks pass 18, backend contracts
and corpus 13; first production-like build/types passed. Actual current Tyre Change
record remains NGN 1,000, version 6. Wheel Alignment was authored through the normal
reviewed admin workflow at NGN 4,000 for all four wheels, 60 minutes. Diagnostics/oil
await compatible unknown-duration authoring publication. Full rendered matrix,
exact-source CI, concurrent release reconciliation and promotion remain required.
Local server start was rejected by automatic approval review; no equivalent retry.
See frontend/docs/HOME_WORKSHOP_20261102.md for source mappings, evidence and limits.
C: reserve passes at 24.77 GiB with a justified 1 GiB remaining write allowance.

### 2 November 2026: Invoice identifiers published

Runtime 59068ee4 is live on both domains as dpl_9HWiLQfY5421gq2etamHH7Mv3eyc;
backend 3141a019-da25-4231-80e8-7935f6a33b9c is ACTIVE, 16/16, with all four
digests matched. New finance approvals require verified Tax ID/CAC fields;
historical settings and snapshots remain readable and unchanged. No real policy
or transaction was published. Exact-master CI passed: 1,314 frontend units with
12 existing skips; 40 final isolated backend checks; nine packaged checks;
ten final hosted journeys, fifteen additional finance workspace cases and four
live public checks passed. Original fixture failures and transient preload warnings
are retained in the evidence, not concealed. Read-only production safety and eight
worker heartbeats passed at 07:22 UTC; temporary access removed. No migration.
[Release evidence and exact limits](../../docs/INVOICE_IDENTIFIER_SUPPORT_20261102.md).
Owner cannot currently access fitment. Broader requirement/state audit, real-role
and physical-device coverage and recorded financial/operational approvals remain
open. Purchasing/deposits remain gated; actual identifiers are still not supplied.

### 2 November 2026: Payment customer search published

Frontend c44d7d68 is live on both domains as dpl_A1QVEcajpqZYnHTiE4pC5GL47Cy6.
Payments can now be filtered by customer name/email, with paging, preserved selection,
reload, retry and manual-reference fallback. Existing payment permissions and actions
are unchanged. Exact-master CI 41398690245 / 41398690430 / 41398690011 passed;
1,312 units passed, 12 existing skips. Six final hosted journeys, four expanded-search
width/accessibility checks and four live public checks passed. Retained broader
payment evidence covers 42 distinct passes; private-evidence storage fixture remains
unverified and fails identically on the prior release. Full failures, changed files,
screenshots and limits: docs/PAYMENT_CUSTOMER_SEARCH_RELEASE_20261102.md.
Backend f0402b67 unchanged; read-only production safety refreshed 06:17 UTC,
temporary access removed. C: 25.40 GiB free; Docker/other worktree resources retained.
Owner currently has no fitment sign-in access; no repeated sign-in request until
that changes. Remaining: broader requirement/state audit, invoice identifier support
and the already recorded financial/operational approvals and external acceptance.

### 2 November 2026: Form clarity published

Frontend dfd69bd1 is live on both domains as dpl_Acehf69pBzE1vxdycA3GXq7MmoCs.
Readable status/review labels and invoice source disclosure/copy are released.
Exact-master frontend 41394976202, backend 41394976199 and secret checks
41394976252 passed: 1,312 units, build/types/lint/format; 12 existing unit skips.
57 distinct hosted journeys passed across the identical-runtime initial run and
corrected assertion rerun; six final-candidate checks and four live public checks passed.
Two storage-dependent upload checks remain unverified. Synthetic screenshots and
all failures/limitations are documented in docs/FORM_CLARITY_RELEASE_20261102.md.
Backend f0402b67 and 85 migrations are unchanged; read-only safety and worker checks
passed, temporary access removed, latest managed backup 2 November 05:22 UTC.
Purchasing/deposits remain gated. Wider brief, real-role/device coverage, invoice
identifier support and recorded financial/operational decisions remain open.
C: 25.43 GiB free; no Docker resources created or other tasks' resources removed.

### 2 November 2026: Stock and workshop wording published

Frontend 518dd13ff281618765725e762825646eaced35df is live on apex/www as
dpl_4qkD4d4C9r2gesMvh18SogvgVfv9; www redirects to apex. Backend f0402b67
and deployment 36b4283f-63fc-401b-abbe-03b8bf9ccf2c remain unchanged.
Stock movement choices/history and work-order summaries/reviews reuse readable
labels. Exact request codes, idempotency, version checks and reviews are preserved.

Exact-master CI passed: frontend 41391577799, backend 41391610306, secrets 41391577851. Frontend: 1,312 units passed, 12 existing skips; build/type/lint/format
passed. Earlier 67a9f203 CI failed only quality-register formatting, corrected in
518dd13f. Local scoped lint/format and 24 progress units passed. Three hosted
baselines passed; final nine hosted stock/workshop cases passed, including uncertain
recovery, reservations, reviewed milestones and 320/1440 accessibility. Two candidate
and four post-promotion public checks passed with no page errors or overflow.
These are synthetic staff fixtures and real public read-only checks, not production
stock or financial acceptance. No actual records, approvals or payments were changed.

Fresh 2 November 05:02 UTC read-only schema/TLS/privilege/eight-worker check passed;
temporary access removed. Eight managed backups verified (latest 1 November
05:22:11 UTC). Reused the 1 November populated restore rehearsal for unchanged
85-migration schema; no migration or new restore was performed. C: 25.40 GiB free.
No Docker resources created; existing containers, volumes, caches and rollback
resources retained. See docs/MOBILE_FITMENT_SIMPLIFICATION_20261101.md for screenshots
and prior evidence. The complete brief remains active: remaining ordinary-interface
wording/form audit, real-role/device coverage and previously recorded external
activation/accounting decisions remain open. Purchasing/deposits remain gated.

### 1 November 2026: Readable booking detail published

Frontend 36f4c51d670f0cfdc065be95ae2cf77e43082ab3 is promoted to apex/www as
dpl_4ok1PujUWyktVb4xPxxLGzMyvHkq (www redirects apex). Backend f0402b67 /
36b4283f-63fc-401b-abbe-03b8bf9ccf2c is unchanged. Exact-master frontend
41346242439, backend 41346242451 and secret check 41346242418 passed.
Booking status/review labels are readable; the staff summary now collapses the
canonical reference until requested, preserving full copy and manual fallback.
Expanded staff-reference contrast was corrected before publication.

Evidence: 1,312 frontend units passed, 12 existing skips; 24 focused booking units
and 68 money/payment-availability/public-boundary units passed. Final hosted:
12 booking interaction/accessibility cases, two copy cases and two safe screenshot
captures passed; candidate public checks passed at 390/1440. Four post-promotion checks across apex/www at both widths passed with no page errors or overflow. The initial held
bd952fa6 candidate failed contrast at four widths and was not promoted. No real
appointment, financial transaction, policy approval or migration was performed.
Read-only production check at 20:14 UTC passed 85-migration compatibility, strict
TLS, runtime least privilege and eight worker heartbeats; temporary access removed.
The pre-promotion gate revalidated backend identity/digests and reused that fresh
check and the same-day populated restore rehearsal for the unchanged schema.
Eight managed backups rechecked; latest 1 November 05:22:11 UTC.

Owner financial clarification and a synthetic non-payable sample are in
backend/docs/finance-review-20261101.md. Purchasing stays gated. Tax/CAC identifiers,
accountant applicability/rounding approval, invoice metadata support, service-invoice
timing and controlled publication/provenance remain outstanding. Existing percentage
discounts truncate fractional kobo while VAT is half-up; proposal is not approval.
Current broader limits: merchant acceptance and operational/other policy prerequisites,
physical-device/unsampled role acceptance, fresh signed-in fitment recheck, separately
blocked local service SSR fixture preview, and remaining legacy operational labels.
This is a completed release batch, not a claim that the entire brief is complete.

### 1 November 2026: Appointment clarity and filter focus published

Frontend ad97a7283f7b3cee5d2d6c9a832ca19f92561298 is live on apex/www as
dpl_G1SFTUokXojjEjbMkt84TTtUt6QT; backend f0402b67 remains unchanged and healthy.
Exact-master frontend 41344028844, backend 41344028780 and secrets 41344028786
passed. 1,312 frontend units passed (12 existing skips), seven final hosted
fixture checks, two candidate public checks and four post-promotion public checks
passed. Corrected booking Clear filters focus after remount and dark-card expanded
reference contrast. Confirmed future time uses Africa/Lagos; full references remain
available through explicit expand/copy. Prices, stock, permissions and gates unchanged.
Read-only schema/TLS/privilege/eight-worker checks passed; temporary access removed.
C: 26.31 GiB free. Broader local evidence and failed/skipped runs are preserved in
docs/MOBILE_FITMENT_SIMPLIFICATION_20261101.md. Current constraints: merchant and
policy/operational activation prerequisites, physical-device/unsampled role acceptance,
fresh Computer Use fitment recheck and separately blocked service SSR fixture launch.
No production transactions or migrations occurred.

### 1 November 2026: Appointment clarity verification

Frontend-only follow-up: confirmed upcoming appointment wording in Africa/Lagos,
compact expandable booking references, and consistent reference labels across
customer/staff surfaces. Build, scoped lint, three units and initial 320/1440
state tests passed. Surrounding rendered regression is running; publication is
pending exact-master CI and held hosted acceptance. Existing f0402b67 backend,
85 migrations, permissions, prices and activation gates remain unchanged.
Wider baseline: 141 dashboard and 31 Contact cases pass across initial runs and
two corrected stale assertions; 43 isolated fitment/policy cases and 22 actual
public route/viewport checks pass. Fresh Computer Use window mismatch prevents
a new signed-in fitment acceptance claim. See docs/MOBILE_FITMENT_SIMPLIFICATION_20261101.md
for precise evidence and the external activation/physical-device limitations.

### 1 November 2026: Mobile dashboard and fitment batch published

Runtime f0402b675e83ae3999526d60880134c518a96435 is published on apex and www:
frontend dpl_7UYruc3SHzs2xzcxFtyDu5XVkqbs; backend
36b4283f-63fc-401b-abbe-03b8bf9ccf2c ACTIVE (16/16), all four digests verified.
Exact-master frontend 41339747501, backend 41339747466 and secrets 41339747631 passed.
Local evidence: 1,309 frontend unit passes (12 skipped), 138 journey cases,
12 focus/navbar regressions, 18 learning checks, 6 service-security checks,
and 10 packaged-image/isolated replay-and-restore checks. Hosted: five intercepted
journeys plus real public Learn/Help/Services at 390 and 1440 passed. After promotion,
four checks across apex/www and both widths passed with no page errors.
Live signed-in fitment inspection found and corrected crowded selected-part links;
no fitment record or permission was changed. Improved shared care tables, year
validation, ordinary learning text and multiline service-description editing.
Read-only production schema (85 migrations), TLS, least privilege and eight worker
heartbeats passed; temporary firewall access was removed. No migration was needed.
Current item: broader route/state acceptance remains tracked in
docs/MOBILE_FITMENT_SIMPLIFICATION_20261101.md. Physical-device/native-keyboard
and untested real-role acceptance remain distinct from fixture evidence. Transaction
activation still requires approved finance/fulfilment policies, operational setup
and merchant test-mode acceptance. Preserve the unrelated Desktop hero edit.

### 1 November 2026: Services and commerce source published

Runtime 53cdc8e1307bb23395b3e5e77bdee8f93be48139 is live on apex and www:
frontend dpl_8Q1egBBsQNYYGVEC5Fh5XxgxQFdX; backend
c5942ed9-51ec-4af6-b468-af8a703c3c2e ACTIVE (16/16), all four digests matched.
Exact-master frontend 41333397074, backend 41333397179 and secrets 41333397155 passed.
Frontend: 1,309 passed, 12 skipped. Packaged image/database checks: 10 passed.
Hosted candidate: five intercepted journey checks plus two real public-content
checks passed. After promotion, four real public-content checks passed across
apex/www and 390/1440 widths, with no submissions or page errors.

Both additive migrations were applied with guarded db:migrate after fresh backup
verification and a populated isolated restore rehearsal (83 to 85 migrations).
Original restored columns/counts remained unchanged. Production db:check,
strict TLS, runtime least privilege and all eight worker heartbeats passed.
Temporary firewall access was removed and verified. Managed backup inventory
was checked; this was a new local populated restore, not a new managed PITR test.

Service discovery, structured contextual enquiries, unlisted parts requests,
immutable quotations, guarded collection-order conversion, history access and
compact favourites are deployed. Production activation remains BLOCKED by
finance/collection approval, real stock/calendar setup and Paystack test-mode
acceptance. Launch/payment flags, prices and business records were preserved.
Saturday 18:00 Africa/Lagos and Tyre Change NGN1,000 are settled owner decisions.
See docs/SERVICES_COMMERCE_READINESS_20261101.md for evidence and exact gates.
Physical-device and 200% browser-zoom acceptance remain unverified.

### 1 November 2026: Privacy guidance and compatible Help rollout published

Runtime 5d310b10ffb6b34119ef849dca0400b30de71a2a is live on both domains,
independently verified as dpl_xw7An14AFK7Nh17SnUpyEQGmJqCe. Backend
dcb30c90-80d1-4ba4-9733-11e736ddc47b is ACTIVE (16/16); all four image digests
match. Exact-master frontend 41310483759, backend 41310483725 and secrets
41310483829 passed. Frontend CI: 1,311 passed, 12 deliberately skipped; production
build, types, lint, audit and formatting passed. No new schema migration or
permission, price or activation-setting change; 83 migrations remain applied.

Read-only strict-TLS database/schema and runtime least-privilege checks passed;
all eight workers are healthy and temporary firewall access was removed/verified.
Today's managed backup and eight retained backup dates were verified. The recent
populated restore from 17abc5e6 was reused after proving schema/safety scripts
unchanged. This is not a new production restore or managed PITR rehearsal.

Local: 82 backend and 38 frontend focused cases, 11 actual HTTP cases on a fresh
isolated database, 67 payment contract cases, types/scoped lint, canonical OpenAPI
validation and two rendered 390/1440 cases. Final package: nine image checks
(20.46s), one isolated replay/restore/drift-rejection check (40.34s). Hosted: two
staff-destination fixtures (53.1s), two actual-public-content privacy fixtures and
two real-data homepage/group journeys. Live: Privacy search/refresh/navigation at
390/1440, two apex homepage/group journeys and two www journeys. Older live Help
also passed after backend rollout before frontend promotion; legacy API returned
seven articles and version 2 returned eight, without restricted privacy content.

The first www live image poll timed out at five seconds. A separate fresh-context
diagnostic loaded all three images in 216/470/958ms with no failed requests; the
www journeys then passed with a bounded 20-second network allowance. The initial
failure is retained and is not counted as a pass. Tyre Change was verified at
100000 kobo (NGN1,000) at 2026-11-01T13:34:25.379Z; no price mutation was made.
All local temporary privacy test servers were stopped and their five data folders
removed, retaining logs. Superseded local build cleanup has a separate private
receipt; current/rollback images, remote images, data, restore evidence and useful
caches are retained. Earlier candidates were not promoted.

Implementation and independent requirement audit are complete; external activation
and acceptance are explicitly incomplete in docs/DELIVERY_HANDOFF_20261101.md.
The full work exceeded the brief's one-hour target; this final package began around
12:40 UTC and production live checks finished around 13:34 UTC. No paid AI request,
charge, refund, real customer booking or message was made during this package.

### 1 November 2026: rollout-compatible Privacy guidance ready for publication

The new destination initially would have broken older open tabs that validate the
entire catalogue against the prior destination list. Before publication, added the
bounded destinationsVersion=2 request; absent/1 callers retain the previous list.
Version selection cannot grant private content. Internal Allie retrieval uses the
current reviewed source and source-set invalidation. Updated OpenAPI and client types.
The earlier d31918bb candidate is READY but remains unpublished; production is still
6de6c86f. Exact-master checks and hosted/live acceptance must pass for this correction.

Passed 82 distinct focused backend unit cases, 38 frontend cases, types/scoped lint,
OpenAPI validation (410 paths) and 390/1440 local privacy search/refresh/navigation.
Fresh isolated HTTP run passed all 11 cases (17.50s), 83-migration replay and schema
check. The first compatibility run expected 400 rather than the established 422
validation response; corrected the assertion, with the failed log retained. Native
servers were stopped. No schema, grant, price, feature-flag or application-data change.
Payment audit additionally passed 67 provider-independent unit cases; see
backend/docs/payment-requirement-audit-20261101.md for implementation/assertion mapping.

Remaining handoff: guarded publication and live checks, then the final activation
summary. Merchant/provider test-mode acceptance, new bounded live model evaluation,
real operational calendars/capacity and notification delivery remain external setup.
Physical-device/native zoom/full screen-reader and signed-in staff production
acceptance have not been newly established by this batch. Tyre Change stays NGN1,000.

### 1 November 2026: reviewed privacy Help guidance, locally verified

Added public privacy-and-allie v1, grounded in the published Privacy notice,
through the existing eligible Help/Allie corpus. Added /privacy to both safe
navigation lists. The guidance preserves retention, provider, backup and saved
support-message caveats; it does not promise deletion or expose staff privacy work.
Current server release mode and guide/practice flags remain part of retrieval and
history invalidation. No schema, price, permissions or production flags changed.
Tyre Change remains NGN1,000, explicitly reconfirmed by the owner.

Passed 81 backend unit checks, 34 frontend checks, types/scoped lint and two
390/1440 rendered browser fixtures using the actual generated public catalogue.
Fresh isolated aat_privacy_help_edfef254b1_test at 127.0.0.1:58983 replayed all
83 migrations, passed schema compatibility and all 11 real HTTP learning tests
(21.44s). The server stopped cleanly. Two preceding Windows launcher attempts
stalled while waiting for descendants; both temporary servers were stopped and
those failed logs retained. Neither was counted as a pass. No application or
production database was written, no paid model call or customer message sent.

Privacy search, article refresh and navigation to the actual notice passed locally
without page errors or horizontal overflow. This is local intercepted-transport
UI evidence, not hosted/live or authenticated staff acceptance. Production remains
6de6c86f until exact-master CI and guarded publication pass. Remaining full-goal
work: finish payment requirement-to-assertion audit and the final activation handoff.

### 1 November 2026: authorised Help destination repair published

Runtime 6de6c86f3f1317ba140135b5f02cff3baeb4ee71 is live. Exact-master frontend
41306198090, database safety 41306198130 and secrets 41306198115 passed. Both
apex and www were independently verified as dpl_H68vUeqpN5iqAg1idy4fAXkL4XC9.
Backend d496ecda-0f12-4a62-ac0e-8bf0d08f1b79 is ACTIVE (16/16), with matching
four image digests, strict-TLS read-only schema/least-privilege checks and all eight
workers healthy. Temporary database access was removed and verified. No schema,
permissions, prices or feature flags changed; 83 migrations remain applied.

The eight-line runtime repair restores seven supported staff Help destinations
and Allie's service-category destination. Local acceptance: 71 backend and 38
frontend focused checks, frontend types/lint, two rendered 390/1440 fixtures.
Hosted acceptance: two Help fixtures (34.4s), two real-data candidate journeys and
four real-data live journeys across both domains at 390/1440. Public Help opened
and survived direct article refresh in Chrome without the black container outline;
Chrome was signed out, so this does not add real authenticated staff acceptance.
Live screenshot: TEMP/help-destinations-live-chrome.png. No paid AI call or real
customer enquiry, booking, payment or message was made.

Nine packaged image checks passed (25.343s), plus one isolated database replay,
backup/restore and drift-rejection check (43.777s). The first registry upload attempt
stopped during access lookup before upload; independent lookup and retained retry
succeeded. Today's managed backup was verified. The recent populated production
restore from 17abc5e6 was reused after proving the schema and safety scripts are
unchanged; this is not a new production restore or managed PITR rehearsal.
Build/release manifests for 17abc5e6 are preserved with explicit filenames. Current
and two preceding releases, populated restore evidence and other tasks are retained.

Tyre Change was re-read through /api/v1/public/services/:id and remains NGN1,000
(100000 minor units), as confirmed by the owner. Initial guessed non-public endpoint
returned 404; it was not counted as evidence. Public images, workshop story location,
eight service groups and contextual enquiry/restricted-booking links passed live.
Final observed C: 27.01 GiB free; task packaged containers cleaned up by their runners.
This package began about 12:14 UTC and live verification finished 2026-11-01T12:36:51.214Z.

Full goal remains active. Next: close the concrete public-policy knowledge gap
(the published Privacy notice is not an eligible Help/Allie source), verify current
capability metadata grounding, then finish the payment lifecycle and requirement
ledger audit. Keep external provider and physical-device acceptance limits explicit.

### 1 November 2026: authorised Help destination repair, locally verified

Found a real contract mismatch: seven published staff Help destinations were absent
from the client validator, rejecting entire eligible catalogues. Allie retrieval
also omitted /admin/service-categories. Added only the supported destinations;
server eligibility, independently granted financial duties and feature flags remain
unchanged. Owner reconfirmed Tyre Change at NGN1,000; no price mutation was made.

Baseline actual server-to-client catalogue parsing failed for three of five role
profiles. After repair, 71 backend and 38 frontend focused checks passed. Durable
regressions run independently within each package: all published eligible articles
remain retrievable, unauthorised service-group guidance stays excluded, supported
staff destinations parse and unsafe/unknown destinations remain rejected. Backend
retrieval coverage is included in the existing CI permission-test stage.

Two local rendered fixture cases passed at 390/1440 (1.5m), opening and refreshing
all seven destinations with no page errors or horizontal overflow. Frontend types
passed. Browser plugin unavailable; existing Playwright/Edge used. Screenshots:
TEMP/help-destinations-390.png and TEMP/help-destinations-1440.png. This is synthetic
catalogue UI evidence, not a new real-role production acceptance or live AI test.
Production remains runtime 17abc5e6 until exact-master CI and guarded publication
of this batch pass. No database/schema or production configuration change required.

### 1 November 2026: booking group continuity live checkpoint

Runtime 17abc5e6 is live on apex/www as dpl_G3ET9fphQoBEqGa1dYBK6qdhU2Bt,
with backend 3795b7c9 and eight healthy workers. Four hosted category/media cases,
two real-data candidate cases and four live public cases passed at 390/1440.
Restricted booking retains the selected group in its enquiry link. Native customer
and staff booking-group persistence remains locally verified; public booking gates
were preserved. No real customer booking/enquiry was submitted. Tyre Change remains
NGN1,000. Live screenshots are in TEMP/aat-booking-group-live. Full goal continues
with requirement/evidence reconciliation and outstanding provider-independent checks.

### 1 November 2026: selected group through booking

Local full-mode request flow now retains selected group across sign-in handoff,
review, receipt and customer/staff detail. Native browser/API checks at 390/1440
verify saved group after rename/unpublication and pending status after proposal
acceptance. Seven fixture browser cases cover review/retry, withdrawn-group recovery,
service booking review and category enquiry; eight draft units pass. Scoped Axe and
overflow checks pass where included. Screenshots inspected in TEMP/aat-native-booking-group-20261101
and TEMP/aat-booking-group-browser. Existing production launch gates remain; limited
request page enquiry retains the group. This is local acceptance pending release,
not physical-phone or production booking acceptance. Full scope remains open.

### 1 November 2026: service-group imagery production acceptance

Runtime 30780884 is live on apex/www as dpl_HGU7Lfaq6oM9XxgTMmUYyStR9a7D,
with backend f17d81bf and all eight workers healthy. Four hosted image/group
fixtures passed at 390/1440 (scoped Axe and overflow), two real-data candidate
checks passed, then four real-data live checks passed across both domains.
Homepage service/vehicle images remain contained and moderately sized; workshop
story placement and links, group order and empty-group enquiry context passed.
No enquiry was submitted. Real authorised admin image editor loaded with file
selection enabled and save disabled until preparation. No actual category upload
or removal was performed: authentic assets/live byte-upload acceptance remain
open. Screenshot retained as service-group-image-editor-live-20261101.png.
Owner confirmed current Tyre Change price NGN1,000; older price notes below are
historical. Physical-phone and remaining role/journey acceptance are not implied.
Next scope: structured selected-group context through booking. Full goal remains
incomplete; restricted payment, AI and live-chat flags remain unchanged.

### 1 November 2026: service-group image authoring

Local group detail now uses the shared reviewed image editor and public group cards
accept genuine photos with icon fallback. Four 390/1440 Edge fixture cases passed,
including cancellation/no write, alt text, reload, removal, focus return, scoped Axe,
no overflow, failed-image fallback and category enquiry context. Images stay within
240px on cards. Screenshots retained under TEMP/aat-category-media-browser. Synthetic
browser images and injected byte storage are not live-upload acceptance. New image
code is pending release. The separately authorised real owner import is complete:
eight groups published, original Tyre Change retained at NGN1,000,000.

### 1 November 2026: service-group ordering production checkpoint

Released runtime 459442f1 with backend f5937b55 and frontend
dpl_64MP96dyHg74veuEnshapSbSm858 on both domains. Four hosted category/owner-review
fixture cases passed at 390/1440, with scoped Axe and overflow checks. Four live
public checks passed on apex/www: homepage workshop story and contained service/
vehicle images, correct detail-page removal and workshop link, no page errors or
overflow. This supersedes the source-only release status below. Actual owner import,
physical-phone acceptance, category imagery and structured booking context remain
open. No gated feature activation; full coverage goal remains incomplete.

### 1 November 2026: service-group display order

Existing category editor/detail/import review now expose maintained display order.
Lower numbers precede alphabetical ties. Review is read-only; confirm saves once;
reopening and reloading retains the order. 390/1440 fixture browser checks and scoped
Axe/no-overflow checks pass, with screenshots in TEMP/aat-category-order-browser-recheck.
The native API/database tests independently prove persistence, pagination and access
boundaries. A test-flow error initially reloaded the blank create form, then was
corrected to reopen the saved category; failed evidence retained. Source-only pending
migration/release. Category imagery and structured booking context still open.

### 1 November 2026: review-button release follow-through

Published source 337477ae on both domains as dpl_5pNZQyW36fq9EisnwLyLR9g1ra31
following exact-master checks. Four live homepage checks passed at 390/1440 on
apex/www. Hosted staff proposal and customer launch-gate checks passed twice;
full customer hosted checks hit the expected Contact redirect and are not counted
as acceptance. Native local customer-review geometry and API/database evidence
remain the source of customer-dialog coverage. Production launch flags unchanged.
See the site-completion tracker for exact receipts and outstanding scope.

### 1 November 2026: native proposal journey and mobile review sizing

Two real-browser/API/database customer-to-staff proposal journeys passed at 390/1440
(58.13s), preserving pending state and original concern/vehicle after acceptance.
Review dialogs do not write; submissions use CSRF. Seeded sessions do not prove actual
login/MFA. Screenshot review found and fixed oversized customer dialog buttons caused
by a horizontal flex basis becoming column height. Native viewport bounds pass at
390x900, 390x500 and 1440x900. Fresh isolated 80-migration replay/db:check, backend
types, scoped lint and formatting pass. Full evidence and the failed initial preview
attempt are in docs/help-learn/CONCERN_BOOKING_20261030.md. CSS publication remains
pending; current live source is c158b0d0. Full objective remains active.

### 1 November 2026: canonical Allie service-group knowledge

Allie now retrieves active ServiceCategory records, including empty published groups,
through the existing public knowledge pipeline. Database ranking precedes the 12-new-
candidate limit; up to 24 previous source IDs are reloaded with current visibility.
Only canonical ID/name/description/version/update fields are selected. Groups carry
no price or availability claim and link to the exact category-filtered Services page.
Backend and frontend bind the destination to the source ID; model URLs remain disallowed.
Public revision v4 hashes active group fields, so edits without version bumps and
unpublication invalidate conversations and in-flight answers. Existing four-source
and 8000-character answer context limits remain; group candidate bound is additive.

Fresh isolated aat_allie_groups_5b36b250ee_test at 127.0.0.1:60637 passed all 80
migrations, no drift and db:check. Four native tests across three files passed, covering
existing catalogue ranking/visibility plus active empty groups, inactive exclusion,
follow-up reload, edit/unpublish invalidation, in-flight response rejection and wrong-
group link rejection. 65 focused backend units and 23 client conversation tests passed.
Backend/frontend types and scoped lint passed. Two mocked Edge browser journeys passed
at 390/1440, including scoped Axe, one turn submission, citation -> matching Services
group, enquiry context link, no overflow and no page exceptions; screenshots inspected.
First browser attempt failed because the preview was stopped; restarted and reran
unchanged assertions. Initial type check caught a LearningPage enum mismatch, corrected
to the established other metadata value. This is local/native plus mocked UI evidence,
not live model or production acceptance. No schema, production data, provider call or
capability activation. Service-request guidance is v11; guide eligibility unchanged.

Next: owner group ordering/media and structured booking category context, remaining
provider/native-browser/role/operational acceptance. Full implementation goal remains
active. This package requires checked-source integration and compatible publication.

### 1 November 2026: homepage update published and verified

Source 7d9bcee8cca39b84d8081ba8231bc271c0c00617 is on master and live on both
alliedautotech.com and www.alliedautotech.com through Vercel
dpl_HcBKstVXwmd9BAa8fvP6MCyw6zRX. Workshop principles moved from service details
to Home; homepage service/vehicle photos preserve full subjects at moderate sizes.
Exact-master frontend 41291218823, database safety 41291218740 and secrets
41291218867 all passed. Six local fixture checks from preparation, two held-candidate
real-data checks, and four post-promotion checks (390/1440, apex/www) passed.
Rendered checks cover artwork loading, photo framing, no horizontal overflow,
About navigation, Tyre Change identity, section absence and no page exceptions.
Screenshots reviewed; portrait equipment retains neutral side framing. This does
not prove every device, role or payment/AI flow. Backend c886268a remains healthy
and unchanged; no database migration or gated-feature activation was required.
CLI token renewal resolved the initial Vercel 403 without a new user approval.
Receipts: backend/ops/digitalocean/.private/homepage-care-*. Browser images:
TEMP/aat-homepage-care-candidate and TEMP/aat-homepage-care-live. C: 26.32 GiB free.
No Docker resources created or deleted; shared dependencies and rollback resources
retained. The full implementation goal remains open, including remaining owner
category work and provider/role/operational acceptance tracked in the feature ledgers.

### 30 October 2026: homepage workshop story and image framing

Moved the approved Precision Autocare / Clear advice section from service details
to Home, ahead of Inside the workshop. Homepage service images keep intrinsic
proportions within 340px height; vehicle images use contain within their 4:3 frame,
with a single vehicle card capped at 480px. No pricing, API or backend runtime changes.
Six local Edge/Playwright fixture checks passed: 390/1440 Home layouts and complete
artwork, service navigation/FAQ and narrow/wide supporting sections. Browser plugin
not available; existing Playwright used. Screenshots reviewed at 390/1440.
Release pending exact-source CI, held candidate verification and both-domain promotion.

### 30 October 2026: completed source package published

Source e8a40784 is integrated into master and published to both domains with matching
backend c886268a-6929-4053-95b0-7930f054bdb7. Exact-master CI, fresh backup/isolated
restore, protected forward migration (80 total), runtime privilege checks, seven
worker heartbeats and six hosted fixture journeys have passing evidence. Capability
flags remain unchanged. Full brief and actual owner category import remain open.
See backend/docs/efficient-delivery-production-20261030.md for receipts, failures,
corrections and acceptance limits.

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
and prices. Evidence: .private/sidebar-fc318618-_.json and TEMP/aat-sidebar-fc318618-_.
The full efficient-delivery goal and uncommitted booking/payment/Allie work remain
in progress; this release does not establish their production acceptance.

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

### 30 October 2026 alternative appointment controls

Staff/customer reviewed proposal actions implemented. Four 390/1440 browser journeys and two scoped-Axe acceptance runs pass; phone screenshot inspected. Disrupted acceptance now records TRANSFERRED; fresh 80-migration replay/db:check and 14 booking integrations pass, temporary DB removed. Types/scoped lint pass. Disk dropped to 15.41 GiB after checks; further builds/tests stopped under the 20 GiB reserve. Owner asked to free 6 GiB; no system/shared resources deleted. Full evidence/remaining scope: docs/EFFICIENT_DELIVERY_20261030.md. No publication.

### 30 October 2026 embedded booking recovery verified

Three local phone browser cases pass: uncertain vehicle save blocks duplicate creation until reread; account change closes either editor and clears prior customer inputs/details without submitting. Scroll locking is released. Readiness ledger now distinguishes implemented account/classification controls from the still-missing staff alternative workflow. Full evidence and remaining scope: docs/EFFICIENT_DELIVERY_20261030.md. No production mutation.

### 30 October 2026 booking account entry

Shared booking details now offers existing Garage/profile editors without leaving the booking. Two 390/1440 fixture journeys plus scoped dialog Axe and three Garage/profile regressions pass; 14 guidance units pass. Phone screenshots reviewed after fixing missing public input styling. Embedded-editor uncertainty/account-switch and direct service-page coverage remain open. Full scope/evidence: docs/EFFICIENT_DELIVERY_20261030.md. No real account write or publication.

### 30 October 2026 staff concern classification

Existing assignment flow now requires service classification before confirmation. Explicit review preserves original concern and REQUESTED status. Local Edge 390/1440 classification and existing confirmation regression pass; phone screenshot inspected. Stale/permission-loss/pagination and physical-device acceptance remain open. See docs/EFFICIENT_DELIVERY_20261030.md.

### 30 October 2026 concern form review/retry checkpoint

Local concern request form now has explicit review, account-readiness guard and same-key uncertain retry. Eight draft units and two simulated browser cases at 390/1440 pass; types/scoped lint pass and phone receipt inspected. Full sign-in/accessibility/staff workflow acceptance remains open. See docs/EFFICIENT_DELIVERY_20261030.md concern customer form checkpoint for exact scope and limits. No publication or real booking.

### 30 October 2026 image composition completed locally

Service catalogue photos now use their recorded source ratio with a 420px height
budget; detail heroes allow 520px. Cover rendering preserves the full portrait
workshop equipment without gaps. Home vehicle cover remains moderate 4:3, matching
the rechecked published 1000x750 BMW photo. Service detail reuses About's exact
precision-autocare CampaignArtwork at its complete 4:5 ratio, max-width 380px;
the original camera-taken file and other placements remain untouched.

24 distinct browser cases pass across corrected runs: seven composition/supporting
section cases, 13 service responsive/accessibility/fallback/navigation cases, four
Home/long-title/varied-image cases. Types, scoped lint and diff checks pass. Stale
Home price/hydration expectations and an unsettled-search measurement were repaired;
failed runs are retained and not counted as full passes. Authentic equipment and
campaign screenshots inspected; browser-only record fixtures, Edge emulation at
320–1536px, no physical-device/Safari or production acceptance. See the image
checkpoint in docs/EFFICIENT_DELIVERY_20261030.md for exact evidence and remaining
full goal. No deployment, data change or feature enablement.

### 30 October 2026 preferred booking local acceptance

All 66 distinct service-detail cases pass across corrected local fixture runs, including ten widths (320–1536), keyboard/Axe checks, pending preferred requests for fixed/quotation services, retained anonymous enquiries, sign-in draft recovery, MFA blocking, account changes and error/uncertain retry. Four final browser cases verify FAQ, structured metadata, narrow layout/no duplicate read and account-change clearing. The shared resource hook now survives Strict Mode effect replay without duplicate server-seeded reads and refreshes after disable/re-enable; 16 lifecycle units pass. Reviewed 390px enquiry and receipt screenshots. This does not prove physical-device, full screen-reader or real-role production acceptance. No live submissions or feature enables. See docs/EFFICIENT_DELIVERY_20261030.md for failed-run causes and remaining full goal; current image composition is still pending.

### 30 October 2026 sidebar complaint recheck

Rechecked the published https://alliedautotech.com Shop and Vehicles surfaces using existing Edge/Playwright checks (Browser plugin unavailable). All nine cases passed: five public geometry/selection/cancellation cases at 320, 390, 768, 1024 and 1440 px; four desktop scroll-containment cases at 1024/1440 with browser-only catalogue fixtures. Panel heights and inner scroll positions remain stable during page scrolling; wheel input at the panel boundary does not chain to the page; scrollbars are hidden and Apply stays in view. Public geometry cases reported no page errors. Reviewed the 1024 px Shop screenshot. Latest repeat verification: all nine cases passed again in 1.4 minutes; the 1024px Shop screenshot was inspected. Evidence: temporary aat-sidebar-current-check folder. C: reserve rechecked at 23.29 GiB. No additional source fix or deployment was necessary; physical phones and Safari were not tested. Disk reserve passed at 23.91 GiB after checks. Existing unrelated delivery work is preserved.

### 30 October 2026 sidebar complaint — live recheck

Rechecked the already-published sidebar correction against https://alliedautotech.com using installed Edge/Playwright (Browser plugin unavailable). All 9 existing cases passed: control geometry/cancellation at 320/390/768/1024/1440 and Shop/Vehicles sidebar height, independent scroll position, wheel containment, hidden scrollbar and visible Apply at 1024/1440. The four scroll cases use browser-only catalogue responses against published assets; the five geometry cases use public data. No business writes or new source changes. Desktop/mobile screenshots inspected; evidence is in the temporary aat-sidebar-recheck-20261030 directory. Physical devices and Safari remain unverified. The reported scrolling defect did not reproduce in this matrix; preserve the existing fix and unrelated booking work.

### 30 October 2026 final catalogue and guide follow-up published

Published exact master source 33fb5bd526ce7383cbfc66ad884eb617f3d73e05 to apex and www as dpl_5RYYMkQQvZLw4mwHGjLy5n96CN8j at 2026-10-30T15:22:02.859Z. Frontend 41077238004, Backend database safety 41077237928 and repository secrets 41077237919 passed for that exact source. The final held build passed all 101 main cases and all seven refresh/Help/guide/auth-focus cases: 108 passed, no failures, skips or flaky results. The deterministic guide race also passed independently on this candidate. All 12 live route/domain/width checks passed with no page errors; final Shop/Vehicles screenshots were reviewed after fonts and photographs loaded. The earlier 5b8bf64e candidate was not promoted; its failing trace and deterministic baseline are retained.

The sidebar now has stable viewport-relative sizing, independent contained scrolling, hidden scrollbars and reachable actions; phone drawers retain focus containment. All five body shortcuts match the input's four 6 px corners across hover, press, selection and actual keyboard focus, preserving make/year/budget. Shared low/medium/high shadows, concise Shop discovery labels, proportionate image-first cards and complete fault disclosures remain. New fixture coverage verifies long titles, missing optional facts, portrait/landscape/low-resolution media and old-response races for all three catalogues. Contact reason selection has a non-colour checkmark; three forced-colour plus four existing Contact cases passed locally, with the production gate unchanged. The guide now keeps the later anchor destination when a queued search update races with it; three deterministic local repetitions and 17 adjacent local cases passed, alongside type/lint/format checks.

Promotion rechecked the unchanged ACTIVE backend 9c91eeff-b191-4de5-b9d5-0e6d06134d42 from 2586c61b, matching component digests, recent managed backups, readiness and the prior successful separate restore receipt. This did not rerun the restore or change any database, permission, factual listing, price or production feature flag. Tyre Change remains NGN 1,000,000; BMW remains NGN 3,000,000 with seven authentic photos and its AC fault. Gated/auth/practice acceptance uses browser fixtures and is not real-role acceptance. Native 200% browser zoom, physical phone keyboard and full screen-reader acceptance remain explicitly unverified; browser tooling could not reliably identify the native Chrome target. No backend guide definition, eligibility or checkpoint changed, so content versions are retained.

Evidence: private catalogue-guide-release-20261030-* receipts; aat-guide-release-hosted reports; sidebar-guide-published-parts.png and sidebar-guide-published-vehicles.png. Local preview stopped. Disk reserve passed around 23.9 GiB. Docker resources remain retained for current/rollback/other-task use; no deletion or Docker build occurred. The release worktree remains available for evidence and recovery. Earlier pending records below are superseded by this publication record.

### 30 October 2026 guide navigation race correction (publication pending)

The held 5b8bf64e candidate passed 100 of 101 main hosted cases but failed guide dismissal after an anchor change. It was not promoted. Trace evidence showed a queued Shop search history update restoring the older #learn fragment. Five isolated repeats of the original timing passed; a strengthened same-task search-history/anchor regression reproduced the failure deterministically against the held build.

LearningCompanion now takes the later hash-change destination from the browser event and synchronizes it with the router through replaceState, preserving the current path/query and adding no history entry. Cross-origin/path events are ignored. The deterministic guide case passes three local repetitions with the learning UI enabled only in that local process. The initial local preview had learning disabled and failed before entering the guide; that setup was corrected, not counted as acceptance. All 17 adjacent local learning/refresh/auth-focus cases passed; type, lint and formatting passed. New exact-source publication gates remain pending. No backend learning definition, eligibility, target/checkpoint, permission or production feature flag changes: this repairs the existing navigation contract, so content versions remain unchanged. Native browser zoom, physical-device keyboard and full screen-reader acceptance remain unverified.

### 30 October 2026 catalogue edge and radio follow-up

Live sidebar recheck: nine cases passed on alliedautotech.com at 320/390/768/1024/1440. Shop and Vehicles retain stable panel heights; main-page scrolling preserves inner position; wheel input at the filter boundary does not chain to the page; scrollbars are hidden and Apply stays reachable. Five strengthened shortcut cases also passed: every shortcut retains four 6 px corners during hover, pointer press, selection and real keyboard focus, with stable dimensions. All types preserves make, year and budget.

Twelve browser-only edge cases pass on the published application: Shop, Vehicles and Services at 390/1440, long titles, missing optional facts, low-resolution/portrait/landscape image containment, plus slow older searches unable to replace newer results. Synthetic geometry swatches and records exist only in intercepted browser responses; no application data was written. Pixel dimensions are checked by decoding the selected response because naturalWidth is density-corrected for srcset candidates. Quotation-required prices remain truthful and full vehicle fault text remains visible.

The all-radio audit found a confirmed colour-only selected state in the gated Contact form. A reserved checkmark now identifies the selected reason without moving labels; native arrow-key selection and keyboard focus are retained. Three local forced-colour cases (320/390/1440) and four existing Contact clarity cases passed; the latter use mocked submission. Reviewed the 390 px high-contrast screenshot. This does not enable the gated production form. Filter, vehicle condition, enquiry intent, learning, practice, reply visibility, workforce candidate and technician radio owners were inspected; protected-role acceptance remains separate. No guide target, permission, backend policy or feature flag changed. The Contact fix and regression additions await exact-source CI and publication; live source remains 8ae0df0e until verified promotion.

### 30 October 2026 catalogue controls published

Published master source 8ae0df0e330e89fe40c0be5de2b09cbb15614ce3 to apex and www as dpl_7bD2aA2dYks8ufvguDg57pN9tEZ7 at 2026-10-30T13:54:05.714Z. Exact-source Frontend 41064581759, Backend safety 41064581785 and repository secrets 41064581727 passed. The staged production build passed 89 catalogue/learning cases plus all seven refresh/Help/guide/auth-focus cases: 96 passed, no failures, skips or flaky cases. Auth and gated learning cases use isolated browser fixtures, not real-role acceptance. All 12 live route/domain/width cases passed with no page errors; Tyre Change remains NGN 1,000,000 and BMW retains its full AC issue. Public sidebar screenshots were reviewed after fonts/photos loaded.

Shared control radius is 6 px. All five body shortcuts match the search input at 320/390/768/1024/1440, including hover/focus and selected controls. All types preserves the budget; pending condition changes do not commit on close. Vehicle radios are 20 px with at least 44 px clickable rows, fixing inherited full-width input geometry. Shop choices are By vehicle and By product under Find products. Pointer selection no longer adds the black label outline; keyboard radio navigation retains visible focus. Low/medium/high elevation tokens unify cards, panels and popovers. Both desktop and mobile filter scrollbars are hidden while native scrolling, focus and reachable actions remain. Existing stable sidebar sizing and image proportions are preserved.

The backend remains ACTIVE 9c91eeff-b191-4de5-b9d5-0e6d06134d42 from 2586c61b. Promotion rechecked component digests, managed backup recency, readiness and the prior successful isolated restore receipt; it did not rerun a restore or change any database, permission or feature flag. Local type/lint passed; 16 focused browser cases passed, followed by five pointer/keyboard geometry cases and one final mobile scrollbar case. Additional 390/1440 forced-colour keyboard checks passed. Earlier localhost-API setup was corrected before passing local acceptance. Production acceptance used the frozen build.

Evidence: private catalogue-controls-20261030-* receipts; temporary aat-controls-hosted reports; sidebar-controls-published-parts.png and sidebar-controls-published-vehicles.png. Browser plugin unavailable; installed Edge/Playwright used. Native Computer Use previously stopped because it could not reliably identify the active Chrome URL, so true browser 200% zoom remains unverified, alongside physical iOS/Android and full screen-reader acceptance. The broader brief's dedicated long-title, low-resolution-media and catalogue request-race fixture matrix remains the next audit item; this release does not claim that coverage. Existing landscape/portrait equipment, failed/missing photo, sparse/many results and shared resource race evidence remain separate. No new guide target or eligibility change. Local preview stopped; disk reserve passed at 24.07 GiB. Docker review retained 61 images, 13 stopped containers, 14 volumes and 244 cache entries; no deletion. Release worktree remains active for remaining audit work and recovery.

### 30 October 2026 control and sidebar refinement — source verification

Owner follow-up checklist: shared input/shortcut radius → brand-system.css and catalogue/page styles → computed four-corner checks at 320/390/768/1024/1440 → verified at 6 px, including hover/focus and selected SUV. Sidebar scrolling → existing stable-height, contained-scroll implementation → four 1024/1440 regression cases → passed. Discovery labels → parts-catalogue.tsx → readable 48 px By vehicle/By product choices at five widths → passed. Condition choices → vehicles.css → repaired full-width radio inheritance, 20 px native inputs and at least 44 px clickable rows → passed. Clearing All types retains applied budget; closing pending condition edits leaves URL unchanged. Cards retain their published image proportions, actual photography and fault disclosures. Shared low/medium/high elevation replaces separate panel/card/popover shadows; input boundaries and keyboard focus remain visible. Equivalent assembly and Services controls use the same radius.

Sixteen local installed-Edge cases passed, including original sidebar scrolling, detail-return history and finder errors/recovery. Type checking and scoped lint passed. An initial preview used an unavailable localhost API and was stopped; the passing run used the existing public API read-only plus browser fixtures. Browser plugin not available; regular Playwright used. No application writes, database changes, capability enablement or new dependencies. Final exact-source CI, staged build acceptance and production promotion remain pending. Live remains abe20a47 / dpl_8LfQ1yaVTub1h81RvWBuwJSrXpKP until verified promotion. Physical devices, native 200% zoom and screen-reader acceptance remain unverified. Existing research and photo decisions in CATALOGUE_EXPANDED_20261029.md remain applicable. The named (1).md attachment is absent; the supplied original expanded brief and the latest pasted instructions were read. No guide target, permission or workflow semantics changed; guide bindings remain intact.

### 30 October 2026 sidebar and history fixes published

Published checked master source abe20a47f7b1f24d079426591a2bd6a35c278dd3 to apex and www as dpl_8LfQ1yaVTub1h81RvWBuwJSrXpKP at 12:50 UTC. Exact-source Frontend 41055787602, Backend safety 41055787698 and repository secrets 41055787623 passed. Final staged production acceptance passed 84 interaction cases plus both original refresh/touch cases, with zero failures, skips or flaky results. The history cases also passed separately before the full suite. All 12 live route/domain/width checks passed with no page errors; Tyre Change retains NGN 1,000,000. Shop/Vehicles live sidebar screenshots were reviewed after fonts and images decoded.

The published desktop panels keep a stable viewport-relative height, contain their own scrolling and hide the scrollbar; Apply/Clear stay above the fields, with matching keyboard order. Mobile retains its bottom action bar. Shop panels align with cards without stretching the count row. Back restores the filtered results and reading position; cached server seeds are matched to their request path in Shop, Vehicles and Services. Image proportions and business facts remain unchanged. The b10a9c3b candidate was not promoted; its failures identified and verified the history fix now included in abe20a47.

The backend remains ACTIVE 9c91eeff-b191-4de5-b9d5-0e6d06134d42 from 2586c61b, with matching four-image digests, readiness 200, eight managed backups (newest 30 October 05:22 UTC), and the previously successful separate restore receipt rechecked, not rerun. No database writes, migrations, permission changes or capability gates were enabled. Learning/practice test fixtures do not establish live gated-feature acceptance. Local type/lint/format checks and 23 resource/presentation assertions passed. Physical iOS/Android, true 200% browser zoom and full screen-reader acceptance remain unverified; the wider design goal remains active.

Evidence: backend/ops/digitalocean/.private/catalogue-history-20261030-* and temporary aat-history-hosted/live reports/screenshots. Final C: reserve check passed at 24.11 GiB. The task's local preview was stopped. Read-only Docker review found 61 images, 13 stopped containers, 14 volumes and 244 cache entries; retained current/rollback/other-task resources, with no deletion. The clean release worktree remains active for evidence and remaining scope; no branch retirement is claimed. Earlier pending checkpoints below are superseded by this publication record.

### 30 October 2026 production-history correction (publication pending)

The b10a9c3b staged candidate passed 82 of 84 hosted cases, but was not promoted. Correcting the new test to enter its browser-only fixture through client search exposed a production-only Back defect: the filtered URL remounted a cached server page with its original unfiltered seed (one actual product instead of twelve fixture results). Public seeds now retain their request path; Shop, Vehicles and Services consume a seed only when that path matches the current normalized query. A different restored query fetches its own results before reading-position restoration. Ordinary initial hydration remains seeded and does not add a duplicate request.

The corrected regression uses one actual public product detail within a fictional browser list, performs no application writes, and checks both restored results and reading position at 390/1440. Type checking, scoped lint and 23 public-resource/background-refresh/catalogue assertions pass. New exact-source CI and hosted acceptance are pending. The previous production source remains 04aeef11; dpl_5ARk42ppeERsi7yzBueqPLB1fi5D is an unpromoted diagnostic candidate. No permission, semantic guide target, learning policy or capability gate changed. Existing sidebar/layout evidence and physical-device limitations below remain applicable.

### 30 October 2026 sidebar and catalogue history follow-up (publication pending)

Reproduced desktop filter height feedback: Vehicles grew from 550 to 957 px as the main page scrolled. Removed the scroll-driven measuring effect. Desktop Shop/Vehicles now use a stable viewport/header height, contained internal scrolling and a hidden scrollbar. Apply/Clear and truthful matching counts sit above the fields on desktop, in matching DOM/tab order; mobile retains bottom actions. Shop count rows no longer stretch into empty space beside sparse results. Existing image sizes, prices, permissions and feature gates are preserved.

Rendered sidebar checks pass at 1024/1440, including independent inner/main scrolling and reachable actions; repeated containment checks pass. Mobile short-drawer and desktop transition checks pass. Returning from a real public product within a simulated results list now restores reading position at 390/1440; restoration cancels on new interaction and never runs on ordinary refresh. The F05 brand helper distinguishes empty suggestions, unmatched text and unavailable suggestions. Type checking and scoped lint pass. Shop/Vehicles screenshots were reviewed. No application/database write was used in tests. Final isolated refresh/touch checks passed at 390/1440, and final Shop/Vehicles sidebar checks passed at 1024/1440. One earlier local combined run observed 108 px movement during the desktop touch case and is retained as diagnostic evidence; hosted repetition remains a publication gate. Exact-master CI and hosted publication remain pending.

Current live source remains 04aeef11 / dpl_CksQxTcugzYKnv4RuPQ4bi9LXEJE until promotion is verified. Broader physical-device, true browser zoom and screen-reader acceptance remain unverified. Source-only backend learning/coverage work and disabled owner-support gate remain unchanged. Release worktree allied-contact-validation-20261027 is active; C: preflight passed at 27.29 GiB, dependencies reused, no cleanup/deletion performed.

### 30 October 2026 expanded catalogue published

Master source 04aeef11582ef60f6ef00e05377e9bbd46060039 is published on apex and www as dpl_CksQxTcugzYKnv4RuPQ4bi9LXEJE. Exact-source Frontend 41020410334, Backend database safety 41020654284 and repository secrets 41020410296 passed. The final protected production candidate passed 73 interaction cases plus two original refresh/touch cases, with no failures, skips or flaky results. Post-promotion checks passed all 12 catalogue route/domain/width combinations (390/1440), with no page errors; Tyre Change retains the owner-confirmed NGN 1,000,000 price and corrected descriptions.

Images remain proportionate across product, service, vehicle and equipment cards, with larger detail views. Internal SKU clutter is omitted; authentic photos, availability, fitment and known faults remain. Local focused checks passed 30 frontend and 63 backend assertions. Rendered source checks passed 63 catalogue/equipment plus 10 Learn/Allie/guide/practice cases and two refresh/touch regressions. Installed Edge automation covered 320 through 1440 CSS pixels; fixtures and actual read-only catalogue data are distinguished in the tests. Physical iOS/Android, true 200% browser zoom and full screen-reader acceptance remain unverified.

The current backend remains 2586c61b / ACTIVE 9c91eeff-b191-4de5-b9d5-0e6d06134d42 with matching four-image digests and readiness 200. Eight managed backups include 30 October 05:22 UTC; the successful separate 29 October restore receipt was rechecked, not rerun. No production database write or migration occurred. Master support-coverage source is preserved, but the owner editor is disabled unless NEXT_PUBLIC_OWNER_SUPPORT_COVERAGE_ENABLED is explicitly true; enabling it requires matching backend publication and acceptance. Updated backend learning content remains source-only. No live chat, AI, practice or commerce capability was enabled.

Evidence: backend/ops/digitalocean/.private/catalogue-master-20261030-* receipts and external temporary browser evidence. Release worktree allied-contact-validation-20261027 remains active for release evidence and recovery. No branch or worktree retirement is claimed. The earlier compatible candidate f628a39f was not promoted; final publication uses checked master. C: remained above 27 GiB during final checks; dependencies were reused and no Docker resources or caches were deleted.

### 29 October 2026 expanded catalogue refinement — verification checkpoint

Current item: CAT-EXP-20261029, owner-supplied expanded brief plus all-image-card moderation. Shop, Services, Vehicles, Home previews and About equipment now favour authentic photographs, useful copy and restrained shadows. SKU/internal labels and redundant card metadata are removed. Pending filter edits are explicit on desktop/mobile; clearing applied facets preserves search/sort. Vehicle identity/specs are shared and whole-naira display retains real kobo. Public image variants recheck publication on every request; private media, business permissions and original photos remain intact.

Worktree: allied-contact-validation-20261027, based on master bc6f59c7; baseline live frontend 034b9309 / dpl_EBwxTjnoP845eTcvgFR11pFkbJoP on apex/www. Backend remains ACTIVE 9c91eeff-b191-4de5-b9d5-0e6d06134d42 from 2586c61b, with no pending deployment. The normal authorised admin workflow corrected both Tyre Change description fields; the owner confirmed their separate fixed NGN 1,000,000 pricing change, which is preserved. No direct database, schema, permission, flag or test-business write was made.

Focused frontend checks pass 30 cases; backend guidance/provider checks pass 53. Type checking/scoped lint pass. Final frozen rendered matrix, compatible source integration, exact-source CI and production-candidate acceptance remain publication gates. The original mobile drawer release and pending owner-coverage work are preserved; owner-coverage APIs remain outside this frontend rollout. Updated backend articles/guides are source-only until their separate reviewed backend release. Physical-device, true 200% zoom and full screen-reader acceptance are not claimed. See frontend/docs/CATALOGUE_EXPANDED_20261029.md and docs/help-learn/CATALOGUE_REFINEMENT_20261029.md for findings, photo/security decisions and measured 49.7–79.3% image-transfer reductions. C: reserve rechecked around 20.8 GiB; bounded existing dependencies, no new worktree/build/image/profile copies or cache deletion.

### 29 October 2026 mobile dashboard drawer

The obsolete 390px expanded-sidebar rule made two Administration navigation regions accessible when the dashboard drawer opened. Removing the rule leaves one modal navigation. Focused rendered checks passed at 320, 390 and 901px, and the live 390px drawer screenshot was inspected after deployment `dpl_EBwxTjnoP845eTcvgFR11pFkbJoP` reached both domains. The customer-care browser fixture was updated to open the collapsed creation form before filling it and its focused rerun passed. Real staff roles, physical devices and full screen-reader acceptance remain separate checks.

### 29 October 2026 catalogue redesign published

Frontend source 93f2f3444a1403b19ebeeb38ba49d37ad800f186 is live on both apex/www, deployment dpl_H2xRQcNT8ELpAniX7eHDM6P6Lafv. Promotion verified at 2026-10-29T05:33:04.295Z, preserving the intervening Contact release 35c314c6. Exact-source Frontend 40821653858, Backend safety 40820904020 and secret 40821651216 CI passed. A newer master push cancelled the first frontend run; the immutable integrated release source passed on release/catalogue-redesign-20261029.

Final production-candidate acceptance: 57/57 clean catalogue/Learn/Allie/guide/practice cases plus 2/2 original refresh/touch cases, with zero unexpected/skipped/flaky results. Actual public post-promotion acceptance passes all 12 route/domain/width combinations for Vehicles, Shop and Services at 390/1440. Screenshots were visually reviewed. Local query units pass 54 assertions; full integrated compiler, scoped lint and formatting passed. Eight-width coverage is 320/375/390/430/768/1024/1280/1440; real physical iOS/Android and every protected role remain separate acceptance.

Runtime backend remains 9c91eeff-b191-4de5-b9d5-0e6d06134d42 from 2586c61b, ready/ACTIVE, with matching four-image digests, no pending rollout, eight managed off-device backups (latest 29 October) and the successful separate 94-table/78-migration restore evidence rechecked. No database write, schema, permission, flag or real test enquiry changed. Compatible W16D frontend controls are included; backend Care article v3 publication remains separate. Later owner-coverage/About changes on master are preserved and are not claimed by this frontend deployment.

Public BMW remains one listing with seven real photos, NGN 3,000,000 and the full AC fault disclosure. Product photography and vehicle-choice data remain honestly unavailable where absent. Release evidence is under backend/ops/digitalocean/.private/catalogue-redesign-20261029-*.json; full audit/design/acceptance report is frontend/docs/CATALOGUE_REDESIGN_20261029.md. C: reserve passes around 28.6 GiB free; no additional agent cleanup ran.

UI and UX quality register

## 29 October 2026: W16F native owner coverage acceptance

The actual local owner browser/CSRF/API/restricted database composition passes,
including committed and unsaved transport failures, reviewed cancellation and
reference-only recovery after navigation. Actual Admin/Staff sessions cannot see
the owner editor or read its endpoint. Three native cases pass, with scoped Axe,
overflow and inspected 390/1440px screenshots. A tall screenshot's fixed-link capture
artifact was distinguished from actual focus/visibility using DOM geometry and
fresh viewport captures. Shared CSS and permissions are unchanged. This is isolated
native acceptance, not hosted or real-role production acceptance. See
../../docs/help-learn/SUPPORT_COVERAGE_COMPOSITION_W16F.md. Exact-route completion,
broader channel composition and shared live-readiness evidence remain open.
The three native cases also pass on merged aff31956, whose three GitHub gates pass.
Eight fixture cases pass on the held production-environment f9a7b7ce candidate with
existing candidate-scoped authorization. No protection rule changed; temporary
provider-cookie state was removed. This is hosted fixture UI acceptance, with real
persistence established separately by the native run. Public source remains the
newer catalogue release 93f2f344; owner coverage publication still awaits Docker.

## 29 October 2026: W16E owner coverage editor

The owner can configure explicit Lagos support windows, capacity and policy state
through a review step without copying workshop hours or enabling live chat. Empty
coverage stays empty. Both branch drafts are retained in memory; stale revisions
require deliberate adoption. Unknown saves retain only an opaque browser reference
and require server recovery or reviewed cancellation. Staff/Admin do not see or read
this owner interface. Eight final browser cases passed at 390/1440px, including
populated midnight windows, stale/draft/reload states, overflow and Axe. Keyboard
Add/Remove focus and access-removal checks also pass; screenshots were inspected.
This is isolated
Playwright/Edge on reused Next 16.3.8; exact-lock, real-role and hosted acceptance
remain separate. See ../../docs/help-learn/SUPPORT_OWNER_COVERAGE_W16E.md.

## 29 October 2026 catalogue verification completed locally

Vehicles, Shop and Services redesign is integrated with current Contact/Care source. 57 distinct rendered cases pass across corrected runs, including eight widths, draft/count/Apply/history, native drawer focus and short-screen actions, error/empty/retry/image failure, progressive fitment and ten Learn/Allie/guide/practice cases. Discovery units pass 54 assertions. The final Shop fix keeps the desktop rail open after Apply while closing the mobile drawer. No real test enquiry, catalogue write, permission/schema or flag change. Exact-source CI and held production candidate verification remain required before promotion. See frontend/docs/CATALOGUE_REDESIGN_20261029.md (repository root) for evidence, deviations and physical-device/fixture limits. The retained backend is 2586c61b; inherited Care article v3 copy is a separate unpublished backend content change.

## 29 October 2026: requested catalogue redesign, rendered verification

Scope: anonymous Vehicles, Shop and Services at eight requested widths. Owner's
new complete implementation brief is read and its source/API/reference audit is
recorded in CATALOGUE_REDESIGN_20261029.md. Verified source gaps: no desktop
vehicle filter sidebar, no draft matching count, small Shop photo beside identity,
dense four-column product grid, horizontal service rows and a late problem-help
path. Existing validation, query/history, fitment, error recovery and publication
semantics are reusable. Primary references were retrieved except YourMechanic
(403); structural research is not rendered third-party acceptance.

Public BMW listing remains verified, with price/disclosure and seven healthy photo endpoints. Four concepts and a fresh 390/1440 baseline are retained. Vehicles, Shop and Services now use image-above-copy cards, desktop filter rails/mobile drawers where appropriate and improved discovery paths. Catalogue query units pass 54 assertions; eight-width rendered, exceptional-state and learning regressions are underway. C: preflight now passes around 29 GiB after owner cleanup. No schema, permission, transaction or flag changes. Remote Contact/Care source changes must be integrated and verified before release.

## 29 October 2026: W16D managed Care channels

Managed enquiry/complaint queues and linked-case channel controls now use current
same-branch Care gates, managed destinations, preserved URL context and retained
draft/focus on background reads. Final 46 focused frontend cases pass. Initial
Staff/Admin and granular view-only fixtures were extended to twelve distinct final
rendered cases across corrected runs: 390/768/1440px channel journeys and existing
assignment/revocation regressions. Header/body mismatches reproduced in both tables
are fixed, with explicit column checks. Known development preload warnings require
resource and applied-style verification; unexpected warnings/errors remain failures.
Reused local Next
is 16.3.8; the lock's 16.4.3 and hosted/real-role acceptance are not implied. See
[`SUPPORT_MANAGED_CHANNELS_W16D.md`](../../docs/help-learn/SUPPORT_MANAGED_CHANNELS_W16D.md).

## 29 October 2026: refreshed workshop fragment candidate

P1 navigation/focus, anonymous `/contact#workshop`, 1440x844. A hosted fixture
20-case Learn/Allie/guide/viewport audit passed 19 cases and reproduced the
refreshed workshop heading at y=44.98 beneath the 78px navbar (two repeat runs).
The initial-fragment path skipped every restored nonzero scroll position, so
native reload restoration could leave a partly hidden heading after layout settled.

Bounded fix waits for load/font metrics for initial fragments and corrects only a
heading partly under the sticky header. Back/Forward, normal refresh and visitors
already reading away from the fragment remain browser-owned; pointer/key/wheel/
touch cancel the pending correction. No CSS repaint, permission or business flow
change. Validation covers repeated hash reloads, real wheel input, ordinary early
touch refresh, links/breadcrumbs, Allie and walkthroughs. Initial extra assertions
incorrectly compared absolute scroll pixels while form/font hydration changed
layout; corrected to assert the actual heading visibility and retained manual
offset. A separate local run lacked the public Help/Learn flag; its unavailable
screen was a harness configuration issue, corrected to the released local mode.
Exact-source 060dba8d CI passed: Frontend 40805931087, Backend safety 40805931425
and secrets 40805931038. The tested production-environment build
dpl_AzXytZPjJgVb93kjfcb79KsuZtVH was promoted to both domains at 04:00:55 Lagos
time. Complete JSON reports now cover 24/24 passing cases: 12 viewport/navigation,
two original refresh/touch and ten Learn/Allie/guide/practice cases. The temporary
adapted touch harness was unnecessary; original tests inherit configured context
options. Its import failure was a harness error before any application test ran.

Local acceptance now passed six focused cases in the released browse/enquiries
mode: repeated fragment reload/manual-wheel checks, navigation/breadcrumbs and
ordinary refresh/touch reading at 390/1440. Scoped lint/format passed. An initial
typecheck overlapped Next dev type generation; the server was stopped and route
types regenerated before the final compiler check. No database or role changes.

After owner cleanup, bounded browser preflights pass at 20.16 GiB free. Automatic
review had rejected the agent's cache deletion; no files from that attempt were
removed. Production is now 060dba8d on both domains. Live public mobile acceptance
passes at 390/1440: repeated workshop fragment refresh, manual reading, both-domain Home
refresh, article outline/shadow, Help-to-Learn header geometry and Allie bounds/
focus return, with no page exceptions or horizontal overflow. Header horizontal
shift is zero at both widths; workshop/Learn screenshots were visually inspected.
An initial desktop assertion assumed a fixed native restored starting position.
Event tracing showed the actual 350px wheel movement persisted, with no subsequent
application scrollTo; corrected live assertions compare that movement. Both final
public journeys pass. Evidence: TEMP/aat-fragment-bmw-live-final-20261029.json and
its four screenshots. Disk postflight is 20.15 GiB free.
Signed-in Chrome briefly exposed the real BMW stock record, with no photos or sale
listing; subsequent UI automation stopped because the browser URL could not be
verified. Real BMW publication remains unverified. Physical-device and full
screen-reader coverage remain open.

## 29 October 2026: vehicle disclosures production acceptance

Released master runtime 2586c61b, Vercel dpl_H4Qy6RjQQXxfYmD9mGXGTG6i5TL9
verified on both domains after compatible API/workers became healthy. Exact-source
Frontend/Backend safety/secret CI all passed (40789879047/40789879135/40789879195).
66 focused frontend units, 78 focused isolated persistence checks, ten distinct
mocked browser cases and 45 packaged checks underpin this cycle. Final hosted
read-only acceptance passed 12 page/domain cases plus two supplemental journeys
at 390/1440: meaningful pages/no overflow or exceptions, Allie launcher focus,
context enquiry/equipment anchors, refresh scroll, help navigation/header sampling,
parts-fitment focus without black outline, location/CROSSOVER query, anonymous
staff 401, revision-3 guidance and scoped vehicle Axe with zero violations.
Browser plugin unavailable; installed Playwright/Edge fallback. Actual selected
BMW views were used only in isolated fixtures, never seeded into production.

Owner notes remain separate from inspection, known faults visible beside actions,
unknowns retained, publication requires active branch/positive price/photo and CAS.
BMW remains an unpublished private validated import, waiting for genuine branch,
price and owner review. No real customer enquiry, availability or transaction write.
Physical devices, real private roles, full screen-reader and independent BMW
inspection remain unverified. Existing transient dock/content overlap review and
broader Care/visual backlog remain open. See backend/docs/vehicle-marketplace-
implementation-20261028.md for matrix, receipt identities and screenshot paths.

## 28 October 2026: catalogue cards reflect vehicle-choice availability

The released Parts catalogue at 390/1440px had one published Engine Oil Filter.
The public fitment-make lookup returned no choices and the finder directed the
customer to ask the team, while the product card still said to choose a
vehicle. Search for `oil`, no-match search, Back restoration, filter Escape and
focus return passed on the live domain. A separate 390x700 measurement found
brief support-dock overlap as the product-detail enquiry action entered the
viewport; scrolling exposed the whole action and the link had already passed
the actual handoff test. No global dock change is included.

Product cards now invite vehicle selection only after a successful nonempty
make lookup. Empty, loading and failed lookups direct customers to the team;
any listed application still requires fitment confirmation. Product records,
availability, price, fitment decisions, navigation and enquiry submission are
unchanged. The local rendered catalogue cases passed at 390/1440px with
positive, empty and failed makes, the working finder choice, no page errors or
horizontal overflow. The existing product-detail audit passed 2/2 at both
widths, including enquiry handoff and scoped accessibility. Public catalogue
GETs used the real published item; identity and writes were isolated. Browser
plugin was unavailable, so existing Edge/Playwright checks were used. Exact
source checks and hosted release acceptance are pending. Real account,
physical-device and full screen-reader acceptance remain open. A concurrent
public-copy release and garage/privacy master update are integrated before
this catalogue change is published.

## 28–29 October 2026: shared Care channel controls, local checkpoint

Customer `/dashboard/support/{enquiries|complaints}/:id` and legacy
`/admin/support` / `/admin/support/{enquiries|complaints}/:id` retain their canonical
case/message forms. New controls provide reviewed channel request/join/transfer/end,
reference-only unknown-outcome recovery and durable cancellation. New public updates
offer an explicit jump without moving the reader or acknowledging notifications;
reply drafts stay editable. A compact queue/availability disclosure links back to
existing cases and requires explicit opt-in. Refresh and paging use shared secondary
buttons, 44px targets and visible focus; no online or wait-time promise is invented.

Evidence: 13 new intercepted browser scenarios accepted across corrected runs,
plus three existing browser regressions (stale record, uncertain reply recovery,
single-flight internal note). Actual passive polling preserves editor focus and
the new-update notice stays until explicitly opened, including when already loaded.
Choosing it focuses the timeline entry. Background draft editing does not unlock
review/send or bypass pending/storage/rate-limit guards. Customer layouts at 390/1024px and legacy Staff,
Admin/Super Admin at 360/768/1440px passed overflow and Axe checks. Browser runtime
error/overlay checks pass in accepted runs. Screenshots and JSON receipts are outside
Git at `%TEMP%/allied-w16-care-ui-20261028/`; the Browser plugin was unavailable,
so existing Playwright/Edge was used. Scoped frontend units: 37 pass. Early cold-
compile, fixture-envelope/CSRF and worker-start failures remain documented rather
than counted as acceptance. The task preview was stopped; other previews retained.

This is local fixture/native evidence, not production or real-role acceptance.
Responsibility-managed enquiry/complaint views, owner coverage editing, actual
browser/API composition, hosted multi-instance/reconnect/load checks and final
publication remain unfinished. No real support message, inventory, provider call
or staffing/AI/live flag was changed. See
[`SUPPORT_CHANNEL_DISCOVERY_W16C.md`](../../docs/help-learn/SUPPORT_CHANNEL_DISCOVERY_W16C.md).

## 28 October 2026: bounded public content and imagery improvement

Current cycle: owner's content brief, instruction 7. Home now has a stable offer,
three distinct tasks, sparse published services, real equipment, compact Shop and
vehicle preview, conditional real feedback and practical visit/help information.
Repeated motto/campaign/principle/process blocks are removed from Home/Services;
About retains the approved mission and all principles. Vehicles uses a separate
neutral editorial derivative and charcoal caption; originals and factual colours
are preserved. Missing product photos are excluded from Home eligibility, while
catalogue fallbacks and authoritative stock states remain. See
[copy, imagery and acceptance handoff](PUBLIC_COPY_IMAGERY_20261028.md).

Evidence: local types/lint; 23 focused state/regression cases; Home fixtures at
320/360/375/390/430/768/1024/1280/1440/1536px; synthetic empty/error/retry,
published reviews, broken/long media, doubled text, menu/keyboard, and scoped
Axe at 390/1440px. First failures included stale fixture stock/refresh assumptions,
missing fixture detail data and a mobile hero contrast regression, corrected.
Read-only public-data layout/interaction coverage passed all five pages at five
widths. Published bee7ed8f / dpl_Akw8ic1B6NQFGgL7tDDrm3pskZZ3 on both domains
with all three exact-source CI gates successful. Hosted acceptance passed 12
recorded checks at 390/1440px, including www refresh/scroll, Allie launcher/focus,
contextual vehicle enquiry and equipment anchor. Final current-tree fixture
recheck passed six responsive/state/Axe cases; counts 0/1/3 and pricing selection
also passed isolated browser fixtures. See the linked handoff for evidence/limits.
No real stock/reviews, backend, permissions or commerce/AI/chat flags changed.
Outstanding editorial copy/photo/reviewer dependencies are recorded separately;
physical devices, full screen-reader and signed-in journeys are outside this cycle.

## 28 October 2026: product detail fitment availability and retry

Route `/parts/89fd9258-c580-43e9-9040-c7e52623e82d`, anonymous at 390/1440px.
The published API returned zero vehicle makes. The live product detail still
said "Choose your vehicle to check approved fitment evidence" while its action
changed to "Browse products" because there was no vehicle to choose. That
contradiction makes the customer look for a missing control. The selected
product's enquiry link and editable contact draft were verified end to end;
no message was submitted. The 390px action was initially behind the fixed
support dock at the bottom edge of the viewport, but normal scrolling and
keyboard focus exposed it and the actual link opened the correctly focused
form. Dock placement remains a separate mobile usability review, not a
claimed blocker in this cycle.

The product fitment summary now says when vehicle choices are not available,
directs the customer to ask the team to check suitability, and distinguishes
that state from a failed lookup with a retry button. It preserves any actual
fitment decision and the existing product enquiry. The published product,
price, availability and compatibility claims were not changed.

TypeScript, scoped ESLint and Prettier passed. The updated rendered product
audit passed 2/2 cases at 390/1440px, including empty lookup, failed lookup,
retry recovery, product enquiry/collection, keyboard focus, scoped axe, no
overflow and intercepted account mutations. An initial local attempt used
the test fixture's old blanket 401 for browser catalogue reads and timed out;
the fixture now passes only public catalogue GETs to the same read-only
backend that supplies the server-rendered page. Other API writes stay
intercepted. Live before evidence: `%TEMP%/aat-live-product-detail-390.png`
and `aat-live-product-detail-1440.png`; local after evidence is in the
product-audit Playwright output. The candidate integrated the published
notification-availability release before rollout. Exact runtime `8d2dfd69`
passed frontend CI `40770274274`, backend safety `40770274308` and secret
guard `40770274264`; Vercel staged READY deployment
`dpl_DfQ8TmtFujaCL215HnWRuaTRuRZr` from the same SHA. Protected product and
contact reads returned 200 before promotion. Both custom domains then
resolved to this READY deployment. Post-promotion hosted product audit passed
2/2 at 390/1440px, with public catalogue GETs allowed and all
mutation/identity behaviour isolated. Real-customer, physical-device and
full screen-reader acceptance remain open. The previous
`dpl_Ch3kcHTq565fAMKne6hFT8NPKw7R` is retained for rollback.

## 28 October 2026: combined Allie integration regression correction

The held consolidated 8e6aab3b candidate reproduced two integration defects at
390/1440px: the newer explicit Learn page classification removed guide/practice
suggestions from Allie, and the merged loading message added about 42px during
access checks. Learn now offers only the guide/practice definitions already
present in its verified catalogue and permitted by its feature flags. Unrelated
page filtering remains in place. The existing positioned loading treatment is
retained while verified content is hidden and inert, with guarded focus recovery.
Conversation/handoff state boundaries, workforce invalidation and security-page
restrictions remain unchanged. Three new focused route/flag cases and the adjacent
access/conversation/handoff/search cases passed (41 tests in five files). The
failed hosted run is retained. Corrected hosted acceptance passed 47 cases; master
`a51a58b8` is published on both domains after all three exact-source CI checks
passed. Public apex/www acceptance passed 23 cases each. Exact release evidence
and remaining limits: `backend/docs/master-consolidation-release-20261028.md`.
Browser plugin unavailable: hosted checks use existing Playwright with Edge and
isolated API fixtures. They do not send support messages, seed inventory, upload to
real storage or call an AI provider. Physical-device and real-role limits remain.

## 28 October 2026: deployment-aware API image URLs

The integrated held candidate `4fbc9cbb` exposed a real framework/API mismatch.
The installed Next 16.4.3 adds `?dpl=...` to relative unoptimized image sources
on Vercel; the public product/vehicle and protected preview endpoints deliberately
accept no query parameters. Four controlled tests reproduced the URL change with
the real framework deployment bootstrap. `PublicMedia` now uses `overrideSrc`
only for its already-validated API image URLs. This preserves Next image geometry,
loading behaviour, fallbacks and approved-host/preview boundaries while keeping
the API URL exact. Server validation and permissions remain unchanged.

The first hosted run retained 68 passes and 13 failures as evidence. Four were
the known not-found stylesheet warning with Vercel's deployment query; six were
gallery/upload cases requiring investigation or fixture-environment correction;
three were DNS/connection failures. The upload fixture's `.test` storage host is
correctly unapproved in production and must be intercepted at a configured public
storage hostname for hosted acceptance. No real storage upload is authorised by
the test. Corrected rendered acceptance and publication remain pending.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

## 28 October 2026: Notification bell preview prioritizes unread updates

The initial live frontend `09efa694` / `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F`
showed an unread badge, but its five-row bell preview requested the newest rows
without an unread filter. A newer read item could displace an older unread item
from that preview. The shared customer and workforce bell now fetches up to five
unread rows when the opening count is positive. If another tab has already read
those rows, it fetches recent history instead of showing a misleading empty
preview. Opening the bell does not change read state; row links still route
through the currently authorized notification target.

The focused four-case jsdom suite passed. TypeScript and scoped lint passed.
Rendered Playwright/Edge fixtures passed the mixed read/unread case and all eight
customer, staff, admin and super-admin journeys at 390/1440px (9/9); the first
browser attempt used `127.0.0.1` and Next blocked its development resources,
then the same test passed on the server's `localhost` origin. Fixtures do not
prove live authenticated-role behavior. No customer record, read state, message,
backend, schema or provider was changed. Physical-device and full
screen-reader acceptance remain open. During release preparation, both domains
advanced to navbar runtime `4aafaebb` / `dpl_F5XnU2aiSxhtK78P8dnbvrffYCR5`.
Both domains then advanced to favourites runtime `ef06efb7` /
`dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv`. Both published sources are merged into
the notification branch. On that source, 36/37 integrated header and
notification browser cases passed with Help & Learn enabled. The remaining
historical-commerce case passed after setting the local launch mode to the
production `browse_enquiries` value; the default `full` fixture had exposed a
test-environment mismatch. Exact-source GitHub frontend, secret and backend
safety checks passed on `ddfab325`. Production then advanced to Learn/Allie
runtime `072e0509` / `dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz`; that source was
merged. A local full check was stopped
after the disk preflight fell below the owner's 20 GiB reserve; the shortfall
later cleared without any cleanup. The product-favourite browser fixture
requires server-side product data and cannot run on this standalone server.

Final runtime `1a33815c` passed frontend release CI `40713279695`, secret
guard `40713279399` and backend safety `40713279822`. Vercel built
`dpl_71G8rw7VmXo7WZZCDJpvTb5eCMib` from that exact SHA with production
settings; protected hosted reads of Home, Help, Learn, Parts and Notifications
returned 200. Promotion succeeded and both custom domains independently
resolved to the same READY deployment. Post-promotion Playwright passed the
mixed unread preview plus eight customer, staff, admin and super-admin
journeys at 390/1440px with synthetic API data. No production notification
was marked read and no real account write occurred. The previous
`dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz` release remains available for rollback.
Real authenticated-role, physical-device and full screen-reader acceptance
remain open. Disk reserve was rechecked after promotion and no Docker resource
or database was modified.

## 28 October 2026: Learn, Allie and walkthrough interaction audit

Owner requested exhaustive interaction of /learn, Allie and optional walkthroughs.
Finite cycle covers anonymous public journeys, synthetic delayed/error/access changes,
keyboard controls and narrow/desktop layouts. Reused the contact-validation worktree
on fix/learning-interaction-audit-20261028, initially from dfd79d91 (same runtime
as published 4aafaebb). A later favourites release ef06efb7 was observed during
verification and was merged before publication. Other dirty work is preserved.

Verified P1/P2 issues and fixes:

- Learn selected Find an answer while showing guides/practice. Explicit All help
  selection, matching panel label and keyboard Home/End/arrow handling now agree.
  Search submission reveals/focuses results; Clear search restores the input.
  Text-field blur does not interpret aria-controls as a navigation instruction.
- Allie ranked the broad homepage overview above the specific parts task. Exact
  normalized task-title matches now rank ahead without using unrestricted content.
  Repeated questions/intents reveal the answer; whitespace gets actionable feedback.
- Periodic/focus access verification collapsed Allie and dropped input focus.
  Content remains invisible, aria-hidden and inert during checks, retaining geometry.
  Focus restores after the React commit only when the access key is unchanged and
  no intervening interaction selected another destination. Denial/malformed data
  removes previous content; identity changes clear inputs/progress as before.
- Mobile Try page controls silently returned to written mode. The ineffective action
  is absent on compact screens; responsive highlights resume on expansion unless
  written mode was deliberately chosen. Missing/obscured controls offer an immediate
  written fallback. Step changes reset panel scroll, completion retains a focus
  destination, and removing/changing the same-page guide fragment closes the guide.
  Cross-page pause remains supported. A final real-content probe also found that an
  unavailable guide stayed over Learn after Available learning; that navigation now
  explicitly closes its guide, with a regression assertion. Guide exit restores an
  available same-page launcher after the floating dock becomes visible again.
- Practice search/review results are focused and revealed. Existing local-only inputs,
  explicit sample replacement, errors, choices, reset and exit boundaries remain.

No backend content definition, semantic target, business rule, permission, feature
flag, transaction or database change. Reviewed catalogue and eligibility remain
server-owned. Generative AI remains off. No actual support or account write.

Browser plugin unavailable; existing Playwright/Edge and dependencies reused.
Fifteen focused learning units pass, scoped lint and TypeScript pass. New ten-case
browser suite exercises search/empty recovery/disclosures at 320/390/768/1440px,
Allie repeated questions/alternatives/context/intents/keyboard close, delayed access
geometry/focus, denial/retry/identity changes, responsive guide pause/resume/restart/
completion/hash/error recovery, and practice errors/replacement/review/reset/return.
The first delayed-focus run exposed a React commit timing race; restoration moved
from a requestAnimationFrame into the post-commit effect and both focused cases
passed. Ten interaction cases passed locally before the last recovery-link
assertion was added; the combined local run reached 23 passes before a renewed
disk-reserve stop. Final exact-source hosted regression is recorded below.
Evidence remains in %TEMP%/aat-learning-* and the maintained e2e/unit tests.

Disk preflight initially passed at 26.74 GiB free with a 1 GiB budget. A later
measurement fell to 19.15 GiB; task-owned dev/browser/test processes were stopped.
Read-only inventory preserved all source, caches, dependencies, other tasks and
Docker/data resources. Free space subsequently returned to 25.74 GiB without any
agent deletion. A subsequent check again fell below reserve. Native npm cache
verification
reclaimed 185 unreferenced blobs (101,752,433 logical bytes). Automatic approval
review rejected the combined generated-cache/duplicate-CLI removal command with
"blocked by policy"; no alternate agent deletion was attempted. At the owner's
request, exact manual PowerShell/native npm instructions were supplied. The two
generated directories were subsequently absent and a fresh preflight passed at
20.45 GiB free before hosted testing. These are point-in-time measurements, not a
machine-wide quota guarantee.

Acceptance limits: intercepted data is synthetic, not real authenticated-role
acceptance. Physical Safari/Android phones, mobile OS keyboards, full screen-reader
acceptance and inaccessible private guides remain unverified. No claim of complete
WCAG conformance or absence of every possible site defect.

### Learning audit production release

Final runtime `072e0509683df08c8635c495a76245ea1cc60379`, Vercel
`dpl_Bov9FbKyy4yPMRqWnJG3CpX6MMQz`, is READY and promoted on apex/www.
The promotion guard verified project, runtime, both previous alias ancestries and
all three green exact-source workflows. Preserved prior favourites deployment
`dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv` / `ef06efb7` for rollback. The first build
`dpl_2yoSNBWLTchrnmzy49kGXgUjKMtt` was superseded by the final recovery-link repair
before public alias promotion.

[Frontend release CI](https://github.com/Otto-space/allied-autotech/actions/runs/40710727313),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40710727576)
and [isolated database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40711362859)
passed. Frontend gates include locked dependencies, zero reported production audit
vulnerabilities, lint, types, complete units, Next 16.4.3 optimized build and format.
The last frontend-only commit did not trigger the path-filtered database workflow;
it was explicitly dispatched at the same frozen commit and passed against isolated
CI PostgreSQL. No application database test/write or backend release occurred.
Backend `8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650` remains ACTIVE without pending
release. Provider backup inventory showed eight backups, newest 2026-10-28T05:22:10Z;
existing separate restore receipt passed with equal original row hashes on
2026-10-26T19:53:05Z. No new shared restore or database safety override.

Hosted acceptance passed all 39 cases on actual deployed CSS with no asset patch:
%TEMP%/aat-learning-hosted-regression. This includes ten new interaction cases,
seven refresh/Help/authentication-focus cases, ten dock/navigation/selection cases,
five container/control-focus cases and seven navbar cases. APIs are intercepted
synthetic GET/auth fixtures; these do not count as real signed-in acceptance.

Separately, real public-content interaction passed at 390 and 1440px: all six
available articles and both disclosures, search/modes/clear/empty recovery, Allie
relevance/repeat/alternatives/context/guide/practice controls, guide entry, page
highlight, written reference, pause/resume/restart/completion/exit, same-page Allie
guide start, and the actual Corolla practice's sample fields, fictional search,
each evidence disclosure, each choice/review, reset and return. Additional real
320x568, 701x900 and 844x390 checks passed for overflow, modal fit and close access.
Scoped automated Axe scans passed for hub/Allie. There were no page exceptions or
API writes in this public audit. Receipt: %TEMP%/aat-learning-live-acceptance.json.
Screenshots aat-learning-final-hub-320.png, aat-learning-final-hub-1440.png and
aat-learning-final-allie-390.png were visually inspected; files remain in %TEMP%.

Real www-domain 390/1440 checks also passed repeated article refresh without the
dark focus border, specific Allie relevance, hide-floating-help/Help-card reopen,
keyboard focus return, retained Whatsapp access and unavailable-guide navigation
cleanup. Receipt: %TEMP%/aat-learning-www-acceptance.json. Both provider aliases
were rechecked against the same final runtime/deployment. Physical-device, real
private-account and full screen-reader acceptance remain open.

## 28 October 2026: Stable navbar through Help to Learn navigation

Reproduced the owner's exact anonymous journey on deployed source `09efa694`:
Help → Explore Help & Learn. Desktop frame samples repeatedly alternated header
height 78px/68px and scrollY 20px/10px. The brand stylesheet shortened the sticky
header when scrollY exceeded 12px; browser scroll anchoring then crossed that same
threshold in the opposite direction, creating a continuous feedback loop. Mobile
390px retained its 68px header and did not exhibit that height loop in this probe.
Before receipts: `%TEMP%/aat-navshake-before-390.json` and
`aat-navshake-before-1440.json`.

Removed the scrolled-state height override. Header geometry now remains stable at
its existing responsive height: 78px above 700px and 68px at/below 700px. Existing
scroll elevation/background treatment and navigation behavior remain. The source
change is limited to the brand stylesheet; the preceding focus, Help, customer
history and saved-item releases are preserved. No permissions, data, flags or
backend changes.

Browser plugin unavailable; reused Playwright/Edge. All seven pre-publication
regression cases passed at 390, 700, 701, 768, 1024, 1280 and 1440 pixels, using the
real optimized production stylesheet with only the offending height declaration
removed in intercepted asset responses. Checks sample header/brand geometry during
the actual link transition and loading/results states, verify settled scroll
position, visible destination breadcrumbs, scroll positions 0/10/13/20/35/200,
retained scrolled shadow, and Back/Forward navigation. APIs were intercepted
read-only synthetic responses; no real writes. Receipt:
`%TEMP%/aat-navbar-prepublication`; screenshots `aat-navbar-stable-390.png` and
`aat-navbar-stable-1440.png`. These are pre-publication probes; exact deployed-CSS
acceptance is recorded below after release. Real signed-in account changes,
physical-device browser behavior and other inaccessible states are not claimed.

### Navbar production release and hosted acceptance

Runtime `4aafaebb5ab3f42bf8fd6c99c0e4fa7bdb0df42e` was built READY and promoted
as `dpl_F5XnU2aiSxhtK78P8dnbvrffYCR5`, confirmed on apex/www after acceptance.
The guard verified project/source, green exact-source checks and inclusion of both
previous alias sources. Prior `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F` is retained for
rollback. No backend deployment or application data write was initiated by this
task. A concurrent backend release was observed ACTIVE as
`8fd37e1c-d2e2-4e2f-bbe4-3e9acb8c5650`; it was preserved and the real public
journey was verified against it.

Exact-source [frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40702876484),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40702876575)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40702876589)
passed. Frontend checks include locked install/runtime audit, lint, typecheck, full
unit suite, optimized production build and formatting. The only runtime diff from
the prior release is the four-line brand stylesheet change.

All seven browser regression cases passed against actual deployed CSS with the
asset override disabled: `%TEMP%/aat-navbar-live-tests`. These use intercepted
read-only API fixtures. Separately, the exact Help → Explore Help & Learn → open
an answer journey passed against real public content at 390 and 1440px, with
Playwright's scrollbar hiding disabled. Header/brand geometry remained stable
through 183 mobile and 174 desktop frame samples; heights stayed 68px and 78px,
and settled scrollY stayed 8px and 20px. No page errors; the article focus outline
and shadow remained absent. Receipt `%TEMP%/aat-navbar-live-acceptance.json`, frame
traces `aat-navbar-after-390.json` / `aat-navbar-after-1440.json`. Screenshots
`aat-navbar-live-390.png` / `aat-navbar-live-1440.png` were inspected. The separate
pre-publication classic-scrollbar/loading probe also kept desktop header width
1425px and brand x=52.5px across the transition.

Private signed-in account-state changes and physical Safari/Android devices remain
unverified. No dependency installation, duplicate local build, new worktree or
Docker resources were required. Final disk preflight passed at 26.53 GiB free;
this is a point-in-time check. Unrelated main checkout changes were preserved.

## 28 October 2026: All automatically focused containers

The owner confirmed that the dark automatic-focus border must be removed from all
containers, including completion headings, dialogs, confirmation/status/error
panels and grouped sections. Interactive keyboard controls retain their focus
indicators. Reproduced the reported direct refresh at
`/learn?article=parts-fitment` on production source `0b5a9b76` /
`dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno`: the focused answer had a 3px dark outline
and white focus shadow despite its existing exception. The optimized stylesheet
loaded a scoped learning rule after an equal-specificity global exception. About,
workforce and payment styles also have container focus selectors.

The root policy now covers programmatically focused non-interactive negative-tabindex
containers, dialogs and static ARIA panels as well as the existing destination
marker. Its explicit specificity exceeds the scoped container rules regardless of
chunk order. Native controls, editable fields and composite widgets (including
negative-tabindex options) are excluded. Normal dialog borders, error borders,
focus ownership, announcements, scrolling, keyboard behavior and permissions are
preserved. No component rewrite, backend/schema, content definition or flag change.
The newer customer-history/saved-item release is the base and remains included.

Browser plugin unavailable; reused installed Playwright/Edge. Pre-publication
checks used the exact source policy prepended to real optimized stylesheet
responses, with CSP enabled. Five regression cases passed: direct article refresh
three times at 390/1440 pixels; Allie response focus at both widths; automatic
heading/section/panel/fieldset/status/error/dialog focus, retained error/dialog
borders and retained keyboard field/button/roving-option focus. An additional
anonymous browser audit passed 19 public routes and their rendered static focus
targets (Home, About, Contact, Help/article, Learn/article/unavailable guide,
authentication pages, Services, Shop, Vehicles, Reviews, Privacy). These are
asset-patched pre-publication checks, not yet exact deployed-source acceptance.
Receipts: `%TEMP%/aat-container-focus-patched-final`,
`aat-container-surface-patch.json`; before image `aat-reading-border-before.png`.
Protected-role completion/error states have source/policy coverage plus
representative synthetic panels; no real private records or transactions were used.
Physical Safari/Android and actual staff-account acceptance remain unverified.

### Published follow-up and actual hosted acceptance

Runtime `09efa694603ea7b1fcb3312974543a7e262cdf6d` is READY and assigned to both
apex/www as `dpl_9us8TLTvZJxzA8KNvdKNqFMqjg8F`. The guarded promotion verified
exact project/source, all required CI results and that both then-current production
sources are ancestors of the candidate. Prior `dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno`
(`0b5a9b76`) remains the rollback target. Backend deployment remains unchanged.

Exact-source [frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40685951828),
[secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40685951914)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40685952202)
passed. Frontend checks include locked install, runtime audit, lint, typecheck,
full unit suite, optimized production build and formatting. No local duplicate
build, dependency installation, worktree or Docker resources were created.

After deployment, all five regression cases passed on the real optimized CSS,
with the asset override disabled. The first run's desktop/panel cases encountered
connection resets; a sequential recheck passed all three without a code change.
Receipt directories: `%TEMP%/aat-container-focus-live` and
`aat-container-focus-live-recheck`. The complete real-content, read-only 19-route
public audit then passed without overrides or page errors:
`%TEMP%/aat-container-surface-live.json`. An earlier concurrent audit's navigation
timeout is retained as an infrastructure/connection observation, not counted as
passing acceptance. No application API writes were sent.

The owner's exact article was also refreshed repeatedly using actual public
content: its focused container has `outline-style: none` and `box-shadow: none`.
The www article passed the same check. Before and after screenshots were inspected:
`%TEMP%/aat-reading-border-before.png` and `aat-reading-border-after.png`.
Authored prerequisite/error/dialog borders remain; focus stays on the intended
destination and controls retain keyboard indicators. Real authenticated private
states and physical-device/browser acceptance remain unverified as recorded above.
Final disk preflight passed at 27 GiB free, a point-in-time check; unrelated main
checkout changes were preserved.

## 28 October 2026: Refresh scrolling, reading focus and Help & Learn

Owner-reported cross-phone homepage jumps were reproduced on production
`552ee418` / `dpl_79uCiatbRsCvM2jtPJkwsx53efpP`. Two of three immediate-scroll
refreshes returned to zero after delayed focus of `main`; the global pointer-end
and visual-viewport handlers could also re-reveal an old focused destination.
Receipt: `%TEMP%/aat-refresh-baseline.json`.

The shared coordinator now leaves initial document positioning and history
restoration to the browser, adjusts genuine route entries/fragments, cancels queued
adjustments on new touch/wheel intent and reveals controls after a tap rather than
a scrolling/cancelled touch. Address-bar resizing does not re-focus old page
content. Native navigation is immediate. Reading destinations (breadcrumbs,
answers, Help results and MFA completion) receive semantic focus without a large
outline/shadow; keyboard controls retain their visible focus styling.

Help category selections reveal their results; search and clear retain useful
focus. The learning hub has breadcrumbs, waits for an answer to load before
revealing it, and offers written-answer recovery for empty modes. Corrected visible
question-mark separators. Allie offers eligible topic shortcuts, directs focus to
answers, supports another question and useful unmatched-search recovery, avoids
empty guide/practice actions and queues the first launcher click across hydration.
Navigation out of Allie no longer restores focus onto its old launcher. Modal
content remains internally scrollable without a visible scrollbar, with a fixed
close header. Guides add progress, retry, a deliberate show-control action and
compact mobile written steps with an expandable full reference.

Scope: existing public Help, Learn, Allie, optional guides and shared viewport
behavior, plus mocked login/MFA completion. Backend definitions, semantic targets,
permissions, feature flags and business policy are unchanged. Restricted learning
continues to be served and revalidated by the backend. Practice remains local.
This is a presentation/interaction cycle, not completion of the separate Revision 4
AI/workforce brief.

Verification: Browser plugin unavailable; reused Playwright and installed Edge.
Local evidence distinguishes browser-driven touch gestures, intercepted API
fixtures, automated axe checks and hosted anonymous acceptance. Focused browser
coverage includes refresh/immediate scroll and real CDP touch dispatch at 390/1440,
login redirect/MFA completion using synthetic responses, guide pause/resume/restart/
completion, Help category/search/clear/history, route breadcrumbs/repeated anchors,
linked form selections and fixed support/modal behavior from 320x568 to 1440x900.
Screenshots: `%TEMP%/aat-help-after-390.png`, `aat-help-after-1440.png` and
`allied-allie-viewport-390.png`. Local results: 20 distinct browser cases passed across the final focused runs,
including six dock/modal viewport cases, four navigation/selection cases, seven
refresh/learning/auth cases and three Help search/history cases. Four focused unit
files passed (14 tests); lint, typecheck, formatting and diff checks passed. The
old Help tests' two payment-label expectations were aligned with the tested launch
mode. A cold development auth navigation exceeded 15 seconds once; its focused
recheck passed, and the route wait allows development compilation. Production
checks and hosted receipts are appended below when complete. Physical iPhone/Safari/Android and real authenticated roles
remain untested; browser emulation is not their acceptance.

### Production acceptance

Runtime `0d4dd9921d28c7b9c87020c5c045496874473de2` is deployed as
`dpl_DAgy9emEabtd3H58kWjoBw35EUUc` to both alliedautotech.com and
www.alliedautotech.com. The guarded promotion re-read both previous aliases and
verified their source was included. Rollback is the preserved preceding deployment
`dpl_79uCiatbRsCvM2jtPJkwsx53efpP` (`552ee418`). No backend was redeployed.

Exact-source checks passed:
[frontend production checks](https://github.com/Otto-space/allied-autotech/actions/runs/40678376969)
(locked install, runtime audit, lint, typecheck, full unit suite, production build,
formatting), [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40678377082)
and [database safety CI](https://github.com/Otto-space/allied-autotech/actions/runs/40678376941).
The Vercel production build is READY. No application database writes or migrations
were made. Read-only operational preflight found eight managed backup entries,
latest 28 October 05:22:10 UTC, and the existing successful separate restore receipt
from 26 October; this task did not perform a new restore rehearsal.

Live Edge acceptance passed at 390 and 1440 pixels: three actual reload/immediate
trusted touch gestures per viewport, Help search/result focus, full hub navigation,
public guide written-mode completion/exit, Allie unmatched-search/topic recovery,
another-question focus and Escape return. The six settled positions remained below
the preceding position rather than returning to the top. No page errors or real API
writes were observed. Receipt: `%TEMP%/aat-live-acceptance.json`. This touch check
replaces an unsuitable programmatic-scroll probe: native reload restoration may
replace a script-issued scroll, so that probe is not counted as user touch evidence.
The hosted login/MFA focus checks also passed (two intercepted synthetic cases,
`%TEMP%/aat-live-auth-focus`). The www learning page returned 200 with its new
breadcrumb and no horizontal overflow. Screenshots inspected:
`%TEMP%/aat-live-allie-390.png`, `aat-live-guide-390.png`, `aat-live-allie-1440.png`.

No Docker resources, dependencies or duplicate worktrees were created. Existing
suitable dependencies/worktree were reused. Final disk reserve preflight passed at
21.74 GiB free; this is a point-in-time check. Next acceptance priority is physical
mobile browser/keyboard behavior and genuine permitted/denied account journeys;
these are not certified by the synthetic authentication or Edge emulation checks.

## 27 October 2026: Workshop address and Whatsapp labels

Updated the public address to "133 Stadium Road, beside Kilimanjaro Pizza Jungle
Restaurant, Port Harcourt, Rivers State, Nigeria" in the shared business details,
Contact visit card, map destinations, Help guidance and search metadata. Public
contact surfaces no longer render phone digits; the footer, About and Privacy
offer a Whatsapp link. Existing call actions use descriptive labels. Messaging
links retain HTTPS and explicit opener/referrer protections. Search structured
data no longer publishes a telephone field. Link destinations necessarily retain
the number; this is not number secrecy or a claim about the business's WhatsApp
account encryption configuration.

Browser plugin not available; reused Playwright/Edge. Local anonymous checks at
390 and 1440 CSS pixels passed Contact, About, Help, Privacy and the workshop
guide: correct page title, meaningful main content, full address, no visible phone
digits, no horizontal overflow, no framework overlay or page errors. Map queries
contain the full address. Keyboard activation of the footer Whatsapp link opened
the expected HTTPS host with null opener and empty referrer (destination
intercepted; no message sent). Screenshots: `%TEMP%/allied-location-390.png` and
`allied-location-1440.png`; receipt: `allied-location-browser.json`. These are
local, mocked API checks, not real-device or authenticated acceptance.

Updated 27 October 2026. This is the ongoing quality register, not an assertion
that every route or state has passed review. Work proceeds in finite batches.

## Standing responsibility and source

Current bounded implementation: reviewed Customer Care handoff W15; see the final checkpoint and docs/help-learn/REVIEWED_HANDOFF_W15.md. Complete Revision 4 remains active.

Prior W14B checkpoint: W14B reviewed Care policy foundation. Immutable v1
is preserved; v2 adds separate view/reply/assign/live duties. Job positions remain
fixed, existing delegated v1 management stays usable and unknown old names do not
become authority. 45 native regression/final5 focused cases,51 backend units,
full1134 frontend plus29 focused/final12 component,8 final responsive fixtures,
types/contracts/lint/secret guard and final cached build passed. Fixed real review
reason loss while retaining immediate password clearing. Operational Care adapters,
handoff and staffed transport remain required; these duties are not declared usable
or deployed. See `docs/help-learn/WORKFORCE_CARE_POLICY_W14B.md`.

W14A prerequisite: branch-specific Care contact boundary. Mixed-branch
Staff/Admin and natural-expiry lock-wait defects were reproduced and corrected.
Six native cases,13 parser units and8 responsive fixtures at390/1440 passed;
foreign contact responses fail closed, legitimate Sales reply access remains.
See `docs/help-learn/WORKFORCE_CARE_CONTACT_W14A.md`. No publication/schema/provider
call; granular Care duties, reviewed handoff and staffed shared transport remain open.

Previous bounded implementation: Revision4 W13 scoped financial aftercare, branch
`feat/workforce-scoped-aftercare-20261027`, based on W12 `e31af199` in the reused
`allied-home-restoration-20261025` worktree. Finance branch scope and the separate
financial approval duty both govern the queue/detail/decision. Customer-visible notes,
internal evidence, current-review HMAC and uncertain outcome recovery are explicit.
Final62 native,60 backend units, full1130 frontend/final67 focused,21 responsive
fixtures and1 actual native-browser case passed, with types/contracts/lint/build.
No new schema, provider call, external customer message or publication. AI defaults
stay off and W9 allowance remains exhausted. Granular Care authority, canonical
reviewed handoff, gated shared staffed transport and all106 route learning acceptance
remain open. Evidence: `docs/help-learn/WORKFORCE_AFTERCARE_W13.md` and retained W12
booking/W11 independent-grant/W10 history/W9 evaluation checkpoints. Customer-table/
sidebar responsiveness remains Cycle13; unrelated newer release work is preserved.

Deployed colour/state baseline: the owner's complete colour/state brief, branch
`feat/colour-states-20261026` in the reused `allied-shop-vehicles-r2-20261025`
worktree, based on `3cea520f` / released runtime `8c11c3a0`. Shared black/red/white
tokens and contextual states are deployed as runtime `d6d8534d`, preserving the
newer workforce release. See [production evidence](../../backend/docs/colour-production-20261026.md).
See [colour/state report](COLOUR_AND_STATE_REPORT.md) for the exact evidence and
remaining native/platform and three cart-drawer verification gaps. The prior
customer-table cycle is retained below. Separate workforce work, permissions,
data and unrelated worktree edits are preserved.

Notification Cycle 8 was deployed on 25 October 2026 from runtime source `345847d5` after locked
Next 16.4.3 CI and optimized hosted acceptance. Genuine native delivery/click
acceptance remains open.
See Cycle 8 and [notification contracts/evidence](../../backend/docs/notifications-experience-20261025.md).
Real authenticated production-role acceptance and genuine native background-push
transport/click acceptance are not claimed. Cycle 8 retains the released Cycle 7
catalogue/enquiry behaviour and preferred Home.

Read the complete [29-section directive](Allied_AutoTech_Continuous_UI_UX_Codex_Prompt.md)
and root `AGENTS.md` before relevant work. The original supplied file is preserved
byte-for-byte, SHA-256 `3dd72b1af1f2c3e36162db1ddf089fb7fbad9fc39b1244c3e9902663202831d9`.
Future frontend contributors own interaction, accessibility, content, layout,
responsive behaviour, performance and recovery quality as part of their task.
Update this register when evidence or scope changes; regenerate the inventory
when routes or interaction surfaces change. Do not open a new audit document for
every small change or redesign an already effective interface without evidence.

The authoritative release source was `af9d8b94`, worktree
`allied-discovery-fitment-20261023`. The first cycle uses branch
`feat/continuous-ui-quality-20261024` in `allied-ui-quality-20261024`, based on
that exact source. The older main checkout and independent audit/copy edits
were preserved. Live baseline was Vercel `dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr`;
recheck both custom-domain deployment IDs before publication. Existing
site-completion decisions remain in `backend/docs/site-completion-tracker.md`.
The already authorized deployment does not enable payments or other real
operational actions. Current launch mode is `browse_enquiries`, workshop
collection only; no fabricated stock, fitment evidence, products or vehicles.

## Route, role and state inventory

[Machine-readable source inventory](ui-quality-inventory.json) lists all 106
`app/**/page.tsx` route patterns, dynamic segments, role families and 338 source
files with form, table, disclosure, select, file input, dialog, feedback or
boundary signals. Regenerate with `node scripts/ui-quality-inventory.mjs` from
`frontend`. These are source signals, not proofs that a route exposes a control,
has a specific permission or handles a state. Imported components and runtime
configuration must be followed during each focused review. Legacy
`redesign-route-audit.md` and `docs/page-quality/` retain historical context;
they do not substitute for current rendered evidence.

| Route family                                     | Required role/context                                            | State checklist for each relevant journey                                                                                                                                                                              | Current rendered coverage                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Public home, about, contact, reviews, privacy    | Anonymous, then signed-in navigation                             | Initial, meaningful content, empty/missing content, contact form validation/pending/success/error, navigation and enquiry recovery                                                                                     | Hosted initial home/about/contact sampled; reviews/privacy/form submission not reviewed this cycle             |
| Services, parts, vehicles and dynamic details    | Anonymous, customer/work browsing; current launch mode           | Loading, populated, empty catalogue, filtered no match, partial data, filter reset/URL/back navigation, unknown/unverified/incompatible/verified fitment, unavailable detail, enquiry validation/pending/error/success | Hosted list initial state sampled; actual result correctness and detail/state coverage not reviewed this cycle |
| Help index and `/help/[slug]`                    | Anonymous, customer, staff, admin, super admin                   | Search/no match/topic/reset, article/unknown slug, native disclosure, role-aware actions, pending identity, expired/failed/malformed identity, retry and stale session                                                 | Focus of cycle 1; exact test evidence below                                                                    |
| Authentication and invitation routes             | Anonymous; valid/invalid/expired token; MFA pending/verified     | Validation, pending, duplicate/expired submission, server/offline error, success, session expiry, safe redirect and recovery                                                                                           | Hosted login initial state only; no real sign-in or invitation accepted                                        |
| `/dashboard/**` customer workspace               | Synthetic customer first; actual customer acceptance separately  | Loading, populated/empty/partial, sorting/filtering/pagination, validation, pending/success/error, stale data, denied/expired session, upload recovery, keyboard dialogs                                               | Route source inventoried; no private dashboard data accessed in this cycle                                     |
| `/admin/**`, workforce and nested work details   | Each permitted capability, staff/admin/super admin, denied roles | Dense tables, column priorities, filters, drawers/dialogs, destructive confirmation, pending/success/error, conflicts/stale updates, denied/expired session, audit evidence                                            | Route source inventoried; real capability acceptance and operational actions not performed                     |
| `/payments/complete` and legacy financial routes | Existing transaction context only, providers disabled            | Unknown/cancelled/pending/failed/completed status, refresh/retry/idempotency, safe recovery, never imply successful settlement from browser return                                                                     | Source inventoried; no financial transaction or payment enabled                                                |

For each selected route test the relevant states above at narrow phone (320 and
390), tablet (768), compact desktop (1024), wide desktop (1440), short viewport,
keyboard, reduced motion and text enlargement. A non-applicable state needs a
reason; an inaccessible state stays untested rather than being counted as passed.
Permissions are server-enforced; a mocked role-aware link does not certify an
operational capability or backend authorization.

Shared surface inventory: SiteHeader desktop/mobile menu and account navigation;
SupportWidget Quick Help modal and persistent mobile support controls; HelpCentre
search, topics, disclosures and no-match recovery; HelpAccountAction identity
loading/error/retry; catalogue filters and fitment selection; saved-item toggles;
DashboardShell navigation; operational forms, tables, uploads, dialogs and feedback.
Their source locations are searchable in the inventory. Only the explicitly
recorded surfaces below were interacted with in this cycle.

## Cycle 1: Help guidance and account recovery

Priority is user harm and journey obstruction, then frequency and reuse.

| ID     | Priority and verified problem                                                                               | Before evidence                                                                                                      | Implemented acceptance condition                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-001 | P1: Parts Help told enquiry-only customers to review fulfilment and pay at checkout; Quick Help repeated it | Hosted `/help/shop-and-collection` and Quick Help at 390px, `help-before.json` and before screenshots                | Shared FAQ explains verified versus unknown fitment, enquiry, workshop collection, no online checkout and no stock reservation; payment/booking preparation and Help intro respect launch mode                                           |
| UI-002 | P2: Quick Help emitted raw customer dashboard links even anonymously or in a work session                   | Anonymous hosted MFA answer returned `/dashboard/security`; unconditional source bypassed the work-role resolver too | Use the existing role-aware action component: anonymous sign-in continuation, customer destination, work security destination or customer-only explanation; pending identity exposes no stale shortcut; failed/malformed check has retry |
| UI-003 | P2: Modal answer could remain after closing, even though identity may change before reuse                   | Source-confirmed persistent answer state; no claim of a reproduced security exposure                                 | Clear answer on close, preserve typed question, restore trigger focus; session-change event discards sensitive drafts/answer as before; external fallback states new-tab behaviour                                                       |

The first browser pass additionally reproduced a 4.37:1 answer-link contrast
failure against the notice background (UI-004, P2) and focus leaving the modal
at a keyboard boundary (UI-005, P2). The existing darker brand-red token restores
contrast; scoped answer actions retain 44px targets. Explicit forward/reverse Tab
wrapping complements native modal behaviour. These are measured fixes within the
Help journey, not a site-wide accessibility claim.

Reused the existing FAQ source, role resolver, dialog, Link/button styles and
article action logic. Article imports retain a compatibility export of the shared
component. No new dependency, typography, token, layout system, permission,
backend route, database schema, catalogue record or operational policy was added.
The approved Quicksand/Nippo typography, red/navy/white palette and logo remain.

### Evidence and verification

Browser plugin not available in this session; existing Playwright with installed
Microsoft Edge is the fallback. No browser or dependency download was required.
Hosted baseline: 8 anonymous routes (`/`, `/services`, `/parts`, `/vehicles`,
`/about`, `/contact`, `/help`, `/login`) at 1440 and 320, 16/16 HTTP 200 with
meaningful H1, no horizontal overflow, no unnamed visible fields or `href="#"`.
This is initial-state sampling, not full journey/accessibility acceptance.
Anonymous session requests generated expected 401 console entries on some
routes; these are not silently described as a clean console. No page exceptions
were collected. No customer records, real message or form submission was used.

Local verification status is recorded after the finite batch below. Browser
identities are synthetic intercepts of `GET /api/v1/auth/session`; they do not
connect tests to an application database. The local preview has no backend origin.
Evidence receipts and before/after images are outside the repository in
`%TEMP%/allied-ui-cycle-20261024`; browser output uses the repository Playwright
temporary output directory. Screenshot names from the focused suite start
`%TEMP%/help-launch-article-` and `help-launch-quick-`.

Completed cycle verification: full frontend lint, TypeScript and formatting passed;
147 unit files / **988 tests passed**. All 59 existing Help/article regression
scenarios passed across the initial run and explicit rechecks, plus the adjacent
anonymous-session draft-preservation scenario. The first full-mode run had 57
passes and two failures: one development chunk-load failure disappeared on a
fresh-server recheck; one outdated no-JavaScript search assertion expected only
one MFA article despite the published recovery article. The test now verifies
both named articles and the no-JavaScript journey passes. Recheck: 3/3 passed.
The initial enquiry suite passed 14/14. The final expanded enquiry suite passed
**15/15 against the optimized production build**, including reverse Tab,
unobscured focus and actual anonymous sign-in-link navigation. The build and
postbuild passed. Across the completed runs, 75 distinct browser scenarios passed
(59 Help/article + one adjacent header draft + 15 current-launch scenarios).
Five current-launch viewport cases had zero axe violations in the checked tags,
no page exceptions or unexpected console errors, meaningful page title/H1, no
framework error overlay and no horizontal overflow. Expected anonymous session
401 responses were explicitly allowed. Mobile/desktop production-build
screenshots were visually inspected, including the keyboard-focused answer link.
These local role/session responses are fixtures; publication identity follows below.

Production preflight: provider inspection at 19:53 UTC confirmed the unchanged
ACTIVE backend deployment `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`, no pending
backend deployment, database online and eight managed backups, latest
`2026-10-24T05:22:10Z`. The release review's same-day encrypted managed backup,
seven-day retention/PITR evidence and actual separate 86-table archive restore
rehearsal were reviewed. This frontend-only cycle ran **no database commands,
writes, migrations, new backup or restore rehearsal**. No Docker image, container
or volume was created or removed. Completion review retained the 13 existing
containers and all volumes, 10.3GB images and 4.398GB reusable build cache.
Dependencies were reused through a worktree junction, with no npm installation.
No space-recovery claim is made for this UI cycle.

### Published release and handoff

Implementation commit **`bd0ac141af2700429cb78ef1c109bbcde61b1465`** is pushed
on `feat/continuous-ui-quality-20261024`. GitHub's
[frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40127992888),
[database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40127992877)
and [redacted secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40127992866)
all passed for that implementation. The CI production dependency audit step
also passed; dependencies were unchanged in this batch.

Vercel production **`dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved through
provider inspection to that exact deployment at **20:08:48 UTC, 24 October 2026**.
The candidate was built without domain assignment, then promoted only after the
release checks passed and both aliases were confirmed still on the expected old
release. Backend deployment remains `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`.
Frontend rollback is `dpl_Ew6X9yGVXF37FEpnqoED8srmKkzr`; no backend rollback
or schema change is part of this frontend release.

Current frontend release worktree is
`C:/Users/PC/.codex/worktrees/allied-ui-quality-20261024`. The original directive,
register, source inventory/generator, byte-preservation attributes and concise
AGENTS guidance were also handed off to the main project folder without replacing
its independent edits. Only the new handoff was appended to the site tracker.
Post-publication acceptance here is provider READY/domain identity; rendered QA
was against the local optimized production build. No new authenticated live
customer/staff acceptance or live transaction is claimed. This finite cycle is
complete; the prioritized next-cycle list below remains explicitly open.

Accessibility target is WCAG 2.2 AA. Relevant checks include
[status announcements](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
and [modal keyboard/focus behaviour](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Automated axe checks and keyboard sampling do not prove full conformance.
Screen-reader speech, real mobile keyboards, hardware assistive technology,
every translated/long-data condition and every authenticated route remain untested.

## Prioritized next cycles and completion boundaries

| Order                   | Next bounded review                                                                                                        | Status / required evidence                                                                                                                                                                                  | Owner / stop condition                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1                       | Public fitment/search/detail to enquiry, including truthful unavailable/unknown states                                     | Source inventory exists; prior release fixtures are historical, not a current live full-path audit. Use approved isolated fixtures, not fake public stock. Preserve the independent pending Parts copy work | Next relevant frontend contributor; reproduce and repair one coherent verified journey, test narrow/wide/state recovery, update register |
| 2                       | Customer workspace navigation, saved garage/photos and support across expired/failed sessions                              | No private data accessed this cycle. Existing owner-confirmed gallery acceptance stays settled; do not reopen it without regression evidence                                                                | Next customer-workspace task; synthetic states then authorized real acceptance only where needed                                         |
| 3                       | Staff capability navigation and dense data: permitted/denied, empty, partial, filter, stale conflict, retry                | Inventory only. The Help work-role link resolver is reused, not certification of every staff support capability                                                                                             | Next workforce task; representative capabilities and keyboard/table review, no real operational changes for QA                           |
| 4                       | Wider marketing forms, screen reader/text enlargement, real mobile keyboard and performance measurements                   | Initial snapshots are insufficient for form submission, complete WCAG or Core Web Vitals claims. Measure before changing layout or bundles                                                                  | Next relevant frontend task; one demonstrated issue at a time, preserve visual hierarchy and business truth                              |
| Separate existing queue | Staff media and approved real catalogue publication, payment-provider/financial acceptance and operational owner decisions | Remain in site-completion tracker; not reopened or relabelled launch blockers by this directive                                                                                                             | Existing recorded owners and approvals                                                                                                   |

Each future cycle: confirm current live source and independent edits; inspect the
real journey and component dependencies; select verified high-impact failures;
define acceptance states; implement with existing conventions; check keyboard,
responsive layout, content and recovery; run proportionate regressions; record
evidence and remaining gaps; publish only under existing authorization. End the
cycle when the selected acceptance criteria and handoff are complete. Unreviewed
routes stay visible in the inventory instead of extending work indefinitely.

## Dashboard and managed workforce cycle - 24 October 2026

The owner explicitly moved the next review to **all dashboards and managed
workforce, page by page**. This supersedes the earlier next-cycle ordering for
this task. Source starts from released `00a53eb2`, Vercel
`dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`, verified READY before branching. Worktree:
`C:/Users/PC/.codex/worktrees/allied-dashboard-quality-20261024`, branch
`feat/dashboard-workforce-quality-20261024`. Existing main-checkout and other
worktree edits were preserved. No backend, database, role or launch-policy change
is part of this cycle.

All 83 customer/work route entries were inspected individually, following their
component imports. The table is a per-page evidence index, not an exhaustive
role/state cross-product or authenticated production acceptance. Existing
page-specific fixture suites were reused; effective layouts were retained rather
than repainted. The catch-all expands into the separate managed journeys below.
The source inventory and state checklist above continue to apply.

### Verified changes

- **DASH-001 / P1:** Failed background workforce-access checks retained prior
  work navigation/content. Reproduced for managed STAFF and ADMIN. Unverified
  access now withdraws work content/links, gives an explicit unavailable state
  and retries safely. Legacy staff capability links also withdraw when their
  permission refresh fails, with a visible retry. Server authorization is
  unchanged; this is fail-closed UI, not a claim of a server data exposure.
- **DASH-002 / P2:** Dashboard drawers let Tab leave the modal boundary.
  Reproduced on the released customer shell. Customer/admin/managed drawers now
  share the already tested Help focus-containment helper, preserve Escape and
  restore the opener. Initial session verification now has a named page and
  announced pending state; unavailable session checks have a clear heading.
- **DASH-003 / P2:** Multiple inspection cards emitted indistinguishable
  `Inspection progress` landmarks (axe `landmark-unique`). Compact workflow
  progress is now an accessible group within its record, preserving stage text
  and visual design. Representative shared consumers are included in the pass.
- **DASH-004 / P2:** Owner responsibility management depended on knowing a raw
  staff reference. The existing staff-directory route is now offered prominently;
  reference lookup remains available. Unauthorized entry has a named explanation
  and a return path. No user enrollment, assignment or permission is changed.
- **DASH-005 / P2:** Customer review detail hid its content on a background read
  failure but had no Retry button. Browser reproduction confirmed the missing
  recovery. Retry now handles both foreground and background failures. Standalone review titles now start at h2, with moderation at h3, while list cards retain their h3/h4 hierarchy and visual styles. A direct
  detail/state test verifies recovery without submitting feedback.

### Per-page review index

`R` means a passed rendered fixture sample from the completed run/rechecks, **not every
possible state**. `L` means the intentionally restricted launch boundary is
checked using HTTP redirects, plus the rendered enquiry destination; the hidden
financial page is not accepted or enabled. `F` is the non-indexed missing-page fallback (Next.js may return 200 once streaming has begun). Each test
basename below is under `frontend/tests/e2e/` with `.spec.ts`. Final outcome and
selected cases are recorded below after verification.

| Route                                             | Evidence suite                   | Review scope                                                      |
| ------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `/admin/[resource]`                               | `dashboard-page-recovery`        | F: Non-indexed missing page; named resources have dedicated pages |
| `/admin/audit`                                    | `work-audit`                     | R: Rendered fixture sample                                        |
| `/admin/booking-capacity`                         | `booking-capacity`               | R: Rendered fixture sample                                        |
| `/admin/booking-slots`                            | `work-slots`                     | R: Rendered fixture sample                                        |
| `/admin/bookings/[bookingId]`                     | `work-booking-detail-quality`    | R: Rendered fixture sample                                        |
| `/admin/bookings`                                 | `work-bookings-quality`          | R: Rendered fixture sample                                        |
| `/admin/branches`                                 | `work-branches`                  | R: Rendered fixture sample                                        |
| `/admin/categories/[categoryId]`                  | `work-product-category-detail`   | R: Rendered fixture sample                                        |
| `/admin/categories`                               | `work-product-categories`        | R: Rendered fixture sample                                        |
| `/admin/complaint-policy`                         | `work-complaint-policy`          | R: Rendered fixture sample                                        |
| `/admin/customers/[customerId]`                   | `work-customer-detail`           | R: Rendered fixture sample                                        |
| `/admin/customers`                                | `work-customers`                 | R: Rendered fixture sample                                        |
| `/admin/delivery-policy`                          | `delivery-policy`                | R: Rendered fixture sample                                        |
| `/admin/dispute-policy`                           | `work-dispute-policy`            | R: Rendered fixture sample                                        |
| `/admin/finance-policy`                           | `work-finance-policy`            | R: Rendered fixture sample                                        |
| `/admin/fitment`                                  | `parts-fitment-workspace`        | R: Rendered fixture sample                                        |
| `/admin/inspections`                              | `work-inspections`               | R: Rendered fixture sample                                        |
| `/admin/inventory/[inventoryId]`                  | `work-inventory-detail`          | R: Rendered fixture sample                                        |
| `/admin/inventory`                                | `work-inventory`                 | R: Rendered fixture sample                                        |
| `/admin/invoices/[invoiceId]`                     | `work-invoice-detail`            | R: Rendered fixture sample                                        |
| `/admin/invoices`                                 | `work-invoices`                  | R: Rendered fixture sample                                        |
| `/admin/notifications`                            | `work-notifications`             | R: Rendered fixture sample                                        |
| `/admin/orders/[orderId]/aftercare`               | `work-aftercare`                 | R: Rendered fixture sample                                        |
| `/admin/orders/[orderId]`                         | `work-order-detail`              | R: Rendered fixture sample                                        |
| `/admin/orders`                                   | `work-orders`                    | R: Rendered fixture sample                                        |
| `/admin`                                          | `work-overview-quality`          | R: Rendered fixture sample                                        |
| `/admin/payment-disputes`                         | `work-payment-disputes`          | R: Rendered fixture sample                                        |
| `/admin/payment-disputes/work`                    | `work-dispute-handling`          | R: Rendered fixture sample                                        |
| `/admin/payment-exceptions`                       | `work-payment-exceptions`        | R: Rendered fixture sample                                        |
| `/admin/payments`                                 | `work-payments`                  | R: Rendered fixture sample                                        |
| `/admin/privacy`                                  | `work-privacy`                   | R: Rendered fixture sample                                        |
| `/admin/processing-jobs`                          | `work-processing-jobs`           | R: Rendered fixture sample                                        |
| `/admin/products/[productId]`                     | `work-product-detail`            | R: Rendered fixture sample                                        |
| `/admin/products`                                 | `work-products`                  | R: Rendered fixture sample                                        |
| `/admin/promotions/[promotionId]`                 | `promotion-detail`               | R: Rendered fixture sample                                        |
| `/admin/promotions/new`                           | `promotion-create`               | R: Rendered fixture sample                                        |
| `/admin/promotions`                               | `work-promotions`                | R: Rendered fixture sample                                        |
| `/admin/refund-timing`                            | `refund-timing`                  | R: Rendered fixture sample                                        |
| `/admin/refunds`                                  | `work-refunds`                   | R: Rendered fixture sample                                        |
| `/admin/reservation-terms`                        | `work-reservation-policy`        | R: Rendered fixture sample                                        |
| `/admin/retention-policy`                         | `work-retention-policy`          | R: Rendered fixture sample                                        |
| `/admin/reviews`                                  | `work-review-moderation`         | R: Rendered fixture sample                                        |
| `/admin/security`                                 | `admin-security-quality`         | R: Rendered fixture sample                                        |
| `/admin/service-categories/[categoryId]`          | `work-category-detail`           | R: Rendered fixture sample                                        |
| `/admin/service-categories`                       | `work-categories`                | R: Rendered fixture sample                                        |
| `/admin/services/[serviceId]`                     | `work-service-detail`            | R: Rendered fixture sample                                        |
| `/admin/services`                                 | `work-services`                  | R: Rendered fixture sample                                        |
| `/admin/staff/[staffUserId]`                      | `work-staff-detail`              | R: Rendered fixture sample                                        |
| `/admin/staff/invite`                             | `work-staff-invitations`         | R: Rendered fixture sample                                        |
| `/admin/staff`                                    | `work-staff-directory`           | R: Rendered fixture sample                                        |
| `/admin/support/[kind]/[supportId]`               | `work-support-detail`            | R: Rendered fixture sample                                        |
| `/admin/support`                                  | `work-support`                   | R: Rendered fixture sample                                        |
| `/admin/vehicle-sales/[transactionId]`            | `work-vehicle-sale-detail`       | R: Rendered fixture sample                                        |
| `/admin/vehicle-sales`                            | `work-vehicle-sales`             | R: Rendered fixture sample                                        |
| `/admin/vehicles/[vehicleId]`                     | `work-vehicle-detail`            | R: Rendered fixture sample                                        |
| `/admin/vehicles/new`                             | `work-vehicle-create`            | R: Rendered fixture sample                                        |
| `/admin/vehicles`                                 | `work-vehicle-stock`             | R: Rendered fixture sample                                        |
| `/admin/workforce/[[...section]]`                 | `dashboard-access-quality`       | R: Owner entry and denied state; managed subpages below           |
| `/dashboard/bookings/[bookingId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/bookings`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/cart`                                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/inspections`                          | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/invoices/[invoiceId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/invoices`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/notifications`                        | `customer-notifications-quality` | R: Rendered fixture sample                                        |
| `/dashboard/orders/[orderId]/aftercare`           | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/orders/[orderId]`                     | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/orders`                               | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard`                                      | `customer-overview-quality`      | R: Rendered fixture sample                                        |
| `/dashboard/payments/[paymentId]`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/payments`                             | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/privacy`                              | `customer-privacy-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/profile`                              | `customer-profile-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/reviews/[reviewId]`                   | `dashboard-page-recovery`        | R: Rendered fixture sample                                        |
| `/dashboard/reviews`                              | `customer-reviews-quality`       | R: Rendered fixture sample                                        |
| `/dashboard/saved`                                | `saved-items-quality`            | R: Rendered fixture sample                                        |
| `/dashboard/security`                             | `customer-security-quality`      | R: Rendered fixture sample                                        |
| `/dashboard/support/[kind]/[supportId]`           | `customer-care-detail-quality`   | R: Rendered fixture sample                                        |
| `/dashboard/support`                              | `customer-care-quality`          | R: Rendered fixture sample                                        |
| `/dashboard/vehicle-transactions/[transactionId]` | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/vehicle-transactions`                 | `dashboard-access-quality`       | L: Launch redirect; financial/booking UI deferred                 |
| `/dashboard/vehicles/[vehicleId]`                 | `garage-photos-quality`          | R: Rendered fixture sample                                        |
| `/dashboard/vehicles`                             | `customer-garage-quality`        | R: Rendered fixture sample                                        |

### Managed workforce journeys within the catch-all

| Journey                                                     | Evidence suite                                      | Review scope                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/admin` and `/admin/workforce`                             | `workforce-overview`                                | All eight responsibility templates, counters, no grants, expiry, revoked/error access and alias |
| `/admin/workforce/jobs`                                     | `workforce-jobs`, `workforce-access`                | Queue, narrow/wide layout, permitted destinations                                               |
| `/admin/workforce/jobs/[id]`                                | `workforce-job-detail`                              | Assigned job detail and technical-update controls in fixtures                                   |
| `/admin/workforce/bookings`                                 | `workforce-bookings`                                | Readable scoped records and real detail destinations                                            |
| `/admin/workforce/bookings/[id]`                            | `dashboard-page-recovery`                           | Direct scoped detail, refresh failure and retry; no legacy booking fetch                        |
| `/admin/workforce/enquiries`                                | `workforce-enquiries`                               | Scoped queue, layout and accessibility samples                                                  |
| `/admin/workforce/complaints`                               | `workforce-complaints`                              | Scoped queue, layout and accessibility samples                                                  |
| `/admin/workforce/orders`                                   | `workforce-orders`                                  | Order-progress workspace samples; no real fulfillment commitment                                |
| `/admin/workforce/finance`                                  | `workforce-finance`                                 | Payment-record reading samples; no live financial action                                        |
| `/admin/workforce/access`, staff responsibility forms       | `dashboard-access-quality`, `work-staff-workforce`  | Owner/denied entry and existing enrollment/assignment review fixtures                           |
| `/admin/security`, `/admin/notifications` for managed staff | `admin-security-quality`, `workforce-notifications` | Personal tools and responsibility-aware notification samples                                    |

### Verification record and continuation

Final page-pass command from `frontend`:
`npx --no-install playwright test --test-list tests/quality/dashboard-pages.txt --workers=2`.
The committed selection is reproducible; it includes direct recovery cases and
Help regressions for the shared dialog helper. Test records are synthetic browser
intercepts against localhost, with no configured backend origin. Live customer
records, staff accounts, assignments and financial/operational actions were not
used. Browser plugin not available; installed Edge/Playwright was reused.

Baseline overviews: 75/75 passed before changes. The broad initial sample had
100 passes, one isolated-real-API test skipped and five failures: two test trace
folder collisions (QA runners accidentally shared an output folder), the actual
inspection landmark defect, and two outdated assertions expecting zero managed
booking links. Runner output folders were separated; assertions now verify the
25 permitted detail URLs instead of treating the shipped feature as a defect.
The separately attempted customer financial cases correctly redirected under the
limited launch; that attempt was stopped and replaced with explicit launch-boundary
checks. A slow repeated full Contact navigation test was replaced by per-route
HTTP checks plus one rendered destination. No launch restriction was removed.
The isolated real-directory integration test remains unrun; the browser customer
directory fixture suite supplies the page sample, not real API acceptance.

Completed verification: full frontend lint and the affected-file lint recheck,
production build/TypeScript, formatting and **988 unit tests in 147 files** passed.
The committed page matrix exercised **167 distinct scenarios across 82 suites**.
The first production-build matrix returned 164 passes and three failures: the
standalone review's heading-order defect, an assertion assuming every Next.js
not-found response must be HTTP 404, and a test parsing a relative Location header
without a base URL. The heading hierarchy was fixed; the two tests now verify the
actual documented framework/redirect contracts. A fresh final build and targeted
**6/6 rechecks passed**, including list/detail review accessibility, background
recovery, scoped booking detail, every restricted customer path and the
non-indexed missing page. All 167 selected scenarios are covered by the completed
run and rechecks; this is not described as one clean uninterrupted run. No skips
or flaky retries occurred in that selected matrix. The earlier isolated real-API
skip remains explicitly outside this acceptance.

The new responsibility entry was checked at 320/390/768/1024/1440; 390 and 1440
screenshots and axe checks passed. Managed-access error/retry was rendered at
390/1440, and customer/admin/managed drawer focus containment and Escape were
verified. The shared Help helper's 15 production-build scenarios passed. The
existing page suites provide further responsive, disclosure, table, form review
and state checks; exact selected titles are in the committed test list. A final focused console probe at 390/1440 verified the responsibility page URL,
Administration title, meaningful H1, directory action and mobile Escape: no page
exceptions or unexpected console errors; one deliberately unavailable optional
notification fixture (503) per viewport was explained. These are synthetic local
browser checks, not real staff capability certification or full WCAG conformance. Artifacts: `%TEMP%/allied-dashboard-quality-20261024`;
images `%TEMP%/workforce-entry-390.png`, `workforce-entry-1440.png`,
`dashboard-access-STAFF-error.png` and `dashboard-access-ADMIN-error.png` were
visually inspected. Existing layouts/brand, field values and policy were retained.

Implementation **`7e522931f53f271ce8a47b6e925f41c5cad48747`** is pushed.
[Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40131516363),
[database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40131516437)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40131516367)
all passed for that implementation, including the CI production dependency audit.
Follow-up test-receipt clarifications do not change deployed runtime code.

Vercel **`dpl_42w1rg4PojUn7a81eD4KrrRVnaW2`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved to that
exact deployment at **20:57:29 UTC (21:57:29 Lagos), 24 October 2026**. The
candidate was built without domain assignment, then promoted after final checks;
both domains were first verified still on the expected preceding release.
Rollback frontend: `dpl_5bJRSphwZTktgFmz9jM3reZ1Hipx`. Backend remains ACTIVE
`5c1ea9a7-6211-46d2-995f-c45e504bf9e9`. Current release source/worktree is
`allied-dashboard-quality-20261024`, not the older main checkout. Post-publication
verification here is provider READY and alias identity; rendered acceptance used
the local optimized build. No real authenticated live customer/staff acceptance
or operational/financial action was performed.

Provider preflight at 20:52 UTC confirmed the backend ACTIVE with no pending
release, database online and eight managed backups, latest 24 October 05:22:10
UTC. Same-day managed encryption/retention/PITR and the prior separate 86-table
restore receipt were reviewed. No local or production database command, schema
change, migration, new backup or restore was run in this frontend cycle. GitHub's
database-safety job uses its isolated CI environment. No Docker image, container,
volume or builder was created/removed; completion inspection retained the 13
existing containers, all 14 volumes, 10.3GB images and 4.398GB reusable builder
cache. Frontend dependencies were reused through a junction; no new installation.
No disk-recovery claim is made. Task-owned preview servers were stopped afterward.

Continue future cycles from this page index: revisit concrete failures first,
then expand state/role coverage on the next relevant page. Real screen-reader,
real-device keyboard and real authenticated operational acceptance remain open.
Unexercised combinations are not counted as complete. The deferred transaction
pages retain their launch gates. Preserve the separately settled Item 6 queue.

## Cycle 3: Shop, Vehicles, My Vehicles and Customer Care

Completed batch: runtime implementation `1aacb6af5ffbe72c23e1f0f7d35b78fadf5f4447`,
branch/worktree `feat/catalogue-care-ux-20261024` /
`C:/Users/PC/.codex/worktrees/allied-catalogue-care-ux-20261024`.
The starting live dashboard release was checked through both provider aliases.
The separately published `5e7deb6a` copy clarification and its deployment receipt
were preserved before preparing this batch. Production advanced to
`dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ` during development; this batch includes
that runtime source. Main-checkout application code and unrelated worktrees
were not edited. The original directive is unchanged.

The flow under review is catalogue search and filtering -> selected item or
vehicle context -> saved vehicle / care request -> permitted customer or staff
conversation and recovery. Browser plugin not available: existing Playwright
and installed Edge are used, with synthetic accounts and intercepted API calls.
No live customer records, messages, financial actions or database writes are
needed for this frontend review.

| Surface and role                                                        | Observed issue and implementation                                                                                                                                                                                                    | Acceptance for this batch                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/parts`, public/customer browsing                                      | Phone search followed a large vehicle form. Put search, category and sort first; retain the visible fitment workflow and unknown-compatibility truth. Add currency guidance and reuse visible-control modal focus handling.          | Search, category hierarchy, individual resets, fitment, price validation, history and phone/desktop drawers remain usable.                                           |
| `/vehicles`, public/customer browsing                                   | Search and advanced Apply behaviour needed clearer explanation; price inputs needed guidance. Reuse modal keyboard containment.                                                                                                      | Search/sort/body shortcuts, condition/origin/powertrain/range filters, error recovery and URL history retain their contracts.                                        |
| `/dashboard/vehicles`, customer                                         | Optional preferences preceded required identity; generic actions and removal looked alike. Put required make/model/year first, associate field guidance, distinguish navigation/removal, shorten guidance and stretch phone actions. | Add/edit/cancel/remove, focus return, duplicate/unknown outcome guards, pagination and saved fitment are preserved.                                                  |
| `/dashboard/vehicles/[vehicleId]`, customer                             | Adjacent gallery and saved-vehicle path must retain working behaviour.                                                                                                                                                               | Fixture gallery/upload/recovery, ownership and narrow layout checks; real storage acceptance is separate.                                                            |
| `/dashboard/support`, customer                                          | Existing records competed with a long form; privacy guidance occupied half the form grid. Add task anchors, category-specific explanations, associated subject/message help, blue navigation and a full-width privacy note.          | Task jumps retain a draft; review/send/cancel and uncertain-outcome recovery remain authoritative.                                                                   |
| `/dashboard/support/[kind]/[supportId]`, customer                       | Preserve conversation continuity and reply safeguards.                                                                                                                                                                               | Empty/loading/error/stale/closed, exact reply, draft/recovery, keyboard confirmation and responsive checks.                                                          |
| `/admin/customers`, admin/super admin                                   | Phone filters consumed a screen; full reference IDs distracted from identity. Improve responsive filter rows, prefix instructions/input modes, removable applied constraints and expandable references.                              | Remove one constraint without losing others; search applies explicitly; reference disclosure works by keyboard; staff remain denied.                                 |
| `/admin/customers/[customerId]`, admin/super admin                      | Adjacent activity and link styles must remain coherent.                                                                                                                                                                              | Role gate, activity collections, paging/history, errors and responsive records retain their behaviour.                                                               |
| `/admin/support` and nested details, staff/admin/super admin            | Dense reference metadata competed with contact/message details. Move reference facts into a native disclosure, strengthen navigation affordances and add removable applied filters.                                                  | Staff branch scope remains enforced; removing branch also clears dependent assignee; records, review/reply and recovery remain functional.                           |
| `/admin/workforce/enquiries` and `/complaints`, permitted managed roles | Selected conversation and navigation needed stronger, consistent affordances.                                                                                                                                                        | Selected buttons have text/pressed state plus visible colour/border treatment; scoped search, queue/detail, assignment/reply and conflict handling remain unchanged. |

Priority P1: the expanded managed-care run exposed a shared access-refresh
regression. A manual refresh marks the access resource loading; the previous
render branch unmounted the workspace and discarded drafts and success feedback.
Keep the same workspace mounted, hidden and inert while verification is pending.
Successful verification preserves the draft; failed verification still removes
work content, and a different actor/access version/assignment key discards it.
A held-response regression verifies all three states without issuing writes.
Priority P2: the catalogue, guidance, field ordering, link/action affordances,
record density and responsive filter improvements in the table above.

Reproducible selected matrix: `tests/quality/catalogue-care-pages.txt`, **385
distinct scenarios across 22 suites**, including adjacent managed overview,
bookings, jobs/detail, orders and finance samples after the shared-shell fix.
The initial optimized-build run was **349 passed / 10 failed** across 359 cases:
five managed-refresh failures shared the lifecycle defect above; four upload
cases used a test storage host excluded by the local preview allowlist; one
Shop assertion expected cart wording superseded by the preserved enquiry-mode
copy release. No storage or authorization guard was weakened. The local-only
preview was configured for the intercepted `media.example.test` host, and the
Shop assertion now checks the stock-reservation warning common to both modes.

All **11 critical rechecks passed**. A fresh optimized browse-enquiries build then
passed **179/179 final browser checks**, with zero skips/flaky cases, including
all ten originally failed cases, all 13 new interaction checks, role/access
recovery, real launch redirects, gallery uploads/retry/cancel, scope changes,
managed assignment/replies and adjacent pages. The stored coverage receipt
compares the actual passed-case union against the 385-case matrix: **385 covered,
zero missing**. This is combined evidence from the initial run and final
rechecks, not a claim of one clean 385-test invocation.

Page identity, meaningful content, no framework overlay, page-error checks,
screenshots, responsive/reflow, keyboard interactions and automated axe checks
passed in the selected fixtures. Representative widths were 320, 360, 375, 390,
430, 768, 1024, 1280, 1440 and 1536; work-record tests also sampled 1920.
Short viewports and reduced-motion states were exercised by the existing suites.
Before/after screenshots were viewed for hierarchy, control layout, guidance,
action colours and reference disclosure. Final phone actions use the full row;
wide customer filters share one row; required vehicle identity precedes optional
preferences; privacy guidance spans the care form. Approved assets, brand fonts,
pricing, compatibility truth, permissions and collection-only launch policy remain.

Local full lint/types, **147 files / 988 unit tests**, optimized browse-mode build
and whole-frontend formatting passed. Final changed-source lint and the final
optimized build/type compilation passed after the shared-shell fix. The initial
combined check was stopped after passing the launch-specific build mode into
multi-mode configuration unit tests; standard unit environment and browse-mode
build environment were separated, with no guard change. Vite's existing
config-loader warning remains informational.

Runtime implementation is pushed. [Frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40137427563)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40137427542)
passed for `1aacb6af`, including the CI production dependency audit. The unchanged
backend passed [isolated database safety](https://github.com/Otto-space/allied-autotech/actions/runs/40136214469)
at preceding UI commit `c3f4076f`; the frontend-only follow-up did not trigger a new
backend job. No local/shared/production database checks or writes were run.

Vercel **`dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB`** is READY. Both
`alliedautotech.com` and `www.alliedautotech.com` independently resolved to that
exact deployment at **22:17:35 UTC (23:17:35 Lagos), 24 October 2026**. Each was
freshly checked on the expected copy release before promotion. The earlier
`c3f4076f` candidate was never promoted; the final candidate includes the refresh
fix. Immediate frontend rollback is `dpl_CMG2vPpWCQMvQdCWMZYsxbwproTZ`;
preceding dashboard release `dpl_42w1rg4PojUn7a81eD4KrrRVnaW2` remains available.
Backend stays ACTIVE `5c1ea9a7-6211-46d2-995f-c45e504bf9e9`, no pending release.
Published acceptance here is provider READY/alias identity. Rendered acceptance
used the local optimized build, not real authenticated production operations.

Immediately before promotion, read-only provider preflight confirmed the database
online, eight managed backups and latest `2026-10-24T05:22:10Z`. Existing managed
encryption/seven-day retention/PITR and the same-day separate 86-table logical
restore receipt were reviewed. No new dump, restore, migration or DB command was
run in this UI cycle. Payments remain disabled. Dependencies were reused through
a junction; no package installation or Docker build/removal was needed. Existing
32 images (10.3GB), 13 stopped containers, 14 volumes and 4.398GB warm cache were
retained. Docker reclamation by this cycle was 0 bytes; host C: free space was
13,973,557,248 bytes at 22:21:15 UTC. No disk-recovery claim is made.
Task-owned preview port 3155 was verified closed.

Artifacts remain outside source: `%TEMP%/allied-catalogue-care-*.log/json`,
`scope-before-*`, `scope-review-*`, `scope-final-*`, public catalogue captures,
and `scope-final-vehicle-form-390.png`. Coverage is fixture-based; no full WCAG
certification, real screen-reader/mobile-keyboard certification, real object
storage acceptance or real authenticated production transaction is claimed.
Unexercised combinations remain open. The original directive SHA-256 still
matches its recorded bytes. Preserve the settled Item 6 queue and owner decisions.
Future separate reviews can pair price-range fields more closely in the Shop
advanced grid and follow the header-session fixture/customer-toast items recorded
by the preceding copy audit; those do not reopen the settled launch scope.

## Cycle 4: Home, Parts, Vehicles and parts-enquiry handoff - 25 October 2026

Initial implementation checkpoint (superseded by the verified release below) on
`feat/home-discovery-ux-20261025`, worktree
`C:/Users/PC/.codex/worktrees/allied-home-discovery-20261025`, based on the latest
recorded release `93e2501b`. Both production aliases were independently inspected
and still resolved to READY `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB` before choosing
source. Existing main-checkout and other-worktree edits remain separate.
The complete supplied [implementation brief](Allied_AutoTech_Home_Parts_Vehicles_Codex_Prompt.md)
was read before editing; the standing quality directive is preserved.

Flow: Home -> direct part search or vehicle discovery -> accurate results and
compatibility context -> editable Product enquiry. Vehicles -> budget, make/model,
condition and year -> retained advanced specifications and listing details.
Browser plugin not available; installed Playwright/Edge supplies rendered evidence.

Revalidated hosted evidence: anonymous unfiltered product and vehicle discovery
returned HTTP 200 with zero public matches; filtered brake/Foreign Used queries
also returned zero. Fitment makes returned HTTP 200 with no active choices both
without a search and with Toyota. Public APIs prove absence of currently visible
records, not absence of all private or unpublished inventory. Products require
active categories/parents; vehicle listings require AVAILABLE status and an active
branch; fitment makes/models must be active. These public requests did not expose
private stock. No client mapping or failed-request cause was found for these zeros.
A single published Tyre Change service has a fuller description than its short
preview. There is one public branch and no published reviews. Baseline captures
and safe request receipts: `%TEMP%/allied-home-discovery-20261025`.

| Brief acceptance / batch                        | Implementation and status                                                                                                                                                                                                                         | Verification / dependency                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue states                                | Implemented: separately read unfiltered publication evidence for filtered zero results; retain error/retry and inputs; collapse irrelevant controls for known empty catalogues; omit empty/single-page pagination.                                | Rendered checks in progress; independent public reads are not a cross-request database snapshot. Unknown availability never becomes an authoritative global-empty claim.                                                                                                                                              |
| Parts intent and finder                         | Implemented: persistent direct search, two discovery choices, compact optional saved-vehicle path, honest no-makes fallback, selection prerequisites, reset explanation and grouped technical details.                                            | No category-specific fitment requirement metadata exists; grouping retains all fields without inventing category rules. Existing compatibility engine remains authoritative.                                                                                                                                          |
| Vehicles                                        | Implemented: budget, make/model, condition and year range first; advanced driving/assembly groups; remove exact-name jargon, duplicate year input and merchandising/equipment choices without dropping existing deep-link semantics.              | Naira/kobo, ranges, Apply/cancel/clear/chips/history and keyboard checks in progress. Searchable equipment taxonomy remains a modelling/content dependency.                                                                                                                                                           |
| Home                                            | Implemented: distinct navigation routes, authentic supplied campaign/equipment imagery, fuller service preview, concise process, conditional inventory/reviews, distinct carousel tasks and initially paused marquee.                             | No operational service data changed. Static-hero alternative deferred because the established carousel capability is retained. Owner should approve fuller tyre/service scope and supply additional authentic workshop photographs.                                                                                   |
| Parts -> Contact                                | Implemented: Product default, conditional context, stable context identity and editable text; sole complete branch is selected without a needless choice; multi-branch selection remains.                                                         | Proven API dependency repaired compatibly: public PRODUCT may omit productId for unlisted parts. Supplied IDs are still checked; customer-linked enquiries and other source requirements remain strict. API must be released before the matching frontend; the forward constraint migration must precede API rollout. |
| Populated fixtures and later owner seed request | Implemented: 20 varied products/parts, 12 vehicles, 5 categories, 3 makes, 6 models and 4 services. `/demo` shares actual card renderers, shows explicit fictional labels, illustrative prices/images, sample details and no operational actions. | No production database seeding, fake genuine availability, public fictional testimonials, staff/customer enrollment or financial records. The optional local-only fixture API is read-only, requires `--demo` and refuses hosted/production execution.                                                                |
| Accessibility / responsive / regressions        | In progress: 320/390/768/1024/1440, populated/empty/failure states, keyboard focus, disclosures, chips, URL/history, pause/reduced motion and scoped axe.                                                                                         | Final results below; automated/emulated checks do not certify real devices, screen-reader speech or full WCAG conformance.                                                                                                                                                                                            |
| Publication                                     | Not performed in this implementation checkpoint.                                                                                                                                                                                                  | Preserve launch restrictions, Item 6 and existing release/backup safeguards. Demo records are intentionally separate from genuine catalogue APIs and database records.                                                                                                                                                |

This cycle does not reopen the settled launch decisions. Real publishable inventory,
approved prices/availability, authentic catalogue photos and customer reviews remain
owner inputs. Do not populate application/shared/production databases to make a
layout test pass or delete existing records as a cleanup shortcut.

### Checkpoint evidence and remaining acceptance

Source implementation is complete across the requested surfaces, but **final browser
acceptance is incomplete**. No commit, push, deployment or application database seed
was performed. `/demo` is a built customer-facing route in this worktree, not a URL
currently available to production visitors. It is deliberately distinct from genuine
inventory and dashboard records. The later request to make populated areas visible
is implemented as an explicitly fictional read-only preview; it does not certify
real prices, stock, services, condition reports or compatibility.

Passed checks:

- Full frontend lint, typecheck and formatting; full unit run **147 files / 988
  tests**. Four additional isolated fixture-contract tests passed separately after
  final review, using the real product, vehicle, category and service parsers.
- Final optimized `browse_enquiries` build, TypeScript compilation and standalone
  preparation passed after the visible Home illustration labels and final demo
  image-label correction. No server startup success is implied by this build.
- Backend typecheck, scripts typecheck, lint, formatting and **10 focused unit
  tests** for public parts enquiries and the existing security boundaries passed.
  OpenAPI export/type regeneration and validation passed for **347 paths** using
  synthetic local test configuration, without connecting to a database.
- Latest selected development-browser run: **16 passed / 1 failed** across 17
  cases. Populated Parts/Vehicle cards and read-only demo layouts passed at 320,
  390, 768, 1024 and 1440; scoped axe/reflow, dependent finder choices, stale
  suggestions, grouped detail retention, generic/selected Product editable
  prefill, context transfer and synthetic submission checks passed in that run.
  The failed case expected six brake examples where the fixture contains five.
  The assertion is corrected; its rerun is still required. Earlier broad runs
  included cold-dev compilation and obsolete copy/fixture assertions and are
  not counted as final passes.

Rendered evidence used `http://127.0.0.1:3165`, local synthetic APIs and installed
Edge/Playwright because Browser plugin was not available. Page identity, meaningful
content, no framework error overlay, scoped page-error checks, screenshots and
interaction assertions passed for the selected populated cases. This is fixture
evidence from the development build, not production acceptance. Screenshots include
`%TEMP%/allied-autotech-playwright/6f4ab084236c/discovery-remediation-*` and the hosted
baseline directory above. The long full-page captures retain the sticky header at
the interaction scroll position; they do not establish first-viewport positioning.
The screenshot helper now scrolls to the top and blurs focus before capture, but
those improved captures have not yet been generated.

The final optimized preview startup was repeatedly rejected by automatic approval
review with **“blocked by policy”**, including after the user's explicit “Do the
preview yourself. I approve.” No more specific reason was supplied. No launch
workaround was used. Ports 3165 and 5021 were checked closed. This tool restriction
blocks the final Home carousel/FAQ, empty/error/populated Home, broad catalogue,
Contact and saved-vehicle regression run; source/build checks do not replace it.
The final Home labels, final demo label, standalone fixture response-envelope fix,
and screenshot-helper change are not browser-reverified. The standalone fixture
now includes the required `meta.requestId`; strict API response validation remains.

Resume in this worktree when local preview execution is available. The intended
preview is loopback-only, backend origin `http://127.0.0.1:5021`, port 3165, launch
mode `browse_enquiries`; the existing optimized build is retained. For manual
populated review use the explicit read-only `scripts/discovery-fixture-server.mjs
--demo`. For the regression run **do not** start that separate fixture: the suites
own port 5021 sequentially. Use `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3165`,
`RUN_HOME_TESTS=true`, and:

```powershell
.\node_modules\.bin\playwright.cmd test tests/e2e/shop-quality.spec.ts tests/e2e/vehicles-quality.spec.ts tests/e2e/home-quality.spec.ts tests/e2e/contact-quality.spec.ts tests/e2e/saved-vehicle-fitment.spec.ts tests/e2e/discovery-remediation.spec.ts tests/e2e/parts-fitment.spec.ts --workers=1 --reporter=line --max-failures=6
```

Test discovery succeeds: **127 cases in seven files**, not 127 executed passes.
Fix and rerun any proven defect, inspect Home and first-viewport phone/desktop
captures, and update this checkpoint before release review. Real-device mobile
keyboards, screen-reader speech, private stock/publication management, real dashboard
operations, actual DB persistence and full WCAG conformance remain unverified.
Category-specific technical fitment disclosure needs authoritative metadata; all
current technical fields remain grouped and optional without invented rules.

The compatible public Product API change must precede the frontend release.
Release review below supersedes the initial API-only migration assumption.
At this initial checkpoint no database check, migration, backup,
restore or operational submission ran in this cycle; isolated mocked unit tests
do not constitute persistence or backup-recovery acceptance. Existing rollout
safeguards, launch restrictions and Item 6 remain mandatory.

Docker completion review: **32 images / 10.3GB, 13 stopped containers, 14 volumes /
1.012GB, 50 build-cache records / 4.398GB** were retained. No Docker resource was
created, removed or reclaimed by this cycle. Useful shared dependencies are reused
through verified junctions; no package installation or image archive was created.
Host C: free space measured **12,651,687,936 bytes** during final checks, versus
13,392,957,440 at this cycle's start; necessary Next build/test artifacts account
for task activity, and no physical disk-reclamation claim is made. The useful
optimized build remains for the blocked review; database volumes and other tasks'
resources were untouched. The mandatory hygiene rule is preserved in root AGENTS
and the linked guide; Markdown is a review requirement, not automatic garbage
collection.

### Production release review - 25 October 2026

The user explicitly authorized production deployment. Implementation `b9162cc4`
was committed and pushed; frontend release CI, isolated backend database-safety CI
and the secret guard passed. Vercel candidate
`dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv` built READY with domain promotion withheld.
Hosted Edge verification replaced the blocked local-preview check: 13 real-data
scenarios at 320/390/768/1024/1440 and eight additional browser-only fixture
scenarios at 390/1440 passed, with zero page exceptions. These covered Home
carousel/FAQ, populated/empty/refresh-failure recovery, Parts state distinctions,
vehicle budget/condition URL and chip semantics, draft cancellation, grouped
finder details and unknown fitment, editable generic Product enquiries and the
read-only populated demo. Scoped axe/reflow and representative screenshots passed.
The first scratch Home run used an ambiguous FAQ selector shared with the Help
dialog; scoping it to main resolved that test issue. Temporary Vercel review
access was revoked after each run and existing protection was verified preserved.
This is selected hosted acceptance, not a claim that all 127 local cases ran.

Deeper release review caught a missed database dependency before any production
change: `aat_enquiry_target_valid` still required productId for every Product
enquiry. The earlier "no migration needed" assessment was incorrect; mocked
service tests did not prove persistence. The obsolete API build was stopped.
Forward migration `20261025050000_public_unlisted_parts_enquiries` expands only
anonymous Product enquiries to permit an unlisted part, retaining product/source
requirements for customer-linked and all other enquiry types. It updates no
records, removes no columns and atomically replaces the check under a bounded
lock timeout. Prisma's field model is unchanged because this is a SQL check
constraint. A new real-PostgreSQL integration regression is included in CI.
No earlier migration was edited. Empty replay, persistence tests, fresh backup,
separate restoration/rehearsal, guarded target migration and image verification
must pass before this release is promoted. Final receipts follow after rollout.

The new isolated target passed all 65 migrations, `db:check` and **13/13** actual
persistence/security tests (three integration plus ten focused unit cases).
The first integration attempt omitted the existing Origin header and required
synthetic phone field; those fixture omissions were corrected without weakening
either guard. The successful recheck used the same task-created isolated database,
preserved the first failed receipt and reset or deleted no records.

### Verified production release - 25 October 2026

**Released.** Frontend runtime source is `b9162cc43bd6fa56ca88d3a07d280ffad4b3dff8`;
backend, constraint migration and cross-platform checksum pin are
`2fc02bafdde75385fffad9c46767615a506f5eb2`. Later backend/docs/type-description
changes do not change the candidate's frontend runtime. Both main and www aliases
were independently verified on READY **`dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`** at
**07:07:45 UTC / 08:07:45 Lagos**. API deployment
**`da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`** is ACTIVE with **16/16** successful
provider steps; all four actual deployment image digests match the verified
manifest. Existing capacity, secrets, permissions, collection-only policy,
`browse_enquiries`, indexing/protection settings and disabled payments were preserved.
The compatible migration preceded the API, which preceded frontend promotion.

Current acceptance supersedes the earlier blocked checklist:

| Surface                      | Final evidence / status                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                         | Verified real empty catalogue state at 320/390/768/1024/1440; carousel/keyboard/FAQ and pause/play checked; browser-only populated/refresh-failure/retry/empty previews and reviews at 390/1440.                                                                                                                                                                             |
| Parts                        | Direct and vehicle paths, grouped detail draft, actual unknown-fitment status, populated shared cards, genuine empty vs filtered no-match, loading/failure/retry and corrected five-brake-example assertion verified in hosted fixtures.                                                                                                                                     |
| Vehicles                     | Populated/missing-media cards; budget Naira-to-kobo URL values, condition, independent chip removal and cancelled drafts verified at 390/1440; genuine empty state on production. Older supported URL semantics remain covered by existing passing unit contracts.                                                                                                           |
| Enquiry                      | Generic Product classification and editable draft survive public-resource refresh on the real site. Actual isolated HTTP persistence returned 202 without an invented product ID; linked-customer and other-category database constraints still reject missing references. No real production enquiry was submitted.                                                         |
| Demo                         | Public [read-only demo](https://alliedautotech.com/demo): 20 products/parts, 12 vehicles, four services, five categories, three makes and six models. Fictional prices/images/availability are visibly labelled, independently filterable, and sample details cannot order/reserve/submit. No dashboard, customer, staff, financial or genuine catalogue seed was published. |
| Accessibility and responsive | Selected page identity, meaningful content, no framework overlay, zero page exceptions, scoped axe, no horizontal overflow, keyboard/disclosure/modal controls and inspected desktop/phone captures passed. Emulation and automated checks do not certify real devices or screen-reader speech.                                                                              |

Release verification: all three workflows passed on the final backend/migration
source: [frontend release](https://github.com/Otto-space/allied-autotech/actions/runs/40158808468),
[isolated database safety and real parts persistence](https://github.com/Otto-space/allied-autotech/actions/runs/40158806716),
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40158484492).
Manual workflow dispatch covered the final `.gitattributes` checksum pin. Local
**43/43 packaged-image/release checks** passed, including non-root commands, CA
bootstrap, media/app imports, isolated migration replay, separate restore and drift
rejection. Local **13/13 database/security tests** passed. The earlier full frontend
988-unit run and later four fixture-contract checks are separate local receipts;
the final frontend workflow also ran the complete production check.

Selected hosted candidate coverage was **22 scenarios**: 13 real-data journeys,
eight browser-only fixture journeys and one explicit autoplay pause/play case.
The real 13 journeys were repeated successfully on the public production domain
after promotion, at the representative widths above, with zero page exceptions.
The 17 health/screenshot/axe entries in each real-data receipt are checkpoints
within those 13 scenarios, not 18 distinct scenarios. The full local 127-case
matrix remains unexecuted because preview startup was blocked by tool policy;
the selected hosted acceptance replaces the release blocker without claiming
that entire matrix passed. Real-device keyboards, screen-reader speech and real
authenticated staff/customer operations were not exercised in this release.

Database safety: confirmed the exact production host/25060/database, strict TLS
and separate backup/migrator/runtime roles. The provider listed **nine managed
backups**, latest **25 October 05:22:10 UTC**. Managed encryption, seven-day
retention/PITR and existing separate managed-restore evidence were reviewed against
the provider's documented recovery features. A fresh production logical archive
was actually restored into a new local isolated `_ci` database: **89 tables**, all
pre-existing row counts preserved, with the forward migration rehearsed from
64 to 65 and `db:check` passing. This was not a new managed PITR restore or a
restore over production. A new exact-target verified backup at **06:56:39 UTC**
preceded the guarded production `npm run db:migrate`; the target then passed
`npm run db:check`, all 65 checksums, validated constraint and runtime-column checks.
No production business DML, reset, data deletion, history resolution or grant
change was performed. Runtime remains unable to read the migration ledger or
perform ownership/DDL/TRUNCATE/superuser/role-creation operations.

An initial backup failed; client/permission checks and a successful verified retry
preceded any migration. A host-clock pause invalidated local time-bound processes;
affected Docker tests were rerun sequentially and the local restore was inspected
before resuming, without reset or failed-history changes. A post-migration
aggregate check initially tried to read the ledger with the restricted runtime
role and correctly received a permission denial. It was completed read-only using
the separate migration role; the migration was not rerun and no grant was expanded.
Every temporary operator firewall rule was removed and the original app-only
rules verified, including the final postcheck. API readiness and five public
catalogue/branch/service reads then returned 200. Public products, vehicles and
make choices remain truly empty; one real service and branch remain published.

Immediate frontend rollback is `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB`; API rollback
is `5c1ea9a7-6211-46d2-995f-c45e504bf9e9` and its protected immutable manifest.
The expanded SQL check is compatible with the prior application and must remain
in place during any application rollback. Never downgrade/restore the database
as an image-rollback shortcut. Recheck current provider state before future work.

Bounded disk cleanup removed the two task-owned, never-deployed obsolete API
images (`b9162cc4`, `dddef8c0`), five never-started test containers and their unused
internal network after checking exact IDs, state, image provenance, mounts and
container references. Docker totals during that cleanup changed **39 -> 37
images**, rounded **11.84 -> 11.81GB**, and **18 -> 13 containers**. All **14
existing volumes / 1.012GB** were retained. Current/rollback/other-task images
(including the independent `f0062282` build) and **6.627GB of useful warm cache**
were retained; no blanket prune, registry deletion or image archive was used.
Both task-created isolated verification databases were removed with the supported
test-only drop command after confirming exact loopback targets and zero active
connections; their measured logical sizes totalled **34,606,462 bytes**. Durable
verified backups and protected receipts remain. Host C: free space measured
**12,582,514,688 bytes** after cleanup; rounded Docker totals and logical database
sizes do not prove an equivalent physical host-space recovery. Local preview/API
ports 3165/5021 remained closed. Existing unrelated worktrees and main-checkout
edits were preserved.

Evidence: `%TEMP%/allied-home-release-20261025/` contains candidate/fixture/playback
and final production receipts plus responsive captures. Protected backend release,
backup, rehearsal, firewall, migration and image receipts remain under this
worktree's ignored, ACL-restricted deployment directory. No credentials, archive
contents or customer records were added to source. Owner inputs remain genuine
publishable stock, prices, approved service detail and authentic catalogue media;
the new demo is not evidence of genuine availability. Preserve settled Item 6.

## Cycle 5: Owner-directed homepage restoration — 25 October 2026

The owner's preference for the previous homepage supersedes conflicting design
guidance from Cycle 4. This correction starts from the complete released `3bf61321`
in isolated worktree `allied-home-restoration-20261025`, branch
`fix/home-restoration-20261025`. Both live aliases were independently checked at
07:27:19 UTC and still pointed to `dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`.
Main-checkout edits and independent staff-filter work remain untouched.

Baseline: the actual Home implementation at `93e2501b`, before `b9162cc4` changed
its hero, typography, partner introduction and editorial structure. Home history
and file-level comparisons show that intervening commits were unrelated. The
saved `allied-home-discovery-20261025/before-home-1440.png` confirms that design;
`allied-home-release-20261025/production-home-{1440,390}.png` records the redesign.
There is no unresolved competing baseline candidate.

Restored: trust-led hero, original workshop/showroom/family/parts artwork, Nippo
headings, partner introduction, workshop services, original technician story and
principles, darker vehicle section, illustrated parts section, equipment, customer
feedback, FAQ and contact invitation. The extra lifestyle grid stays omitted:
its themes already appear in the hero. Retained improvements are the paused
marquee (less competing motion), fuller published service descriptions, three
clear process steps, distinct failed/empty requests and retry controls, current
enquiry-only CTAs and the correct Product enquiry handoff. No booking, checkout,
reservation, inventory, permission or backend change is introduced.

The feedback section remains visible when there are no published reviews. Its
link restores direct discovery of the existing `/reviews` page, whose moderated
feedback, filters, account-aware action and privacy boundaries are preserved.
No review has been fabricated. `/demo` and all production-only sample catalogue
components/data are removed. Deterministic fixtures now live exclusively in tests;
shared real Parts/Vehicle cards retain their ordinary behaviour. The route
inventory is regenerated and a 404 regression replaces the demo acceptance.

Initial local lint/types/format, 992 tests in 148 files and optimized build passed.
The development browser run was stopped after duplicate-fetch assertions failed
under React development effects (first case also exceeded its cold compilation
timeout). This is not counted as release acceptance. Automatic approval review
blocked optimized loopback startup with “blocked by policy”; no alternate startup
was used. Browser plugin not available; existing Playwright and installed Edge
are used without downloads.

Hosted review passed 16 focused real/fixture scenarios on preview `80a967e3`,
then all 16 passed again on the production-configured `3b0c353c` candidate while
main/www remained on the existing release. The existing public-review suite
passed all 23 cases at 320–1536px: filters, cursor reset, empty states, error and
malformed recovery, stale requests, four synthetic roles, private-field exclusion
and untrusted text. No real sign-in or review submission was made. The suite's
separate access-cleanup wrapper initially returned failure because another
completed review had already revoked its own temporary key; both owned keys were
revoked and the provider state was rechecked. Existing protection was retained.
Initial preview anonymous account lookup was unavailable with preview settings;
production-configured review uses the existing production forwarding settings.
Expected 401/404 and deliberately injected 503 responses are not page exceptions.

Final polish gives the illustration caption a dark contrast surface. Additional
normal-motion checks found identical hero heights across all four slides at five
widths, visible keyboard focus and lab load layout-shift observations below 0.027.
These are lab/emulation results, not field performance. Doubling Home text at
320x568 reproduced min-content overflow in the parts/equipment grids. Scoped
zero minimum widths, breakable headings/links and stable icons corrected it in
browser-injected proposed styles; a permanent regression is added. Final hosted
acceptance must verify the committed CSS without injected styles before promotion.

Read-only rollout review at 07:53 UTC confirmed the unchanged active API,
database online, nine managed backups (latest 05:22:10 UTC) and the existing
06:48:38 UTC successful separate restore rehearsal across 89 tables/65 migrations,
with original rows unchanged and no production write. Existing encrypted
off-device retention/PITR evidence remains applicable. No new database command,
backup, restore, migration, role/grant change or Docker build is needed for this
frontend correction. Settled Item 6 and launch restrictions remain unchanged.

### Released and verified

Runtime source **`bb92ca529c3c75e8ed0b6439051412996184c0c0`** is live on READY
Vercel **`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU`**. Main/www aliases independently
matched at **08:08:20 UTC / 09:08:20 Lagos** on 25 October 2026. Final source
[frontend release checks](https://github.com/Otto-space/allied-autotech/actions/runs/40174871261)
and [secret guard](https://github.com/Otto-space/allied-autotech/actions/runs/40174871259)
passed. The complete 992-test frontend suite, lint, types, formatting and optimized
build passed locally on the implementation; exact final-source CI repeated the
release gate with lockfile-installed dependencies. Local reused Next is 16.3.8;
the hosted/CI lockfile version is 16.4.3. No package/dependency change was made.

Final acceptance: **16/16 hosted real/isolated-fixture scenarios** on the exact
production candidate, **7/7 additional stability/focus/enlarged-text/long-name/
broken-image checks** with committed CSS and no proposed-style injection, and
**23/23 public-review regressions** on the preceding candidate with unchanged
review code. After promotion, **9/9 real-data production scenarios** passed with
zero page exceptions and scoped axe checks. Home sampling covers
320/390/768/1024/1440px; the review suite additionally covers
360/375/430/1280/1536px and a short 320x568 screen. Lab layout-shift observations
were 0.0010–0.0269; all four hero slides had identical heights at each sampled
width. CSS text enlargement is a stress test, not a claim of real browser-zoom or
screen-reader acceptance. Source Home's full 18-case optimized localhost suite
remains unexecuted because startup was blocked; equivalent hosted checks above
are the actual acceptance evidence. Real devices, screen-reader speech and real
authenticated operational submissions remain untested.

The production page shows genuine empty parts/vehicle/review states and the
published service. Populated cards/reviews were verified only in browser-isolated
fixtures; no synthetic record was published. All retained Home images loaded in
the real-data desktop/phone inspections. Primary/secondary CTA destinations,
parts-enquiry editable prefill, FAQ/directions, mobile navigation, touch/keyboard
carousel, pause/play, reduced motion, retry/retained refresh failure and shared
real Parts/Vehicle cards passed. `/reviews` is public and linked; `/demo` is an
actual HTTP 404. Production anonymous account lookup shows the normal sign-in
action; the earlier preview-only unavailable-account state is not present.

Backend stays on ACTIVE `da8e5b3a-19e7-4ab3-834f-d8a1aeffadf9`, source `2fc02baf`.
No database command, migration, backup/restore operation, business DML, grant
change, real enquiry/review submission or payment was performed this cycle.
Immediate frontend rollback is `dpl_3XjRQRkHuJY1oVvnhPuqBPu5mMtv`; the preceding
preferred-design release `dpl_8M1UudCWqwtTUtFCekqEwBuGDCsB` is also retained.
Application rollback must retain migration 65 and the compatible API constraint.

Evidence outside source: `%TEMP%/allied-home-restoration-20261025/` contains
`candidate/hosted-qa.json`, `stability-qa.json`, preflight/postflight receipts,
`production/hosted-qa.json`, real `production/home-{1440,390}.png`, full-page
captures and review-page screenshots. Compare against the baseline/redesign
captures recorded above. Temporary automation keys were revoked, existing
protection retained, browsers closed and local ports 3166/5021 closed.

No Docker resource or dependency installation was created. Inspected context,
builders, image/container references, data volumes and disk usage; useful current,
rollback and other-worktree resources were retained. During concurrent activity
Docker totals changed from 37 images/11.81GB, 13 containers, 14 volumes/1.012GB,
6.627GB cache to 38 images/11.84GB and 6.715GB cache, with container/volume totals
unchanged. These additions are not owned by this frontend task and were retained.
Automatic approval review rejected removing the task's superseded `.next` output
with “blocked by policy”; no alternate deletion was attempted. The measured
143,481,750 bytes of generated output remain alongside 451,146,323 bytes of useful
warm cache. Host free space was 11,335,639,040 bytes after that rejected cleanup;
no reclaimed-space claim is made. Docker/database volumes and backups were untouched.

This completes the owner's focused homepage correction. Further business-approved
inventory and authentic customer reviews remain content inputs, not fixtures to
publish. Existing broader role/device/manual acceptance and settled Item 6 retain
their recorded scope; no further redesign is implied by the previous audit.

## Cycle 6: Audit A01–A07 — 25 October 2026

Scope: the complete 25 October UI/UX audit in Downloads and the supplied implementation
brief, read before editing. This is finite Batch 1, not acceptance of every route or
an instruction to redesign Home again. Revalidated both live frontend aliases on
`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU` and the backend ACTIVE deployment
`f9239c36-d4b7-4ef0-b8ba-479cda926a13`. Reused the clean homepage-restoration
worktree and dependencies/cache on `fix/audit-actions-20261025`; merge `b45513f1`
combines the preferred Home with the independently released `ff42b0e2` backend fix.
Only the tracker required conflict resolution, retaining both release receipts.
Main-checkout uncommitted work is preserved. No additional worktree, dependency
installation, editor profile, Docker build or application database write was needed.

### Revalidated findings and changes

| ID  | Current evidence and repair                                                                                                                                                                                                                                                                                                                                                                                                                          | Boundary                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Limited-release filtering left the customer group labelled My orders with only Saved items. The group now reads Saved items; full mode reads Orders & saved items and preserves distinct destinations.                                                                                                                                                                                                                                               | Existing route restrictions and staff navigation are unchanged.                                                                                                                     |
| A02 | Both finance headers still linked to absent /admin/operations. Back to overview now opens the existing /admin route, permitted to the same administrators.                                                                                                                                                                                                                                                                                           | No route or permission was added.                                                                                                                                                   |
| A03 | Saved-vehicle refresh, paging and retry buttons were unstyled native controls. They now reuse explicit secondary actions; garage management remains an underlined navigation link. Refresh exposes busy/disabled state.                                                                                                                                                                                                                              | Fresh ownership/configuration checks, unknown fitment and URL filtering remain intact.                                                                                              |
| A04 | Policy contact refresh still used the body-text link class. Both editors now use a shared secondary action, including busy state.                                                                                                                                                                                                                                                                                                                    | Selection, eligibility, review, approval and publication safeguards are retained.                                                                                                   |
| A05 | The overview still linked to restricted customer booking/order/payment details and advertised booking. It now describes the enquiry release, offers Request a service visit, omits unavailable actions and retains real historical summaries without misleading links. The date preset now reflects its actual range.                                                                                                                                | Full-mode record links and permitted operational access remain. No commerce flag or direct-route restriction changed. Help launch guidance was already mode-aware; it was retained. |
| A06 | Backend publicReviewer projects trimmed profile first/last name and a review-scoped photo URL. PublicReviewProfiles reads only a currently APPROVED review's current portrait; missing/unapproved/no-photo requests are 404, private/no-store, and do not expose contact details or garage media. The owner-only profile sentence contradicted this. Profile, upload/replacement/removal, review guidance/review confirmation and Privacy now agree. | Disclosure correction based on verified source/tests, not a claim of a confirmed data leak. No public field, storage rule or media permission changed.                              |
| A07 | Audience remained a dropdown. Native radio choices, audience-specific help and a persistent audience summary now sit beside the editor/review action; the existing confirmation repeats the audience and its consequences.                                                                                                                                                                                                                           | Customer reply form remains customer-only. Single-flight writes, preflight, review/cancel, draft recovery and unknown-outcome locks remain.                                         |

`action.tsx` consolidates the existing brand button foundation into explicit primary,
secondary, tertiary, danger and navigation variants plus a programmatic selected toggle.
`docs/ui-actions.md` documents semantics and migration boundaries. Only the named
consumers migrated; no blanket link-background rule or dependency was introduced.
The full source census records 1,209 native buttons, 105 native anchors and 58 buttons
using text-link styling across 283 files. These are review signals, not 1,209 defects.
The inventory now retains an 18-aspect per-page checklist and evidence record across
all 104 public/auth/customer/work route patterns; unreviewed aspects remain explicit.
Shared primitives do not imply acceptance of their untested consumers.

### Acceptance evidence

Browser plugin not available; existing Playwright with installed Edge was used, without
browser downloads. Local development preview: http://127.0.0.1:3166, launch mode
browse_enquiries, isolated browser/API fixtures. No production fixture was published.
Desktop/mobile before screenshots cover overview, support, policy contacts and finance
headers; after screenshots additionally cover Parts, profile, reviews and Privacy.
Evidence is outside source at `%TEMP%/allied-audit-actions-20261025/`.

The initial 31-case focused matrix passed: 360/390/768/1024/1440 widths, populated
customer historical activity, empty/error overview, administrator finance return links,
Super Admin contact refresh in both policies, saved-vehicle refresh and customer
profile/review/privacy disclosures. Main-region axe checks, overflow, page identity,
nonblank content, framework overlay, keyboard radio selection, review audience and
cancel-without-write assertions passed. Page exceptions were checked in the customer
and support matrices. The first attempt was stopped after an incomplete Parts fixture
had no make options and did not open the vehicle-discovery tab; this was a fixture
setup error, corrected before the passing run, not fictional stock added to the app.

Additional regression: 28/29 selected cases passed initially; the remaining
wrong-thread case failed only during Playwright trace teardown because two review
jobs shared the same output directory. The case passed on a sequential, isolated
rerun. Both saved-configuration workflows passed at 390/1440px; session invalidation
and late-response protection also passed. One console-health check exposed the
customer-review fixture's unimplemented notification-summary endpoint (404); an
explicit isolated zero-summary fixture corrected the setup. No application endpoint
or permission was changed to silence it. The six-screen console check then passed
without warnings, errors or page exceptions. Final DOM refinement uses a block
container for noninteractive metric summaries; the 390px overview and six-screen
console checks passed again. The additional 320x568 staff check passed empty-message
validation, associated error text, native radio keyboard operation and doubled-text
reflow without a write. Local lint, route type generation, TypeScript, all 996 unit
tests across 149 files and full-project formatting passed. The original combined
check attempts were stopped during resource contention and when the owner supplied
the new disk reserve; these are interruptions, not passing gates. Checks were rerun
sequentially with fresh reserve assertions. The optimized webpack build and standalone postbuild also passed. `/demo` is absent
from its generated route table. No production deployment or final-source hosted/CI
acceptance was performed this cycle. Local reused Next is 16.3.8; the lockfile is
16.4.3, so the normal locked-dependency release gate remains necessary before rollout.
The six existing backend public-review portrait tests passed, using the main checkout's
identical media/test source (Git equality checked against this branch). They use mocked
Prisma/storage and make no database connection or write. No schema generation,
migration, database safety check, backup/restore, grant change or production transaction
was required by these disclosure/UI changes.

Limitations: local development evidence is distinct from optimized hosted acceptance.
Fixtures verify UI states, not real role provisioning or operational readiness. Real
customer/staff sign-in, real submissions, physical devices, screen-reader speech and
actual browser zoom remain untested. Text enlargement is a CSS stress test and does
not certify browser-zoom or full WCAG compliance. No production deployment is implied.

### Next priorities

A08/A09/A12: paired range fields, concise field help and the remaining utility-action
consumers; A10/A11: compact customer/support queues and genuinely empty dashboards;
A13/A14: policy edit hierarchy and notifications/helper collisions; A15: policy reading
hierarchy. Preserve the owner's restored homepage direction. Broader checklist cells,
protected Privacy/Finance approval forms and real authenticated workforce acceptance
remain their recorded scope. Optional assistant/tours remain a later product decision.

### Completed checkpoint and disk reserve

Batch 1 (A01?A07) is complete in the local review branch; A08?A15 remain the finite
next backlog. The 104-route checklist has 12 explicitly scoped page records; all
other route/aspect cells remain uninspected in this cycle. Source discovery and
mocked acceptance are distinct from real role/device access. Before/after screenshots
and the normal/reduced-motion fixture evidence remain outside source; no screenshot,
trace archive, generated build, credential or synthetic inventory was committed.

The owner's new disk reserve was applied immediately: stopped the earlier check
chain before building, read and invoked `C:/Users/PC/.codex/scripts/assert-disk-space.ps1`,
then guarded lint/types/tests with 0.25 GiB allowances (small caches/type output).
The single warm optimized build passed its separate 21 GiB threshold: fixed 20 GiB
reserve plus a justified 1 GiB allowance, covering the measured ~451 MB warm cache,
~392 MB prior dev output and the small reused standalone bundle without a download
or dependency copy. Free space was 24.52 GiB immediately before that build and stayed
above the reserve during the measured checks. The checker is a preflight, not an OS
quota or guarantee about concurrent applications. The final measurement is recorded
in the completion tracker.

No task Docker resources were created. Reviewed desktop-linux context/builders,
image/container references and disk totals: 38 images/11.84GB, 14 containers,
14 volumes/1.012GB and 87 cache entries/6.715GB. The new running PostgreSQL container
belongs to another active task and was retained. Current, rollback, base/tool,
other-task and uncertain resources were retained; no broad prune or volume removal
ran. Removed only this batch's superseded 1,581,764-byte diagnostic trace archive
after its isolated rerun passed; retained screenshots, small receipts and useful
current build/cache. Other concurrent free-space changes are not attributed to this
batch. Earlier explicitly approved folder deletions remain subject to their recorded
automatic-review rejections; no deletion workaround was used.

### Production rollout — 25 October 2026

Owner explicitly requested production deployment after the local batch checkpoint.
Runtime `e9f48ef525b80cc215f340015b0553e5b1e3af73` is READY on Vercel
`dpl_5vyykAdQnDsAshfCKRU9KNkePJgb`. Both actual main/www aliases independently
matched at 11:13:48 UTC / 12:13:48 Lagos. This is a frontend-only promotion;
DigitalOcean remains ACTIVE `f9239c36-d4b7-4ef0-b8ba-479cda926a13`, source `ff42b0e2`.
No backend image, database migration, business-data write or permission change was
performed. The separate Shop/Vehicles revision-2 worktree remains in progress.
Future source selection must retain this release's audit fixes rather than deploy
its older frontend base over them.

Exact runtime-source CI passed: frontend release checks `40186973452`, backend
safety `40186973448`, secret guard `40186973443`. The locked-dependency hosted
candidate passed all 34 audit scenarios at 360/390/768/1024/1440px plus short-phone
validation/doubled-text checks, including zero-warning/error console health. The
first hosted attempt exposed a development-only test assumption: negated text
assertions still required Next's development portal to exist. Test-only commit
`8b5fe871` now asserts zero error portals while correctly accepting their absence.
Its frontend CI `40187506046` and secret guard `40187506070` passed. This commit
changes no deployed runtime input; Vercel excludes tests/docs, so the already verified
candidate was reused without another application build.

All nine real-data candidate checks passed: restored Home at 320/390/768/1024/1440,
loaded imagery, mobile menu, FAQ, carousel keyboard/touch/pause/play, service/quotation
links, public reviews and actual /demo 404. Scoped axe checks and page exceptions
passed. All nine real-data public scenarios passed again on production after promotion, with zero page exceptions. Expected anonymous-session 401 responses and the intentionally visited /demo 404 are recorded separately from application exceptions. The
34 dashboard scenarios used browser-isolated fixtures against the optimized candidate;
no fictitious record, real sign-in, reply, policy approval or transaction was submitted.
Physical devices, screen-reader speech and real authenticated operational acceptance
retain their stated limits.

Read-only preflight/postflight confirmed the database online, nine automated managed
backups (latest 05:22:10 UTC), existing encrypted off-device seven-day/PITR safeguards,
and today's successful 06:48:38 UTC separate 89-table/65-migration restore rehearsal,
original rows unchanged. No new database command, backup or restore was needed or run
for this frontend-only release. Backend origin, browse/enquiries mode, disabled private
testing and existing deployment protection were retained. Temporary hosted QA keys were
revoked and their absence verified before promotion. Immediate frontend rollback is
`dpl_Hspe97LQ9MsxdKoNwaiqURvKFQPU`; preserve the current backend and migration 65.

Evidence: `%TEMP%/allied-audit-deploy-20261025/` holds scoped preflight/postflight,
`hosted-suite.json` and `candidate-public/hosted-qa.json` plus desktop/mobile captures.
Hosted audit screenshots refresh the existing `allied-audit-actions-20261025/after-*`
files; the before captures remain intact. Production captures use a separate directory.

Production completion: live Privacy copy matched the new profile first/last-name
and current-photo disclosure on both main and www; the restricted customer Orders
URL still redirected to Contact. These three additional read-only checks passed
at 11:15:50 UTC / 12:15:50 Lagos, without writes or page exceptions. All browser
contexts are closed. Exact-source CI, 34 hosted fixture scenarios, 9 candidate
public scenarios, 9 production public scenarios and the 3 changed-copy/restriction
checks are complete. Real-account operational submissions remain untested.

Disk completion: reserve checks passed before CLI upload, browser QA and final
handoff; final C: free space was 23.83 GiB. No local rebuild, dependency installation,
image archive, extra worktree or editor profile was created for this rollout.
Docker remained at 38 images/11.84GB, 14 containers, 14 volumes/1.012GB and 87 cache
entries/6.715GB. No task-owned redundant Docker resource existed to remove; useful
current/rollback/other-task resources and evidence were retained. Main-checkout
uncommitted edits and the independent R2 work remain untouched.

## Cycle 7: Shop, Vehicles and enquiry continuity — 25 October 2026

Bounded revision 2 implementation released. Frontend reviewed tree `cfba360d`,
READY `dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe` on main/www; backend `91455d10`, ACTIVE
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19`; database history/schema verified at 70.
The current audit/homepage source was merged and retained. This cycle does not
redesign other dashboard pages or complete all broader role/state acceptance.

| Area               | Verified behaviour and evidence                                                                                                                                                    | Limits                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Shop               | Broad product language, visible meaningful categories, native mode selection, scoped recorded choices, typed oil grade/ml, family reset, paired NGN budgets, explicit sort/history | Real catalogue still has zero published records; no inferred family/specification backfill                                |
| Vehicles           | Cross-field make/model search, exact full sort cursor, budget/condition preferences, requirements intent distinct from listing                                                     | Matching/persistence use real isolated PostgreSQL; no real listing or sourcing promise invented                           |
| Contact            | Both budgets and criteria in editable draft/review, listing reference, Keep/Start preserving both drafts, resume/reload, session separation and storage-failure protection         | Submission is mocked in browser; actual persistence/routing/authorization passed isolated API tests; no real enquiry sent |
| Catalogue admin    | Grade and explicit ml validation/review/persistence, family/category compatibility, shared other-product authoring preserved                                                       | Browser admin save is a fixture; no live product/category mutation performed                                              |
| Supporting queues  | New intent projected to authorised queues with existing branch/assignment/template restrictions; readable labels retain legacy listing semantics                                   | No new real authenticated operational sampling; broader dashboard redesign outside scope                                  |
| Recovery/rendering | Global/category empty versus no match/error, pending/stale searches, invalid budget focus, Escape return, responsive 360–1440                                                      | Edge automation and sampled main-state WCAG scans; no full physical-device/screen-reader certification                    |

Final source checks: 1,003/1,003 frontend units (150 files), lint, TypeScript,
formatting, optimized production build, zero production audit vulnerabilities;
backend CI, physical schema-drift rollback test, migration review/history/backup
checks, isolated domain tests and fresh 65→70 production-archive restore rehearsal.
All 18 hosted fixture browser cases passed in one final run. Two real public
read-only cases passed on the candidate and again on production at 390/1440.
No automated WCAG-tag violation or application error appeared in sampled main
states. Keyboard validation/modal focus and Escape were automated; full manual
assistive-technology and operational-role acceptance remain untested.

Visual inspection caught and fixed inherited oversized native radios. Real-data
inspection caught a generic footer enquiry losing criteria; Contact and bounded
WhatsApp footer links now follow applied client-side preferences. The category-only
empty state is explicit. Existing shared support for other products remains;
new specialist tyre/battery/other-fluid/car-care fields and optional oil approvals
are deferred pending their business contracts. Never seed fixtures to satisfy
missing publication data. No checkout/payment/delivery/reservation was enabled.

Manifest: `tests/quality/shop-vehicles-r2.txt`. Full contracts, migration/rollback
and detailed evidence: `backend/docs/shop-vehicles-search-r2.md`. Screenshots:
`%TEMP%/allied-shop-vehicles-r2/` (fictional populated fixtures) and
`%TEMP%/allied-shop-r2-real/` (real empty data/public prefills). Temporary hosted
review keys were revoked and existing protection retained. Local Next server
startup was rejected by automatic approval review; hosted validation completed
without an alternate local startup attempt.

Owned synthetic tmpfs test container was removed after verifying no other consumer.
Retained current/rollback images, useful caches, all data volumes, source, other
worktrees, private backups and the native recovery database. No broad prune or
unknown-file deletion. The 20 GiB reserve passed measured task preflights; final
reading is in the completion tracker. This does not enforce a machine-wide quota.

Remaining acceptance: real catalogue publication/labels and reviewed fitment are
business inputs; authenticated live queues and real private detail states remain
unsampled. Keep prior cycles' broader dashboard/manual backlog and settled Item 6
scope. No homepage restoration or broader redesign is implied by this release.

## Cycle 8: Notifications across roles - 25 October 2026

Bounded notification-only implementation on `feat/notifications-experience-20261025`.
Original baseline `0253a651`; checkpoint `04559c7a`, then current released R2 source
`71d3f60d` merged as `628d6add`. Shared generated contracts were regenerated.
No current production release, role, customer data or business policy was changed.

| Page/surface                                   | Verified implementation and state scope                                                                                                                                                 | Evidence/limit                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Customer `/dashboard/notifications`            | Focused inbox, optional full-width settings, read/unread, All/Unread/advanced filters, paging, whole-account bulk scope, retry and uncertain-write recovery                             | Populated browser-isolated fixtures; source-record commerce stays launch-restricted                                            |
| Staff/Admin/Super Admin `/admin/notifications` | Same workspace; own inbox and current managed-access gate, no title-based permission grants                                                                                             | Legacy four-role and represented eight responsibility fixtures; real operational accounts unsampled                            |
| Shared bell/preview                            | Global count, 99+ display/full accessible count, five frozen recent rows, no read-on-render, retry/empty/error, focus/Escape/outside dismissal                                          | Account/session isolation; no duplicate toast/sound stream                                                                     |
| Settings                                       | Reviewed switch changes, immutable channel policy, truthful defaults, unavailable SMS/marketing state and deliberate future consent                                                     | Existing preference/idempotency protections retained; no real provider delivery triggered                                      |
| Source-record context                          | Explicit read of displayed related IDs only, no hover/render/scroll acknowledgement or focus theft; missing/revoked source redaction                                                    | API integration and targeted rendered journeys; restricted full-mode customer commerce remains separately unsampled            |
| Browser push                                   | Local native subscription AND permission AND server binding, no prompt on mount, device-only off, endpoint/account isolation, bounded persistent ID deduplication and safe inbox clicks | Worker fake-provider + actual handler/storage harness; native Edge subscription probe failed with permission-denied AbortError |
| Producers/recipients                           | Persisted security events added transactionally; existing branch/assigned/delegated/internal-note boundaries and optional channel policy retained                                       | Isolated real PostgreSQL checks, no fabricated production events or broad escalation                                           |

Post-merge checks already passed: 1,018 frontend unit tests; 477 backend unit tests;
51 integration cases (42 domain/context/preference/retry/identity + 5 push-provider
fixtures + 4 ownership/summary). All 70 existing migrations replayed on a new
isolated `_ci` target with restricted runtime and `db:check`. Backend types, lint,
format, secret guard and 410 mounted/documented API operations passed. No new
notification migration is needed. Final frontend checks/browser evidence follow.

Fixtures never certify a real production account, physical device, screen-reader
speech or native delivery. Native probe used an ephemeral local Edge profile and
keys: permission reported granted, then subscribe failed with `AbortError:
Registration failed - permission denied`; no external provider send occurred.
Production push configuration already exists, confirmed read-only without exposing
secrets. A supported device/provider delivery and actual OS-click check remains.
Deploy the compatible push worker before the new service worker/frontend; missing
endpoint fingerprints intentionally fail closed. No publication in this cycle.

Screenshots: `%TEMP%/allied-notifications-cycle-20261025/` contains four-role
390/1440 inbox/preview/settings captures plus 360/768/1024 long-content views.
Final migration/API/browser/native receipts: `%TEMP%/allied-notifications-final-20261025/`.
Desktop/mobile captures were visually inspected; baseline screenshots were blocked
before local preview became available, so no manufactured before/after claim.
Current fixture preview is development mode with reused installed dependencies;
locked-dependency hosted acceptance is a separate pending release check.

Disk interruption and recovery: browser testing paused when C: fell below the
mandatory 20 GiB reserve. The approved disposable 1.94 GiB batch was automatically
rejected and retained. Owner completed CapCut uninstall, independently verified
about 5 GiB recovered and 21.16 GiB free before resuming a 1 GiB bounded stage.
Chrome, source, other worktrees, histories, databases, backups and release resources
were retained. No blanket cache/Docker prune or deletion workaround was used.

Final rendered checkpoint: 155 distinct browser scenarios have passing latest
outcomes across the recorded runs; this is not one clean full-suite run. The
147-case run first passed 143: one cold development redirect exceeded its wait and
passed unchanged on recheck; three old workforce assertions omitted the existing
Fitment link. Assertions were corrected only for the three already eligible
templates; all eight workforce scopes then passed. Nine focused context/focus/
doubled-text/reduced-motion cases passed, including seven permitted source-record
journeys. All four roles' 390/1440 inbox/preview/settings captures were refreshed
in an eight-case passing run. Restricted full-mode customer commerce context pages
remain inaccessible in the current browse/enquiries preview and were not counted
as passing. Physical-device zoom and full screen-reader speech remain unsampled.

Final device correction: push-status now returns only the current account/session's
endpoint hashes. A saved binding for an older endpoint cannot make the renewed
local subscription appear enabled. Six focused device tests passed after this
correction, including actual SHA-256 comparison and no repeated permission prompt;
five isolated push API/worker cases passed, including endpoint renewal and keeping
another session's device enabled. The earlier full frontend suite passed 1,018;
the six-case focused recheck includes one newly added regression (not 1,024 distinct
tests). Frontend types and full formatting passed; full lint exposed one unused
test import, removed and validated along with all subsequently changed source/tests.
The final endpoint-hash contract/types were regenerated and checked separately.

The optimized frontend build and standalone postbuild now pass on source
`0def5c64`, using the existing dependencies and `browse_enquiries` configuration.
It was initially blocked by the mandatory disk preflight. The owner subsequently
removed all four approved redundant installers (1,147,739,384 measured file bytes,
about 1.07 GiB); their absence and retention of both installed extensions were
verified. The 1 GiB build preflight passed with 22.08 GiB free, and the postbuild
reading was about 22.04 GiB. Chrome was untouched. No dependency install, duplicate
worktree or Docker resource was needed. The former disk/build blocker is resolved.
Build log: `%TEMP%/allied-notifications-final-frontend-build.log`; manual-cleanup
receipt: `%TEMP%/allied-notifications-final-20261025/owner-cleanup-verified.json`.

Installed Next is 16.3.8 versus the lockfile's 16.4.3; exact locked-dependency CI and
optimized hosted browser acceptance remain release checks. The rendered scenarios
were verified in the local development preview; this successful optimized build
does not turn them into production-mode browser evidence. Genuine native delivery
and OS-click acceptance remain unverified for the device reason above.

Live release was rechecked read-only: main/www still serve
`dpl_7Hnx3QdAhEL9UFtWSKnf8AzHFDYe`; backend remains ACTIVE
`264c3f8e-324d-42bd-86cb-0dffa2eb9f19` with no pending rollout.
No notification deployment was performed. Release API/general worker before the
frontend, then verify native delivery/clicks on a supported consented test device.

## Production notification release - 25 October 2026, 17:26 UTC

Notification runtime 345847d5 is deployed: backend 1876e3d1-ab99-4e26-8a58-1ea4fcb0d46a
ACTIVE; frontend dpl_37Wd7HsDbxGiqpaZw8qL1oZuDpG3 READY on main/www. API and
general worker preceded frontend promotion. Home/reviews, R2 and audit fixes,
permissions, database history at 70 and browse/enquiries restrictions are preserved.
No production fixture, customer message, transaction, migration or grant change.

Exact locked Next 16.4.3 CI passed: 1,019 frontend units, lint/types/format/build
and production audit; backend safety and secret CI passed. Nine image checks,
production read-only db:check, runtime least privilege and current worker heartbeats
passed. Today's separate 89-table restore and nine managed backups were verified.
Temporary exact-IP database access and hosted review keys were removed.

155 hosted fixture browser cases passed across 142+13 complete runs, including
four role families and eight workforce scopes. An outdated opt-in fixture failed
initially; adding its actual endpoint/hash contract resolved it without app changes.
Live Edge checks on both domains at 390/1440 passed Home/Reviews, authentication,
/demo 404, images, wrapping and console/runtime checks; no API writes. Native
delivery/OS clicks, physical devices, full screen-reader and authenticated real-role
acceptance remain unverified. Item 6 and broader operational acceptance remain open.

Full release/rollback/evidence details: backend/docs/notifications-experience-20261025.md
in the reused allied-home-restoration-20261025 worktree. Runtime remains 345847d5;
subsequent edits are evidence and the E2E fixture correction only. C: postflight
29.54 GiB free; current/rollback images, warm cache, databases/backups and other
tasks retained. No broad prune, duplicate install/worktree or image archive.

## Cycle 9: Product compatibility concurrent edits — 25 October 2026

Route `/admin/products`, administrator product detail editor. Another editor could
change a legacy compatibility between the freshness read and write. The new editor
sends the child version on update/retirement; the API checks it inside the product
mutation lock and rejects stale changes with 409 before history or mutation.
The administrator response exposes the version, while the public projection stays
limited. An older response without a version disables edit/retire and asks for a
refresh. A rejected review disables repeat confirmation, keeps the draft and offers
explicit reload of current values. The draft key includes the child version so
obsolete session storage does not override that reload.

Nine isolated PostgreSQL integration cases passed under a non-owning runtime role;
concurrent writes produced one success, one 409 and one history increment. Stale
retirement was rejected. All 13 Edge/Playwright editor cases passed locally,
including a 320px write-time conflict, draft recovery, no horizontal overflow and
automated WCAG 2.2 AA rule checks. A focused follow-up confirmed no duplicate
confirmation after rejection. The capture is
`%TEMP%/allied-compatibility-conflict-mobile.png`. Final-source checks and
hosted release evidence are tracked in the site-completion tracker. This is
isolated/fixture-rendered evidence, not a real authenticated production editor
session; physical devices and screen-reader speech remain untested.

On the 70-migration release branch, final-source backend race tests passed 9/9,
frontend/API builds, types and lint passed, and the optimized editor run passed
11/13 before two issues were isolated. The preflight retry rule was corrected so
a failed read can be retried safely while an attempted stale write cannot; a
separate screenshot timed out under concurrent checks. Both cases and the mobile
write-time conflict passed after the final rebuild (3/3 focused), with no new
horizontal overflow or automated accessibility violation. Hosted authenticated
acceptance remains open.

## Cycle 10: Customers and Customer Care - released 25 October 2026

Backend source dc0322f0; final frontend fd19aabc in the reused allied-shop-vehicles-r2-20261025 worktree,
branch feat/customers-care-20261025. Live backend 9ed4a4f2-683a-41f2-ab43-39673783a4a5
ACTIVE; frontend dpl_BVUgeibwBeTL3EvTZPiiCM9nMNgf READY on main/www at 19:44 UTC.
Notification source 17bc43fc and concurrently released compatibility source 313c4f9c
were merged and reverified; the release guard stopped when production changed.
Other worktrees/main edits are preserved. Home, finance and broader redesign remain
outside this cycle; only the shared semantic status presentation crosses dashboards.

Actual routes: Admin/Super Admin /admin/customers and details, legacy /admin/support
and case routes, managed Customer Service enquiry/complaint workspaces, customer
/dashboard/support and conversations. Existing per-page index entries remain valid.
Implemented genuine compact tables, visible details, labelled server search/filter/
cursor return state, copy controls with reserved space/focus/touch/manual fallback,
real reviewed account transitions/session revocation/audit, conversation-first care,
public/internal audience separation, retained drafts and per-operator notice dismissal.
Managed contact projection and dismissal retain exact responsibility/case scope;
sales-only readers gain no contact fields, suspension or provider permissions.

Locked Next 16.4.3 CI passed 1,024 units plus lint/types/format/build and production
audit (zero production vulnerabilities). Backend safety CI passed full empty replay
and schema checks at 71 migrations, the real missing-column guard and permission/
mutation flows. Final merged-source real isolated PostgreSQL/HTTP suite: 55/55 across
six files including the existing compatibility fix. Four non-root image contracts
passed on the task fixture. Route/OpenAPI coverage remains 415 operations/355 paths.

Final compiled Edge candidate: 15/15 new customer/care cases and 19/19 complete
customer-detail cases passed; 13/13 compatibility
editor cases passed on the merged predecessor. The final detail-only batch removes
stretched secondary panels and garage payment fields, corrects the synthetic garage
fixture and refreshes matching before/after captures. Conversation regression run passed 60/61; the disclosure shortcut
was corrected and all six focused role/audience/outage/responsive cases passed on the
rebuilt source. All 61 distinct cases therefore passed across the full run and rerun,
not in one all-green run. The table wrapper/assistive-label containment issue and
1366px grid override were fixed. Responsive 360/390/768/1024/1440, 1366x768 desktop,
200% reflow emulation, keyboard, contrast, scoped Axe and normal-flow console/runtime
checks passed. Broader backend run failures were investigated and resolved in focused
reruns; exact counts and caveats are in backend/docs/customers-care-20261025.md.

Forward migration 20261025170000_support_delivery_notice_dismissal applied through
the protected runner after a fresh verified production backup. Separate actual restore
rehearsal preserved all 89 original table hashes and migration ledger through 70-to-71.
Live db:check/history/checksums, least privilege, backup SELECT, readiness and eight
worker heartbeats passed. No existing grants changed. Temporary database IP access
and owned hosted-review keys were removed. Twelve real read-only post-promotion
journeys passed on both domains; no real customer was suspended, replied to or had
a notice dismissed for acceptance.

Synthetic before/after table, detail and care captures: %TEMP%/allied-customers-care-20261025/.
Browser receipts: %TEMP%/allied-customers-care-hosted/, allied-customers-care-regressions/
and allied-customers-care-compatibility/. Live smoke: %TEMP%/allied-customers-care-live/.
UI mutations use HTTP fixtures; API integration uses real isolated PostgreSQL. No OS
clipboard read; write outcomes are instrumented. Touch/zoom are emulated. Physical
on-screen keyboard/devices, full screen-reader, every shared-status consumer and
operational authenticated real-role acceptance remain unverified. Recovery was a
logical archive restore, not a new managed physical PITR cluster. These limitations
and broader site-completion Item 6 remain open; no perfection claim.

Only the owned auto-remove tmpfs fixture and eight superseded local candidate tags
were removed. All 14 volume identities, protected native fixtures/restores/backups,
current/rollback/base/tool images and other tasks were retained; no broad prune.
Postflight C: 28.77 GiB free at measurement; no machine-wide reserve guarantee.

## Cycle 11: Cart clear across tabs - candidate 25 October 2026

The reviewed customer cart could change in another tab after the client's final
read but before the empty-body DELETE. The server now requires the reviewed item
IDs, product IDs, quantities and unit prices, compares them under a cart lock and
returns 409 without deletion when anything changed. The client sends this snapshot
while preserving its full preflight, draft review and unknown-outcome safeguards.
The backend contract and all 13 compiled cart fixture cases passed. The selected
320px and 1280px cases passed automated axe/overflow and keyboard interaction;
this does not replace physical-device or full screen-reader verification. A fresh
isolated 71-migration replay and two backend integration files passed. Actual
production customer carts were not mutated for acceptance. Release and real-role
checks remain open; the per-page dashboard backlog is unchanged.

## Cycle 14: Help, Learn and safe practice - local 26 October 2026

Selected brief Phases 0-3 implemented in feat/help-learn-practice-20261026 from
released 76377d43. Public Help/Quick help and dashboard entry points now reach
server-filtered, versioned learning: 17 articles, three semantic-target guides and
11 fictional local exercises. Source flags remain off for publication. No AI,
operational lookup/action tools, new schema or unrelated dashboard redesign.

Actual isolated API/session fixtures cover visitor/customer/Admin/owner and all
workforce templates, combined/delegated access and CEO_MD scope. Managed Admin
does not gain legacy administration. Private titles/bodies/guide/scenario content
stay on the backend; 191 final client chunks contain none of 94 restricted markers.
Real live-page guides observe user events, preserve dirty support inputs and offer
written mode for missing, obstructed or narrow targets. Local practice validates
editable examples, confirms replacement, searches fictional part evidence, reviews
and resets only its own memory. It has no operational mutation adapter.

Final local checks: 1,032/1,032 frontend units, 77/77 backend checks and 18/18
optimized Edge browser cases; types, lint, format, build/postbuild and API contract
checks pass. Browser practice traffic contains no writes or external requests.
320/390/768/1440 practice and dashboard-entry overflow checks and scoped Axe pass;
keyboard modal exit/focus restoration, refresh/pause, route and identity transitions
are exercised. A new 7px entry overflow at 320 was fixed with an accessible 44px
icon button. Desktop/mobile captures were visually inspected.

Evidence/checkpoint: docs/help-learn/IMPLEMENTATION_STATUS.md, content register,
capability map and operations guide; screenshots %TEMP%/allied-help-learn-20261026/.
Playwright/installed Edge used because Browser plugin was unavailable. API/browser
fixtures, intercepted failure/hostile-content cases and actual production acceptance
remain distinct. Physical devices, full screen readers, other browsers, locked CI
and hosted acceptance are unverified. Installed Next 16.3.8 differs from lock16.4.3.
No production deployment or real customer/business write occurred; existing site
completion Item 6 and the broader dashboard backlog remain open.

## Fitment and product media - 26 October 2026 local candidate

Scope: `/admin/fitment` (permitted Sales/Operations authors, independent technical
reviewers, Admin/Super Admin) and `/admin/products?media=<id>` Images/Compatibility.
Branch `feat/fitment-media-20261026` reuses allied-home-restoration from recorded
release 76377d43; other worktrees and pending work are retained. No shared rollout.

Reproduced legacy Toyota/Camry labels with blank controls using the actual previous
component and isolated fixture. Unchanged review made no write. Corrected explicit
legacy reconciliation, normalized ID hydration outside suggestion pages, owner-bound
selection drafts, snapshot preservation during refetch, stale/version blocking and
mismatched context. Evidence readiness and approval are distinct; unknown years stay
missing. Editor task groups, paired years, populated/required qualifier priority,
secondary disclosures, contextual controls and independent review/history are verified.
Product tasks separate Images from legacy Compatibility while retaining old deep links
and list filters. Gallery moves use an atomic, versioned full-permutation backend
operation. Main selection, upload stages, trust/validation, audit and cleanup survive.
Hosted URL validation now rejects literal private/local and common expiring URL forms.

Evidence and precise acceptance matrix: `backend/docs/fitment-product-media-20261026.md`.
Before/after captures are actual rendered components with synthetic fixtures; no stock
or evidence was invented for production. Isolated native PostgreSQL replayed 71
migrations and passed db:check; 21 API/database integrations, seven backend units and
40 frontend units passed. Full frontend lint/types/optimized build and backend
lint/types/OpenAPI/route checks passed. Browser checks use installed Edge, with scoped
Axe, keyboard/focus, 360/390/768/1024/1440 and existing 320px regression. A separate
real API/browser case uses actual file bytes, database persistence, public image
access and removal against an isolated database and memory storage provider.
Final compiled browser counts and artifact paths are recorded in the evidence doc.

Outstanding: real authenticated production-role, physical-device/on-screen keyboard,
full screen-reader, actual object-storage-provider and locked Next 16.4.3 CI acceptance.
Installed Next is 16.3.8; no dependency duplication. 200% native browser zoom and full
contrast/motion acceptance are not inferred from narrow-width/Axe checks. Business
must provide real photos/evidence and reconcile actual legacy records; names do not
establish approved product types or compatibility. No production data/role/storage
write or production deployment occurred. Site-completion Item 6 remains open.

Final fitment/media checkpoint: 36/36 compiled scope cases and 12/12 adjacent
upload/product regressions passed (48 total). Actual native isolated API media
lifecycle and URL rejection passed; 200% logical reflow/reduced-motion emulation
is distinguished from native/device acceptance. Owned preview/test API stopped;
54.78 MiB superseded browser output removed, current evidence retained. C: 29.88 GiB
free at measurement. Docker daemon unavailable; no Docker resources created or pruned.
Gallery alignment follow-up: removed an inherited sibling margin, rebuilt and passed
all five populated-gallery widths again with an actual desktop alignment assertion.
Current review captures reflect the follow-up; no production release or new scope.

Fitment/media production checkpoint - 26 October: runtime a28753ab is live in
frontend dpl_CucTTefbZ71ApHiWsYA8P9JrPoH9/backend caeac741-805b-47a5-bb2d-d9e703cdff77.
Locked CI and hosted Next 16.4.3 passed, closing the local dependency-version gap.
Thirteen read-only Edge journeys at 390/1440 passed; both aliases verified, no page
runtime errors/overflow, Home-to-Parts and authentication redirects retained.
Captures: %TEMP%/allied-fitment-media-production-20261026/. Read-only production
schema/privilege/heartbeat checks passed; no migration/business write. Real signed-in
fitment/review/provider upload, physical and screen-reader acceptance remain open.
See backend evidence for rollout, recovery/rollback and disk-retention receipts.

## Cycle 14 production addendum - 26 October 2026

The owner subsequently authorised deployment of Help, Learn and Practice Phases 0-3.
Frozen runtime `adef02f9` includes the actual preceding fitment/media release
`a28753ab`; broader redesigns and separate pending branches remain outside scope.
Both domains point to Vercel `dpl_EqRCL8GvHPvwXxMB2brqSgtdYKcD` (READY);
backend `1dbceb73-075e-4f41-bd76-deb3daf71354` is ACTIVE. Learning, guides and
safe local practice are enabled, AI remains disabled and browse/enquiries mode is
preserved. All three exact-source CI workflows passed, including locked Next 16.4.3
and 1,036 frontend tests; production dependency audit zero vulnerabilities.
Merged learning/media regression 26/26, deployment specs 32/32 and packaged contracts
10/10 passed. Read-only production public catalogue/practice and private-denial
probes passed. Frontend provider READY/alias evidence does not establish hosted UI
or authenticated-role acceptance. Physical-device, full screen-reader and actual
production-role journeys remain unverified; earlier local fixture/browser evidence
retains its stated boundaries. No business record or message was submitted.

Full release, rollback, backup/restore and disk evidence:
[Help/Learn production record](../../docs/help-learn/PRODUCTION_RELEASE.md).
Original Cycle 14 no-publication/locked-CI limitations describe the historical local
milestone and are superseded only by the explicit evidence in this addendum.
Site-completion Item 6, business policies and unrelated pages remain open.

The correction is released: frontend `dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u`
READY on main/www, backend `98401193-fb85-48d9-8c51-462dcadd6d19` ACTIVE,
source `76377d43`. The production API and public route smoke passed; the real
signed-in cart clear, physical devices and screen-reader flow remain untested.

## Cycle 12: Staff access revision — candidate 25 October 2026

Status, branch and role changes now require the selected account revision in the
backend. Missing revisions fail validation; concurrent stale changes return 409
without overwriting the winning decision. The existing dashboard sends the
revision and keeps its review, result verification and unknown-outcome controls.
Fresh isolated database tests passed, including competing mutations. Seven
compiled browser fixtures passed at 320px and 1280px. These are mocked browser
flows, not real signed-in role, physical-device or screen-reader acceptance.
Production release and hosted verification remain open.

## Cycle 13: Customer table and sidebar responsiveness - 26 October 2026

Owner screenshots showed customer rows stacking their actions when the sidebar
expanded. Reproduced at 1200 CSS px: approximately 105px rows expanded versus 57px
collapsed, with table overflow. The shared dashboard suffix-based action selector
overrode the intended no-wrap rule. Dedicated row controls now keep both actions
together. Stable identity/status/date/action column widths, compact horizontal
padding and a flexible email column keep all six columns visible at 1184-1920px
in either sidebar state. Long identities remain complete and wrap naturally.

The requested table, desktop navigation and mobile-drawer scrollbar tracks are
hidden. Overflow remains scrollable with touch/wheel/keyboard; the page scrollbar
is unchanged. The pinned identity column becomes static on phones. Focus capture
reveals whole controls clear of the pinned column and table edges; this fixes an
observed 1024px Edge case where native Tab focus left an action partially clipped.
Existing account review/sending safeguards, search, sort, paging and permissions
are unchanged. No real customer/account, database or external-message writes.

Final compiled local Edge run: 22/22 browser cases in one complete run (13 new
responsive/navigation cases plus nine existing care regressions). Six desktop
widths 1184/1200/1280/1366/1440/1920, narrow widths 320/390/768/1024, short sidebar,
customer/admin navigation and mobile Escape focus passed. Copy/manual fallback,
touch emulation, filters/detail return/paging, long content, sampled Axe/contrast,
and 200% reflow emulation passed. Four related units, targeted ESLint, TypeScript,
formatting, optimized build and standalone postbuild passed.

Initial failures were retained: cold dev compilation exceeded its first navigation
wait; a two-pixel desktop overflow and wrapping status label were corrected; native
keyboard focus exposed the clipping defect fixed above. Navigation test locators
were made stable while disclosure state changed. The final compiled run is green.

Evidence: %TEMP%/allied-customer-table-20261026/ contains before/after screenshots,
row metrics and traces. %TEMP%/allied-customer-table-compiled.log records 22 passes;
allied-customer-table-build.log and allied-customer-table-final-types.log retain
build/type results. Browser plugin unavailable; installed Edge/Playwright used.
Fixtures use synthetic example.test records and intercepted APIs, not published data.

Dependencies were reused (installed Next 16.3.8; lockfile 16.4.3). Exact locked CI,
hosted acceptance, authenticated real-role, physical devices and full screen-reader
testing remain unverified. Vercel management read returned 403; no access protection
was changed. The last recorded frontend release remains dpl_JD4ffNmmmo2W7dgrzBHN4evwNd6u;
DigitalOcean was read-only verified ACTIVE at 98401193-fb85-48d9-8c51-462dcadd6d19.
No production rollout was requested/performed in this cycle. Item 6 stays open.

Local-artifact postflight: owned development and compiled preview servers stopped;
C: measured 29.99 GiB free (30.30 GiB before work). Browser evidence totals about
8.4 MiB. Reused dependencies/worktree and useful compiled build/cache retained;
no install, extra worktree, profile copy, image archive or Docker resource created.
Docker inventory was unavailable because its daemon was stopped; no Docker cleanup
was attempted. Source, unrelated work, histories, backups and databases retained.

26 October combined production checkpoint: runtime 3ccee21a publishes the pending
customer table/sidebar, required staff-revision and Help/Allie batches together.
Backend e8c5297d-93f5-41e0-97bd-0c7851fa5daa ACTIVE; frontend
dpl_5hGWpdJyGqQgG69dcumqFQ2RU7HQ READY on main/www. Exact-source locked CI,
1,039 units, 41 isolated integrations, nine image cases, 57 hosted-candidate fixture
browser cases and 22 live read-only checks passed. Captures:
%TEMP%/allied-pending-release-production-20261026/ (real public reads), plus existing
allied-customer-table-20261026 and allied-allie-20261026 folders (synthetic fixtures).
Provider-cookie/identity/timing harness qualifications, three skipped provisioned
cases and remaining actual-role/device/screen-reader limits are explicit in
backend/docs/pending-commits-production-20261026.md. No business submissions or
schema migration. Broader Item 6 remains open; other worktrees preserved.

Revision 4 W1 local checkpoint: real workforce account directory replaces UUID-first lookup.
Scoped backend projection and copied-detail authorization, URL filters/pagination,
cleared failure states and existing reviewed editor retained. 31 isolated database/HTTP
tests, 14 focused units and 18 distinct fixture browser scenarios passed across
320/390/768/1024/1440 plus existing 430px editor coverage; exact reruns and initial
fixture/locator/reflow corrections are in docs/help-learn/WORKFORCE_DIRECTORY_W1.md.
No production writes/publication. Installed Next 16.3.8 differs from lock 16.4.3;
hosted/actual-role/device/screen-reader acceptance and full Revision 4 foundation
remain open. The 106-route structural coverage baseline is not completion.

Revision 4 W2 local checkpoint: owner demotion atomically removes role-dependent
delegation, advances workforce version and records reason without deleting valid
scoped duties, independent financial grants or histories. Invitation acceptance
cannot revive dormant delegation. The review submits both account/workforce
revisions. All 37 isolated HTTP/DB tests, 1,053 frontend units and optimized build
passed. Updated W2 browser specification is not rerun: compiled preview start was
blocked by automatic approval review; no alternate startup. W1 browser evidence
is separate. No schema migration, production rollout or real communication.
Evidence: docs/help-learn/WORKFORCE_ROLE_DEPENDENCIES_W2.md. Remaining foundation,
actual AI, all-route learning, handoff/live chat and evaluations stay required.

Revision 4 W3 local checkpoint: assignment/delegation definitions pinned to reviewed
version 1, using forward migration 72 with portable LF checksum. Fresh empty replay,
schema comparison/db:check, preserved reduced populated fixtures and existing
non-destructive SQL guard passed. Fixed a reproduced delegated-admin copied-target
branch bypass (200 before, 403 after); canonical versioned fitment, assignee and
support-recipient eligibility align. Strict legacy mutation receipts preserved;
updated clients explicitly request version metadata. All 57 isolated HTTP/DB cases,
five backend units, 1,057 frontend units, lint/types/contracts and optimized build
passed. W2/W3 rendered QA remains open after policy-blocked compiled preview start.
No production migration/deployment, real messages, provider call or published stock.
Evidence/rollback dependencies: docs/help-learn/WORKFORCE_TEMPLATE_VERSIONS_W3.md.
Current C: postflight 28.12 GiB free; same useful Docker/current/rollback resources
retained, no pruning. Complete effective-access/transition matrix, actual AI, full
learning coverage, reviewed handoff, gated chat and evaluations remain required.

26 October campaign release: 8c11c3a0 is live with the supplied unaltered poster on
home/About, complete 4:5 framing and About workshop-wall archive removed. W1/W2
committed workforce changes included; unfinished W3 preserved separately. Local
61 distinct browser cases accepted after documented stale-fixture corrections,
1,053 units, scoped Axe/keyboard/responsive checks and all CI passed. Production
alias identities and independent backend health verified. Hosted actual-role,
physical device and full screen-reader acceptance remain open. Evidence, exact
release/rollback IDs, disk qualification and screenshot paths are in
backend/docs/pending-commits-production-20261026.md, campaign release section.

26 October 2026 - owner-authorised pending W3 workforce commit 432308e0 deployed
as reconciled runtime c4e0005d, preserving live campaign/W1/W2 and payment-source
concurrency source 2033b159. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a ACTIVE;
frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln READY, both apex/www aliases verified.
Guarded forward migration 72 and db:check passed after fresh backup and actual
separate populated 90-table restore/migration rehearsal with original row hashes
preserved. All exact-source CI, 123 restricted-runtime integrations, 41 release/
image cases and 43 distinct hosted fixture browser journeys accepted. Post-release
DB/least-privilege/worker checks and original app-only firewall verified. No grants
changed or real business submissions. Existing rapid overlapping staff-directory
filter loss remains separate; actual-role/device/screen-reader acceptance open.
Operator harness/timeout qualifications and compatible recovery composition are
in backend/docs/workforce-versions-production-20261026.md. Other worktrees and
uncommitted edits preserved; no speculative Docker cleanup; C: 27.71 GiB free.
Full Revision 4 implementation and broader Item 6 remain open.

26 October 2026 - Revision 4 W4A local checkpoint: server-derived responsibility
capabilities/branch/scope/provenance and assign/revoke added/removed/retained preview.
Delegated hidden-source and maximum-scope redaction retained; optional impact digest
is recomputed inside the existing locked mutation, rejecting stale/expired reviews
without partial writes. Position, baseline, independent grants and approval rules
are unchanged; full effective-policy/nav/session/subscription composition is open.
Fresh synthetic native CI target replayed 72 migrations, schema/db:check and runtime
least-privilege checks passed. 56 workforce plus seven learning integrations, 12
backend units, 1,066 frontend units, final lint/types/contracts and optimized build
passed; 24 focused units rechecked the final lifecycle correction. 77 distinct local
fixture browser cases accepted at 320-1920px, impact review 390/1440px with Axe,
keyboard, overflow and inspected screenshots. An initial raw-503 fixture expectation
was corrected to the existing safe generic error; no product safety was weakened.
The exact prepared preview script started on 127.0.0.1:3167 after fresh explicit
owner approval. All browser APIs were intercepted; no real submissions/deployment.
Evidence: docs/help-learn/WORKFORCE_EFFECTIVE_ACCESS_W4.md. The 106-route completion
gate remains unmet; actual AI/provider evaluation, full learning, persisted Customer
Care handoff and staffed/gated live chat remain required. C: postflight 27.85 GiB;
no Docker/worktree/profile/install duplication or speculative pruning. Other active
worktree changes/releases are preserved and require reconciliation before any rollout.
Full Revision 4 and Item 6 remain open.

26 October 2026 - Revision 4 W5 local checkpoint: canonical managed-workforce
navigation/page/action predicates, scoped revision metadata and server-relative
activation/expiry rechecks. Access loss discards stale reads, protected drafts,
learning and staff notification previews; forbidden pages return to the permitted
overview with an explanation. Owner baseline preserved even with a business-position
record, including the current-role guarded legacy invitation helper. No authority,
commerce, schema or real messaging capability added. Existing unknown-save recovery,
MFA, branch/assigned scope and independent approvals retained.
75 distinct native HTTP/DB cases accepted across bounded runs on the W4 synthetic
CI target; db:check and runtime restrictions reverified. Full 1,086 frontend units,
then 29 route/draft and 16 final preview cases passed; lint/types/contracts and the
final optimized build passed. 87 distinct intercepted browser cases accepted in
12 bounded batches, plus two console/Axe/overflow screenshot rechecks at 390/1440px.
Mobile/desktop images visually inspected; real roles, physical devices and full
screen-reader acceptance remain open. Tests exposed/fixed notification cache and
record-navigation draft regressions; harness qualifications are documented.
Evidence: docs/help-learn/WORKFORCE_NAVIGATION_SESSIONS_W5.md. The full Revision 4
and 106-route completion gate remain open: independent policy composition, real AI,
persisted reviewed handoff, gated staffed chat and provider evaluation are required.
No W4/W5 deployment. Other active worktree changes/releases retained and need
reconciliation before publication. Disk preflight stopped a low-headroom build;
space recovered without deletion. Reviewed obsolete dev-output deletion was blocked
by automatic approval review; no alternate removal attempted. Browser batches kept
at least 27.074 GiB in accepted receipts. No Docker resources created/pruned.

Revision 4 W6 (27 October): backend-only provider/retrieval core passed 51 contract/unit and 10 native learning cases with the provider mocked. No frontend interaction or source inventory changed; W5 rendered evidence above remains the UI checkpoint. Allie UI is still reviewed search, not an enabled conversation. See `docs/help-learn/ALLIE_PROVIDER_CORE_W6.md` for actual checks, provisional data flow and unfinished state/quota/endpoint/UI/provider evaluation. No new visual acceptance or deployment claimed.

Revision 4 W7 (27 October): owned transient conversation backend passed 36 native HTTP/DB and 139 unit cases with provider mocked; migration 73 fresh replay/schema/db:check and generated API types passed. No conversation UI added or new rendered acceptance claimed; W5 remains the frontend checkpoint. Owner setup instructions and a DPAPI masked-key helper are available. AI remains disabled; full 106-route acceptance, configured-provider evaluation, privacy UI, persisted Customer Care handoff and gated chat remain open. Evidence: docs/help-learn/ALLIE_CONVERSATIONS_W7.md and learning-threat-model.md. No publication.

Revision 4 W8 (27 October): local Allie conversation/privacy UI accepted in 16 distinct browser fixtures, 19 new unit cases and full 1,109-case frontend run; final focused/format/lint/build checks passed. Public and all existing dashboard roles, six widths plus 390x844, stop/unknown-outcome/clear/access boundaries, keyboard/focus/reduced motion and Axe verified as documented. Native backend 37 integrations and 60 core/state units passed with provider mocked; no real model or combined hosted journey. Existing auth launcher exclusion preserved after correcting the test assumption. Evidence: docs/help-learn/ALLIE_CONVERSATION_UI_W8.md; no publication/default AI enablement. All 106 route decisions, provider evaluation, persisted handoff and gated chat remain open.

Revision 4 W9 (27 October): actual provider evaluation and local browser composition
checkpoint accepted within limits; baseline quality issues and representative fixes
recorded in docs/help-learn/ALLIE_EVALUATION_W9.md. 80 units/39 native cases, backend/
frontend types/lint, actual guest/customer flows, native-dialog Axe and inspected
390/1440 screenshots. No new UI redesign, publication, permission expansion or build.
All 106 route gates and full handoff/live/workforce foundation remain open.

27 October 2026 - Revision 4 W10 local checkpoint: unsupported workforce history
preserved by bounded read-only contracts and revocation receipts; current grants
and mutation inputs remain strict. Nine native effective-access cases, 17 focused
frontend cases, full 1112 tests/167 files, source/scripts/frontend types and lint,
OpenAPI375/routes439+4 and one optimized cached build passed. Four final rendered
fixtures at 320/390/768/1440 passed with keyboard, Axe, overflow and no writes/errors/
external calls. Inspected mobile/desktop viewport screenshots; fixed test disclosure
and tall-element screenshot assumptions. No provider call, schema change, install,
new worktree or publication. Evidence: docs/help-learn/WORKFORCE_HISTORY_W10.md.
Exact-lock Next16.4.3 CI, hosted/real-role/device acceptance remain open. Independent
grant/account-baseline composition and granular care authority are next foundation
dependencies before persisted reviewed handoff and gated shared/staffed transport.
All 106 route completion gates remain open; full Revision4/Item6 stays active.

27 October 2026 - Revision 4 W11 local checkpoint: separate recognised active
owner grants compose with the managed boundary without widening branch duties.
Existing refund/dispute/privacy/financial-policy workspaces, current grant revision,
source eligibility, scoped notification links and stale-read/review disposal align.
Managed Admin uses the scoped refund queue and cannot recover broad legacy refund
inspection; owner/unenrolled legacy inspection and independent approval remain.
57 native HTTP/DB cases, 112 backend units, full 1114 frontend units and final45
focused cases, 18 populated role/width browser fixtures and11 history/session
regressions passed. Types/lint/contracts, final cached build and secret guard pass.
Known Next not-found CSS preload warning is verified/reported separately; full
route acceptance, hosted/device/screen-reader checks remain open. No schema/model
call, real message, install, new worktree or publication. W9 approval stays exhausted.
Evidence: docs/help-learn/WORKFORCE_INDEPENDENT_ACCESS_W11.md. C:25.79GiB free; Docker
retention reviewed without deletion, denied dev folders unchanged. Next: compatible
scoped BOOKING_CONFIRM and financial-aftercare adapters, then granular Care duties,
persisted reviewed handoff and shared staffed/gated transport. All106 completion
decisions and full Revision4/Item6 remain active.

27 October 2026 - Revision4 W12 local checkpoint: scoped booking confirmation
requires current BOOKINGS_READ branch scope AND separate BOOKING_CONFIRM. Shared
legacy capacity/calendar/assignment/schedule/version/audit/reminder guards retained.
Eleven scoped native,57 workforce/session/learning,11 legacy booking,59 backend units,
full1121 frontend and final34+35 focused cases passed. Twenty final responsive
fixtures at320/390/768/1440 and one actual browser/CSRF/API/restricted-CI-DB
confirmation passed. Fixed stripped recovery hints via explicit reviewed error codes
and narrow-detail label squeezing via detail-only stacked mobile facts.
OpenAPI376/routes440+4, generated types, types/lint/secret guard and final cached
build pass; exact-lock16.4.3/hosted/device acceptance remains open. No schema change,
model call, real message, install, new worktree or publication; W9 allowance exhausted.
Evidence: docs/help-learn/WORKFORCE_BOOKING_W12.md. C:25.56GiB measured free. Native
API stopped and synthetic browser session/cookie retired; existing frontend preview
retained. Docker resources preserved, denied dev-folder cleanup not retried.
Next: scoped financial-aftercare then granular Care permissions, persisted reviewed
handoff/shared staffed transport. All106 route gates and fullRevision4/Item6 active.

27 October 2026 - Revision4 W13 local checkpoint: scoped financial aftercare
requires current FINANCE_READ branch scope AND separate FINANCE_POLICY_APPROVE.
Minimal queue/detail, current evidence HMAC, customer-visible reviewed decision note,
receipt verification and reload-safe uncertainty block implemented. Existing legacy
fee/inspection/immutable-data/audit rules retained; no stock/refund execution.
Final62 native across7 suites,60 backend units, full1130 frontend plus67 focused,
21 responsive Staff/Admin fixtures and1 actual browser/CSRF/API/CI-DB case passed.
OpenAPI379/routes443+4, generated types, types/lint/secret guard and cached build pass.
Evidence: docs/help-learn/WORKFORCE_AFTERCARE_W13.md. No schema/model call, real message,
install/new worktree or publication. W9 allowance exhausted. Native API/session/cookie
retired; frontend preview retained. C:25.43GiB measured free; Docker useful resources
preserved and denied dev-folder cleanup untouched. Next: granular Care permissions,
canonical reviewed persisted handoff and shared staffed/gated transport. All106
route learning decisions, exact-lock/hosted/device gates and fullRevision4 remain open.

27 October 2026 - Revision4 W14C local checkpoint: operational Care view/reply/assign
intersect on the actual branch. General enquiries and complaints use canonical
reviewed assignment with checked eligible-handler pagination, CAS/audit/notifications.
Read-only controls, current help/practice predicates, public/internal separation,
revocation and reference-only uncertainty recovery implemented; unsent cross-action
drafts retained after verified success. Final14 native+61 regressions,21 backend
units, full1145 frontend/171files+36 focused,36 new responsive and50 legacy browser
cases pass. One real browser/CSRF/API/restricted-CI-DB flow saved2 assignments and
2 public replies,4 audits,zero internal messages,unchanged inventory/bookings.
OpenAPI381/routes445+4,types/lint/secret3260/correctly configured cached build pass.
Screens inspected; synthetic sessions revoked/cookie removed. No schema/provider
call,real delivery or publication. Evidence: docs/help-learn/WORKFORCE_CARE_CASES_W14C.md.
FullRevision4 remains active: next canonical reviewed persisted Allie handoff, then
shared staffed/gated transport and all106 exact route-learning decisions. W9 allowance
exhausted; new Care guidance has no actual-provider re-evaluation. Exact-lock16.4.3,
hosted/actual-role/device/screen-reader gates stay open. Useful Docker/caches retained.

## Revision 4 W15: reviewed Customer Care handoff

Verified customer Allie now opens an editable queued-message flow without requiring AI attempts. Exact destination/audience review, selected excerpts, cancel/edit, loss/reload recovery, independent drafts and canonical history/operator visibility are implemented. Full 1,161 frontend tests, 32 distinct Allie/handoff browser fixtures at 320-1440px and one real browser/API/restricted-CI-DB composition pass; scoped Axe and keyboard/focus checks are recorded. Backend ownership/privacy and transactional acceptance remain distinct from real delivery. Evidence and screenshots: `../../docs/help-learn/REVIEWED_HANDOFF_W15.md`. No provider call, production seed, publication or live-chat staffing claim. Two exact customer-support matrix entries contain partial evidence; all 106 complete route decisions remain open. Physical devices, complete screen readers, current hosted roles, new-source real-provider quality and shared staffed transport remain unverified.

26 October 2026 - complete colour/state brief, local implementation checkpoint.
Branch feat/colour-states-20261026 in allied-shop-vehicles-r2-20261025, based on
3cea520f / released runtime 8c11c3a0. Shared black/red/white tokens, branded
marketing/navigation/Allie gradients, contextual focus/selection and semantic
statuses are implemented; approved imagery and white operational surfaces remain.
No backend, schema, permission or business mutation changed. 1,053 units, lint,
typecheck, optimized build and 30 contrast pairs passed. Browser evidence accepts
324 distinct cases across 118 files; three optional cart-drawer cases unexecuted.
Firefox/WebKit, native autofill/pickers, physical devices and full screen-reader
acceptance remain unverified. Exact coverage, initial harness corrections, safe
screenshots and remaining limits: frontend/docs/COLOUR_AND_STATE_REPORT.md and
colour-browser-coverage.json. No push/deploy under this brief. Other worktrees,
Desktop edits and the separate workforce/Allie scope are preserved. Broader site
completion Item 6 remains open. Task servers stopped after checks; no Docker
resources created/deleted; final disk preflight 28.15 GiB free.

26 October 2026 - owner-authorised colour/state release deployed.
Runtime d6d8534d preserves deployed workforce/payment source c4e0005d and adds the
black/red/white presentation. Vercel dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD READY;
both apex/www aliases verified. Backend 707a200f-17c3-4947-a0bd-21b39496cf6a
remains ACTIVE and unchanged. All three exact-source CI gates passed, including
1,057 units, zero production audit vulnerabilities and isolated 72-migration
replay/db:check. 39 hosted fixture cases and 12 post-promotion public checks passed;
independent www and backend health reads passed. Formatting/hydration harness
corrections and explicit device/native/three cart-drawer limits are documented in
backend/docs/colour-production-20261026.md. Managed backups and retained populated
restore proof verified; no new restore, production DB command or business write.
Prior frontend dpl_GRVrwacMhYkrqktFvGRChY5LB2Ln retained for compatible rollback.
Other worktrees and Desktop edits preserved; no Docker cleanup; C: 27.86 GiB free.
Broader site completion Item 6 and the separate workforce/Allie roadmap remain open.

26 October 2026 - colour and brand assets Revision 2 local checkpoint.
Branch feat/brand-assets-r2-20261026 in allied-shop-vehicles-r2-20261025, based on
ce3121b8 / released d6d8534d. All nine supplied files inspected and original hashes
preserved; five pixel-identical logo crops and nine responsive WebP posters prepared.
Shared red/white/black marks, Home trust/service artwork, About portrait and Services
workmanship implemented. Ad 4 withheld: nationwide delivery contradicts collection
policy; clean corrected artwork is a business/source dependency. No policy changed.
1,057 units, lint/types/build/format and 30 contrast pairs passed. 103/109 broad
fixture browser cases passed; six await optimized replay (three development loading/
navigation failures and three Help/Learn tests with the local flag disabled). The
three prior cart gaps passed in focused checks; real Strict Mode dialog cleanup and
pre-hydration image-error handling repaired. Final local preview start was rejected
by automatic approval review, reason only "blocked by policy"; specific local-only
approval requested and pending. No bypass, push, deployment or database command.
See frontend/docs/BRAND_ASSETS_R2_REPORT.md and brand-assets-r2-coverage.json for
exact evidence, missing clean recaptures, platform limits and reused dependency
version discrepancy. Both live domains still dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD.
Other worktrees and unrelated edits preserved; broader Item 6 remains open.

26 October 2026 - mobile public support placement, P1 local correction. Live
Tyre Change detail at 320x640 reproduced the fixed support dock overlapping
31px of the handling-branch field during ordinary scrolling. This was a real
unfocused field obstruction, not a screenshot artifact. The shared narrow/short
viewport rule now presents Help and WhatsApp as an in-flow support strip after
the page content, retaining 48px-or-larger targets, safe-area padding and the
existing header Help route. Desktop floating controls remain as before. A
read-only browser style preview showed the field fully visible and the support
strip after the footer; no application record or message was submitted. The
exact local source passed frontend lint, typecheck, 1,057 units, optimized
build/postbuild and formatting. Exact hosted-candidate interaction, 390px,
short-landscape and adjacent-page checks remain before publication. Browser
plugin unavailable; installed Edge/Playwright provided the live baseline and
style preview. Prior rejected local preview startup was not retried.

27 October 2026 - hosted P1 acceptance for the same support correction.
Protected exact-source candidate dpl_3ipmjkYQNpcTMXqDnv9wgyEDm1QJ rendered
the real public Tyre Change detail using read-only public API data. Field hit
testing and zero obstruction passed at 320, 390, 768 and 900x400 coarse-pointer;
1024 retained its desktop control without intercepting the field. The mobile
support actions remain reachable below the footer and Ask Allie opens/closes.
Home/About/Services brand artwork, keyboard and failure states passed 21 of 22
hosted cases; the final 720px reflow check passed after replacing an inaccurate
CSS-zoom emulation. Five of six earlier pending cases passed; Review Cart is
launch-restricted and keeps its earlier isolated full-mode fixture evidence.
No form submission, real customer data mutation or production frontend release.
Actual device/browser zoom, screen reader and live authenticated-role checks
remain open. The next P1 review is public enquiry draft/account switching and
uncertain-submit recovery, already identified in release-blockers.md.

27 October 2026 - the brand/support batch is deployed. Final frontend source
8433ff57, Vercel dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ READY on both apex/www;
the previous dpl_9YTq9gSNUnb3XuHKry5MgCVvigdD is retained for rollback.
Locked frontend/secret CI passed. Seven read-only production routes at sampled
320/390/1440 widths passed title/H1, page-error, overflow, logo and action
checks. Tyre Change selector hit-testing passed at 320px and Allie opened and
closed. Backend stayed ACTIVE and unchanged; no form, customer or payment
submission occurred. Exact proof and remaining physical-device, actual zoom,
screen-reader and role acceptance limits are in BRAND_ASSETS_R2_REPORT.md.
The next P1 item was revalidated against the exact released source on 27 October:
public enquiry and complaint forms already clear private fields, review and receipt
on account invalidation while retaining the duplicate-prevention lock for an
uncertain anonymous send. Ten existing browser cases cover both request kinds at
draft, review, pending, unknown and completed stages; another covers validation
racing invalidation. The production deployment `dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ`
was re-inspected on both domains. No application change or repeat test run was
needed for this resolved item. Next independent P1 review: wider public forms,
actual mobile keyboard/text enlargement and measured performance, reproducing a
specific defect before editing. Real API and cross-device acceptance remain open.

27 October 2026 - About mobile hero layout shift, P2. Fresh read-only Edge
contexts at 390x844 reproduced the same CLS contribution, 0.0832804 in three
loads. Layout-shift attribution showed the second hero CTA moving to a new row
when the approved Quicksand font loaded, pushing the campaign artwork down
57.09px. Five other sampled public routes had no comparable shift; those
single-run lab samples are not field Core Web Vitals. The scoped CSS change
stacks the two CTAs through 480px, so fallback and final font geometries agree.
An optimized local build passed TypeScript and packaging. Three fresh 390px
candidate loads measured CLS about 0.0000056 each. At 320, 414, 480, 481,
768, 1024 and 1440px, the About page had no horizontal overflow or page
exceptions; sampled 320/390/481/1440 Axe scans had no violations and the
campaign image loaded. The local reused Next installation is 16.3.8 while the
project requests 16.4.3, so locked CI and an exact-version hosted candidate
remain required before release. The local preview's unrelated authentication
proxy aimed at absent localhost:5000; no account or API mutation was tested.

Production follow-up: exact frontend source `8fa386cba46836adfaf43d8529b985c83c47255a`
passed locked frontend CI and the secret guard, then deployed as Vercel
`dpl_6wmkNSL8eWDvHKKmqafU6rkb9C5k` READY. Independent apex and www
inspection resolved to that ID; the previous `dpl_A8CLYwBc6h4tYAwNqconFJTXfQFZ`
remains a rollback candidate. A protected exact-source preview first measured
zero or about 0.0000056 CLS at 390px. On the live apex, three fresh 390px
About loads each measured 0.0000056. About at 320/481/1440 and Home, Contact
and Help at 390 returned 200, with titles/headings, no page errors or overflow.
The About campaign artwork loaded; its Services/Contact CTAs kept valid
destinations and the sampled 390px Axe scan reported no violations. API
mutations were blocked and none attempted. Backend readiness remained 200;
no backend image, schema, payment, provider or business record changed.
This is sampled lab/browser evidence, not a field Core Web Vitals claim or
physical-device/complete screen-reader acceptance.

27 October 2026 - read-only Contact enlarged-root-text sampling. Browser plugin
was unavailable; installed Edge/Playwright inspected live `/contact` at
320, 390 and 1440 CSS pixels with a 200% root-font-size override. The page
identified correctly, had a meaningful heading, no document overflow or page
exceptions, and the form controls stayed within each viewport. At 390px the
public branch loaded as Allied AutoTech - Port Harcourt, a synthetic reserved-
domain draft opened the local review dialog, and its subject/message/branch were
readable without overflow. All API mutations were blocked; Send was not clicked.
Screenshots are retained outside the repo under `%TEMP%/aat-contact-text-200-*`.
Aborted About/Help prefetches occurred during navigation; there were no failed
form-data requests. This is a CSS root-size simulation, not actual browser zoom,
mobile keyboard, screen-reader or production submission acceptance. No Contact
defect was confirmed or code changed. Existing product/service/vehicle account-
change source and focused rendered-test coverage were inspected, not rerun; the old
release-blockers bullet claiming that reset was still unimplemented is superseded.

27 October 2026 - visual identity audit candidate on feat/visual-identity-audit-20261027.
All V01-V55 findings from the owner audit are retained in VISUAL_IDENTITY_AUDIT_CHECKPOINT.md.
Initial fixes cover the overview/Care CSS collision, availability truth, reply focus,
reference/message density, authoritative unread counts, reviewed homepage help,
practice instructions, Privacy/numeric type, footer destinations and customer wording.
Backend session labels have isolated pure-unit evidence; no backend release yet.
Homepage follow-up bounds the intact campaign, compacts sparse product/review states,
removes duplicate vehicle promotion and uses the existing black/red gradient.
Latest full unit run 1070 passed; two additional Home behavior tests passed separately.
Four isolated actual-component Home Edge cases passed at 360/390/768/1440; earlier
8 booking-card cases passed, with a later browser-close timeout followed by a successful sequential 8/8 rerun.
Full Next journeys, exact-lock CI, remaining audit findings and actual-role/device
acceptance remain open. Candidate is not yet published. See checkpoint for precise
evidence, dependencies, local-preview restriction and preserved unrelated work.

27 October 2026 - visual-audit frontend batch released. Runtime a1b8ce45 preserves
concurrent Contact/location source 42855c0d and publishes customer clarity and sparse
Home fixes. Vercel dpl_GKfQv1k4cD5qTKZj3c6LaP8Y4iqz READY on both domains.
Exact locked frontend CI 40478325501: 1072 units, lint/types/format/build and zero
production audit vulnerabilities; secret guard 40478325469 passed. Same backend
source at e925ecec passed isolated safety CI 40476605252. Hosted fixture acceptance
7 new plus 35 regressions passed; 14 candidate and 14 production public read-only
checks passed at 390/1440 with zero mutations/page exceptions. Backend remains
79d7a0ac-4e83-4b73-ae46-40af4731a604 ACTIVE/readiness200. No DB/worker/provider write.
Session-label and new homepage-help backend changes remain committed, not released.
Full V01-V55 goal remains active; next Shop discovery/detail and empty overview.
Evidence/rollback: backend/docs/visual-audit-frontend-production-20261027.md and
frontend/docs/VISUAL_IDENTITY_AUDIT_CHECKPOINT.md. Existing other-task edits preserved.

27 October 2026 - Contact visit-preference validation, P1. The released
`8fa386cb` source sent every visit-preference error to the date field and marked
both date and time invalid, even when time or the message needed correction.
Runtime `317b1678` targets and announces the actual date, time or message field,
clears stale feedback when edited, and keeps the request subject to staff
confirmation. Eleven focused units, six Edge Contact scenarios (including
320/390/1440px), TypeScript, changed-file lint/format and an optimized Next
16.4.3 build passed. The local build used a junction to matching installed
dependencies, so standalone tracing warned about paths outside the worktree;
the exact-source locked frontend CI `40472135463` and secret guard `40472135440`
passed independently. Vercel `dpl_24sXMLFwUuX6ag8PqMTtGaVH2xPh` is READY on
both apex and www. Live Edge at 390/1440px used the published Tyre Change
service and confirmed field focus, `aria-invalid`, visible error text and zero
API writes. API readiness returned 200. No backend, schema, provider, payment,
customer record or business policy changed. Other authenticated journeys,
physical devices and complete screen-reader acceptance remain open.

27 October 2026 - Shared viewport and support UX, P1/P2. The owner explicitly
requested a fixed mobile Ask Allie/Whatsapp dock, no visible Allie scrollbar,
breadcrumb-first page entry and scrolling to linked controls/selection targets.
The mobile rule had changed the dock to position: static. It now stays fixed
above the safe area with reserved document space and focus clearance. Allie
keeps a fixed header/close action and a separate scrollable body with hidden
scrollbar styling; scrolling and keyboard access remain available.

ViewportNavigation is mounted once in the shared root layout. New pathname
entries reveal breadcrumbs (or main content when none exist); explicit hashes
reveal their targets. Same-page hash links, linked buttons/tabs, selectors and
checked controls reveal visible aria-controls/data-scroll-target destinations.
Ordinary controls remain visible. Contact enquiry type, vehicle-intent radios,
visit preferences and Allie responses identify their actual target fields.
Keyboard focus stays clear of the header and support dock. Pointer activation
finishes before scrolling; validation/dialog focus takes precedence, pending
entry adjustments cancel on fresh user input, and optional learning walkthroughs
retain their own focus. A duplicate legacy support focus handler was removed.

The first fixture run rejected an invalid synthetic learning href and incomplete
API envelopes; fixtures were corrected without weakening production validation.
Subsequent checks caught pointer-focus scrolling cancelling a checkbox click;
that defect was fixed and the picker/validation/review regressions passed.
Reload acceptance checks actual hash visibility below the header, allowing native
browser focus restoration. Browser plugin not available; existing Playwright/Edge
was reused with intercepted synthetic API responses and no real writes. Final
14-case browser matrix passed: 320x568, 390x844, 768x900, 844x390, 1024x900 and
1440x900 support/modal tests with axe scans; 390/1440 page entry, repeated anchors,
hash/reload, selection, checkbox and radio journeys; and four adjacent Contact
validation, review/confirmation and pointer-picker regressions. No horizontal
overflow or page errors were observed. Screenshots: %TEMP%/allied-allie-viewport-
390.png and matching 1440.png. Native keyboard, physical devices, screen readers
and exhaustive authenticated-role combinations remain unverified.

27 October 2026 - P1 public Parts detail enquiry copy. On the live 390px page,
the only listed oil filter had no branch availability, yet the detail said to
arrange collection from a listed branch and repeatedly described ordering.
The candidate is based on the current fbb6565a frontend release and uses the
existing launch-mode gate to require staff confirmation of stock and collection
arrangements before visiting. Full-commerce wording remains separate. Price,
availability, fitment and the product-specific enquiry destination are unchanged.
An optimized Next 16.4.3 build, scoped lint and hosted CI passed before this
rebase; a rendered 390px detail showed the revised wording, product enquiry link, no
overflow and no page exception. A protected preview built, but its dynamic
product route returned 503 because the preview environment lacks BACKEND_ORIGIN;
that is a preview configuration gap, not hosted journey acceptance. Desktop and
exact-source CI and production verification remain pending. No customer form or financial action was
submitted.

### Historical 26 October Allie visual checkpoint

This earlier visual checkpoint is retained as evidence. Its AI deferral wording
is superseded by Revision 4 and the later W6-W15 implementation records.

## Cycle 15 - Help, Help & Learn and Allie - 26 October 2026

Bounded owner-requested refinement, runtime candidate aa54fba8, branch
feat/help-allie-20261026 in allied-shop-vehicles-r2-20261025. Help's bare learning
link is now a branded card; /learn has three visible modes, all-kind eligible search,
plain task/source presentation and query/mode-preserving navigation. Allie uses a
small native SVG and compact content-based panel/sheet with approved answers,
source/actions/unknown fallback; no provider, record lookup or action tool. Actual
role/context eligibility and in-memory practice boundaries remain authoritative.
Reproduced oil-filter search progression timing failure and repaired refresh/remount
readiness. Busy/missing/written/paused states explain themselves; live guides are
non-modal and do not fill/submit. Practice uses a single sticky mode signal,
editable sample care replies, honest hints and specific feedback. Dedicated practice
pages suppress floating support controls after actual mobile overlap review.

Evidence: 1,039 frontend tests; seven actual authenticated API cases, 71-migration
fresh isolated replay/db:check and runtime privilege checks; lint/types/build,
OpenAPI/types/424 operations. All three exact-runtime CI workflows passed. Real
isolated API/compiled Edge acceptance: 29/29 baseline plus six final-polish rechecks,
Help/hub/Allie at 360/390/768/1024/1440 and practice at 320/390/768/1440; scoped Axe,
keyboard/focus/Escape, reduced-motion/logical reflow, denied/private/unknown/error,
identity clearing, actual 30-second guide refresh and node replacement. Practice
network assertions observe no business writes or external traffic; form drafts and
practice inputs remain separate. No new production publication or real business write.

Full criteria, design-reference comparison, screenshot index, CI links and precise
limits: [Allie checkpoint](../../docs/help-learn/ALLIE_IMPLEMENTATION.md).
Local screenshots: %TEMP%/allied-allie-20261026/. Installed Edge/Next 16.3.8 local
rendering is distinct from locked Next 16.4.3 CI. Physical devices/native keyboards/
zoom, full screen-reader and actual authenticated production-role acceptance remain
open. Existing launch/policy/permission constraints, other worktrees and unrelated
Home/dashboard scope are preserved. Site-completion Item 6 remains open.

## Shop publication checkpoint - 28 October 2026

28 October 2026 - Shop visual-audit frontend released. Runtime 552ee418,
Vercel dpl_79uCiatbRsCvM2jtPJkwsx53efpP READY on both apex/www after promotion
and 14 live public checks. Preserves 9f9311cf collection guidance and fbb6565a
mobile navigation. Locked frontend CI 40673723280: 1072 units plus build/types/
lint/format passed; secret guard 40673723234 passed. Eight final hosted Shop/
product cases passed; ten retained-navigation cases passed on earlier candidate.
Backend 79d7a0ac unchanged, ACTIVE/readiness200. No local/shared DB test or write.
V20 initial mobile spacing and V23 wider vocabulary remain partial; full V01-V55
goal remains active. Evidence/limitations/rollback and disk-preflight incident:
backend/docs/shop-audit-production-20261028.md. Other tasks/dirty work preserved.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/compatibility-release-20261025; it is not a claim of current production identity.

Release source `313c4f9c` passed exact-source frontend CI. Production-configured
Vercel `dpl_GDqL1pgfFbWtb7avvNGGW8Zu3bNH` is READY on both main and www aliases,
after the matching API became ACTIVE on `634b9110-8ad0-455e-ad7d-48cd9ee35681`.
Protected candidate Home, Help, Parts and admin routes responded successfully.
The final three browser-isolated editor cases passed on the actual main domain:
320px write-time conflict/draft reload, safe failed-read retry, and mobile
layout/automated accessibility. All requests that could write were intercepted
inside the browser; this does not claim an authenticated operator test or
production data change. Public Home/Help/Parts responded 200 after promotion,
`/shop` resolved to `/parts`, and `/demo` remained 404. Wider role/device and
manual screen-reader acceptance remain in the prioritized backlog.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/parts-enquiry-copy-current-20261028; it is not a claim of current production identity.

28 October 2026 - P1 public Parts detail enquiry copy released. The only live
oil filter had no branch availability, yet its detail told visitors to arrange
collection from a listed branch and repeatedly described ordering. Runtime
9f9311cf builds on fbb6565a and uses the existing launch-mode gate to require
staff confirmation of stock and collection arrangements before visiting.
Full-commerce wording remains separate. Price, availability, fitment and the
product-specific enquiry destination are unchanged. Exact-source frontend CI
40668317540 and secret guard 40668317916 passed. A preview without
BACKEND_ORIGIN returned 503 on dynamic detail; the protected production-target
deployment returned the corrected page, then was promoted as
dpl_68bNV74wNajB9vW1Ly85nzmmdEvU. Both apex and www serve that ID. Live Edge
at 390/1440px passed product-detail heading, corrected copy, collection FAQ,
product-specific Contact navigation, no horizontal overflow and no page errors.
No customer form, payment or inventory action was submitted. Native devices,
screen readers and authenticated-role acceptance remain outside this check.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/customer-vehicle-payment-filter-20261027; it is not a claim of current production identity.

27 October 2026 - P1 vehicle-payment history on purchase detail. The verified
customer list API candidate filters by the owned vehicle transaction before
pagination, and the purchase panel requests that target and rejects a mismatched
row or incomplete history. This prevents unrelated account history from exhausting
the client scan; source payment locks and eligibility remain authoritative.
Six focused Edge/Playwright fixture cases passed on the locally compiled page:
later-page unresolved requests, wrong-target data, failed fetch and repeated cursor.
The first run used a blocked Next development origin and was not counted; the
successful run used localhost. Frontend typecheck, scoped ESLint/formatting and
exact-lock GitHub frontend release checks passed. A fresh isolated PostgreSQL
service test covered owner/target/cursor boundaries. This is not a full-page
accessibility or real production-role acceptance. The backend and frontend must
release in that order; no production deployment or financial transaction was made.
Evidence and provider-access limit: backend/docs/customer-vehicle-payment-filter-20261027.md.

27 October 2026 - Contact visit-preference validation, P1 local correction. At
`/contact` with an anonymous service enquiry, a future date and missing time,
the rendered form focused and marked the already completed date field. Entering
the time left the shared error visible until another review. A 4,000-character
message plus visit details also focused the date rather than the message. The
shared SERVICE/VEHICLE preference validator now identifies the field that needs
correction; the form marks it, connects its error description, focuses it and
clears stale feedback on editing. Both visible preference fields expose their
required state. Review still creates no booking, hold or payment. Eleven focused
unit cases, frontend typecheck, scoped lint/format and `git diff --check` passed.
Read-only isolated Edge/Playwright CLI interaction confirmed the before/after
missing-time focus and correction, message-overflow focus, valid review dialog,
and no overflow at 320px. The local API responses were fixtures; no POST was
sent. Exact-source locked Next 16.4.3 frontend release CI 40448703220 and
redacted secret guard 40448703167 passed for runtime c54ef088; the reused local
Next installation is 16.3.8. Hosted acceptance, wider public forms, physical
keyboard/screen-reader checks and full site completion remain open.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/fix/parts-enquiry-copy-20261027; it is not a claim of current production identity.

27 October 2026 - P1 public Parts detail enquiry copy. On the live 390px page,
the only listed oil filter had no branch availability, yet the detail said to
arrange collection from a listed branch and repeatedly described ordering.
The bounded candidate, rebased onto exact live frontend source a1b8ce45,
uses the existing launch-mode gate to ask visitors to confirm stock and
collection arrangements before visiting. Full-commerce wording remains separate.
The product's price, availability, fitment and enquiry destination are unchanged.
An optimized Next 16.4.3 build and scoped lint passed; a rendered 390px detail
showed the revised wording, exact product enquiry link, no overflow and no page
exception. Desktop optimized/hosted acceptance and release verification remain
pending. No customer form or financial action was submitted.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

## Customer history and Saved items - bounded candidate, 28 October 2026

V41/V42: current care and load/retry status remain first. Customer-only Activity history uses a native keyboard-operable disclosure; date drafts remain mounted across closing/opening. Verified all-zero periods use one message instead of five metrics, a flat chart and repeated empty record panels. Existing records, date filtering, permissions and staff analytics remain available. The launch limitation is shorter and placed with historical records. Remaining current-care empty cards are outside this batch.

V52: a successfully loaded empty collection has one browse action. Loading/error states retain navigation and retry; populated collections retain the toolbar action. Labels say Favourite products/Browse Shop without changing API values, saved IDs or mutation contracts.

Acceptance: 12 focused units pass (including empty vs historical data, date draft retention, staff preservation and refresh/session behavior); types and scoped lint pass. Six hosted desktop/mobile history/Saved fixtures added for native keyboard disclosure/tabs, date changes, error recovery, one action, overflow and sampled Axe. These browser checks and exact-source cloud CI are pending; this candidate is not deployed. Existing dirty tracker/asset files and other worktrees remain untouched.

### Historical merged-branch checkpoint

The following dated observation is retained from fix/compatibility-concurrency-20261025; it is not a claim of current production identity.

The earlier hosted run passed 11/15 scenarios. It found phone overflow caused by
absolute assistive labels escaping the table's scroll containing block, and a
1366px filter-grid override. Both are fixed in source and await final compiled
acceptance. Earlier fixture envelope/ambiguous-selector failures were corrected;
they are not counted as product regressions. Final checks and release evidence
will follow; this checkpoint does not certify production rollout.

## Cycle 10: Product compatibility concurrent edits — 25 October 2026

Route `/admin/products`, administrator product detail editor. A second editor could
change a legacy compatibility between the first editor's freshness read and write.
The older draft could then overwrite the newer record. The editor now sends the
child's version for update and retirement; the API compares it inside the existing
product mutation lock and returns 409 before history or record mutation if stale.

The administrator response exposes the child version while public product data
retains its limited projection. Existing bare DELETE clients remain accepted during
the transition. When an older response lacks a version, the editor disables
edit/retire and asks for refresh. A rejected review disables repeat confirmation,
preserves the draft, refreshes the record and offers explicit reload. Including the
child version in the form draft key prevents reload from restoring obsolete values.

Nine isolated PostgreSQL integration tests passed using a new `_test` database on
127.0.0.1:55581 with a non-owning runtime role. Concurrent same-version writes
produced one success and one 409; history advanced once and stale retirement was
rejected. All 65 then-current migrations replayed without schema diff. Thirteen
local Edge/Playwright product-extras cases passed, including a 320px conflict,
draft recovery, no horizontal overflow and automated WCAG 2.2 AA rule checks. A
focused follow-up verified that a rejected confirmation cannot be resent. Frontend
and backend types, lint and builds passed on the pre-merge source. The integrated
source then passed a fresh 71-migration replay, restricted-role `db:check`, nine
focused backend integration cases, generated contracts, typecheck, lint and
optimized builds. Its rendered editor suite and hosted release checks remain open.
The mobile capture is `%TEMP%/allied-compatibility-conflict-mobile.png`.

These are isolated and fixture-rendered checks, not an authenticated production
editor session. Real device and screen-reader speech remain untested. The current
`browse_enquiries` restriction and genuine catalogue content requirements remain.
The next review should verify an authorised admin QA session on the matching
release and continue the per-page operations backlog.

### Historical merged-branch checkpoint

The following dated observation is retained from origin/feat/visual-identity-audit-20261027; it is not a claim of current production identity.

28 October 2026 - Customer history and Saved items released. Runtime 0b5a9b76, Vercel dpl_GWDKwqj3Gs7uT8o1qNt4ce2jdLno READY on both domains after 14 public checks. Preserves published Help/Allie/navigation 0d4dd992 and Shop 552ee418. Exact frontend CI 40680419648 passed 1074 units, lint/types/format/build and production audit; secret guard 40680419233 and isolated backend safety 40680419675 passed. Eighteen final hosted journeys plus two native keyboard/focus/hover cases passed. Backend 79d7a0ac unchanged, ACTIVE/readiness200; no local/shared database write. V42/V52 released with sampled evidence; V41 remains partial for current-care empty cards. Full V01-V55 goal stays active. Evidence, recovery, harness failure and limitations: backend/docs/customer-history-production-20261028.md. Other tasks and dirty files preserved.

## Owner-reported favourites refresh defect - 28 October 2026

P1: on the reported public Engine Oil Filter page, a confirmed save displayed Saved to favourites only until reload. ProductActions initialised a local false flag and never read the saved collection. Reproduced against live frontend 0b5a9b76 with an isolated customer/collection fixture: save succeeded, reload lost the saved label. An initial fixture envelope lacked its required message and was corrected before reproducing the actual failure.

Candidate reads the existing authenticated, uncached owned favourites API, following pagination until the product is found or absence is confirmed. It shows Checking favourites while reading and an explicit retry on failure; an incomplete read is never treated as unsaved. Product navigation resets the action instance; session changes cancel late reads. Successful saves still depend on matching server receipts and retain existing CSRF/role/mutation guards. No browser storage substitute, API/schema change or customer-data mutation is introduced. A pathological repeated cursor or more than 100 pages fails safely with retry, rather than making an unsupported unsaved claim.

35 focused units passed across saved-state persistence, later pages, removal, failure/retry, product/account changes, account mutation and launch gates. Hosted desktop/mobile refresh acceptance and exact-source CI are next. Current-care/notification presentation investigations are deferred while this owner-reported failure is repaired. Wider V01-V55 goal remains active.

28 October 2026 - Owner-reported product favourites refresh defect released. Runtime ef06efb7, Vercel dpl_FAJ8oVhecCNTGac2XAyufAgg7hvv READY on both domains after 14 production public checks. Product detail now reads persisted favourites with pagination and explicit loading/error/retry states. Final CI 40704788016 passed 1080 tests, lint/types/format/build and zero production audit vulnerabilities; secret guard 40704788037 and isolated backend safety 40704788003 passed. Sixteen hosted fixture cases passed, including save-refresh/removal/retry at 390/1440 and retained focus/navbar behavior. Concurrent published sources 09efa694 and 4aafaebb are preserved. Backend independently advanced to 8fd37e1c (image 4fbc9cbb), ACTIVE/readiness200 with the favourites API unchanged; this task made no backend/database write. Evidence and precise limits: backend/docs/favourite-refresh-production-20261028.md. Wider V01-V55 goal stays active; next current-care empty-card and notification-availability clarity work. Existing dirty files and other worktrees preserved.

## Current-care density candidate - 28 October 2026

V41: render recorded current service, garage vehicle, next booking, quotation/payment, order, inspection and update summaries only when present. A verified fully empty response has one concise starting point and the existing garage/support actions; the header retains the single service-visit action. Vehicle-only summaries use a white surface and do not imply work is in progress. Grids adapt to the number of populated sections; current service timelines, exact money, requested-time labels, account ownership and launch-restricted links remain unchanged. History/date drafts and error/loading/session handling stay in the existing parent.

Ten new component cases and twelve overview/history/launch regression cases pass; types and scoped lint pass. New full-route acceptance covers compact empty states at 360/390/768/1440, keyboard focus plus hover, real garage navigation, single-record combinations, populated summaries and sampled Axe. Rendered acceptance and final-source CI remain pending. The first browser preflight correctly stopped at 19.3 GiB free; no browser/build/upload ran then. Source-only edits and small no-cache component checks continued; later free space recovered independently above 25 GiB and browser verification resumed after a passing preflight. No cleanup or database writes ran. V48 notification availability remains the next bounded batch; this candidate does not complete the whole visual audit.

28 October 2026 - Compact customer-care release completed. Runtime 73436a31, Vercel dpl_J3Yv5aJwRGrzwZe6fiUPyeNdd81t READY on both domains after 14 public production checks. Empty care is compact; recorded cards, history drafts, permissions and error/session boundaries remain intact. Preserves published Help/Learn 072e0509, notification preview 1a33815c and favourites ef06efb7. Final-source CI 40715112526 passed 1092 tests plus types/lint/format/build and zero production audit findings; secret guard 40715112493 and isolated backend safety 40715112523 passed. Twenty-five final hosted dashboard/notification cases passed; ten unchanged-source learning cases passed on the preceding candidate. Two actual public homepage explanation cases passed at 390/1440 with three valid destinations, reviewed article, honest AI label and focus return. Initial extra-test heading expectation was corrected to the actual summary-then-topic sequence, without runtime changes. V41 density/V04 public explanation have released sampled evidence; full V01-V55 remains active. Backend 8fd37e1c unchanged by this task, ACTIVE/readiness200. No shared DB/customer writes. Evidence, rollback, disk interruptions and limitations: backend/docs/customer-care-density-production-20261028.md. V48 notification preference/channel distinction is next; preserve other worktrees.

## 28 October 2026 - V48 delivery preference clarity candidate

Reproduced the live 390px SMS row showing a prominent On state beside unavailable delivery using isolated account fixtures. The actual settings now distinguish Default/Saved/Last known preference from Service enabled, Delivery unavailable and Availability unknown. Missing or stale channel data never implies sending is available. Marketing consent, versioned writes, explicit recovery and account guards remain unchanged; policy and delivery feature flags are not changed. Shared details explain required messages and valid contact details without repeating future-marketing paragraphs in every row. Both preference consumers use the same availability contract.

12 new contract/render cases plus 29 adjacent notification/recovery cases passed (41 total). TypeScript noEmit and scoped lint passed. Nine hosted role/viewport/state cases were added; the initial live baseline failed at the expected old label and retained its screenshot. An initial harness configuration error (string grep) was corrected to RegExp before that baseline ran. Actual candidate browser checks, exact master CI and production promotion remain pending. Current published source a51a58b8 and later master release records are integrated. Existing dirty tracker/asset records and the active master backend work are preserved. No learning target, permission, backend API, schema or approved delivery policy changed; no learning definition needs a new version for this presentation-only batch. Full V01-V55 scope remains active.

28 October 2026 - V48 delivery preference availability released on master runtime 2725efea, Vercel dpl_Ch3kcHTq565fAMKne6hFT8NPKw7R verified on both domains. Default/saved choices, unavailable delivery and unknown/stale availability are distinct. Final exact CI: 1216 tests passed, 12 optional cases skipped, production audit zero vulnerabilities; frontend 40768336402, isolated backend safety 40768406734 and secret guard 40768336321 all passed. Thirty final hosted notification/permission/recovery cases and 14 candidate plus 14 production public checks passed. An initial refresh test assumption was corrected to verify explicit and background refresh separately; runtime code was unchanged. Published consolidated a51a58b8 and all prior favourites/care/learning improvements are preserved. Backend 3ee6748f remains ACTIVE/readiness200 and unchanged by this task. Master integrations preserved all concurrent source and generated-contract hashes. No shared DB/customer/message writes; actual delivery and private-account/device acceptance remain unverified. Evidence and limitations: backend/docs/notification-preference-availability-production-20261028.md. Full V01-V55 goal remains active; continue the remaining visual, typography and navigation ledger items.

## 28 October 2026 - V53/V55 customer guidance candidate

Garage entry now keeps basic make/model/year entry separate from a native optional Shop-search disclosure. Existing linked vehicles and the dedicated Set up parts search action open the setup directly. Selection labels explain that available search choices update the basic names but do not prove fitment; missing choices can be skipped. Validation reopens the disclosure before focusing its missing field. Turning setup off and back on preserves its specification draft; saving with it off still explicitly removes the link under the existing payload contract.

Privacy guidance now explains request, authorised review and the separate execution boundary, with a real Customer Care follow-up destination. Approved-pending-policy records state that no data change is scheduled. Source authority: PrivacyRouter review/holds checks, retention-and-privacy.md, retention-policy-workspace.md and the disabled retention worker. An execution procedure is not currently implemented or authorised by this batch; no automatic deletion, deadline, new permission or operational policy is invented. Existing learning content already states the same boundary; no guide target or workflow contract changes.

Two isolated live 390px baselines failed at the expected previous interface and retained screenshots. Local TypeScript noEmit, scoped lint and formatting passed. Six new rendered acceptance cases and existing garage/fitment/privacy regressions are prepared; hosted checks, exact master CI and promotion are pending. Current published fitment source 8d2dfd69 has been incorporated. The active public-copy worktree and all unrelated edits remain preserved. Full V01-V55 scope remains active.

## 28 October 2026 vehicle condition and owner-draft cycle

- Preserve current live 55714afd and master garage/privacy guidance; use existing
  stock, listing, managed media, Customer Care, permissions and workforce boundary.
- Add attributed owner condition/issues with correction audit, engine code/cylinders,
  crossover/minivan, actual branch-location discovery, saved-content preview and
  photo-before-publication validation. Unknown owner facts stay unknown.
- Private BMW preparation uses seven actual reviewed views; plate masks are limited
  to identifier pixels. No stock/listing published or production enquiry submitted.
- Isolated persistence, denied access, CAS, publication/media race, search and enquiry
  regression checks pass. Ten distinct mocked rendered cases cover public card/detail,
  home, filters, missing photos, authoring import, preview/correction and Axe.
  Exact-master CI, production rollout and hosted acceptance remain pending.
- Backend handoff and requirement matrix:
  `backend/docs/vehicle-marketplace-implementation-20261028.md`.
- Real-role, physical-device and independent vehicle-condition acceptance remain
  unverified. Public VIN search remains a privacy/business decision.

28 October 2026 - V53/V55 guidance released on master runtime 55714afd, Vercel dpl_6b35E89UpjSP9heFX88nWWB6BFdA verified on apex/www. Garage optional search setup preserves basic entry and drafts; privacy review/execution guidance remains visible on mobile and links to Customer Care. Final combined CI passed 1225 tests (12 optional skipped), lint/types/format/build and zero production audit findings; frontend 40780036790, secret guard 40780036778 and isolated backend safety 40780036897/40780112964 passed. All 41 final hosted cases plus 18 candidate and 18 production public checks passed. Screenshot inspection caught and fixed the old mobile rule hiding privacy steps. Published public-copy source bee7ed8f is preserved; initial promotion correctly stopped for that concurrent release. Backend 3ee6748f remains ACTIVE/readiness200, unchanged by this batch. Other source/contract hashes and both tracker sections were preserved. No shared DB/customer writes. Evidence, initial harness corrections, limits and rollback: backend/docs/garage-privacy-guidance-production-20261028.md. Full V01-V55 remains active; next reconcile published public-page work and continue the service-enquiry/remaining clarity ledger.

Vehicle release follow-up: the inherited staff location query now applies city/state
filtering after assigned-branch scope. A focused persistence regression covers a
matching branch, a non-matching location and foreign-branch staff; no permission or
responsibility was granted. Schema and the populated restore rehearsal are unchanged.

## 29 October 2026 - service enquiry clarity and inline privacy link

V28/V29: one accessible enquiry heading and an uncropped equipment photo. V30's
existing request-only journey is verified and preserved. The shared intake privacy
link now has a non-colour cue; keyboard focus remains visible while hovering.
Service, Contact, registration, catalogue and favourites pass 19 hosted fixtures
on the integrated candidate; 20 public checks pass. Initial fixture failures and
the real Axe finding are retained, corrected and distinguished in the
[visual audit checkpoint](VISUAL_IDENTITY_AUDIT_CHECKPOINT.md).

Source is merged with concurrent Care/vehicle work. Publication still requires its
compatible guarded backend rollout; all three exact-source gates passed on
2586c61b. The held candidate is not
on the public domains. No real account/message/shared-database mutations by this
audit. Business-authored service wording, physical devices, real roles, full
screen-reader coverage and remaining V01-V55 findings remain open.

## Favourites refresh live recheck - 29 October 2026

Rechecked the owner's Engine Oil Filter URL without changing account data. Both
production domains resolve to READY deployment dpl_AzXytZPjJgVb93kjfcb79KsuZtVH,
source 060dba8d; Git ancestry confirms the ef06efb7 persistence repair is included.
The two existing hosted Playwright cases pass at 390/1440: save, reload, later-page
lookup, simulated external removal, failed read and retry. All identity/collection
reads and mutations were intercepted fixtures, with unmatched API requests denied.
Six focused product-favourite unit tests also pass. The mobile saved-after-refresh
screenshot was inspected. Evidence: C:/Users/PC/AppData/Local/Temp/allied-favourite-recheck-20261029/.
Browser plugin was unavailable; existing Playwright/Edge was reused. These checks
verify current rendered frontend behavior, not the owner's private account or a
new real database write. No runtime patch or deployment was necessary. Existing
tracker conflict and unrelated edits were preserved. Postflight free C: 22.2 GiB.

## Contact clarity release - 29 October 2026

V34/V35/V36: sole verified branch uses labelled read-only output; field-specific
subject/message errors preserve first-error focus; concise preparation/next-step
guidance replaces repeated instructions/headings. Request review, drafts, privacy,
approved hours, acknowledgement/resolution distinction and branch routing remain.
The duplicate named region detected by scoped Axe was fixed before release.

Production runtime 35c314c6 / dpl_CXXM8WeyShRAKrZZNRCCEBvrKY2i is verified on both
domains. Final review f2b74819 changes only test files. CI: 1,256 passed, 12 optional
skipped; types/lint/format/build and production audit pass. Backend safety and secret
guard pass. Hosted evidence covers all 68 distinct cases (52 initial passes plus
16 corrected reruns), with 4 focused Contact journeys and 20 public checks passing
after publication. Desktop/mobile screenshots, keyboard/hover, review/Escape/focus
and scoped Axe are recorded; real account/message/device acceptance remains open.
Known preload warnings are verified against their actual assets and declarations,
retained as performance limitations. No blanket console suppression.

Evidence and exact limitations: backend/docs/contact-clarity-production-20261029.md;
%TEMP%/allied-contact-clarity-20261029/. Backend unchanged; reviewed CSO guide version 3
requires its separate backend publication. Existing dirty files/worktrees preserved.
About baseline confirms V31/V32 remain unfinished: 11 expanded principles and small
non-interactive equipment thumbnails. Whole-site audit remains active.

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

30 October 2026 — Customer reversal and reconciliation-worker review handling
implemented in codex/efficient-delivery-20261030. 41 isolated financial integration
cases, 27 backend units and 3 local browser fixture cases passed. Existing successful
captures remain immutable; customer reads expose only a reversal indicator. Evidence
and remaining scope: docs/EFFICIENT_DELIVERY_20261030.md, Customer reversal and worker
checkpoint. No production publication or live financial/provider activity.

30 October 2026 — Concern booking contract and nullable-safe read paths added in
codex/efficient-delivery-20261030. 79-migration isolated replay/db:check and 12 booking
integration cases pass, plus 47 backend/13 frontend units and 2 browser cases. New
migration remains uncommitted/unpublished. Customer intake and staff classification
controls remain pending; continue at the Concern booking contract checkpoint in
docs/EFFICIENT_DELIVERY_20261030.md. No shared database or production change.

### 30 October 2026 — Allie public service citations

Canonical active-service retrieval and exact UUID-bound navigation references now
join the existing reviewed help source pipeline. Twenty frontend conversation units
pass including substituted external/admin/other-service/query-string destinations.
Backend units (71) and native isolated integration (16) pass. This is unit and
server integration evidence; new service-citation rendered phone/desktop acceptance
is still outstanding. Other public source types and full goal remain open. See
docs/help-learn/ALLIE_PUBLIC_KNOWLEDGE_20261030.md at repository root.

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

### Concern entry and saved concern — 30 October 2026

Native 390/1440 request-to-dashboard tests now pass against isolated actual APIs/DB.
Wait for initial account check before accepting concern edits; preserve existing
account-change reset. Dark appointment card now places concern below heading/status
with light text; scoped Axe/readability checks pass at both widths. One fixture test
hit local browser ERR_NO_BUFFER_SPACE loading webpack, then passed alone. See
../../docs/help-learn/CONCERN_BOOKING_20261030.md. No production publication.
Owner's eight-group service structure added to active scope; implementation status
and verified live Tyre Change identity in ../../docs/OWNER_SERVICE_STRUCTURE_20261030.md.

### Owner service group review — 30 October 2026

/admin/service-categories now has a permissioned review/apply control using the shared
mutation dialog. Corrected async opener focus loss; cancel returns focus. Two fixture
browser cases pass at 390/1440 with all eight groups, cancel/no-write, explicit save,
scoped Axe and no horizontal overflow. Screenshots visually inspected. Native API
import/discovery/admin tests pass 30 cases; this is not native browser composition.
No production changes. See ../../docs/OWNER_SERVICE_STRUCTURE_20261030.md.

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
