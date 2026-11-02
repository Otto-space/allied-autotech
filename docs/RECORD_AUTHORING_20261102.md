# Record authoring and launch wording - 2 November 2026

Runtime 9be4e66bb10716fd0066b9de26275f1ddcf88c55 is published on apex/www as
frontend dpl_4VjxHa2jJ9rULegr61vrZCweC9WV. Matching backend
3f6e7873-4d49-4ca1-8e7c-14571ea95584 is ACTIVE 16/16 with four verified
digests, readiness 200 and eight fresh workers. No schema, business-row, price,
grant or feature-flag change.

## Implemented

Vehicle stock has explicit View details and Edit details actions, copied stock
numbers and readable shared status badges. Edit details opens the existing editor
without submitting; the header reopens it. Fresh access, branch, version, review,
uncertain-response, listing and asking-price guards remain unchanged. The five
record-section links stay in one horizontal, locally scrollable laptop row with
either sidebar state. Failed stock refresh removes the edit shortcut.

Product, parts inventory, booking and complaint records reuse the corrected
customer-record table region. Existing mobile cards, scopes, filters, pagination
and actions remain intact. Product/inventory SKUs and movement references use the
existing clipboard control with manual selection recovery. Inventory reservation
labels and badges are readable while filter/API values are unchanged.

The phone dashboard header places search above account controls, keeping the
field readable at 320px without losing notification/account/sign-out actions.
Staff and managed-workforce booking details now reuse the Nigeria-time appointment
indicator and confirmed-future/current-only countdown already used for customers.
No clock expiry confirms, cancels or changes a booking.

Inspection Help now follows the enabled public launch mode. The enquiries release
directs visitors to an enquiry and separate workshop confirmation. Full-mode
inspection requests retain their original conditional path. The dashboard's launch
note correctly allows readable existing records. Public vehicle-enquiry guidance
advances to v5; private vehicle-operations to v2. Eligibility, private filtering,
semantic destinations and help/commerce/provider flags are unchanged.

## Verification before publication

- Synthetic baseline on the actual prior production artifact: 2 passed at
  320/1440px, capturing stock and detail pages. An earlier invocation from the
  repository root failed to find fixture image files; running from frontend
  corrected the test environment without an application change.
- Main local browser run: 73 passed, no skips/flaky cases. Three permitted roles,
  explicit actions, editor hash/header/focus, desktop sidebar states, mobile
  search in four roles, existing stock/detail access/stale/concurrency/review,
  exact grouped NGN and bounded filtering regressions are covered.
- Shared local run: 19 passed / 2 failed. The two failures used an incorrect exact
  catalogue-link name; the corrected two public journeys subsequently passed.
  Its 19 passes cover Staff/Admin appointment timing, seven booking and seven
  complaint responsive/Axe layouts and three inventory detail fact layouts.
- Preserve run: 8 passed / 1 vehicle-create navigation timeout. The failure's
  snapshot shows the confirmed-created fallback with the correct photo-editor
  link, not a repeated POST. The unchanged Admin and Super Admin creation cases
  passed in the subsequent 4-case recovery run, together with both corrected
  public Help/contact/catalogue/detail journeys. The timeout cause is not proven.
- Initial added copy checks incorrectly required touch sizing in a mouse context
  (4 failed). Corrected tests explicitly emulate touch at 320px and mouse at
  1440px, retaining the existing 44px coarse / 36px fine-pointer design.
- Focused backend learning units: 14 passed across four files after the CI correction. Frontend Help/stock units: 9 passed.
  Final four table cases pass with touch at 320px and mouse at 1440px.
  Frontend TypeScript, scoped ESLint, formatting and diff checks pass.

Local preview uses in-memory GET-only public snapshots and intercepted synthetic
account/operational responses, without an application session or database. Its
missing product-detail contract was filled from the exact anonymous published
product response; no product facts were invented. Every launch-truth case aborts
non-GET API requests and asserts none occurred. Synthetic writes in existing
review tests terminate at Playwright fixture handlers.

## Operational readiness and remaining acceptance

Public browsing, enquiry wording and current-record authoring can be verified in
this batch. Actual signed-in Admin/Super Admin/assigned Staff acceptance remains
unavailable; the owner cannot access the session now and is not asked again.
Provider notification delivery, physical phones/Safari and a full screen-reader
journey remain unverified. No live customer, vehicle, stock, price or financial
record is changed for demonstrations.

The current published Oil Filter lacks a genuine product photograph, description,
brand/manufacturer reference, classification and verified compatibility. These are
operator-supplied facts, not permission to invent content or approve fitment.
Existing collection-only policy, disabled delivery/deposits/reservations and
payment/booking activation requirements remain recorded separately. Tax/CAC,
invoice timing and actual provider test-mode acceptance remain existing owner/
accountant/provider prerequisites; this batch adds no owner decision.

The wider objective remains tracked in the quality register. A green build alone
does not establish operational acceptance or whole-site launch readiness.

## Published verification and safety

