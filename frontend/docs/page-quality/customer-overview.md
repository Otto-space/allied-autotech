# Customer dashboard overview

Status: **locally accepted, 8 October 2026**. Route `/dashboard`, customer role only. Thirtieth completed expanded milestone. Staff/admin overview and other customer routes retain their separate page gates.

## Audit and implementation

Four baseline captures at 390/768/1280/1440px showed date filters, five totals, a bookings/orders chart, status distribution and recent lists. Those aggregates were correctly scoped but did not answer what is happening with the customer's vehicle now. Three fresh [concepts](customer-overview-oct-concepts/README.md) preceded implementation.

The customer page now places current vehicle/service, next booking and quote/payment review first, followed by latest order, inspection and notification. Actual service timestamps form the progress list. Historical activity remains below a clear date-filter boundary. Empty accounts receive explicit empty messages and supported next actions; unavailable or invalid data never becomes a zero-activity claim. Refresh/loading/error feedback appears above current care. Date validation, chart legend toggles, keyboard day inspection, daily data, recent records and definitions remain available.

Implementation reuses [RoleOverview](../../app/components/role-overview.tsx), existing session/resource invalidation and date/money utilities, with a customer-specific [care summary](../../app/components/customer-care-summary.tsx) and [scoped CSS](../../app/dashboard/customer-overview.css). Staff/admin presentation remains unchanged. At this dashboard root, the selected Overview navigation item provides the location; no redundant ancestor breadcrumb is introduced. The overview has no password fields or new write operation. It does not mark notifications read.

## BG-09 backend acceptance

The goal authorizes backend gap integration. Existing `GET /customers/overview?from&to` now includes a minimal owner-scoped `care` projection, independent of historical dates. The server derives the customer from the session, validates strict 1-90-day Lagos date ranges, and retains its repeatable-read transaction and private/no-store response. Staff and organisation responses omit care. No migration or new write endpoint is needed.

Selections: latest updated in-progress booking; earliest future requested/confirmed booking; its owned vehicle or latest garage addition; latest unexpired issued quotation; latest unexpired requires-payment request or processing/requires-review request; latest order with actual status and fulfillment method; earliest scheduled confirmed/rescheduled inspection, otherwise earliest future requested inspection; latest unexpired user notification. All picks have deterministic timestamp/ID ordering and return at most one record. Missing records are null. The projection also defends against a malformed historical cross-customer vehicle relation.

Payment amount describes the selected request, not the customer's total debt or verified settlement. A preferred inspection time is not a confirmed appointment. Delivery method does not establish a delivery date or delivered event. No invented repair stages, private VIN, staff notes, contact data or notification body are included. See [backend implementation](../../../backend/src/modules/overview/customer-care.ts), [schema](../../../backend/src/modules/overview/customer-care.schemas.ts), [contract](../../../backend/src/modules/overview/overview.openapi.ts) and [integration tests](../../../backend/tests/integration/customer-care-overview.test.ts).

The implementation makes nine bounded selection calls per customer projection, with no per-row loop. Existing customer/status, customer/date, quote/booking and user/notification indexes were reviewed. Four EXPLAIN ANALYZE checks on the small isolated database covered current booking, upcoming booking, quotation join and latest notification; measured execution was 0.044-0.227ms. This is fixture evidence, not a representative-volume benchmark. Larger-volume latency/index tuning remains a release verification concern; no unsupported scalability claim or speculative migration is made.

## Concept fidelity and corrections

