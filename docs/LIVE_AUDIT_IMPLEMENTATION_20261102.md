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

## 3 November 2026: owner-approved monetary arithmetic

The user explicitly selected "Use the recommended rule" in this chat after
reviewing the concrete proposal: for future orders, round the percentage discount
and VAT once per order to the nearest kobo, resolve exact halves upward, and
allocate partial refunds by largest fractional remainder, breaking ties by the
saved line order. Allocations must reconcile to saved totals. Issued historical
amounts remain unchanged. This resolves the former tie/boundary/allocation question;
do not request that decision again. Implement the same saved snapshot across
review, payment, invoice/receipt, verification and refunds.

This is owner decision evidence, not a fabricated runtime publisher or policy
activation. Live payments and existing controlled finance settings remain unchanged.
Actual invoice identity, VAT exceptions and provider/operational acceptance retain
their separate unresolved requirements.

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

### 3 November 19:44 UTC package: actual workshop resource integration

Target 20:44 UTC. Integrated the committed 90ddaf49/287f5307 resource source,
selected domain tests and unchanged forward allocation migration. Uncommitted
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

### 3 November 17:44 UTC remaining-scope reconciliation

Read-only review confirms another active source candidate in
allied-contact-validation-20261027 already contains pending reschedule records,
staff approval/withdrawal and preserved-original-slot behaviour, plus saved timing
and versioned offer work. It is dirty and under verification; do not duplicate it
or count it as integrated/current-production acceptance. Its tracker identifies
equipment/resource qualifications and in-progress timing as unfinished. Preserve
that work and reconcile its migrations/contracts before integration.

The current master payment creation body still does not identify the offer revision
displayed to the customer. Payment creation/initialisation already lock and validate
the current review and private saved binding, but a changed-offer race between the
customer's last read and intent creation still needs closing. The correction must
not introduce a fresh staff approval or an extra customer confirmation screen.
Original uncertain-request recovery and captured-money accounting must remain safe.

Corrected a remaining guest order-summary sentence which wrongly placed final
suitability/availability checks after payment. This is a copy-only change after
079ca9ee; no new browser/test result is claimed for it. C: recovered to 21.94 GiB
after external activity; no resources were deleted by this task. Heavy builds stay
hosted. Full D01-D17 scope and the existing production release gates remain active.

### 3 November 17:36 UTC package result: vehicle carry-through verified

Frontend source 079ca9eef1a461962fb7ac87dd36fb0ce306fd28 passes workflow
41684225412: production compiler, lint, build and 1,397 unit cases pass;
12 existing cases remain skipped. Chromium runtime passes 21/21, including
the two new selected-vehicle cart journeys at 320/1440. Secrets workflow
41684225285 passes. Backend source 5b7727357fbf7578469c56c91a3a092103351553
passes workflow 41683363872, including migration 92 replay and 81 focused cases
(19 isolated database, 29 review, 13 fitment, 12 retry and 8 safe-view cases).
The later frontend-only commit leaves that backend tree unchanged; these are
separate source checkpoints, not an exact-master production-release assertion.

The initial new database fixture omitted required independent fitment evidence;
the fixture now supplies it and the constraint remains enforced. An old frontend
cart assertion was updated for explicit null vehicle metadata; the new selected-
vehicle/replacement case also passes. No validation or assertion was weakened.

Safe synthetic screenshot artifact 13253308477 (1,959,228 bytes) is preserved by
frontend run 41684225412. Download was stopped by the mandatory disk preflight:
C: had 13.15 GiB free, below the 20 GiB reserve. The new screenshots have not been
visually inspected locally. Earlier 31c292dd screenshots remain historical evidence,
not screenshots of this source. No local build, install, download or cleanup ran
after the failed preflight. Read-only cleanup review found approximately 1.28 GiB
in two frontend compiler caches; Docker reports 4.652 GB reclaimable build cache,
which is not proof of safe deletion. An active database task is retained. Source,
databases, rollback images and other tasks' resources remain untouched.

This completes the bounded cart implementation package. Automatic eligibility is
verified with synthetic browser data and isolated database records only. New
payment creation still needs binding to the offer revision displayed to the buyer.
D02/D03/D05-D17, operational notifications, real-role/provider acceptance and
physical-device checks remain tracked in the full objective. Migration 92 is not
applied to the shared application database; no purchase/booking flag, production
publication, real transaction or owner-only permission changed. The goal remains
active. Substantial local work must wait until the disk reserve is restored.

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

### 3 November owner clarification: automatic verified purchases, review for exceptions

The owner explicitly approved automatic pre-payment checks instead of a fresh
human decision for every order. Existing approved suitability evidence plus
current reservable branch stock allows immediate payment. Missing vehicle/spec
information, uncertain fitment or unconfirmed supplier supply needs staff review.
Repeat purchases must reuse explicitly chosen verified details and recheck current
evidence/stock; do not assume the last vehicle is the current vehicle.

Source now automatically decides eligible account/guest specification submissions
and genuinely universal accessory checkout, using the same fitment, financial
fingerprint and aggregate stock-hold logic. Migration 91 records AUTOMATIC decisions
with no invented human approver; historical decisions remain HUMAN. Migration 90
is unchanged. Provider capture accounting/recovery is preserved. Pending-customer
wording follows the owner's requested next step. Parts Help is version 10.

Unfinished: mobile customer specification/acceptance and staff exception forms,
explicit repeat-purchase reuse controls, checkout vehicle selection, review-ready
notification evidence, rendered payment states and exact-source full acceptance.
The automatic source is not deployed or activated. New replay/database results
are pending. D02/D03/D05-D17 and full audit acceptance remain in scope.

