# Customer order detail and payment-request handoff

Date: 8 October 2026. Route: `/dashboard/orders/[orderId]`. Scope: customer order details, payment-request preparation and handoff, cancellation review. Local page acceptance is complete. The dedicated payment/provider page remains a separate next gate.

## Audit and implementation

The previous page placed identity, delivery, items, totals and actions in one long section. It embedded the full payment component after creating an intent, lacked a selectable order reference and invoice shortcut, and did not abort its mutations when the customer session or route closed.

The page now separates order identity, historical item rows, server totals, payment, fulfilment and documents/help. Desktop uses two independent columns, while mobile presents totals and payment before items. A resource-specific breadcrumb, copyable order number, actual invoice link and bounded cancellation dialog follow the existing brand and account shell. Collection names the recorded handling branch; missing delivery or invoice information has an explicit fallback.

Existing customer role checks and backend contracts remain authoritative. No backend implementation or contract change was required for this gate. Operational order screens and the shared delivery component retain their own scope.

## Transaction behavior

- Payment review is read-only. It checks the current order and traverses the bounded payment history before offering creation; there is no order filter in the current payment-list contract. Repeated cursors, duplicate payment IDs, incomplete history and failed reads stop preparation.
- Confirmation rechecks the reviewed order version, amount, status, payment deadline and recorded payment state, then checks history again. An existing blocking payment leads to its detail page without another creation write. These reads are not an atomic guarantee; the backend remains responsible for locking, competing-payment checks and final amounts.
- Creation uses the existing CSRF-protected, idempotent order-payment contract and validates the returned payment's identity, purpose, target and positive amount. An uncertain response locks new actions and offers recovery with the original body/key, including after a deadline or order-state change. No provider initialization or charge is triggered from this page.
- Payment eligibility supports pending and confirmed unpaid orders, following the backend. Invalid, elapsed and zero-value payment conditions fail closed. A timer updates the deadline state while a review is open, and the action checks again before creation.
- Cancellation captures the reviewed version and validates its reason. It distinguishes immediate cancellation from a request recorded for staff review. Unknown outcomes retain the existing lock after refresh; no refund success is inferred.
- Requests are aborted on unmount/session change and checked again after awaits. Route state is keyed by order ID. Session changes clear private review state and reset the cancellation draft. Successful cancellation clears the draft and returns focus to the page heading.

## Concepts and visual corrections

Three [fresh concepts](order-oct-concepts/README.md) preceded implementation. Baseline screenshots covered 390, 768, 1280 and 1440px, including mobile cancellation. Native mobile and desktop final screenshots were inspected against the concepts.

| Check                   | Concept / baseline evidence                           | Implementation and correction                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop composition     | Separate items/fulfilment and totals/payment columns  | Independent columns replaced the first implementation's shared grid rows, removing the gap below the shorter summary.                                                                           |
| Mobile hierarchy        | Total and payment before item details                 | DOM and visual order agree on mobile; desktop positions commerce beside item content.                                                                                                           |
| Order identity          | Clear reference, status, branch and copy              | Actual order number appears in the breadcrumb and heading; denied clipboard access exposes a selectable reference.                                                                              |
| Historical item content | Concept illustrated product images                    | The API has no historical image projection. Package icons, real names, SKUs, quantities and recorded prices are used without invented product media.                                            |
| Server totals           | Distinct navy amount panel                            | All amounts, including tax and delivery, come from the order. No generated tax percentage or client-calculated total is displayed.                                                              |
| Payment review          | Reviewed amount, then a payment reference and handoff | Actual target-validated payment links replace the embedded provider component; review itself sends no mutation.                                                                                 |
| Cancellation            | Compact reason dialog and explicit confirmation       | Inspection caught shared mobile flex rules pushing the confirmation button sideways. A scoped grid fixes the action area; tests now measure internal overflow and every button's bounds/height. |
| Error placement         | Readable, contextual feedback                         | A hidden dialog initially duplicated payment error text. Dialog errors now render only while it is open; background messages remain outside it.                                                 |
| Fulfilment facts        | Delivery recipient and address                        | Actual stored delivery fields are displayed; no unsupported edit action, invented shipping timeline or assumed branch address was added.                                                        |