All three exact-source GitHub checks passed: frontend 41486816169 (1,339 units
passed / 12 existing fixture-gated skips, types/lint/format/build and zero production
audit findings), backend 41486665455 and secrets 41486665465. The backend gate
includes 11 real authenticated learning HTTP tests in a new isolated CI database;
v2/v5 eligibility and private/public boundaries pass. Initial backend run
41485653492 failed an obsolete v4/date assertion; the corrected test retains the
owner-disclosure/reservation checks and adds conditional action wording. Runtime
source did not change between f8bec03d and 9be4e66b. Installation logs separately
report development-inclusive audit findings (frontend 22; backend 9); these are
not the zero production-audit result. No dependency was changed in this batch.

Ten final packaged-image/database checks passed, including isolated migration
replay and restore. The four exact-source images were pushed, reviewed and used
without changing the application spec beyond four digests. Production predeploy
remains read-only. Fresh production backup/hash, strict-TLS target identity,
87-migration db:check and runtime least-privilege checks passed. The same-day
populated restore rehearsal at 09:33 UTC was revalidated for unchanged Prisma
and safety scripts; it preserved original row hashes in a separate _ci database.
Managed off-device backup/PITR evidence is retained. A fresh managed-provider
restore was not performed in this batch. Temporary trusted-source access was
removed after each pre/post check, preserving concurrent rules.

Final held artifact: 27 new journeys + 13 authoring regressions + 29 hero/service
cases passed, all with zero skips/flaky/unexpected results. The earlier f8bec03d
artifact independently passed 27+13 but was superseded, not promoted. Initial final
artifact run had 26 passes / one Staff phone focus failure. The cause is unproven:
three traced repetitions, a complete 27-case rerun and the deployed Staff case
passed unchanged. The original failure is retained; no assertion was relaxed.

Actual deployed routes: 17 apex cases and 2 www journeys passed. The 17 include
three role-fixture stock/editor checks, phone search, Help/contact/product actions,
favourite reload/removal, authoritative service prices and imagery, no-JavaScript
content, three real-time carousel loops, hover/manual/keyboard behavior and slow/
failed-image recovery. Operational identities and mutation responses are synthetic
interception on the real build; public catalogue/Help/hero reads are separate
anonymous live evidence. www redirects to apex; both deployment identities match.
Anonymous vehicle-enquiry reads return v5 on both domains and private vehicle
operations returns 404. Browser plugin unavailable; installed Edge/Playwright used.

Evidence is in C:/Users/PC/AppData/Local/Temp/site-completion-20261102. Core reports:
authoring-local.json, authoring-shared.json, authoring-preserve.json,
authoring-recovery.json, authoring-tables-final.json, authoring-hosted.json,
authoring-preserve-hosted.json, authoring-hero-services.json, authoring-focus-check.json,
authoring-public.json, authoring-www.json and authoring-guidance-live.json. Protected
backup/provider/image/worker receipts remain outside Git. Only four superseded
never-published task image references were removed without force. Current and
rollback releases, warm cache, data volumes, backups and other worktrees remain.
Local preview was stopped after local QA; no duplicate dependency installation.

## Safe before and after evidence

These account/record screenshots contain synthetic fixtures, not customer data.

[Before stock and narrow search, 320px](C:/Users/PC/AppData/Local/Temp/site-completion-20261102/authoring-before/authoring-before-before-authoring-320/stock-320.png)

[After explicit actions and full-width search, 320px](C:/Users/PC/AppData/Local/Temp/site-completion-20261102/authoring-public/authoring-affordances-ADMI-42bea-itable-destination-at-320px/stock-ADMIN-320.png)

[Before detail, 1440px](C:/Users/PC/AppData/Local/Temp/site-completion-20261102/authoring-before/authoring-before-before-authoring-1440/detail-1440.png)

[After header action and horizontal sections, 1280px](C:/Users/PC/AppData/Local/Temp/site-completion-20261102/authoring-hosted-final/authoring-affordances-ADMI-53e59-table-destination-at-1280px/editor-ADMIN-1280.png)

[Shared inventory table, 1440px](C:/Users/PC/AppData/Local/Temp/site-completion-20261102/authoring-hosted-final/authoring-affordances-Inve-59a3f-s-and-SKU-copying-at-1440px/records-inventory-1440.png)

Original Home/About asset mapping, workbook inspection, quantities, package
boundaries and photographs remain documented in frontend/docs/HOME_WORKSHOP_20261102.md
and frontend/docs/HERO_OVERLAY_20261102.md. The latter and
docs/PUBLIC_SERVICE_PRESENTATION_20261102.md retain original public before/after
photographs. Existing genuinely unresolved workbook details remain there: R20/R21
boundaries, repeated row 9 description, four-tyre package equivalence, unnamed/
unpriced jobs, AC markup choice, unknown durations and inclusion/warranty terms.
They were not guessed, repriced or discounted twice.

Completion cleanup removed eight task-created provider cookie/state/handshake files.
No application session or owner credentials were copied. Docker finished with 125
images, the same 14 containers/15 volumes and 11.97 GB of retained warm build cache.
C: measured 25.66 GiB before image building and 25.48 GiB at completion. These are
point-in-time preflights, not an OS quota or equivalent physical-reclamation claim.
The four removed f8bec03d image references were never published; current 9be4e66b
and prior successful rollback images remain. No source branch/worktree retirement
was needed for this master batch; other active/dirty/missing worktrees are preserved.