Previous source 4c376fc6 passed frontend 41660535204 and secrets 41660534546;
backend 41660534996 passed all 54 focused review cases but failed guest fixture
versions and direct adapter-abort retry. Source 8a63d830 fixes these and passed
that guest stage, then exposed later fixture expiry/initialization mistakes in 41662553588. Those fixtures now bind actual review expiry without changing guards.
Local retry tests pass 12/12; frontend order-payment cases pass 13/13. Current
automatic source still requires isolated replay/regression and browser results.

# Complete live audit implementation - 2 November 2026

Latest package checkpoint, 3 November 14:28 UTC: source 1a9c6039 passes backend
41653132527, including 90-migration replay/db:check and 52/52 focused review cases.
Owned customer/guest request and Admin/MFA decision endpoints are implemented;
the aggregate-hold regression preserves the existing one-active-reference rule.
Frontend ef3b4ff1 passes 41651475005 with 13/13 runtime browser cases; its frontend
tree is unchanged in 1a9c6039. Safe synthetic mobile/laptop action screenshots in
artifact 13235328482 inspected. These are source/CI fixtures, not actual-role,
provider, physical-device or published purchasing acceptance. Full goal stays active.

Current D01 checkpoint: signed source 8aec5020 passed frontend 41638126292,
backend 41637103255 and secrets 41637103251, unpublished. Later rendered testing
found and repaired full-mode booking links that ignored the independent switch.
The repaired 320px and 768px cases pass locally; 1440px is incomplete because the
preview stopped after detecting insufficient disk reserve. No local full-browser
pass is claimed. Hosted CI now reuses its exact production-check build with a
loopback-only synthetic API for all 13 runtime regressions and safe screenshots;
new-source results are pending. D04 pre-payment review, D03 staged service charges
and remaining D02/D05-D17 requirements remain implementation work.

Additional first-package evidence: the final release-boundary suite passes 71/71
(including fail-closed omitted controls), and separate process/address checks pass
26/26. These runs overlap the initial 103 cases and are not a summed unique total.
Backend/Frontend TypeScript, backend script types, repository backend lint, scoped
frontend lint, formatting and diff checks pass. Review-only production template
adds only eight disabled module controls across four components; existing settings
are preserved and no live configuration changed. Source checkpoint awaits exact
CI and rendered acceptance; full D01-D17 objective remains active.

## Active self-contained brief implementation - D01-D17, 3 November 2026

The 611-line self-contained brief includes newer owner decisions absent from the
previous audit release. The published checkpoint below is retained as historical
evidence, not completion of this expanded objective. Payment AFTER final checks
supersedes pay-first. Source scope approval is definite; controlled publication
and technical/provider/actual-role acceptance remain distinct.

| ID  | Current instruction                                              | Current implementation evidence/status                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D01 | Appointment requests and parts purchases approved independently  | Independent server switches/HTTP guards/capability/parser and shared entry points implemented. Full frontend checks and 13/13 hosted runtime browser cases pass at 320/768/1440, including independent module states and recovery. Unpublished; no activation.                                                                                                                                                                                                                       |
| D02 | VAT-exclusive7.5%after discounts; nearest-kobo                   | Owner explicitly approved order-level HALF_UP percentage discount/VAT and largest-remainder partial-refund allocation, ties by saved line order, in this chat on 3 November. Preserve issued historical amounts; aggregate percentage discounts now use HALF_UP and 13 money checks pass. Saved monetary snapshots, disjoint unit-range arithmetic and scoped financial amounts are implemented locally; native/browser acceptance and D17 durable refund-unit reservations, capture/prior-refund limits and execution remain required. This arithmetic is no longer an unresolved owner decision; no live activation. |
| D03 | Materials first; workmanship after work/before collection        | Current workflows require payment before order confirmation; service staged money/balance handling needs implementation.                                                                                                                                                                                                                                                                                                                                                             |
| D04 | Final suitability and availability before full parts payment     | Automatic account/guest suitability and stock checks, chosen-vehicle carry-through and displayed-offer binding are implemented. Signed 0a61508e passes all three required workflows, 82 purchase and 88 guest checks, 1,457 frontend units (12 existing skips) and 64 browser cases. Rejected-offer screenshots show no stale green approval. Shared rollout, notifications, real-role/provider/physical acceptance and D13/D17 fulfilment remain unaccepted; no activation.         |
| D05 | Normal workshopMon-Sat08:00-18:00                                | Reconcile actual capacity configuration; do not infer Sunday/holidays.                                                                                                                                                                                                                                                                                                                                                                                                               |
| D06 | Three actual specialists; two machines; one alignment specialist | Integrated resource plans, maximum matching and atomic reservations. Source 0a61508e passes 14 lifecycle and 9 policy cases under an isolated non-owner runtime, including competing reservations, cleanup, ongoing work and preserved history. Resource authoring UI/actual configuration and real workshop acceptance remain unfinished; no fabricated Staff or permission grant.                                                                                                  |
| D07 | Editable duration, buffers/resources and booking override        | Saved estimates, reasoned pre-start overrides, versioned slots and resource preservation pass combined isolated checks and responsive browser fixtures on 0a61508e. Ongoing work stays occupied through overruns and recorded cleanup; elapsed estimates never prove completion. Operational overrun authoring/notifications and actual-role acceptance remain unfinished.                                                                                                           |
| D08 | Newworld interim operations                                      | Named decision recorded; actual account/scope mapping unverified; no new grant.                                                                                                                                                                                                                                                                                                                                                                                                      |
| D09 | Reasoned eligible cancellation without approval; release slot    | Eligible unstarted cancellation is implemented without a fresh approval step or inferred fee/refund. Isolated 0a61508e lifecycle checks prove occupancy release with allocation/financial history retained. Real-role/notification acceptance remains unverified.                                                                                                                                                                                                                    |
| D10 | Reasoned available-time reschedule requiring approval            | Reasoned requests/alternatives and atomic authorised approval are implemented and verified in isolated 0a61508e checks and responsive fixtures. Original appointment/reminders/resources remain until approval; conflicts preserve them. Actual staff/customer operational acceptance remains unverified.                                                                                                                                                                            |
| D11 | Late arrivals wait or leave                                      | Actual arrival/wait/alternative/left actions need reconciliation and tests.                                                                                                                                                                                                                                                                                                                                                                                                          |
| D12 | Five business days for ready in-stock collection                 | Calendar counting details unresolved; deadline/overdue/extension support required, no automatic paid-stock release.                                                                                                                                                                                                                                                                                                                                                                  |
| D13 | Per-product sourcing/preparation time                            | Authoring/order estimates/status updates need implementation. No universal one-day promise.                                                                                                                                                                                                                                                                                                                                                                                          |
| D14 | Private unique third-party pickup code                           | Order-specific secret storage/reissue/verification/rate limits/transactional partial handover need implementation.                                                                                                                                                                                                                                                                                                                                                                   |
| D15 | Reminders and calendar actions                                   | Confirmed-future .ics and Google Calendar actions, manual-update guidance and confirmed-only countdown are implemented; 0a61508e passes 64 browser cases including exports across 320/768/1440. Configurable future-only deduplicated reminder scheduling and actual delivery/calendar-app/device acceptance remain unfinished.                                                                                                                                                      |
| D16 | Delegated non-punitive no-show                                   | Configurable attendance review/staff-confirmed missed action/capacity release and notifications required.15minutes is a proposed delegated default.                                                                                                                                                                                                                                                                                                                                  |
| D17 | Delegated supply-exception handling                              | Existing independent aftercare/refund kernel preserved; explicit accepted alternative/affected tax-aware portion and revised pre-payment path need reconciliation. Broader returns/warranty deferred.                                                                                                                                                                                                                                                                                |

