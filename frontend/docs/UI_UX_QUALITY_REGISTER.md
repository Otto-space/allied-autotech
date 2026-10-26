# UI and UX quality register

Updated 25 October 2026. This is the ongoing quality register, not an assertion
that every route or state has passed review. Work proceeds in finite batches.

## Standing responsibility and source

Current bounded implementation: notifications only, branch
`feat/notifications-experience-20261025` in the reused
`allied-home-restoration-20261025` worktree. Customer and work inboxes, bell,
preview, read/unread state, preferences, device flow, producer privacy and delivery
reliability are the current cycle. Homepage, catalogue and unrelated dashboards
remain outside the new implementation scope. Released Shop/Vehicles source
`71d3f60d` was merged and its 70 migrations and existing behaviour preserved.

Status: deployed on 25 October 2026 from runtime source `345847d5` after locked
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

[Machine-readable source inventory](ui-quality-inventory.json) lists all 104
`app/**/page.tsx` route patterns, dynamic segments, role families and 320 source
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
within those 13 scenarios, not 17 distinct scenarios. The full local 127-case
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
