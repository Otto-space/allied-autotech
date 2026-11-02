# Complete live audit implementation - 2 November 2026

The complete owner audit was read and reconciled with deployed runtime 9be4e66b.
The current requirement ledger is frontend/docs/UI_UX_QUALITY_REGISTER.md; this
report records a bounded implementation package, not a second backlog or a claim
that the whole site is ready. Package start: 17:31 UTC; 60-minute review: 18:31 UTC.

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
[Contact after, 320px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/after-local-contact-320.png)
[Vehicle before, 1440px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/before-settled-vehicle-1440.png)
[Vehicle after, 1440px](C:/Users/PC/AppData/Local/Temp/aat-full-audit-20261102/after-local-vehicle-1440.png)
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