Actual remaining inputs are the precise unresolved items in decision-register
section at top of backend/docs/public-launch-policy-decisions.md. Do not ask again
for already approved VAT, service due timing, normal hours, scope or revised parts
sequence. Finish independently testable implementation before operational acceptance.

First package verification:103backend units across4suites,20frontend units across2,
backend TypeScript pass. Local browser run13cases was stopped during compilation
following a failed disk preflight and supplies no completed acceptance. Only owned
preview/browser processes stopped. Preserve source; reserve readings12.8then21.19GiB.
No schema/production/role/policy/data write or payment/email occurred in this batch.

## Final implementation and publication - 3 November 2026, 11:20 UTC

The audit engineering implementation is published. This closes the source and
bounded verification work; it does not approve transaction activation or certify
all roles/devices. Earlier source-only and outstanding-release entries below are
historical checkpoints superseded by this section.

Published application source: fabbe7a600a02e002f1f4ee773dada4b5cf25697, signed and
verified. Exact-master checks pass: frontend 41615440555 (1,360 passed, 12 existing
skips), backend 41615440915 and secrets 41615440637. The concurrent Home composition
and Nippo/Quicksand changes are integrated without replacing the published Admin
vehicle-operations repair or widening owner-only/independent financial controls.

Backend adc7be72-e564-4fc7-b1db-5f1c0f8d4cf2 is ACTIVE, 16/16, with four matching
candidate digests and readiness HTTP 200. Only those four digests changed in the
AppSpec; environment, business/activation flags and read-only PRE_DEPLOY were kept.
Frontend dpl_Fzq4yoEwLMH1puuvqznu9SdRAqAX is verified on both alliedautotech.com and
www.alliedautotech.com after backend readiness. Published mode is browse_enquiries.

| Requirement                     | Final engineering status and evidence boundary                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 public provenance           | Three normal protected-editor description saves completed; public full descriptions and summaries are clean. Prices/package boundaries preserved; internal history retained.                                                                                                                       |
| F02 service images              | Canonical Home/catalogue/detail rendering and stable missing/failed-media geometry implemented; genuine diagnostics/alignment and explicitly illustrative oil imagery.                                                                                                                             |
| F03 capability guidance         | Authoritative runtime capabilities, stale/unavailable recovery and consistent public/dashboard/Help handoffs implemented. Direct URLs retain server gates.                                                                                                                                         |
| F04 genuine product information | Family-specific gaps and next actions visible to operators; genuine product photo, brand/part identity and reviewed compatibility still require the operator. Nothing fabricated.                                                                                                                  |
| F05 search focus                | Shared branded focus and forced-colour/keyboard states pass fixture checks for four roles. Actual signed-in role acceptance remains unavailable.                                                                                                                                                   |
| F06 filters                     | Progressive fields, concise help and explicit applied/pending/URL/clear semantics implemented; existing filters preserved.                                                                                                                                                                         |
| F07 public wording              | Workbook/development jargon removed; private provenance retained. Commercial conditions remain explicit.                                                                                                                                                                                           |
| F08 vehicle detail              | Consolidated specifications; owner-reported AC fault, exact price and inspection distinction preserved.                                                                                                                                                                                            |
| F09 Contact                     | One useful location/directions area and shared business data; contextual enquiries preserved.                                                                                                                                                                                                      |
| F10 dashboard authoring         | Explicit View/Edit actions, responsive task sections and existing permissions; Admin/Super Admin/assigned Staff fixture paths pass. Actual-role acceptance pending.                                                                                                                                |
| Public search                   | Anonymous published services/products/vehicles/Help, grouped results, ranking, native GET, retry and URL/Back recovery; final live diagnostics search succeeds.                                                                                                                                    |
| Notifications                   | Optional user-initiated invitation reuses settings/subscriptions. Fixture permission/session/device/click cases do not establish actual push/email delivery.                                                                                                                                       |
| Appointments                    | Owned Nigeria-time calendar/details and confirmed-only countdown, resume/reschedule/error handling implemented; no capacity/date invented. New booking activation remains closed.                                                                                                                  |
| Home/media                      | Separate responsive photo/copy areas, complete seven-person team photo and shared card geometry. Three real-time autoplay loops and all existing controls preserved. Later approved laptop hover-continues requirement supersedes the older hover-pause suggestion; explicit/focus pause persists. |
| Approved purchasing             | Shared account/guest ownership, private recovery/cart/checkout/payment, seven-day quotes, invoices/receipts and cancellation/aftercare/operator refund-review handoff implemented. No fake account, automatic guest refund authority or provider activation.                                       |

