# Record authoring and launch wording - 2 November 2026

This batch extends the verified c53530c4 runtime. Publication is pending the exact
source checks, held frontend acceptance and compatible backend rollout. No database
schema, business row, price, role grant or feature flag is changed.

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
- Focused backend learning units: 13 passed. Frontend Help/stock units: 9 passed.
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