## Verification evidence

Browser plugin not available; verification uses the repository's Playwright setup with Microsoft Edge against `http://localhost:3001`. The flow is order detail → read-only payment review → intent receipt and dedicated payment link; cancellation is separately reviewed and verified.

Final acceptance evidence:

- All 36 order-quality browser scenarios have passing evidence: 35 passed in the final combined batch, then the added session-draft scenario and strengthened cancellation focus/draft assertions passed in a focused run. Coverage includes ten widths (320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px), full-page Axe scans of order/review/receipt and dialog states, short portrait/landscape screens, long content, role denial, session change, malformed reads, pagination, deadline expiry and unknown-outcome recovery.
- Three existing regressions passed again in the final combined 38-scenario batch: delivery-checkout follow-up, cancellation escalating to staff review, and uncertain cancellation retaining its lock after refresh.
- Twelve new unit tests passed for deadline boundaries, payment identity, review snapshots, blocking attempts and complete/invalid/interrupted history traversal.
- The real isolated API/database flow passed: one collection order, one payment for the server amount (`2687500` kobo), same-key replay returning that payment, reload/history reuse without another intent, confirmed cancellation and release of reserved stock. Other-customer order/payment reads returned 404; anonymous access returned 401; missing-CSRF creation returned 403. No page errors were recorded. External payment providers were disabled.

The final production build and standalone packaging, full frontend lint, separate TypeScript check and formatting passed. The last test-only assertions also passed scoped lint. The mobile dialog correction passed internal-overflow and button-bound/height checks at all ten widths; each action is at least 44px high. These are local checks, not staging provider certification or whole-application acceptance.

| Browser check                        | Result                          | Evidence                                                                                                             |
| ------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Page identity and meaningful content | Pass                            | Correct route/title, actual order heading, totals and records in controlled and real-API flows.                      |
| Framework overlay and runtime errors | Pass                            | Inspected desktop/mobile captures; real run and captures recorded no page errors.                                    |
| Responsive layout and accessibility  | Pass                            | Ten widths, full-page Axe checks, short screens and dialog internal bounds.                                          |
| Interaction proof                    | Pass                            | Read-only review, one creation, receipt link, same-key replay, history reuse, cancellation and server stock release. |
| Role and session boundaries          | Pass                            | Anonymous and work-role denial; private state/draft clearing; cross-customer API denial.                             |
| Concept fidelity                     | Pass with documented deviations | Three concepts compared with final order, review, receipt and cancellation captures; corrections listed above.       |

## Files and artifacts

Implementation: [order component](../../app/components/order-detail.tsx), [scoped styles](../../app/components/order-detail.css), [payment guards/history helper](../../lib/api/order-payment.ts), [keyed route](../../app/dashboard/orders/[orderId]/page.tsx).

Tests: [browser scenarios](../../tests/e2e/order-detail-quality.spec.ts), [unit boundaries](../../tests/unit/order-payment.test.ts).

QA artifacts remain outside the repository under `C:/Users/PC/.codex/`: `order-oct-before-{width}.png`, `order-oct-after-{390,1440}.png`, `order-oct-review-{390,1440}.png`, `order-oct-cancel-{390,1440}.png`, `order-oct-receipt-{390,1440}.png`, `order-oct-first-viewport-{390,1440}.png`, `order-oct-real-payment.png`, `order-oct-real.log`, `order-oct-browser-accepted.log`, `order-oct-draft-checks.log`, `order-oct-regressions.log`, `order-oct-build-accepted.log`, `order-oct-lint.log` and `order-oct-types.log`.

## Remaining scope

The dedicated payment page, provider visibility and initialization, invoice/receipt download and sharing, saved items and remaining role/account dashboards need their own gates. Payment history is currently bounded to 100 pages of 100 records and fails closed if it cannot be fully checked; a target-filtered history endpoint would be a separate optimization, not a prerequisite for the current contract. No paid receipt, refund completion or deployed provider readiness is claimed.