Verification results are distinct runs, not a unique whole-site test total:

- Integrated held build: 122/122 browser cases, no skipped/flaky cases; separate
  authoring/public-search run 30/30, no skipped/flaky cases. Installed Edge,
  Playwright, held production build. Protected roles and transaction records are
  synthetic fixtures. Public Home reads use approved actual imagery.
- Covers sampled 320/360/390/430/768/1024/1280/1366/1440 layouts, sidebar states,
  keyboard/touch, focus, loading/error/denied/disabled/recovery, reduced motion,
  doubled-text reflow, image stalls/failures, visibility/offscreen suspension,
  no-JavaScript first slide and three full real-time autoplay loops. This is not
  physical-phone, Safari or complete screen-reader acceptance.
- Final published smoke: 16/16 anonymous HTTP checks across apex/www, including
  exact deployment, capabilities, public Help, private-guide denial, anonymous
  booking denial, readiness and preserved service commercial values. Eight actual
  public browser views pass at 390/1366 with no overflow or API writes. Final Home,
  diagnostics and search screenshots inspected. Earlier full batches remain below.
- Native isolated aftercare: 71/71 across nine suites; focused later learning checks
  14/14. Current backend CI includes 87 guest tests across eight suites. Tests use
  fresh isolated targets; no real customer/stock/payment submission for QA.
- Candidate and schema-compatible recovery images each pass all nine actual
  packaged runtime tests plus byte verification of all 89 SQL migrations. Both
  four-image manifests are retained; old schema-87 images are not the schema-89
  recovery plan. Recovery source 80cba6c2 has byte-identical backend runtime,
  migration, safety and dependency inputs to the published integration.
- Fresh verified backup and separate populated 87 -> 89 restore/replay pass;
  original business/audit/financial column hashes/counts and ownership remain.
  Production guarded forward migration passes; all 89 hashes/history and original
  rolled-back history are preserved. Critical counts do not decrease against the
  fresh verified pre-migration backup. Runtime has required new-table DML, no
  database/table ownership, DDL, TRUNCATE, superuser or role-creation powers.
- Production read-only db:check passes as migrator. The actual application
  verifyDatabaseSchema passes as runtime without reading business rows. Eight
  worker heartbeats are fresh/error-free; the new guest-refund operational scan
  exists and advances (observed version 4). No worker was manually invoked on real
  records. Temporary trusted-source access is removed with concurrent rules kept.
- Managed daily backups/PITR availability, retention and provider encryption
  documentation were checked; eight actual managed backups were present. This
  run rehearsed a populated logical restore, not a managed-PITR disaster restore.

Retained failures and verification corrections: the first runtime post-migration
check wrongly used the migration-history checker with the restricted runtime role
and was denied SELECT on _prisma_migrations. The rollout stopped, temporary access
was removed, and the actual state was reconciled read-only. No migration retry or
history grant was used. Final history/schema check uses migrator and the actual
application probe uses runtime. A temporary health helper had a JavaScript quote
syntax error before executing; corrected before its successful run. The final
public harness initially used body rather than the server HTML deployment marker,
an obsolete service snapshot and the wrong search parameter q; corrected to the
actual html response, fresh backup baseline and form parameter search. Its first
fresh-baseline parser omitted shortDescription; corrected from the same verified
archive. Assertions on price/scope/duration/version remain strict against the
fresh pre-release backup. These were verification failures, not successful runs.

The oil-service duration is now 30 minutes/version 2 in both the 10:58 UTC backup
and final live response (record updated 05:27 UTC), predating this rollout. Earlier
editorial evidence had unknown duration. Preserve the later record; its separate
approval/author was not verified and should be checked before booking activation.
All final service names, short descriptions, prices, currencies, pricing types,
durations, versions, categories and active states match that immediate backup.

| Capability                                                           | Launch-readiness status                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Browsing, service/vehicle enquiries, public search and reviewed Help | Published; final public checks pass within recorded coverage.                                                                       |
| Admin/Super Admin/assigned Staff operations                          | Published with existing boundaries; fixture coverage passes; fresh actual-role sign-off outstanding.                                |
| Customer calendar/details and confirmed countdown                    | Published; synthetic lifecycle/responsiveness passes; real populated appointment acceptance outstanding. New requests remain gated. |
| Optional browser invitation/settings                                 | Published; fixture lifecycle passes; real device subscription and end delivery unverified.                                          |
| Account/guest purchasing, quotation, documents and aftercare         | Published implementation behind existing gates; isolated/fixture acceptance passes. Not approved for taking online payments.        |
| Payment/booking activation                                           | Closed pending policy, operational/provider acceptance and explicit approved launch scope.                                          |
| Live AI, delivery and booking deposits                               | Deferred/off; no new AI evaluation budget or activation authority.                                                                  |

Owner/operator work still required: verified Tax ID/CAC and accountant-approved VAT
applicability/rounding boundaries; service invoice payment timing; real workshop
hours, durations/resources/capacity and named responsible operators; genuine product
identity/photos/compatibility evidence; controlled merchant test-mode success,
cancellation, duplicate/delayed/wrong-amount/currency/webhook/reconciliation and
refund acceptance; authorised actual-role and delivery/device acceptance; final
capability-specific launch sign-off. Reconcile saved policies before asking again.
Collection-only, full payment then final compatibility/availability, separate
paid/allocated/ready states, seven-day quote validity and independent financial
approval are settled instructions and are preserved, not reopened as new questions.

