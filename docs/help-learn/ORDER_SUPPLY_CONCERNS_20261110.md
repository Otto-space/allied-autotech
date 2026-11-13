### 13 November: remaining-goods learning checkpoint (source)

Customer parts-collection v4, administrator order-sourcing v7 and restricted
refund-work v8 now explain current resolved refund coverage, exact remaining goods,
private partial collection and preservation of original money/physical history.
Audience checks, guide targets and publication flags remain unchanged. See
[remaining-goods checkpoint](RESOLVED_SUPPLY_FULFILMENT_20261113.md) for evidence,
acceptance boundaries and the distinct unfinished financial-closure paths.

### 13 November: integrated supply resolution review verified; D17 remains active

Runtime source 3746fe79290c22f8c11e6788cc07a2e2cdd3f106 preserves master 6e910f9b,
including Parts, People, reminders, mobile scrollbar and saved-item focus fixes.
Final held deployment dpl_8CevpHYqk1LwqQN52dTMWWXEuNER is READY; no custom public
alias was promoted. Both apex/www still resolve to dpl_EdMgppUipQ81msnEmHCef4jZxx6m
(the www alias redirects to apex). Desktop owner's hero edit remains untouched.

Backend runtime is unchanged from integrated 173cce6d: all 134 native cases/11 files,
120-migration empty replay/schema diff/db:check and restricted-runtime checks pass.
Its owned tmpfs database was removed. Correcting the synthetic anomaly resolver
identity fixed the earlier fixture failure; the other case passes with unchanged
30-second limits. All 17 frontend units, 35 backend/learning units, source and focused
test types, scoped lint/formatting, OpenAPI 471 paths/mounted 554 operations plus 4
infrastructure routes and secret guard 4019 files pass. Canonical types regenerated.

Rendered source 173cce6d passed 10/10 Chromium fixture cases: account/guest 320/1440,
admin concern 320/1440, refund 390 and resolution 320/768/1440. Visual review removed
the redundant old refund-request prompt for an already reconciled case. Final
source 3746fe79 then passed 3/3 affected resolution journeys at 320/768/1440 with the
new absence assertion, saved refresh, exact amounts/quantities, scoped Axe and no
page overflow. Screenshots were visually inspected. The initial new-browser run
failed because PowerShell input encoded the naira test literal as a question mark;
the test now uses its exact Unicode escape, preserving the currency assertion.
Browser plugin unavailable; existing Playwright was used. These are intercepted
synthetic APIs and emulated sizes, not actual role/provider/bank/device acceptance.

Receipts under TEMP/aat-d03-service-payments-20261109/:
- native-supply-resolution-final.log (134/134;120 migrations; owned cleanup)
- resolution-held-browser-final.log (10/10 on173cce6d)
- resolution-final-held-browser.log (3/3 on3746fe79)
- resolution-final-held-results/.../supply-resolution-320.png and1440.png
Temporary held-access cookie files were removed after the runs. No real money,
application database, role/grant, policy activation or public-domain change.

Remaining implementation: connect current verified resolution to net original
financial coverage and exact remaining pickup/fulfilment/closure; handle actual
zero-capture/cancelled and technical-reversal reconciliation distinctly. Generic
cancelLocked restocks CONSUMED reservations for confirmed cancellations, so it
must not be reused blindly for refunded supply goods. Future SQL must preserve
legacy physical rows while admitting only proved unfulfilled refunded gaps.
A cancelled replacement must not erase its historical accepted original refund;
unknown/late money and technical cases remain review. No fee, fake handover,
automatic stock return, forced credit or general returns/warranty is approved.

The D01-D17 status snapshot is in owner-decision-checklist.md. Before publication,
finish that independent D17 work and obtain actual invoice/operating/account facts,
provider/role acceptance, exact-master GitHub checks and guarded backup/restore/
migration/release evidence. Booking readiness is separate from purchasing readiness.
The full goal stays active; this verified resolution batch is not launch completion.

### 13 November: actual supply settlement and disposition review (source)

