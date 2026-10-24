# UI and UX quality register

Updated 24 October 2026. This is the ongoing quality register, not an assertion
that every route or state has passed review. Work proceeds in finite batches.

## Standing responsibility and source

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
`app/**/page.tsx` route patterns, dynamic segments, role families and 294 source
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

`R` means a rendered fixture sample selected for final verification, **not every
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

Pending final results: production build, page-pass outcome, final screenshots,
release checks, actual publication identity and remaining gaps.

Continue future cycles from this page index: revisit concrete failures first,
then expand state/role coverage on the next relevant page. Real screen-reader,
real-device keyboard and real authenticated operational acceptance remain open.
Unexercised combinations are not counted as complete. The deferred transaction
pages retain their launch gates. Preserve the separately settled Item 6 queue.