Safe evidence (public anonymous reads; private screenshots use synthetic fixtures):

- [Home before final composition, 390px](C:/Users/PC/AppData/Local/Temp/allied-home-baseline-live-390.png)
- [Published Home after, 390px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/final-published-home-390.png)
- [Published Home after, 1366px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/final-published-home-1366.png)
- [Published search, 390px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/final-published-search-390.png)
- [Synthetic guest aftercare, 320px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/integrated-held/purchase-guest-aftercare-g-5dc3b--and-saved-history-at-320px/synthetic-guest-aftercare-320.png)

JSON evidence: integrated-held.json, integrated-authoring.json,
guest-final-public-release.json and guest-final-published-browser.json in the
existing temporary evidence directory. Protected release receipts remain in the
ignored backend/ops/digitalocean/.private directory; do not publish credentials,
AppSpec contents, backups, populated clones or private customer rows. All task-owned
held-review tokens are revoked, and their task-created credential files removed.

Cleanup review: C: measured 22.36 GiB before this final review and 22.31 GiB after
browser checks. No existing installer/cache/source/database/image was deleted.
Git/Node/Chrome installers total about 104 MiB; adding unverified-needed Radmin and
Python installers brings candidates to 176 MiB. Preserve workshop media archives.
Docker reports 141 images/10.84 GB, 392 cache records/12.46 GB and 15 volumes/3.049 GB;
reclaimable does not mean disposable. Candidate/recovery/current/rollback images,
warm caches, shared PostgreSQL server, populated rehearsal, other-task containers,
volumes and active worktrees are retained. Earlier automatic review rejected
selected temporary database-directory deletions with blocked by policy; those
exact targets remain untouched, with no alternate deletion attempt. The minimum
20 GiB remains a preflight rule, not an OS-wide guarantee.

### 3 November 2026: Aftercare source gates and populated recovery rehearsal pass

Signed source 80cba6c2 passes exact-master frontend 41599139743 (1,360 passed,
12 existing skips), backend 41599139699 and secrets 41599139710. Backend CI includes
87 guest purchase tests across eight suites, including ten cancellation/aftercare
cases. Current production remains frontend 333c3a22 and backend c65d74ac / schema 87;
all transaction and appointment activation gates remain unchanged.

Held production-environment candidate dpl_mwjYYx8gDGjP821a59ABjSuGwpz9 passes
87/87 affected browser cases in one final run (5.8 minutes; no skips/flaky cases).
This covers guest and account aftercare, Admin/Super Admin/operational Staff fixture
boundaries, work order changes/recovery and overview states across sampled phone,
tablet and laptop widths. The earlier held run passed 85/87: two generic alert
selectors matched both permission and overview notices. The corrected test scopes
the overview alert while preserving the assertion that unverified metrics stay
hidden; its focused four-case run and final complete 87-case run pass. The initial
87-case JSON was overwritten by that focused run; retained console and failure
artifacts record the initial result. Final JSON is aftercare-held-final.json.
Synthetic 320/1366 aftercare screenshots from that run were inspected. These are
hosted fixtures, not actual-account, provider or physical-device acceptance.

A fresh strict-TLS production backup was verified using its separate backup role;
source migration history/checksums matched, and temporary firewall access was
removed while preserving concurrent rules. Populated rehearsal in a newly created
isolated _ci database passes the guarded 87 -> 89 migration, schema/history checks,
all original business/audit/financial column fingerprints and row counts, existing
account ownership, empty guest tables, new constraints/triggers and a separate
non-owner/no-DDL/no-TRUNCATE runtime role. Receipt:
guest-production-rehearsal-80cba6c2.json in the protected release directory. The first
assertion counted raw migration-history rows as successful migrations and stopped
before migration: production has 87 successes plus one retained rolled-back record.
The same task-created restore was resumed, without restoring over it or altering
history; final history has 89 successes. Production received no data/schema writes.
The populated clone and its controlled local test server remain preserved.

The prepared CI receipt initially serialized a PowerShell array wrapper; the guard
rejected it before any provider/database mutation. The independently captured v2
receipt requires all three actual successful master runs and is used by the rehearsal.
A temporary deployment-review token appeared in tool output; it was immediately
revoked. Its replacement was kept private, used only for this held deployment, and
revoked after testing; the two task-created credential files were removed. Application
authentication and Deployment Protection were not disabled or broadened.

Next: commit the scoped assertion/evidence checkpoint, check that source, prepare
compatible backend/recovery images and packaged checks, apply only the reviewed
forward migrations with a fresh verified backup, verify backend readiness/privileges/
workers and both public aliases, then reconcile the complete requirement ledger.
The held application and rehearsed database inputs must be compared with the final
source before evidence is reused. Real-role/provider/device and owner financial,
workshop-capacity and activation decisions remain separate; no whole-site readiness.

### 3 November 2026: Guest aftercare and operator refund handoff (source)

Guests can inspect their own cancellation/return requests, review exact quantities
and reasons, cancel a pending unconfirmed order and recover an uncertain action
without inventing a customer account. Strict current guest ownership, trusted
Origin/CSRF, current order versions and original keyed receipts remain authoritative.
Uncertain browser state retains only a buyer/order-bound inert action key; private
reasons stay out of browser storage. A lost receipt is not evidence of failure.
Confirmed orders require a staff cancellation review. Reviewed requests and verified
payment, refunds, allocation and collection readiness remain separate states.

