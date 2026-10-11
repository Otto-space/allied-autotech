# Cart and checkout

Date: 8 October 2026

Status: complete for the local `/dashboard/cart` page and checkout-creation gate. Final checks below passed. The full application and deployment remain open scopes.

## Audit and scope

The previous cart used large text-only rows despite product image data being available. Checkout submitted directly from the editor and retained only the resulting order ID. Quantity forms shared a draft identifier. The existing backend already supported cart mutation, idempotent checkout, delivery policies, server totals and promotion preview.

Baselines were captured at 390, 768, 1280 and 1440px before three [fresh design concepts](cart-oct-concepts/README.md) were generated and inspected. The implementation retains the existing dashboard shell, route and backend contracts.

| Operation            | Existing contract, relative to `/api/v1`                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read cart            | `GET /customers/cart`: real products, images, quantities, unit prices, line subtotals and subtotal.                                                                                                        |
| Edit/remove items    | `PUT /customers/cart/items/{productId}` replaces the quantity; `DELETE` removes that product. Customer ownership, CSRF and stock validation remain on the server.                                          |
| Clear cart           | `DELETE /customers/cart`, after the existing mutation-review dialog and a fresh read comparing the reviewed contents.                                                                                      |
| Branch choices       | `GET /public/branches` with bounded `limit` and cursor pagination.                                                                                                                                         |
| Fulfilment           | `GET /public/fulfillment-options`: ordering availability, collection and approved delivery zones/fees.                                                                                                     |
| Promotion estimate   | `POST /customers/promotions/preview`: a non-reserving estimate; the order determines the applied discount.                                                                                                 |
| Create/recover order | `POST /customers/orders/checkout` with CSRF and `Idempotency-Key`. The backend validates branch stock, recalculates all amounts, reserves stock, creates the invoice/order and clears the cart atomically. |
| Follow-up            | Existing customer-owned order detail and payment route, using the validated returned order ID.                                                                                                             |

Sources: [order service](../../../backend/src/modules/orders/orders.service.ts), [order schemas](../../../backend/src/modules/orders/orders.schemas.ts), [cart schemas](../../../backend/src/modules/catalog/catalog.schemas.ts), [fulfilment policy](../../../backend/src/modules/policies/policies.service.ts), [frontend response schemas](../../lib/api/commerce-schemas.ts).

## Implementation

The desktop layout places compact cart rows beside checkout; smaller screens stack them. Real product thumbnails have a truthful unavailable-image fallback. Each quantity editor has independent state, integer validation and no reusable browser draft. Unsaved quantities block checkout until their update succeeds. The subtotal remains server supplied.

Collection/delivery controls use native radios with branded selected states. Delivery fields retain the real contract limits, associated validation messages, approved city/state and a 500-character address counter. Branch choices can traverse all server pages and retain an explicitly selected option. Empty branches have a recoverable explanation. Promotions remain optional estimates.

Review does not write an order. It shows fulfilment, branch, recipient/address, promotion code and the known subtotal/delivery fee without inventing a payable total. Editing preserves entered details. Changed delivery policy/fee or loaded cart contents invalidate the review. Before a new checkout submission, a fresh cart read detects changes since review; failed reads do not send an order. This preflight is not an atomic cart-version guarantee: the backend still checks current inventory and prices in its transaction, and the customer reviews the authoritative order total before payment.

The confirmation uses the validated full order response: reference, subtotal, discount, delivery, optional tax, total and Lagos-time payment deadline. Replayed paid/cancelled orders show their actual state. The copy control retains its manual fallback. Creating an order never initiates payment.

An uncertain checkout locks editing and offers only recovery with the original request body and key, or navigation to orders. Recovery bypasses the new-submission cart preflight because the original successful transaction may already have cleared the cart. Unknown cart mutations remain paused after refresh. Pending requests are aborted on unmount and their late responses cannot publish success notices. Session changes clear the saved delivery draft; successful creation clears it through the native form submission lifecycle.

## Verification evidence

Acceptance evidence recorded for the final production code:

- Production build and standalone packaging passed (`cart-oct-build-accepted.log`). Full frontend lint passed; the final component/test edits passed scoped lint, and separate TypeScript checking passed. Changed source/test formatting and documentation-link checks passed. Final standalone preview remains available on local port 3001.
- All 52 browser scenarios passed in the final consolidated run (`cart-oct-browser-complete.log`). This includes 13 cart-maintenance/shared regressions and 39 delivery/checkout scenarios. No test is counted twice for a rerun.
- Editor, review and receipt each passed scoped WCAG A/AA scans and overflow checks at 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px. Full-page clear-cart accessibility checks also passed at 320/1280px. Additional checks cover 390x568 and 844x390, long addresses, keyboard focus, manual-copy fallback, two independent quantity editors, actual image-response rendering, branch pagination, promotions, invalid details, unknown and malformed outcomes, known rejections, changed cart/delivery data, unavailable branches, session clearing and late-response suppression.
- All three concepts and final desktop/mobile collection, delivery, review and receipt captures were inspected directly. Dedicated full-layout captures use increased viewport height to avoid stitched fixed-navigation artifacts; the actual responsive checks use 960px or the stated short viewport heights.

Integration and regression results:

- The final real API run (`cart-oct-real-accepted.log`) verified isolated API/database collection and delivery orders with matching server totals, two persisted orders, four reserved units and an empty cart after each creation. Same-key retries returned the same order. Changed-body retries returned 409; another customer's order read returned 404; missing CSRF returned 403 and anonymous cart access returned 401. No page errors were recorded.
- Fifteen existing backend commerce security/route-boundary tests passed; eight frontend form-draft tests passed.
- The initial browser batches identified a saved delivery draft returning after a session-change event, plus insufficient inherited primary-button contrast during a transition. Both were corrected. An older radio assertion was updated to inspect the now-hidden review editor. A later fixture incorrectly treated any second request as a replay, even with a new key; it now recognizes an actual repeated key. Production replay behavior was already correct.
- The real API harness was corrected to follow the current CSRF token, expect the existing 201 replay status and supply UTC policy timestamps. These were harness corrections, not backend modifications.

The API run used synthetic accounts, products, inventory and policy versions in `allied_vehicles_qa` on PostgreSQL 55439, API 5012 and frontend 3001. Policy setup was confined to that isolated database. It does not approve actual delivery coverage, certify deployed accounting policy, or verify a payment provider. External providers remained disabled.

## Fidelity ledger

| Check               | Concept/baseline                                                                            | Implementation and verification                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop hierarchy   | Concept 01 separates products from checkout; the baseline placed checkout below a wide row. | Two columns from 1200px, with contained sections and controlled spacing. The final 1440px capture matches the concept hierarchy; the current dashboard shell remains intact.               |
| Mobile cart density | Baseline quantity controls stacked into a tall row.                                         | Thumbnail/title, subtotal, then quantity/update/remove on one compact control row; 44px controls retained; final 320/390px captures show no overlap or horizontal overflow.                |
| Media               | Concept 01 includes product thumbnails.                                                     | Existing safe public-image component renders API media; missing/broken images use the explicit fallback. Synthetic media-response coverage is separate from deployed storage verification. |
| Input design        | Concept 02 uses visible borders and selected fulfilment tiles.                              | Scoped `#82939F` borders, red selection/focus, mobile 16px inputs and single-column recipient fields.                                                                                      |
| Review integrity    | Concept 03 separates review from authoritative confirmation.                                | No write on review; fresh cart comparison and delivery-change checks precede creation. Only the resulting order supplies the payable total.                                                |
| Brand and contrast  | Generated art includes invented logos, slogans and example tax figures.                     | Existing brand/fonts retained; sample claims omitted; primary red darkened within the brand family for text contrast.                                                                      |
| Confirmation        | Concept 03 shows an order reference and money breakdown.                                    | Server reference, copy fallback, exact string-money formatting, actual replay state and Lagos deadline.                                                                                    |

## Remaining boundaries

No mandatory new backend endpoint was identified for this page. Deployed media, actual delivery policy, accounting setup and payment-provider acceptance remain release dependencies in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md).

Order detail/payment, invoice and receipt design/download/sharing, saved-item pages, dashboard shells and any cart drawer remain separate gates. The current mobile cart is usable directly; no drawer is claimed in this milestone. Secure sharing must not expose private document URLs.

## Changed files

- `app/components/cart-panel.tsx`
- `app/components/cart-checkout.tsx`
- `app/components/cart-checkout.css`
- `tests/e2e/cart-maintenance.spec.ts`
- `tests/e2e/delivery-checkout.spec.ts`
- This report, concept notes and the milestone/backend-gap registers.

Temporary QA scripts, logs and captures are kept outside the repository under `C:/Users/PC/.codex/` with the `cart-oct-` prefix. No backend source or schema was changed for this gate. The existing notification component supplies the confirmation toast; its application-wide redesign remains part of the broader goal.
