# Product detail quality milestone

Route: `/parts/[productId]`  
Status: complete; local acceptance passed, 30 September 2026.  
Scope: Product detail only. Service detail has not started.

## Audit and design

Baseline browser captures at 390, 768, 1280 and 1440px showed a nearly invisible quantity input, excessive gallery space before the mobile identity, incomplete breadcrumbs, weak purchase hierarchy and omitted brand/part-number fields. Existing server validation, metadata, real cart/favourite actions and session-change protection were retained.

The [three coordinated concepts](product-detail-concepts/README.md) were generated, saved and inspected before code. The page now has semantic Home → Shop → product breadcrumbs; an early mobile name/price; a contained gallery with expanded viewing; a compact white purchase panel; a navy assistance band; open information/compatibility columns; and bounded related-product reads. Forms use Quicksand, strong borders, 44–46px controls and visible focus states. No password input is present.

## Backend contract and integration

Read-only audit covered the catalogue router, schemas, service, repository and controller, plus existing frontend schemas/client/session utilities.

| Endpoint                                              | Behavior used                                                                                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /public/catalog/products/{productId}`            | Public active product/category, ordered safe image projections, brand/SKU/part number, exact NGN kobo prices, compatibility and active-branch stock booleans. UUID and returned identity validated.                          |
| `GET /public/catalog/products?categoryId=...&limit=3` | Bounded related read; exclude the current product, require matching category, show at most two. Independent loading, failure and empty states.                                                                               |
| `GET /auth/session`                                   | Optional session check before a customer mutation; anonymous visitors get a return link, operational roles get customer-account guidance.                                                                                    |
| `GET /auth/csrf`                                      | Existing mutation client obtains and sends CSRF protection.                                                                                                                                                                  |
| `PUT /customers/cart/items/{productId}`               | `{ quantity }`, integer 1–1000; replaces the total quantity, does not increment or reserve it. Backend validates actual availability. Response cart must contain the matching product and requested quantity before success. |
| `PUT /customers/favourites/{productId}`               | Empty object body; customer only. Returned product identity is checked. Confirmation links to `/dashboard/saved`.                                                                                                            |

The API exposes availability booleans, not a public stock quantity, so the frontend does not invent a maximum stock figure. Cart/favourite writes retain duplicate guards, abort-on-account-change and private state clearing. Unknown outcomes tell the user to check the account; no mutation is automatically replayed. Quantity errors retain the value and are linked to the input. Success focuses a confirmation heading. The saved-heart state represents a confirmed action on this visit, not an invented initial account read.

No new backend endpoint is required for this milestone. Existing deployment/media verification remains in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). Product enquiry links use the working Contact form.

## States and verification

The main product is validated before related content streams, preserving unavailable/error HTTP status behavior. The route has dedicated missing/error recovery and retry; there is no whole-route loading boundary that prematurely streams a successful status. Related-product loading is isolated. Product and BreadcrumbList JSON-LD use real data, exact decimal money, the configured canonical origin and CSP nonce only on indexable unfiltered public pages.

Evidence is recorded outside the source tree under `C:/Users/PC/.codex/` and browser captures under the OS temporary directory. Browser plugin tools were unavailable in this session; Playwright with installed Microsoft Edge is the browser fallback.

- Initial production build and scoped ESLint passed.
- Initial dedicated browser suite: 17 passed, including eight widths, Axe WCAG 2/2.1/2.2 AA, gallery keyboard/focus, cart validation/duplicate guard/receipts, anonymous/operator guidance, 409/422/429/403/500/network/malformed receipts, account changes, unavailable/missing data, long content, reduced motion, retry and SSR metadata/status.
- Real API and isolated PostgreSQL: customer login, quantity 3 saved then replaced with 2, over-stock quantity 6 rejected without changing 2, favourite persisted, fresh reads after reload, no page errors. Database: `allied_vehicles_qa` on port 55439; no production writes.
- Final corrections: tablet gallery fills its column, the favourites confirmation opens the existing Saved items route, backend quantity errors focus their input, and the photo dialog is explicitly centred despite the global CSS reset.

### Final acceptance evidence

| Gate                             | Evidence                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsive and interaction suite | `product-detail-browser-final.log`: 17 passing cases at 360, 390, 430, 768, 1024, 1280, 1440 and 1536px. The additional touch test initially had an invalid synthetic event; its corrected version and the desktop modal test both pass in `product-detail-gallery-release.log`. All 18 distinct cases are verified. |
| Account regression               | `product-detail-account-regression.log`: five passing cart/favourite completion, late-response and expired-session cases.                                                                                                                                                                                            |
| Server rendering                 | `product-detail-seo-final.log`: three passing no-JavaScript, credential-isolation and crawler-404 checks.                                                                                                                                                                                                            |
| Real writes and destinations     | `product-detail-real-final.log`: actual API/database checks described above, plus successful navigation to Saved items and Cart.                                                                                                                                                                                     |
| Real catalogue health            | `product-detail-health.log`: two related products, genuine missing-photo fallback, no overflow, unexpected console errors or failed requests.                                                                                                                                                                        |
| Recovery accessibility           | `product-detail-states.log`: error and missing pages at 390/1440, zero Axe violations in all four checks.                                                                                                                                                                                                            |
| Source and build                 | `product-detail-build-release.log`, `product-detail-lint-release.log`, `product-detail-type-release.log`: successful production build/postbuild, scoped zero-warning ESLint and TypeScript. Scoped Prettier and diff checks passed; 14 document links validated.                                                     |

The final build differs from the previous complete browser run only by the dialog-centering CSS; both gallery tests were rerun on that build. No backend source was changed. New unit tests were not added for presentation that is covered by the browser and real API checks.

Screenshot evidence: `product-detail-{width}-{viewport|full}.png` in the OS temporary directory; focused `product-detail-{390|1536}-{purchase|details|related}.png`; `product-detail-modal.png`, `product-detail-success.png`, and `product-detail-long.png`. Real catalogue and recovery screenshots are under `C:/Users/PC/.codex/product-detail-*.png`. All required widths and the native 1536 × 1024 concept size were inspected with `view_image`, together with the concepts. The latest centred modal was inspected after the final rebuild.

Above-the-fold copy review passed against the corrected concept brief: product identity/pricing/stock remain API-derived; the total-quantity action and reservation disclaimer are preserved. Actual site navigation, fonts, wordmark, API media and record counts intentionally supersede generated approximations. No remaining material visual mismatch was found against that corrected brief. The implementation was faithfully verified against the coordinated design, including typography, palette, borders, spacing, gallery treatment, purchase controls and downstream sections.

## Fidelity ledger

| Review point                 | Concept requirement                                                     | Implementation and evidence                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and fonts           | Nippo headings, Quicksand body, compact breadcrumb                      | Existing actual fonts/wordmark preserved; readable backend name; long breadcrumb truncates with full title. Generated logo/font approximations are not substituted.                                      |
| Purchase panel               | White bordered panel, exact price, stock rows, compact quantity/actions | Visible quantity border, current and conditional comparison price; inline stock icon/text; clear total-quantity semantics.                                                                               |
| Gallery                      | Contained media, thumbnails and expanded viewing                        | Safe API URLs only; primary selection; arrows, Home/End, swipe, dialog focus containment/Escape/restore; genuine missing/error placeholders. Desktop 16:10 and full-width compact tablet/mobile framing. |
| Lower information            | Open specification/compatibility columns                                | Real brand/category/SKU/part number; nullable year bounds expressed without assuming universal compatibility; notes preserved.                                                                           |
| Assistance and related items | Navy help strip and two compact related records                         | Working Contact anchor and category links; actual bounded API results; independent empty/error/loading.                                                                                                  |
| States and copy              | Focused confirmations and actionable failures                           | Confirmed server receipts, customer role/session guidance, unchanged values on failure, disabled unavailable cart with usable favourites. Generated reservation claim explicitly rejected.               |
| Shared chrome                | Corporate header/footer                                                 | Existing navigation and approved Kilimanjaro address retained; no invented generated footer links.                                                                                                       |

Test-only photographs illustrate layout; the real QA catalogue currently has no product photographs. Production uses published API media or the explicit missing-photo state. No generated concept product is shipped as catalogue content.

## Files

- [Product page](../../app/parts/[productId]/page.tsx)
- [Product actions](../../app/components/product-actions.tsx)
- [Gallery](../../app/parts/[productId]/product-gallery.tsx)
- [Styles](../../app/parts/[productId]/product-detail.css)
- [Error recovery](../../app/parts/[productId]/error.tsx), [missing product](../../app/parts/[productId]/not-found.tsx), [state shell](../../app/parts/[productId]/product-state.tsx)
- [Browser acceptance](../../tests/e2e/product-detail-quality.spec.ts)
- [Account regression fixture](../../tests/e2e/public-account-actions.spec.ts)

Physical devices and browser engines other than Edge remain outside this local milestone. Deployed catalogue/media and staging integration verification remain separate release checks.