Cancelled paid guest orders enter a visible existing Administrator alert -> order
-> payment workspace handoff. Operational Staff receive no new financial actions.
Only a real permitted operator can request a HUMAN refund, and a different authorised
operator must approve it. Cancellation before confirmation requires the full remaining
verified capture; no guest/fake account acts as requester. A failed/cancelled refund
request reopens review. A late capture verified after cancellation enters the same
review even when Order.paidAt stays null; its history says Check payment outcome.
Existing technical late-payment refund policy is preserved. No provider refund was
called, no real record was changed and no launch flag or grant was enabled.

Latest isolated native evidence guest-aftercare-native-4fa944118e0249f987a8787cc1ad6b39
passes 71/71 across nine suites, including ten guest cases, existing payment/aftercare,
privacy, refund controls, operational scans and learning/quotation units. All 89
migrations replay; no drift, db:check and non-owner/no-DDL/no-TRUNCATE checks pass.
Its guarded harness removed successful task-created data. Initial native fixtures
used the wrong Audit model/actor field and expected 400 instead of strict 422;
those test corrections retained application guards. Later guidance versions advance
parts-fitment to v8 and financial-aftercare from v3 to v4; 14/14 focused learning/
quotation units pass after that metadata correction. Eligibility and flags stay fixed.

Final guest/operator browser run passes 12/12 (4.4 minutes) on installed Edge against
the isolated 127.0.0.1:3103 preview. This is regular Playwright because the Browser
plugin is unavailable. The earlier 11/12 run counted required CSRF bootstrap as a
financial write; the corrected assertion still rejects other writes. Coverage includes
320/768/1366 layouts, reviewed item quantities, Escape/focus, uncertain response/reload,
original receipt without another POST, paid cancellation, confirmed review, limited
capabilities, failed history/draft recovery, buyer switch and operator destinations.
Sampled Axe reports zero violations; 320/1366 synthetic screenshots were inspected
for wrapping and clipped controls. Retained files are under guest-aftercare-browser-
accepted/ and its JSON receipt in the existing task evidence directory. A separate
79-case shared regression run was stopped during another disk-reserve incident:
41 cases logged passes, one failed, and the remaining 37 have no completion evidence.
The failure expected the cancellation reason label, which earlier quotation work
had replaced with a long combined label. The clear cancellation label is restored;
quotation confirmation has its own helper and action-specific validation, with
unchanged server rules. That repair and the remaining shared regressions need a
fresh run. The final operator fixture also covers a verified payment reference
while cancelled Order.paidAt is null; its final rerun is still required.

Source checks: frontend TypeScript and scoped lint pass; backend production types
and repository lint pass; OpenAPI validates 435 paths / 511 mounted operations plus
four infrastructure routes. The overview unit regression initially passed 33/34:
the added UUID field rejected unrelated private resource metadata. The parser now
keeps a validated resource ID only for a guest refund order alert and strips other
resources; all 35 affected frontend units pass, including the added boundary case.
The accidental full frontend lint attempt was stopped during a second disk incident;
it is not a pass. Remaining checks, exact-source CI, fresh populated restore, compatible
images and publication remain outstanding. Current runtime stays 333c3a22/schema 87.
Local reused Next 16.3.8 is fixture evidence, not exact-lock 16.4.3 release acceptance.
Console Ninja log transport warnings are local extension noise, not provider or site
delivery evidence. Actual-role, provider test-mode, native sharing, physical-device
and full screen-reader acceptance remain unperformed; the overall site is not certified.

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

Evidence: %TEMP%/aat-full-audit-20261102/guest-documents-browser-accepted.json
(final 9/9), guest-documents-browser.json (36 account checks passed; initial guest
buyer-change check failed), and the native receipt named above. Final viewport
screenshots are synthetic-guest-invoice-320.png and matching 768/1366 captures
under guest-documents-browser-accepted/. Native initial run passed 50/54: three
new fixtures incorrectly expected access to pre-payment DRAFT invoices, and an
existing exact ownership assertion omitted the now-explicit guestId:null condition.
Corrected fixtures/assertion preserved draft exclusion. The first added revocation
browser check found stale visible content after an access-check rejection; immediate
invalidation fixed it. A defensive billing-reference comparison also closes a
wrong-buyer response before rendering. Retained failures are not acceptance.
The final native runtime was unchanged by subsequent unused-import cleanup and
strict environment-index syntax; subsequent guidance changes have their separate
13-case unit evidence. Exact committed-source CI is still required.

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

Evidence: %TEMP%/aat-full-audit-20261102/guest-quote-browser-final.json (9/9),
quotation-browser.json (7/7), and the native receipt named above. Final viewport
captures are synthetic-guest-quotation-320.png and its 1366px equivalent under
guest-quote-browser-final/. They do not demonstrate production accounts/providers.
Retained failed attempts: one new assertion expected an ACTIVE reservation although
existing final confirmation consumes it immediately; corrected to CONSUMED with
quantity/reserved-stock checks. A newly added expiry test was initially nested and
was relocated. The account browser fixture omitted public capabilities; its explicit
route was registered after the generic handler without weakening fail-closed logic.
One viewport recapture overlapped a 4,790ms Fast Refresh rebuild; stable rerun and
final nine-case frozen-source run passed. No failed attempt is counted as acceptance.

### 3 November 2026: Account-optional cart and payment screens verified (source only)

HTTP source 79e0d46d passes frontend 41574039845, backend 41574040046 and
secrets 41574039839. Published runtime remains 333c3a22 / 87 migrations;
commerce, booking deposits, delivery and vehicle reservations remain closed.

Guest email links and payment returns keep the requesting approved frontend origin,
with unapproved origins rejected before attempts/provider calls. This preserves
host-only cookies across the supported alias choice; actual provider acceptance
on each production alias remains unperformed.

Public cart, browser-bound email verification, guest history, exact order/payment
review, callback checking, same-attempt recovery and expiry controls are implemented.
Account carts/favourites remain separate. Browser storage holds product IDs/quantities
and buyer-scoped non-authorizing retry metadata; contact fields and CSRF/proof/session
credentials are not stored there. Failed/uncertain requests recover the original order.
A return URL never proves payment, and paid never means allocated or ready.

