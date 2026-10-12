# Customer order aftercare — design specification

Prepared 12 October 2026 before production changes. This is the next page gate, not an accepted implementation. Scope: `/dashboard/orders/[orderId]/aftercare`; existing staff review and fulfillment evidence keep their separate route and behavior.

## Retained concepts and baseline

- [Desktop](desktop.png): complete order context, selected-products form and history layout.
- [Mobile and states](mobile-states.png): mobile sequence, confirmation, uncertain outcome, duplicate success, decision detail, empty/error/loading states.
- Baseline captures: `C:/Users/PC/.codex/customer-aftercare-oct-before-{390,768,1280,1440}.png`. The baseline is excessively tall, places history below the form, and uses generic entity breadcrumbs. Desktop and mobile were inspected before concepting.

Browser/IAB is unavailable in this session. Use Playwright with Edge for actual rendering and interaction checks. Concepts are design references; example records never enter production data.

## Extracted specification

| Element      | Implementation requirement                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell        | Preserve existing logo, navigation, search, account controls and support dock.                                                                                                                             |
| Breadcrumb   | Overview → Orders → actual order number → Aftercare. Collapse middle context on narrow screens while retaining the order link elsewhere.                                                                   |
| Heading      | Existing page title, 28px desktop / 24px mobile, Quicksand; outlined refresh button beside heading where space permits.                                                                                    |
| Context band | Ink background, 8px radius, 20–24px padding. Actual order number/status, branch, fulfillment method and server total. Responsive wrapping with readable labels.                                            |
| Main layout  | Two columns approximately 55/45 with 24px gap; one column below 1100px. Form first, history second. White panels, thin cool border, restrained shadow, no nested card stack.                               |
| Form         | Compact 19–20px title, 14px labels/body. Paired request type/scope at desktop; stacked on small mobile. Visible 44px controls, compact selected-product rows, 105–120px textarea, 10–2,000 character hint. |
| History      | Ruled records; actual kind/status/date, explanation, product quantities and all available customer-safe decision fields. Latest 100 explicitly bounded, no invented pagination/total.                      |
| States       | Skeleton with announced loading, truthful empty/failure/stale messaging, preserved duplicate result, reviewed submission and persistent unknown-outcome recovery.                                          |
| Controls     | Existing button/select/focus styles, Lucide arrows/refresh, 16px icons, red primary action. Shared native confirmation dialog preserves established focus/cancel/busy behavior.                            |
| Responsive   | 360–1920px, short landscape, no overflow; reserve space for fixed mobile Help/WhatsApp dock.                                                                                                               |

## Explicit corrections to generated examples

Use the real Allied logo and shell instead of generated branding, tagline, invented account name and mobile product-search placeholder. Keep neutral status treatments rather than generated green success pills. Do not display a collection date: the order DTO does not supply a scheduled collection date. Render actual API amounts, products, dates, statuses and decision notes; the concept's sample fee/decision must never become business rules. Preserve shared dialog labels (`Go back`, `Send order request`) and safe-error copy. Use the complete non-rejected-request explanation, including approved requests; generated wording about only active requests would be incorrect.

## Functional invariants

Whole-order returns retain `POST /customers/orders/:id/returns`; selected products and cancellations retain `POST /customers/orders/:id/aftercare`. Backend ownership, strict schemas, quantity rules and non-rejected same-kind duplicate behavior remain authoritative. Approval alone does not cancel orders, change stock or confirm refund payment. No frontend eligibility window is invented.

Before sending, recheck the customer session and fresh owned order/history. Stale or failed reads block submission, including an already-open review. Unknown outcomes survive reload in an account/order-scoped marker. Recovery requires an explicit successful refresh of both reads and acknowledgement; background refresh alone cannot unlock another submission. Never replay automatically. Preserve account/order drafts and clear them only on a validated successful result. Abort reads/writes on owner/route changes. A request marker is not backend idempotency.

## Acceptance still required

Implement and test valid whole/selected requests, quantities, cancellation, duplicate approved/requested responses, failed reads, stale reviews, CSRF/session changes, rate limits, storage failure, lost responses/reload/manual reconciliation, private decision fields, zero amounts and long content. Verify actual API/database persistence and permissions in an isolated environment. Run appropriate static/build/regression checks and native-size concept/render comparisons with a five-point fidelity ledger. This specification does not close the page gate.
