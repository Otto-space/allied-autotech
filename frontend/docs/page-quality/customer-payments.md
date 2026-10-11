# Customer payments list

Status: **locally accepted, 9 October 2026**. Route `/dashboard/payments`, customer role only. Thirty-fourth completed expanded milestone. This is a separate gate from the accepted [payment detail](payment-detail.md).

## Audit and implementation

Baseline captures at 390, 768, 1280 and 1440px showed a generic list with duplicated detail actions, raw status labels, no purpose or creation-date context, filters lost on reload and an inherited breadcrumb. Three fresh [desktop, revised mobile and state concepts](customer-payments-oct-concepts/README.md) preceded production changes. The first mobile artwork was rejected before implementation because every row action became an oversized red button.

The [payments panel](../../app/components/payments-panel.tsx) presents a five-column desktop table and continuous labeled mobile records. Each record shows its reference, creation date in Lagos time, readable purpose, supported related-record links, server status and exact NGN amount. Related links use their record type rather than inventing order/invoice numbers from UUIDs. They do not fetch additional records to populate this list.

Only payment status `SUCCEEDED` permits the Confirmed amount label. Attempt status, payment-provider return navigation and expiry timestamps do not establish successful payment. Refresh reads the existing list; View invoices, View payment and Contact support use existing routes. No checkout, receipt issuance, cancellation or payment mutation is added to this list.

## Contract and private data

Existing `GET /customers/payments` requires an authenticated customer, derives scope from the actor and accepts six statuses, a UUID cursor and bounded limit. The repository orders by creation time descending, then ID descending. It already projects `createdAt`, target IDs, purpose, amount and status. No new backend field, endpoint, permission or migration is required for the list.

[Query normalization](../../lib/customer-payment-query.ts) persists validated status, page size and cursor in the URL. A bounded `_trail` supports Previous after reload; this presentation-only field and unknown query parameters never reach the strict API. Filter changes reset paging. Direct cursor links display Later page and offer First page instead of inventing a page number. Counts refer only to the current page.

[The list parser](../../lib/api/customer-payments-schema.ts) extends the existing payment schema with an optional, nullable ISO creation date and validates response cursors. Missing historical dates receive an explicit fallback; malformed supplied dates fail closed. Known purpose labels cover the seven current purposes and existing aliases; unknown values use Payment request.

Manual loading/error states hide old records. A transient background refresh failure retains them with an explicit stale-data notice and retry action. Initial, filtered and later-page empty states have distinct recovery actions. The existing session boundary clears private records and discards late responses after an account change. Staff/Admin/Super Admin access remains outside this customer route.

## Verification and fidelity

The first production build passed **59 browser scenarios**: 36 payments-list cases and 23 shared-navigation regressions. The list tests cover ten widths (320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px), four normal-state Axe scans plus a short-screen keyboard/reduced-motion scan, 44px controls, all six statuses, all seven purposes, linked-record paths without extra reads, exact large amounts, missing/invalid dates, filter and cursor reload/Back/Forward, error recovery, session invalidation and role boundaries. All ten first-pass captures showed no horizontal overflow.

Twenty existing backend payment-policy, checkout-availability and boundary tests passed, as did five frontend resource-lifecycle tests. Full frontend lint, post-build type checking and the first production build/standalone packaging passed. A separately launched initial type check overlapped build regeneration of `.next/types`; its missing-generated-file errors were resolved by the successful post-build check. No source change was needed for that timing issue.

Real browser/API/database checks against isolated `allied_customer_overview_test` returned 12 owned payments in pages of 10 and 2, filtered two processing records, preserved reload/Previous and opened the selected payment detail. Reads verified exact server amounts, newest-first ordering, owner-safe projections and private `no-store` caching. Scope override returned 422, foreign detail 404, Staff/Admin/Super Admin each 403 and anonymous access 401. The browser forwarded requests to real Express responses, performed no mutations and reported no page errors. The acceptance helper exited 0. Synthetic data remained confined to the isolated QA database.

Visual review of the first build led to one further mobile refinement: related links sit beside their purpose instead of consuming a separate full row. The final production build and standalone packaging passed, followed by all **36 payments-list browser scenarios** again, including a strengthened unknown-purpose case using an inherited object-property name and verification that the selected payment detail actually loads. Combined with the 23 shared-navigation cases, there are **59 distinct passing browser scenarios**; repeat runs are not counted twice. Final focused lint and formatting passed.