Native guest-ui-native-ed8d3f410c2e47d48cae41c33ac8c00b passes 52/52 across five
suites with 89-migration replay, no drift/db:check and non-owner runtime privileges.
Fifteen rendered cases plus three expiry/touch/route-handoff cases pass (18 distinct local cases),
covering 320/390/430/768/1024/1366px, keyboard, buyer changes, failed loads, uncertain
receipts and safe provider links. Sampled 320/1366 Axe reports have zero violations.
The initial 9/12 run found a wrong skip target and draft loss on availability refresh;
both were fixed before the full repeat passed. Three cart units and 35 unchanged
payment/learning regressions pass. TypeScript, repository backend lint, focused
frontend ESLint/format and secret guard pass. Screenshots are synthetic, not real
accounts/providers; physical devices and live-role acceptance remain unperformed.

Next: guest quotation issuance/acceptance, invoice/receipt delivery, cancellation/
aftercare and operator refund-review completion, with matching guidance. New populated
restore, compatible recovery images, exact-source CI and publication remain mandatory.
No complete operational purchasing or whole-site readiness is claimed.
Screen evidence is under %TEMP%/aat-full-audit-20261102/: guest-browser-context.json
(15 cases), guest-browser-expiry.json (3 cases), and guest-browser-reviewed.json
(the repeated 320/1366 subset after final presentation changes). The reviewed folder
contains synthetic-purchase-320.png and synthetic-purchase-1366.png. These use only
synthetic names, email, products, totals and provider ports. The development badge is
not production UI. Earlier screenshots with the wrong skip target/scroll offset are
retained as failed-attempt evidence, not final acceptance screenshots. Native final
receipt: guest-ui-native-ed8d3f410c2e47d48cae41c33ac8c00b/receipt.json; its task data
was removed after success. Actual before/after public screenshots remain in the
previous published-release section and are separate from these guest fixtures.

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

The complete owner audit was read and reconciled with deployed runtime 9be4e66b.
The current requirement ledger is frontend/docs/UI_UX_QUALITY_REGISTER.md; this
report records a bounded implementation package, not a second backlog or a claim
that the whole site is ready. Package start: 17:31 UTC; 60-minute review: 18:31 UTC.

## Shared guest checkout core - verified source checkpoint, 3 November

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

The native first attempt daae9c2a87dd4ce7971b0a14833047e8 (51/52) is
stopped and retained; successful 3bbaaf1cf6ae474b877cce3763cd7449 (52/52)
removed its own synthetic data. Both receipts include target/source hashes. Domain
checks combine real isolated account HTTP and direct guest service calls; guest HTTP
routes have not been mounted. Email proof uses controlled synthetic recipients and
encrypted outbox payloads, never external delivery. Core order tests create no payment
or financial approval. The existing quoted-payment regression uses injected fake
provider observations. Before/after physical devices, actual customers and production
business rows were not used. No public authoring or credential bypass is introduced.

## Seven-day quotation enforcement - source checkpoint, 3 November

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

Native first run a9c83677bccf4f7e8e89e82b8b12c4c2 passes 34/34. Final
255199c1a51b4cf8beed5f245a89e29d passes 37/37 after adding explicit obsolete-form
rejection and unchanged legacy-receipt recovery. That target was newly created,
actual identity checked, replayed and used only with synthetic fixtures/fake provider;
its own data was stopped/removed. The final canonical source includes a review-date
metadata correction checked by focused units. A targeted test typecheck exposed an
older UUID-literal inference in the fake buyer fixture; the fixture now uses the
actual AuthenticatedActor interface. An initial metadata API check omitted test
configuration; the explicitly configured loopback/nonconnecting metadata check passes.
No shared application database or actual messaging/payment provider was contacted.

Quotation browser receipt: %TEMP%/aat-full-audit-20261102/quotation-browser.json,
7/7, zero skips/flaky/failures. Screens are isolated role fixtures, including
staff-parts-quotation-360/768/1366.png. They are not real account screenshots;
the earlier guide-after-public images remain the safe genuine public comparison.
The fixture API accepts no unmocked writes and has no database/provider; Next dev
uses verified existing dependencies. Native/unit, rendered fixtures and future
provider/device/live-role acceptance are distinct evidence classes.

Existing issued offers are never silently extended or rewritten. An operator should
review any earlier custom-date offers through normal authoring before operational
acceptance; no protected authoring bypass or repeated sign-in request is introduced.
New quote validity is not a credit period or a decision about workshop invoice timing.

## Guest purchase ownership extension - verified source checkpoint

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

Retained native attempts under %TEMP%/aat-full-audit-20261102:
owner 6904ec303be1422c9622b079293e93d5 (24/26; original account-only guard),
f07c3773cd4643f5abadb4aec3b9f759 (21/26; new variable-binding defect),
f53c85be805c410a860fa33c548e0cff (27/27), 7a78cdc50ca2426d80b371f2765c5ce5
(26/27; nested test), 462c20fcb84a44459b5ffa8f38fd539a (28/28), and final
6b6d27f640984af7a7629bf0305ad4b5 (28/28 with transactional LF SQL/review gate).
Successful task clusters removed their own data; failed clusters are stopped and
retained for investigation. No retry was made against any of the three policy-blocked
cleanup targets. The final receipt records source hashes and actual isolated target.
A first guessed unit-test invocation matched no files; the actual discovered five
suites pass all 57. No failing financial or ownership assertion was removed.

## Guest purchase ownership preservation and rollout plan (source)