| Area              | Reference and final treatment                                                                         | Decision                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Hierarchy         | Current care precedes date-filtered activity, with a roughly 60/40 upper composition.                 | Matched; customer metrics remain secondary.                                     |
| Surfaces          | One ink service panel, white review area and ruled secondary records on cool-grey canvas.             | Matched without repeating large marketing cards.                                |
| Typography        | Quicksand, 30/27px main heading, 20px sections, 15px record headings and 13px body.                   | Preserves the approved Nippo/Quicksand brand and existing dashboard typography. |
| Vehicle identity  | Actual name, year and registration with a small car icon.                                             | Generated vehicle photographs and personal details are deliberately excluded.   |
| Progress          | Actual requested/confirmed/started timestamps only.                                                   | Generated extra stages, location claims and delivery estimates are excluded.    |
| Next booking      | Compact desktop detail/action grid; stacked mobile content.                                           | Refined after rendered comparison to reduce unnecessary height.                 |
| Secondary records | Latest order, inspection and update share ruled sections with garage/support links.                   | Matched; actual status and date semantics replace invented concept content.     |
| Mobile activity   | Single-column date controls and stacked recent-booking rows; compact metric strip.                    | Deliberate adaptation for readable records and 44px controls.                   |
| Feedback          | Freshness and failure/retry appear before care; missing/malformed/wrong-scope data hides the summary. | Improved over the concept's combined demonstration of empty and error states.   |
| Existing shell    | Actual wordmark, permitted navigation and working Help/WhatsApp retained.                             | Generated navigation/footer content is excluded.                                |

The first browser pass identified a hidden date label inheriting full mobile width and 36px chart legend buttons. Excluding the screen-reader label from that width rule and increasing legend targets fixed both defects. Final ten-width captures show no page overflow. Desktop/mobile, empty, error and loading captures were inspected against the three concepts. No production image generation was needed beyond design concepts.

## Verification

- **58 final browser scenarios passed:** 23 customer overview checks, 12 shared overview checks and 23 shared navigation checks. Customer widths: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Four customer Axe scans plus existing shared scans passed. Visible overview links/buttons/inputs/selects/summaries meet 44px height checks.
- State coverage includes populated/empty/loading/unavailable data, missing/malformed care, wrong scope, retry, historical empty activity with retained current care, long names and exact large money, short 320 x 420 screens, actual detail links, requested versus scheduled time, account invalidation and ignored late responses. Existing date validation, chart/table keyboard behavior and role-specific navigation passed.
- **Six frontend unit tests passed** for overview parsing/formatting/date behavior and refresh behavior. **Eight backend integration tests passed** in `allied_customer_overview_test`, including the three new care tests and five overview regressions. All existing migrations replayed into this separate database; no migration was added for BG-09.
- **Actual browser/API/database journey passed:** browser requests forwarded unchanged to an isolated Express instance, with real seeded records and no mocked API responses. Historical totals were zero while current care remained; exact `9007199254740993` minor units rendered correctly; owned quotation navigation worked; response was private/no-store; no page errors occurred. This verifies overview reads/navigation, not the separate booking-detail workflow.
- **Unmocked frontend-proxy check passed:** a seeded verified QA customer logged in through the actual frontend proxy to the refreshed isolated API on 5012. Overview returned 200/private-no-store with explicit null care, and the 390px empty dashboard had no overflow. Provider email/SMS/payment delivery remained disabled. A prior unverified registration attempt did not establish a session; it was not counted as acceptance.
- Frontend production build and standalone packaging, full lint, type check and focused formatting passed. The final feedback/layout edit also passed focused lint/format and the final production build, followed by the full 58-scenario rerun. Backend type/lint, format, OpenAPI export/validation/mounted-route coverage and frontend API type generation passed.

Browser-plugin transport was unavailable; Playwright used installed Microsoft Edge. QA helpers, screenshots and logs remain outside the repository under `C:/Users/PC/.codex/customer-overview-oct-*`, including final browser, unit, backend, build, proxy, real-API and query-review records. Fresh concepts are retained in this report's linked concept directory.

## Release boundary and next gate

BG-09 is locally accepted in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). Deploy its backend contract before the dependent frontend and verify target-environment cookies, caching, isolation and performance under REL-03. No staging or production deployment, provider delivery, realistic-volume load test or all-application completion is claimed.

Next route: customer bookings `/dashboard/bookings`, followed by remaining account/dashboard/role pages. The whole-application goal remains active.