Order-sourcing v6 remains administrator-only; refund-work v7 retains explicit
refund-duty eligibility. The new order resolution action independently requires
current administrator MFA and CSRF. Learning never grants that authority.
Review requires the exact original affected refund, successful independent checking
or verified provider evidence and its canonical debit. The immutable event derives
unfulfilled/previously handed-over ranges from actual history. Unused pickup codes
are revoked; active pickup review must be reconciled first. It returns no stock,
does not invent physical collection and does not itself clear payment/collection.
Current financial and physical proof must be rechecked before later clearance.
Actual wrong/used/installed technical assessments remain distinct; no general
returns/warranty terms, fees, credit or policy publication are introduced.
UI, types, native and rendered verification for this batch are tracked in the
site completion tracker; publication flags remain unchanged.

Final frontend-scoped formatting and fixture lint pass. A root-scoped formatting
check unnecessarily included the intentionally ignored generated API types; the
correct frontend ignore policy was retained and generated output was not reformatted.

### 10 November: alternative acceptance verified in the integrated held build

Current runtime source04f23adf preserves masterb1222a11 confirmation/recovery focus
repairs, earlier service-card sizing and vehicle fields. Backend117-migration empty
replay, empty schema diff, db:check and restricted runtime pass. All112 native cases
across9 files pass: actual account/guest alternative acceptance and explicit-version
rejection, current-session SQL proof, exact original refund caps, late-capture
retention, cancellation/revised offers, ordinary guest quotes, pickup and vehicle
regressions. Owned tmpfs target was removed; only shared BuildKit remains.
Receipt: TEMP/aat-d03-service-payments-20261109/native-supply-alternative-integrated.log.

Held deployment dpl_7yKx1ZUtfZnq4ctZ6v3JFrnTefP7 passes25/25 Chromium fixture cases
across320/360/768/1280/1366/1440: original supply controls, actual alternative reviews,
administrator quotation authoring, guest ordinary/alternative decisions, interrupted
acceptance recovery, access removal, expiry, read errors and capability transitions.
Screenshots were visually inspected; scoped Axe/overflow checks pass where tested.
The first held run exposed a fixture assumption about enabled initial capabilities;
it was stopped after confirming that the real restricted server state was preserved.
Fixtures now explicitly fetch/assert their mocked enabled capability after hydration,
retaining every interaction/assertion. No real release flag was changed.

Frontend units13/13, learning units48/48, backend/frontend and focused test types,
scoped lint, secret guard4000 files, canonical OpenAPI470 paths and mounted coverage
553 operations plus4 infrastructure routes pass. Public domain aliases, application
DB, financial policy and restricted capability publication remain unchanged. These
are isolated/fixture results, not provider, actual role or physical-device acceptance.

Next required D17 work: bind verified refund settlement to immutable resolved unit
ranges, reconcile original financial coverage and remaining physical obligations,
then support truthful partial pickup/closure without inventing handover, restocking,
credit or new charges. New alternative payment remains held until that resolution.
Exact-master CI, fresh populated restore and guarded release safeguards remain
required before production. Broader returns/warranty is still expressly deferred.

### 10 November: actual alternative quotation and acceptance binding

D17 reuses the actual Care Parts quotation and existing account/private-guest
acceptance. Issuance binds the current alternative request. The immutable offer
retains separate-original-refund-before-new-payment terms, labelled engineering
under the D17 delegation. Acceptance explicitly acknowledges that version, creates
one actual unpaid same-buyer order, and retains current customer/guest session proof
without storing a token. SQL preserves offer terms and acceptance proof. Stale,
technical, foreign and unacknowledged offers cannot be accepted. Cancellation of an
unpaid replacement permits a fresh customer choice/revised alternative; committed
refunds still require reconciliation. This is not forced credit or a money transfer.

An original affected-portion refund after alternative acceptance uses the existing
independent approval/provider/cap safeguards. New alternative payment and collection
stay held pending the original verified financial/resolved-unit workflow. Actual
late successful capture evidence remains recordable; it does not mark an order paid.
Broader returns/warranty and real owner/accountant/provider prerequisites remain.
Forward116/117 replay/schema diff/db:check and35 native cases passed on an isolated
restricted target, then owned tmpfs cleanup. Final integrated rerun and rendered
acceptance are pending. First116 run had34 passes/one missing synthetic policy
sourceQuestion; the fixture was corrected, no guard removed. UI units13/13 and
learning48/48 pass. Restricted sourcing v5/refund-work v6 and public parts guidance
v15 reflect the same sequence; publication flags and production data are unchanged.
D17 is incomplete until verified settlement and truthful resolved-unit fulfilment
are connected. Do not promote this held source as a complete production workflow.

