# Customer invoices list

Status: **local acceptance passed, 9 October 2026**. Route `/dashboard/invoices`, customer role only. This is the thirty-fifth expanded milestone. The list is a separate gate from [invoice detail and private documents](invoice-detail.md).

## Audit and implementation

Baseline inspection at 390, 768, 1280 and 1440px found a large, sparse list with raw status labels, absent source/due-date/credit context, local filters lost on reload and a non-semantic inherited breadcrumb. Four image-generation calls produced three retained [desktop, corrected mobile and state concepts](customer-invoices-oct-concepts/README.md) before production changes. The first mobile artwork required correction of an invented search function and pale guidance banner.

The [invoices panel](../../app/components/invoices-panel.tsx) now uses a compact desktop table and continuous labeled mobile records. References, real issuance or creation dates, due dates, related source references and links, server status and exact server totals are visible. A positive deposit credit is described beneath the total; it is never deducted a second time. Missing source or due-date context receives an explicit fallback. The list creates no invoice, payment or document mutation, and makes no per-row source or document request.

Refresh reloads the list; View payments and Contact support open existing routes. View invoice hands off to the accepted detail workflow for document downloads/sharing and any permitted payment request. Drafts, global financial totals, overdue classifications and unsupported search/provider filters are not exposed.

## API, ownership and recovery

`GET /customers/invoices` requires an authenticated customer, derives scope from the actor and accepts Issued/Paid/Void status, UUID cursor and bounded limit. The repository excludes drafts and orders by creation time descending, then ID descending. Source relations already supply order/transaction references or the booking ID; amounts are server snapshots. No new endpoint, field, permission or migration is needed for this list.

[Query normalization](../../lib/customer-invoice-query.ts) preserves validated status, page size, cursor and bounded UI-only previous-page history across reload and Back/Forward. It strips unknown query fields and `_trail` from API requests, resets paging when filters change and gives direct cursor links Later page / First page recovery. Counts describe only the current page.

[The customer-list parser](../../lib/api/customer-invoices-schema.ts) narrows the existing invoice schema to the three customer-visible states, validates displayed ISO dates and requires a UUID response cursor. A malformed or draft record fails closed. Invoice status alone controls the Paid label; a payment record or `paidAt` value does not promote an issued invoice to Paid.

Manual loading and read failure hide previous rows; transient background failure retains rows with an explicit stale notice. Initial, filtered and cursor-page empty states have different recovery actions. Existing session invalidation clears private data and discards late responses. Exact-route shell breadcrumb suppression leaves the other dashboard routes intact.

## Verification

| Check                        | Result and scope                                                                                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser                      | All 60 scenarios passed: 37 invoice-list cases and 23 shared dashboard-navigation regressions against the production preview.                                                                                    |
| Responsive                   | Screenshots captured and visually inspected at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. No horizontal overflow. Short-screen keyboard and reduced-motion checks passed.                        |
| Accessibility                | Automated checks at four viewport widths and a short mobile viewport passed; labeled controls, semantic breadcrumb, focus and minimum action targets are covered.                                                |
| List behavior                | All supported statuses, URL normalization, reload/Back/Forward, cursor traversal, direct-cursor recovery, reset, loading, empty/error/stale states and detail/source links passed.                               |
| Financial correctness        | Exact server totals, credit without a second deduction, authoritative status, invalid dates, draft rejection, missing source/issuance and long references passed. No per-row document/source reads or mutations. |
| Identity                     | Customer session changes discard private rows and late responses; privileged roles cannot read the customer list.                                                                                                |
| Backend/resource regressions | 24 focused financial-document and backend-boundary tests, plus five frontend resource-lifecycle tests, passed.                                                                                                   |
| Static/build                 | Production build and standalone preparation, full frontend lint, post-build typecheck, focused lint and formatting checks passed.                                                                                |

The real browser/API/PostgreSQL run used the isolated `allied_customer_overview_test` database and actual Express responses. Twelve owned invoices traversed in pages of 10 and 2; the Void filter returned two records. Reload, Previous and detail navigation worked. Assertions verified exact totals, newest-first ordering, private cache headers and a bounded customer projection. Scope override returned 422; foreign detail returned 404; Staff/Admin/Super Admin returned 403; anonymous access returned 401. A draft remained absent from the list and inaccessible by detail (404); the draft filter returned 422. No mutations or browser page errors occurred. This list check does not repeat the separate invoice-detail PDF-download acceptance.

## Concept fidelity

The three retained concepts were compared with the final render, including a native 1505×1045 desktop viewport, a scrolled mobile record and loading, initial empty, filtered empty, failed-read and stale-data states.

| Design point            | Final result                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hierarchy and identity  | Official shell/logo, Quicksand headings, restrained red actions and semantic Overview / Invoices breadcrumb match the written specification.                                                                                                           |
| Guidance                | The ink banner retains the FileText icon, title and document guidance; the rejected pale mobile variant was not used.                                                                                                                                  |
| Desktop density         | A single five-column table groups reference/dates, source, status, total and detail action; rows remain compact with clear separators.                                                                                                                 |
| Mobile layout           | Continuous labeled records preserve source links, side-by-side status/amount and a full-width detail action. Long values wrap without page overflow.                                                                                                   |
| Controls and typography | Computed styles confirm 30/27px headings, 14/16px select text and 48px select height. Focus is visible and actions meet the 44px target.                                                                                                               |
| States                  | Skeletons preserve row anatomy; empty/error recovery is explicit; retained background data carries a stale notice. No decorative board legends enter the interface.                                                                                    |
| Contract corrections    | Neutral status badges replace artwork tints; page counts omit unsupported global totals. The credited example is a service-booking invoice because database rules disallow credits on order invoices. Amounts and source labels always follow the API. |

The browser plugin was unavailable, so verification used installed Microsoft Edge through Playwright against `http://localhost:3001`. External helpers, captures and logs use `C:/Users/PC/.codex/customer-invoices-oct-*`, including `browser.log`, `real.log`, `backend.log`, `resource.log`, `build.log`, `lint.log`, `types.log`, `captures.log`, `states.log` and `computed.log`. Concept assets and this acceptance record remain in the repository.

## Remaining scope

Next: customer garage/vehicles list `/dashboard/vehicles`, with its own audit and page gate. The accepted invoice-detail gate retains its document/settlement scope. Deployed payment/document/session verification remains open under REL-03 in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). Other customer, staff, Admin and Super Admin pages remain open; the full application goal remains active.
