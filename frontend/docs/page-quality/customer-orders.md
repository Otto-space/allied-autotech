# Customer orders list

Status: **locally accepted, 8 October 2026**. Route `/dashboard/orders`, customer role only. Thirty-third completed expanded milestone. This report covers the list; order detail has its own [accepted gate](order-detail.md).

## Audit and implementation

Baseline inspection at 390, 768, 1280 and 1440px found oversized standalone rows, duplicate detail links, no item or delivery context, local filters lost on reload and a non-semantic inherited breadcrumb. Failed refreshes could retain old rows without a clear current-data boundary. The local preview initially returned a server error; rebuilding and restarting the existing standalone preview restored the baseline before design work.

Three fresh [desktop, mobile and state concepts](customer-orders-oct-concepts/README.md) preceded production edits. The implemented page uses one compact desktop table and labeled mobile records. Order numbers, creation dates, item snapshots and quantities, collection branch or delivery city/state, status and exact server totals are visible. Two item lines and a remaining-line count keep long orders compact; the detail page retains the full list. Full delivery street addresses are unnecessary on this list and are not rendered. `paidAt` supplies the payment-record label; order status alone never implies payment.

Browse parts opens the shop; Refresh reloads the list; each order has one View order link with an order-specific accessible name. Contact support opens the existing customer route. The list introduces no mutation, cancellation, payment initialization or bulk action.

## API, ownership and recovery

Existing `GET /customers/orders` requires authentication and the customer role, derives customer scope from the actor, and accepts only six supported statuses, a UUID cursor and a bounded limit. Repository ordering is creation time descending, then ID descending. Item names/prices are order snapshots. Draft invoices are suppressed by the customer projection. No order search, selectable sorting, global total or fulfillment/payment filter exists; the UI does not fabricate those controls.

[OrdersPanel](../../app/components/orders-panel.tsx) reuses the resource loader, exact money formatter and Lagos date formatter. [Query normalization](../../lib/customer-order-query.ts) preserves status, limit, cursor and a bounded UI-only previous-page trail across reload and Back/Forward. The API never receives that trail or unrecognized fields. Invalid recognized values produce safe defaults and an explanation. Filter changes reset paging. Unknown traversal uses Later page and First page, rather than inventing an absolute page number.

[The list parser](../../lib/api/customer-orders-schema.ts) retains the existing order contract while permitting the nullable historical branch relation in Prisma and the actual repository projection. A missing branch receives an explicit fallback instead of rejecting every order. Invalid records or response cursors fail closed. This is frontend alignment with an existing contract, not a backend change.

Loading and failed manual refresh hide previous records. A transient background failure retains them with an explicit stale-data notice. Initial, filtered and later-page empty states have distinct recovery actions. Session invalidation discards customer records and ignores late responses. Staff, Admin and Super Admin do not mount the customer list or request its data.

[Scoped styles](../../app/dashboard/orders/orders.css) provide visible control borders, red focus, compact rows and responsive labels. The shared shell suppresses its old breadcrumb only on this exact route, which supplies a semantic ordered breadcrumb with `aria-current`. Existing shell navigation and Help/WhatsApp utilities remain.

## Fidelity ledger

| Comparison        | Result and correction                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hierarchy         | Breadcrumb, heading/actions, ink guidance, filters, page count, records and pagination follow the concept.                                                         |
| Copy              | Heading, subtitle, guidance and functional labels match the written concept; real data and API errors replace generated examples.                                  |
| Brand             | Official logo, existing role navigation and Quicksand preserved. No generated account name, alternate logo, USD amount or unsupported Shipped status adopted.      |
| Table density     | Initial record paragraphs made rows too tall. Tightened paragraph margins, line-height and vertical cell padding; stronger order numbers distinguish identity.     |
| Controls          | Explicit scoped borders/focus avoid shared-style overrides. Desktop select text is 14px and mobile 16px; labels 13px. Visible actions retain at least 44px height. |
| Mobile            | Identity and fulfillment span each record; status/payment share a row; the detail link spans its own touch row. No horizontal table scroll.                        |
| State composition | Centered package icons, row-shaped skeletons, distinct empty states, retryable read errors and visible background staleness follow the state concept.              |
| Navigation        | One semantic breadcrumb and one order-detail action per row. Pagination preserves URL traversal without claiming a global total.                                   |

Generated artwork is a design reference only. The existing shell, approved brand mark, real data and documented accessibility refinements take precedence over generated inaccuracies. `view_image` comparison of the saved desktop/mobile concepts and final browser captures verified the ledger above. The desktop was also checked at the generated concept's native 1505×1045 viewport, and scrolled 390px state screenshots verified readable empty/error/filtered/stale content above the support utility bar. Final record height reduced from approximately 136px to 113px on desktop and 372px to 341px on mobile. No material mismatch remains against the written specification; pagination/footer remain in normal document flow after the records.

## Verification

The first production-build run passed **56 browser scenarios**: 33 customer-orders checks and 23 shared-navigation regressions. Tests cover ten widths (320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1536px), five page accessibility scans including a 390×480 keyboard/reduced-motion state, 44px controls, filter/limit/cursor persistence, Back/Forward, invalid queries, missing/long fields, exact large totals, malformed data, manual/background error recovery, loading/empty states, detail navigation, role denial and cross-tab session invalidation.

The final production build passed **35 browser scenarios**: all 33 customer-orders cases plus the two existing account-flow regressions for failed reads and account switching. Together with the 23 shared-navigation cases from the first run, this establishes **58 distinct passing browser scenarios**, without counting repeated runs twice. All ten final widths showed no horizontal overflow. Final state and native-size captures were also regenerated and visually inspected.

Fifteen existing backend commerce policy/boundary tests and five frontend resource lifecycle tests passed. Full frontend lint and type checks, focused final lint/format, final production build and standalone packaging passed.

Final real API/database/browser checks against isolated `allied_customer_overview_test` returned 12 owned orders in pages of 10 and 2, filtered two confirmed records, preserved reload/Previous behavior, rendered item snapshots and exact totals, and verified newest-first ordering and private `no-store` caching. Ownership override returned 422, foreign detail 404, Staff/Admin/Super Admin access each returned 403 and anonymous access returned 401. Browser API requests were forwarded to actual Express responses; no response fixture supplied this evidence. The acceptance process completed with exit 0 and no browser page errors. The expanded fixture initially hit the existing single–Super Admin constraint; reusing the isolated QA account resolved fixture setup without changing that invariant.

Browser tools were unavailable, so Playwright used installed Microsoft Edge. External helpers, captures and logs are under `C:/Users/PC/.codex/customer-orders-oct-*`; concept assets remain in the repository. Synthetic accounts and orders are confined to fixtures and the isolated QA database.

Key evidence files: `browser.log` (56 first-run cases), `browser-final.log` (35 final-build cases), `real-accepted.log`, `build-accepted.log`, `lint.log`, `focused-lint.log`, `types.log`, `backend-tests.log`, `unit.log`, `after-{width}.png`, `native-viewport.png`, and `state-{state}-viewport.png`, all with that external filename prefix.

## Remaining scope

No new backend gap is required for this list. Deployment/session/provider verification remains under REL-03 in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). This gate does not establish production readiness or re-certify order/payment mutations.

Next: customer payments list `/dashboard/payments`. Other customer, staff, Admin and Super Admin routes remain open; the full application goal remains active.