Integrated native evidence:95/95 supply/refund/pickup cases passed on115 migrations.
An added vehicle case initially failed before fixture creation because it compared
the local NAT port with PostgreSQL's internal5432. Its original CI assertions remain;
local task containers now use the existing exact tmpfs identity/network/port proof.
A fresh115-migration replay/db:check/restricted-runtime retry passed that vehicle
case1/1. Both owned databases were removed. Focused integration TypeScript passes
after preserving endpoint/cookie tuple types; no runtime assertion was removed.
Logs: TEMP/aat-d03-service-payments-20261109/native-supply-integrated.log and
native-vehicle-integration-check.log. No populated restore, production migration,
exact-master CI or public-domain promotion is claimed for this D17 candidate.

### 10 November: integrated supply interface rendered acceptance

Source2abf201f preserves master7af6c51c, including service-card sizing and vehicle
engine/features work. Only evidence-history conflicts needed manual reconciliation;
both histories were retained. Held deployment dpl_4N2QUtE4ogEuKhYhGogVZFYgM5sY
passes7/7 synthetic rendered cases: account/guest request review, cancellation,
recovery/refresh at320/1440, administrator actual-unit intake at320/1440 and the
390px verified-capture refund request/link/focus. Six scoped Axe and overflow checks
pass; screenshots were inspected. Browser plugin unavailable; existing Playwright
was used. This proves fixture UI, not actual roles/provider settlement or devices.
The first build passed4/7: guest console assertions misclassified the intentional
account-session401, now checked by exact endpoint/status separately; a real refund
focus race with dialog restoration/refresh was reproduced and repaired. All other
console errors remain failures. Final types/scoped lint/11 interface units and48
collection/learning/vehicle units pass; secret guard3995 files passes. Prisma client
was regenerated using isolated test environment defaults. Public domains, production
DB and capability flags remain unchanged. D17 alternative acceptance and verified
settlement/resolved-unit fulfilment remain unfinished, with its source held.

### 10 November: customer and administrator supply interface checkpoint

Owned account and private-guest order details now show actual supply concerns only
when the backend advertises capability version1. Customer requests require explicit
review; interrupted saves reconcile their original request rather than duplicate it.
Session/access changes discard private state. Staff cannot enter customer choices.
Administrator intake selects actual unit ranges and separates public/private notes.
Refund requests select an actual verified capture, bind the current customer choice
and exact saved affected amount, then link to the existing independent refund queue.
Requested/approved is never presented as money returned. No payment gate is enabled.

Actual verification:11 focused frontend tests and focused test TypeScript pass;
19 native API cases passed with114-migration replay/db:check/restricted runtime and
owned tmpfs cleanup. Restricted order-sourcing v4 and refund-work v5 guidance plus
collection calendar/eligibility checks pass46 tests. Seven rendered fixture cases
are prepared but not yet run. Visual/browser acceptance remains outstanding.
D17 alternative acceptance and settled-unit fulfilment remain incomplete and held.
The separate schema110 candidate608d3c0d passed frontend42728871961 (984/984 full
browser matrix,1549 units;12 pre-existing skips), backend42728871883 and secret
42728871576. These are candidate checks, not exact-master production approval.
No production database, alias, feature flag or private owner hero edit changed.

### 10 November: financial linkage verified; complete resolution remains held

Refund-work guidance is now restricted v4. Actual current customer refund choices
bind the existing independently approved refund workflow to exact saved affected
gross, discount and tax; no fee or live financial-policy approval is invented.
Original captures and earlier commitments cap requests; unbound money/unknown
charges require reconciliation. Used/installed/disputed goods stay in assessment.
A committed refund prevents a competing choice. Safe owned reads show actual refund
status, never bank/operator evidence. Requested/approved is not money returned.
95 native cases across7 suites passed with114-migration replay/db:check/restricted
runtime and owned tmpfs cleanup. Separate eligibility/session/approval units26/26.
See site-completion-tracker for failed fixture attempts and exact evidence scope.
Customer/operator UI, actual alternative acceptance and settled unit resolution
remain incomplete. No feature flag, financial policy or production record changed.

### 10 November: actual customer remedy choices verified; resolution remains held

