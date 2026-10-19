# Order fulfilment — gate 60

Locally accepted 17 October 2026 at `/admin/orders`. Order detail is the next separate
gate. Application-wide and deployed-environment acceptance remain open.

## Delivered behaviour

The existing `StaffOrders` component now uses the accepted dashboard visual system:
one breadcrumb, compact heading, outlined refresh, labelled filter form, ink records
band and five readable columns. Mobile/tablet records retain branch, fulfilment,
recorded payment, timestamps, order value and collection/delivery method. Currency
uses the existing exact Kobo formatter; dates use Lagos time. Payment recording and
fulfilment remain separate facts, with no inferred invoice/refund status.

Full order-number lookup, status and administrator branch filters run on the server.
URL state survives reload and browser navigation; cursor history is bounded and
filter changes reset pagination. Existing customer-scoped links remain supported,
with an explicit clear-customer action. Counts describe only the current page.
Staff never fetch administrator branch choices, and customers make no operational
requests. Order links continue into the existing role-aware detail workflow.

Malformed/repeated filters show recovery without an order request. Malformed,
duplicate, oversized or filter-mismatched responses cannot become list records.
Transient refresh failures retain disclosed stale records and disable paging;
denied/missing reads remove private records. Loading, empty, retry and keyboard
submission states are verified. This page performs no business mutations.

## Backend integration

`GET /staff/orders` now accepts optional `orderNumber`: trimmed, case-sensitive exact
equality, maximum 120 characters, no control characters. It combines with existing
branch/customer/status constraints and cursor paging. The existing unique order
number index supports lookup; no schema change or migration was needed. Staff's
assigned active branch remains authoritative even if a caller supplies another
branch ID. Successful list responses now explicitly use `Cache-Control: private,
no-store`. Existing invoice projection remains administrator-only.

OpenAPI and frontend generated types were refreshed. See
[backend acceptance](../../../backend/docs/staff-order-discovery.md) and ADM-13 in
[the gap handoff](../../../BACKEND_IMPLEMENTATION_GAPS.md).

## Design and fidelity

Fresh [desktop](work-orders-oct-concepts/desktop.png) and
[mobile](work-orders-oct-concepts/mobile.png) concepts preceded code. The
[extracted specification](work-orders-oct-concepts/spec.md) records required changes
to generated branding, role navigation, font scale and mobile metadata layout.
Browser/IAB is unavailable, so Playwright with installed Edge supplied screenshots.
Both concepts and final desktop, 390px, 320px and Staff renders were inspected with
`view_image`. The generated desktop's native 1501×1048 viewport was checked. The
971px-wide mobile concept is an enlarged design illustration; actual mobile widths
320–430px were tested instead of treating that raster width as a device breakpoint.

| Comparison             | Result                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and orientation  | Real Allied logo, authorised navigation and a single named breadcrumb preserved.                                                               |
| Heading and type       | Controlled Quicksand 28/24px heading, 18px sections, 13px rows and 12px captions/labels match the extracted system.                            |
| Filters and actions    | White bordered strip, neutral refresh/clear and red Apply; administrator branch filter only.                                                   |
| Palette and containers | Cool pale canvas, ink desktop band, white records; mobile heading opens onto the canvas. No added decorative media.                            |
| Records and density    | All five column meanings, linked reference, method, date and payment time retained; mobile uses labelled two-column metadata.                  |
| Controls and icons     | Lucide refresh, chevron and arrows; visible borders/focus; 44px controls and wrapping long content.                                            |
| Copy                   | Primary copy matches the extracted specification. Data and counts vary with the response; required recovery states use the same visual system. |

The implementation was faithfully verified against the extracted design. No
material visual mismatches remain. The intentional differences above preserve real
branding, permissions, controlled typography and small-screen usability.

## Verification

- **18 browser scenarios have passing evidence:** 17 new discovery cases and the
  existing Staff list-to-detail fulfilment regression. The combined run passed 17;
  its loading case passed after fixing the test's UTF-8 text assertion. An earlier
  fixture omitted the required success-envelope message; corrected before acceptance.
- **13 frontend unit cases passed** for query normalization, exact-case preservation,
  invalid links, role restrictions, bounded history, response safety and projections.
- **7 backend cases passed** across staff-order discovery, the phase-four transaction
  flow and API boundaries. A test initially expected HTTP 400; the established API
  validation contract returns 422, and the corrected test passed.
- **23 captures and 23 Axe scans passed:** 14 widths (320, 360, 375, 390, 430, 768,
  900, 901, 1023, 1024, 1280, 1440, 1467 and 1920), native desktop, Staff mobile,
  empty, error, denied, malformed, mismatch, invalid and landscape states. No page
  overflow or Axe violations. The long-content/reduced-motion browser case adds
  eight Axe scans. The 14-width capture run reported zero page errors.
- **Real browser/Express/PostgreSQL passed:** 25+3 paging, reload/history, exact
  lookup beyond page one, inactive-branch filtering, customer scope, Staff branch
  boundaries, omitted Staff invoice data, private cache headers, zero list mutations
  and zero browser errors.
- Full frontend lint, focused final lint, TypeScript and isolated production build
  passed. Backend typecheck/lint, OpenAPI validation (268 paths) and route coverage
  (321 operations) passed. Eight implementation/dependency hashes match the tested
  production snapshot. Changed files were formatted and diff whitespace checked.

## Database and release boundary

Verified loopback host `127.0.0.1`, port `55480`, fresh database
`allied_work_orders_20261017_test`, local test environment and cluster identity
before creating it. Empty replay of the existing 58 migrations and `db:check`
passed. A separately created restricted runtime role was verified to have no
ownership, schema CREATE, table TRUNCATE or administrative role attributes. Tests
preserved synthetic domain rows and removed only their own sessions.

No application/shared/staging/production data or grants changed. No new schema,
backup operation, restore rehearsal, off-device backup verification or deployment
was performed. Local acceptance does not prove deployed acceptance.

Private QA evidence remains outside the repository under
`C:/Users/PC/.codex/work-orders-*`: build, API, browser, capture, real-integration and
database logs; screenshot/state manifests; source hashes. Runtime secrets remain in
the private isolated-cluster directory and are not included in this report.
