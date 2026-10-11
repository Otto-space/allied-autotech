# Customer bookings list

Status: **locally accepted, 8 October 2026**. Route `/dashboard/bookings`, customer role only. Thirty-first completed expanded milestone. Customer booking detail remains the next separate gate.

## Audit and resulting behavior

Four baseline captures at 390/768/1280/1440px showed large generic rows with status and deposit text, but little vehicle context. Status and cursor state disappeared on reload. The inherited breadcrumb lacked ordered-list/current-page semantics. A failed refresh could leave old records visible without a clear stale-data boundary.

Two fresh [desktop and mobile/state concepts](customer-bookings-oct-concepts/README.md) preceded production edits. The page now uses a compact desktop table and labeled mobile records, with real service, vehicle, appointment, branch, status and deposit details. Existing quotation counts and work-order states appear when returned. Requested times are distinguished from confirmed appointments; a recorded deposit uses the backend timestamp, not an inferred booking/payment state.

The heading and original subtitle remain. Book a service opens Services; Refresh rechecks the list; every record has one View booking action; Contact support opens the customer support route. Scheduling, cancellation, payment and quotation decisions remain on existing detail routes. No list mutation or invented bulk action is introduced.

## Contract and state behavior

Existing authenticated customer-only `GET /customers/bookings` derives ownership from the actor. The strict query supports eight booking statuses, UUID cursor and limit 1-100. Results follow ascending ID cursor traversal, with non-draft issued quotation filtering and the existing customer-safe staff-note/work-order/payment projections. It has no customer search, date sort or global total contract. The UI uses supported status filtering, 10/20/50 row choices and an explicit count on this page. No backend change or migration was required.

[BookingsPanel](../../app/components/bookings-panel.tsx) reuses the resource loader, exact money formatter and Lagos date formatter. [URL normalization](../../lib/customer-booking-query.ts) preserves status, limit, cursor and a bounded UI-only previous-page trail across reload and Back/Forward. The trail and unrecognized query fields never reach the API. Invalid recognized values receive safe defaults with a visible explanation. Filter/page-size changes reset traversal. A direct cursor URL without a known trail says Later page and provides First page; it does not invent an absolute page number. Trails are bounded to 50 entries, after which first-page recovery remains available.

Loading and failed manual refresh hide the table. A background refresh can retain verified rows while explicitly saying the list may be out of date. Retry is available; errors never imply an empty account. Empty-account, empty-filter and empty-cursor states have appropriate recovery actions. Session invalidation clears private results and ignores a late response.

[Scoped CSS](../../app/dashboard/bookings/bookings.css) supplies compact controls, focus treatment and responsive records. The [shared shell](../../app/components/dashboard-shell.tsx) suppresses its older breadcrumb only on this exact route; the page provides a semantic ordered breadcrumb with a chevron and `aria-current`. Other routes retain their existing navigation. No password input exists on this page.

## Fidelity assessment

| Comparison         | Final implementation and decision                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main hierarchy     | Breadcrumb, unchanged heading/subtitle, service/refresh actions, guidance, filters, page count, records and pagination follow the planned hierarchy.                                                    |
| Brand and surfaces | Actual Allied wordmark and sidebar remain; the ink guidance follows the mobile concept. Generated alternate logo, Shell branding and slogan were excluded before implementation.                        |
| Typography         | Quicksand 30/27px heading, 18px guidance/state headings, 15px service title and 13px body follow the written tokens. Existing brand typography is preserved.                                            |
| Table density      | Five columns, restrained neutral badges, subtle row separators and a single detail action replace oversized standalone cards. Dates and amounts remain actual formatted data.                           |
| Controls           | Separate visible labels, 48px selects and at least 44px actions. The first test pass exposed exact-label ambiguity from nested selects; sibling labels fixed it.                                        |
| Mobile records     | No horizontal table scrolling. Service and appointment span the record; status and deposit share a compact row; the detail action spans the bottom. This reduced unnecessary vertical stacking.         |
| State design       | Clear loading skeleton, distinct empty/filter/cursor states, retryable error and explicit background-staleness notice. Demonstration states from the concept are never combined into live fake content. |
| Supported behavior | Generated search field, overflow menu and extra arrows were excluded because the current contract/action set does not support them. No fake total, sort or payment claim appears.                       |
| Navigation         | Actual permitted shell and Help/WhatsApp remain. A real semantic breadcrumb replaces plain separators on this route only.                                                                               |

Final desktop/mobile, loading, empty and error screenshots were visually compared with the concepts. Ten final widths showed no horizontal page overflow. No production photo or other image asset was needed; concepts are design references only.

## Verification evidence

- **51 combined browser scenarios passed** on the final production build: 28 customer-bookings checks and 23 shared navigation checks. **One additional background-refresh scenario passed** separately after the combined run, giving 52 distinct passing scenarios. It verified that retained rows are visibly labeled stale and recover through Retry.
- Customer widths: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Four customer Axe scans passed, alongside shared navigation accessibility checks. Visible page controls meet the 44px height check. Long names, exact large money, missing vehicle/branch/time and a 320 x 420 viewport passed.
- URL status/page-size persistence, reload, Back/Forward, cursor Previous/Next, direct-cursor recovery, filter resets, strict API query projection, empty/error/malformed states, retry, owned detail navigation, no mutation, role denial and late-session-response handling passed.
- **Actual API/database/browser acceptance passed** against isolated `allied_customer_overview_test`: 12 owned bookings traversed in pages of 10 and 2, confirmed filtering returned two, reload and Previous preserved traversal, vehicle context rendered, and no page errors occurred. Requests were forwarded unchanged from the browser to the actual isolated Express instance; no API response was mocked. Private staff notes were excluded; ownership override returned 422, foreign detail 404, administrator list access 403 and anonymous access 401. The harness restores the synthetic customer cookie after anonymous-denial checks, which correctly clear it.
- **Five existing backend service-operation policy/boundary tests passed. Five frontend background-resource tests passed.** Full frontend lint and type checking, focused lint/format, production build and standalone packaging passed. Final label/layout edits passed another production build and the combined browser rerun; the final added test passed focused lint and type checking.

Browser-plugin transport was unavailable; Playwright used installed Microsoft Edge. Captures, helpers and logs remain outside the repository under `C:/Users/PC/.codex/customer-bookings-oct-*`, including baseline/final width captures, state captures, real API evidence, browser logs and static/build logs. Concepts remain in the linked repository directory. Synthetic records are confined to test fixtures and isolated QA databases.

## Remaining scope

No new required backend gap was identified. Deployment/session/provider verification stays under REL-03 in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). The list gate does not certify booking-detail scheduling, cancellation, quotations or payment transactions, which require their own route/state acceptance.

Next: customer booking detail `/dashboard/bookings/[bookingId]`. Remaining customer, staff, administrator and Super Admin pages are still open. The full application goal remains active.