D17 now retains an append-only choice from the actual owned customer or private
purchase guest: refund review, suitable-alternative review, or technical review for
used/installed/disputed goods. These are requests, not financial approval, substitute
acceptance, credit consent, payment or settlement. No staff member can impersonate
this customer choice. Both service locks and SQL guards verify the actual current
principal, order and concern. Guest writes require their own CSRF; account/guest
mixed cookies are rejected. Replay rechecks current access before returning history.

Current order versions serialize competing choices. Changed choices append rather
than overwrite, and duplicate UUID/body replay cannot duplicate an alert or entry.
The safe projection omits private operator notes and actor/session/replay identities.
Existing scoped Care alerts are reused; the original financial/collection hold stays.
Technical requests do not infer a general returns period or financial entitlement.

Actual evidence:84/84 across six native suites;113 migrations replayed into a new
isolated loopback tmpfs test DB, empty schema diff, db:check and restricted runtime
passed. Task DB/container removed. Applied113 is now immutable. Separate four-file
units/learning/routing:38/38 after updating the order-sourcing v3 expectation. Receipt:
TEMP/aat-d03-service-payments-20261109/native-supply-choice.log. Canonical OpenAPI
adds only two owned choice paths; no existing path changed/removed. Backend/frontend types and scoped lint pass; secret guard3975 files, OpenAPI470
paths and mounted-route coverage553 operations plus4 infrastructure routes pass.

The actual interface, acceptance of a suitable offered alternative, linkage to the
independent refund workflow, verified settlement and resolved unit fulfilment remain
to implement. D17 is incomplete and held locally; do not publish this source or enable
purchasing to demonstrate it. Schema110 release candidate dab976c7 is unchanged.
Its backend42721896518 and secret42721896435 passed; frontend42721896492 remains
running in the full matrix. No production database, transaction or flag was changed.

# Order supply concern intake - 10 November 2026

### 10 November: supply concern intake and Care handoff verified in isolation

D17 now retains actual affected unit ranges, the immutable original monetary basis
where available, and a linked owned/branch Care enquiry. Unavailable sourcing creates
one unresolved case for uncovered units; repeats do not duplicate cases/alerts and
later estimates do not silently resolve it. Existing current-recipient Care alerts
and opt-in encrypted department delivery are reused. A queued/disabled email is not
successful delivery. Missing/invalid historical money remains a reconciliation state;
used/installed/diagnosis reports stay in technical assessment without inventing a
returns period, fee or entitlement. Financial approval is always false at intake.

Current Admin/Super Admin MFA authoring, scoped Staff reads, actual buyer/guest
ownership, strict CSRF, version/replay checks and immutable history are connected.
Unresolved concerns stop new payment preparation and physical fulfilment while
preserving captured money and stock records. Actual independent remedy consent,
alternative-quote binding, refund/adjustment linkage, resolved quantities, operational
UI and rendered acceptance remain to implement. This intake is not D17 completion
and is held from production until its resolution journey is connected.

Actual evidence: 79/79 in six native suites; 112-migration empty isolated replay,
empty schema diff, db:check and restricted runtime checks passed. The first run had
71 passes/eight failures caused by a trigger alias colliding with implicit OLD.
Forward112 repairs that function; applied111 is untouched. Owned tmpfs DB removed.
Separate four-file units/learning/routing: 37/37; backend types/scoped lint pass.
Receipt: TEMP/aat-d03-service-payments-20261109/native-supply-exception-forward-fix.log.
Order-sourcing learning is admin-only v2; existing publication/commerce flags remain.

Chosen under the narrow D17 delegation; not a new owner-authored general refund or
warranty policy. No actual customer, order, provider, permission, financial-policy
publisher or production database was changed. New endpoints use existing account,
private guest and current branch/MFA boundaries; raw internal reasons and actor/
session/replay identities are never returned in buyer reads. Care case messages
contain the customer-facing concern, not the private operator note or pickup code.

The money engine reads the original saved aggregate HALF_UP/largest-remainder
allocation, validates it against actual order totals and computes disjoint unit
ranges with exact attributable saved tax. Legacy records are never repriced. A
historical delivery charge requires review rather than an invented zero or blanket
refund. Review-only basis does not create a refund, substitute, fee, credit or payment.

Future resolution must preserve actual independent approval, provider eligibility,
refund caps/reconciliation and explicit customer consent to an actual suitable offer.
Until connected, the hold cannot be treated as resolved merely by editing a sourcing
estimate or closing the linked Care conversation. Do not publish this incomplete
journey as finished or enable purchasing to demonstrate it.