Migration 20261102224000_purchase_guest_order_ownership has exact LF SHA-256
3c0a545d0a2ab0f6cda2e2f09da368d755dd72f4cede4369b07d4c32aeeddd15. Its reviewed exception is name/hash bound; changed or renamed SQL remains
blocked and ordinary target/history/fresh-backup/restore gates are unchanged.
The DDL runs in one transaction with a ten-second lock timeout. It adds nullable
guest ownership and indexes, expands customerId nullability on Order/Invoice/
OrderAftercareRequest, and requires exactly one real buyer. No existing row,
price, amount, permission, policy, applied migration or grant is rewritten.
Existing foreign keys remain; guest references restrict deletion. Guest invoices
are parts-order only. The invoice source guard retains all existing currency,
tax, credit, total and pending-deposit-refund checks and adds exact guest identity.
Guest order/invoice/aftercare ownership and quote recipient snapshots are immutable;
aftercare ownership must match its original order. No account quotation is backfilled
to a guest recipient, and that internal recipient is excluded from client projection.

Before production: take/verify a fresh exact-target backup; restore populated data
into a new isolated _ci database and compare original table/column values, row
counts and hashes before/after the two forward migrations. Existing new owner
columns must be NULL; new guest tables must be empty. Replay all 89 migrations
on a separate empty isolated database; run db:check and affected account/guest,
finance/capture/refund/quotation/aftercare tests. Verify strict TLS, separate
runtime/migrator/backup identities, off-device backup/PITR/restore evidence and
least privilege. Do not reuse the earlier unchanged-schema restore as proof.
Prepare exact-CI-checked schema-compatible recovery images before rollout; older
87-migration images fail history checks once 88/89 are applied. Never roll back
schema or delete guest/business data. Rehearse recovery without creating an account
for a guest. Commerce remains closed, so these migrations do not enable purchases.
The complete guest API/UI/recovery journey must be verified before exposing it.

Cancellation keeps existing financial authority. Guest proof cannot satisfy the
HUMAN refund requester constraint or authorise a refund. Verified paid guest
cancellations require an authorised real operator request and separate approval;
the worker records a review alert instead of fabricating a User or system approval.
Alert destination/resolution and the guest cancellation UI still need integration.

A confirmed adjacent gap is retained for the next checkout package: PartsQuote.issue
currently accepts custom one-to-thirty-day expiry although the recorded approved
quotation policy is seven days with no shorter override. Enforce the server policy
and update authoring/contracts/Help; this is implementation work, not a new owner
policy question. Do not describe parts-quote seven-day enforcement as complete yet.

## Account-optional purchasing foundation - source checkpoint

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

Native receipts: guest-access-native-694480e213f44ce6bd923afe7b9816f8 (14/15;
failed fixture, stopped), guest-access-native-346867537c5448f0a62885a7fd062fec
(15/15), guest-access-native-3fb31f6291fa43ef894594491eabae8e (16/16 after
cleanup coverage). Successful runs removed only their own synthetic data; source
hashes and replay/check logs are retained. A later ad hoc test typecheck initially
omitted the existing Express augmentation and exposed a JSON-envelope cast; the
invocation and test-only cast were corrected. This is separate from the passing
production TypeScript check. No test authentication assertion was removed.

Automatic approval review additionally rejected cleanup of the stopped synthetic
folder guest-access-native-694480e213f44ce6bd923afe7b9816f8/data, reporting only
"blocked by policy". It is retained alongside the two previously blocked native
folders; no alternate deletion method was tried. No application data was a cleanup
target. Existing task/provider evidence, source, backups and other tasks remain.

## Published runtime capability and Help repair - 21:58 UTC

Runtime capability and Help repair published

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

The 0c200511 guide regression and recovery below remain part of the evidence.
The final source enforces the 12-step contract on server responses, reviewed content,
actual isolated HTTP and the real client schema. No assertion was weakened to hide
that regression. A transient provider error during the first post-health attempt
restored the firewall in finally; a separate final read-only check passed at
21:56:18 UTC. Vercel CLI acknowledgement and registry login retries used the same
authorised principal; provider state/digests were verified before continuing.

Evidence under %TEMP%/aat-full-audit-20261102: guide-main-hosted.json (49),
guide-hero-services.json (29), guide-preserve-hosted.json (21), guide-held-learning.json
(2 actual), guide-public-release.json (16 HTTP), guide-published-browser.json (20/22),
guide-published-vehicle-retry.json (2/2), guide-public-learning.json (2 actual).
Native guide-native-9b02cd83149141f394060031df6c3e32/receipt.json records 46/46,
87 migrations, isolated target identity and non-owner runtime privileges. The six
suites include booking/response/fitment and current capability/learning/calendar.
Frontend development-inclusive dependency findings remain 21 moderate / one high;
production dependency audit is zero. Existing 12 skipped tests are not passed tests.

Eight anonymous public screenshots and their deployment identities are recorded in
guide-public-comparison.json at 320 and 1440 pixels. Compare before-settled-<route>-<width>.png
with guide-after-public-<route>-<width>.png for contact, services, vehicle and search.
These contain public content only, no customer/account data or fabricated business
records. Public guide screenshots are guide-public-learning-{320,1440}.png.
Full-page captures can include transient lazy thumbnail placeholders; they are not
proof that every thumbnail request completed. Physical devices/Safari and actual
provider/account delivery remain untested. Current buying and booking gates stay closed.

Completion retention review: Docker remains on desktop-linux, with 137 unique
images, 14 containers (one existing running builder), 15 volumes (10 active) and
12.26 GB build cache. Eight new images are the failed-source investigation and
current four-image release sets; current/previous recovery targets, useful warm
cache and other tasks' resources are retained. No Docker objects were pruned.
Eight known task-created provider-cookie/handshake/state and diagnostic-log files
were removed non-recursively after checks; original protected settings and release
evidence remain. C: measured 24.21 GiB free at completion (20 GiB reserve). The two
previous policy-blocked synthetic database folders remain untouched.

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