All ten final responsive captures were inspected, alongside the desktop concept's native 1505×1045 viewport, a scrolled 390px record and initial-empty, filtered-empty, loading, error and retained-stale states. No horizontal overflow, blank page, framework overlay or normal-state console/page error was observed. Computed styles confirmed Quicksand, 30px desktop/27px mobile headings, 48px selects, 14px desktop/16px mobile select text, visible control borders and red focus outlines. Typical final row height is approximately 90px at desktop and 276px at 390px.

| Concept requirement                          | Final evidence and decision                                                                                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clear hierarchy and an ink guidance strip    | Heading, actions, guidance, filters, count, table, paging and support appear in the specified order. Real shell/logo retained.                                         |
| Compact typography and visible controls      | Computed Quicksand sizes, 48px selects, 44px action checks and visible focus treatment match the written specification.                                                |
| Five-column desktop payment context          | Reference/date, purpose/related record, status/note, exact amount/qualification and one detail action remain aligned at 1280–1536px.                                   |
| Labeled mobile records with restrained links | Continuous records replace horizontal table scrolling; purpose and link share a row after refinement, status/amount share a row, and View payment remains full width.  |
| Financial meaning follows server state       | Processing remains unconfirmed even when an attempt says successful; only `SUCCEEDED` labels a confirmed amount. Real API amount and ownership checks pass.            |
| Complete recovery states                     | Inspected loading, initial/filtered empty, failed read and background stale views preserve readable copy and usable recovery controls.                                 |
| Responsive shell and footer                  | Official navigation and existing support utilities remain; scrolled captures verify actions above the mobile utility bar. Pagination and footer stay in document flow. |

Intentional artwork corrections remain those recorded before implementation: real logo/shell, supported links, NGN values and actual dates; no generated trademark, slogan, USD row, provider controls or overflow menus. Narrow filters stack for readable labels and touch targets. Native-size comparison establishes the specified hierarchy and density; no unresolved mismatch remains against the written specification.

Browser plugin not available; the established fallback is Playwright with installed Microsoft Edge. External helpers, screenshots and logs use `C:/Users/PC/.codex/customer-payments-oct-*`.

The initial implementation review corrected accidentally renamed CSS border properties before browser verification. The page uses a unique `paylist-` class prefix to avoid changing the separately accepted payment detail styles. The shared dashboard-shell change only suppresses the inherited breadcrumb on this exact route.

| QA check                           | Result                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Page identity / meaningful content | Pass: `/dashboard/payments`, Your payments title and rendered records.                                                           |
| Framework overlay / console health | Pass: no overlay or normal-state console/page errors in the final computed checks.                                               |
| Responsive / accessibility         | Pass: ten widths, five list Axe scans, short-screen keyboard controls and 44px actions.                                          |
| Interaction loop                   | Pass: filter → page-size change → reload → Back/Forward; Next → reload → Previous; retry; selected detail; account invalidation. |
| Actual integration                 | Pass: isolated PostgreSQL + Express + browser reads, owned pagination, exact amounts and denial cases.                           |

Key evidence files use the external prefix above: `browser.log` (59 cases), `browser-final.log` (36 final cases), `backend.log` (20 tests), `resource.log` (five tests), `real.log` (exit-0 real acceptance), `types.log`, `focused-lint.log`, `build-final.log`, `captures-final.log`, `computed.log`, `after-{width}.png`, `native-viewport.png`, `mobile-record.png` and `state-{state}-viewport.png`. Commands used the existing `npm run build`, `npm run lint`, `npm run typecheck`, focused `npx vitest run` and `npx playwright test`; external capture helpers used installed Playwright/Edge against `http://localhost:3001`.

## Remaining scope

No new backend gap was required for this list. This report does not establish deployment readiness or re-certify provider settlement and receipt mutations. Deployment checks remain under REL-03 in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). Browser coverage is local Edge; no physical-device or Safari acceptance is claimed. Next: customer invoices list `/dashboard/invoices`. Other customer, staff, Admin and Super Admin routes remain open; the full application goal remains active.
