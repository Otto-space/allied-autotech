# Product cart confirmation drawer and notifications

Status: locally accepted on 8 October 2026, the twenty-first expanded milestone. This workflow extends `/parts/[productId]`; it does not certify all account pages or every notification-producing action.

## Contract and implementation

The existing customer-only `PUT /customers/cart/items/{productId}` replaces the total quantity of one product and returns the cart. No new backend route, migration or stock reservation is needed. The frontend retains fresh-session checks, CSRF, the mutation lock and account-change cancellation. `parseCartUpdate` validates the response, requested product/quantity, unique row/product identities and exact integer-kobo line/subtotal reconciliation before presenting success.

The native modal drawer displays the returned items and subtotal. Review cart opens the existing `/dashboard/cart` workflow, which reads current server state. Continue shopping, Escape and the close control return focus to the quantity-save button. The backdrop makes the underlying page inert; keyboard wrapping keeps both tab directions within the drawer. Account changes clear the private result, and late responses cannot reopen it.

The shared notification style now uses white/ink/cool-grey surfaces, restrained red errors, 12px corners, wrapped messages and 44px actions/dismiss controls. Existing deduplication, three-notice maximum, pause-on-hover/focus, persistent warnings/errors and session clearing remain intact. Favourite saves show an actionable toast only after validated success. Cart updates use their drawer without an additional toast. Existing inline messages remain available after dismissal.

## Baseline and concepts

Four baseline captures at 390, 768, 1280 and 1440px recorded the existing inline-only cart confirmation. Three [fresh concepts](cart-drawer-oct-concepts/README.md) were generated and inspected before production implementation: desktop drawer, mobile drawer and notification states. The real product page, approved logo and backend-linked media are retained; generated product claims, ratings, mobile OS chrome and invented branding are excluded.

## Verification

The final production build passed all **32 drawer/notification browser scenarios**, plus **two existing product-detail regressions** covering quantity validation, duplicate submission, favourites and mobile keyboard/gallery use. Full frontend lint, type checking, production build and scoped formatting passed. **23 unit checks** passed across cart response validation, existing feedback behavior and account-mutation cancellation. No backend implementation changed in this milestone.

- Responsive coverage: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px; all ten drawer captures and toast captures at 320/390/1440 were produced. No horizontal drawer overflow or browser page errors were observed. A 24-line cart with very large amounts retained reachable actions at 320px and heights 420/600/844.
- Accessibility: six Axe scans passed (drawer at 390/768/1440 and favourite toast at 320/390/1440), alongside 44px controls, both keyboard-wrap directions, Escape/focus return, body-scroll restoration and reduced motion. The corrected final modal typography was visually compared with the concepts.
- Failure coverage: malformed totals/lines/identities/quantities, duplicate rows, failed updates, account changes and delayed responses do not present a successful drawer. Cart confirmation sends no duplicate toast or additional write; Review cart does not initiate checkout.
- Real isolated API/database/browser checks passed twice, including on the final build: repeated saves kept one cart row at quantity 2, exact subtotal reconciliation held, favourite creation persisted, another customer's cart remained empty, anonymous reads returned 401 and missing-CSRF writes returned 403. Navigating to the cart created zero orders; no browser page errors occurred.
- An intermediate parallel test run collided in Playwright's shared trace-output directory. The final 32-scenario run used its own external output directory and passed. This was a test-artifact conflict, not an application defect.

Browser plugin unavailable: Playwright with Edge was used. Temporary scripts, logs and screenshots are outside the repository at `C:/Users/PC/.codex/cart-drawer-oct-*`. Controlled browser fixtures exercise negative and responsive states; real checks use synthetic accounts in the isolated `allied_vehicles_qa` database on port 55439. No production records, live payment providers or external customer notifications are involved. Useful repeat commands: `npm run lint`, `npm run typecheck`, `npm run build`, the three named Vitest suites, and the opt-in `RUN_CART_DRAWER_TESTS=true` Playwright suite with the local catalogue API configured. Existing product regressions used a separate standalone process with runtime origin pointing to their isolated fixture.

## Fidelity decisions

| Point               | Implementation and intentional adjustment                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Composition         | White drawer up to 460px on the right over an ink backdrop; full viewport width on narrow screens. Preserve the product page behind it.                                                       |
| Hierarchy           | Compact heading, saved-quantity summary, cart lines, server subtotal, primary review action and secondary continue action follow the concepts.                                                |
| Typography          | Quicksand for modal interface text; retain Nippo on the underlying marketing page. Increase selector specificity to prevent inherited product headings from changing the modal typeface.      |
| Spacing and content | Use bounded 76px desktop / 64px mobile thumbnails and wrapped text. Line totals sit below their descriptions to support large values without squeezing names.                                 |
| Palette and media   | Ink/red/white/cool-grey; show approved server images or the honest unavailable-image fallback. Concept product photos are not shipped as live inventory.                                      |
| Controls and focus  | At least 44px actions, red focus, explicit keyboard wrapping, Escape/backdrop dismissal and restored focus. The first browser pass exposed a reverse-tab boundary issue, which was corrected. |
| Short screens       | At heights up to 600px the whole drawer scrolls under a sticky close header; ordinary heights use a scrollable body and fixed footer. This preserves access to long carts and actions.        |
| Notifications       | Preserve top-right placement, 380px maximum width and existing timing rules. The concept's four examples describe tones; the actual stack remains limited to three.                           |

## Remaining scope

Deployment, other browser engines, real mobile device/assistive-technology testing and remaining authentication/account/role pages retain their separate acceptance requirements. No new mandatory backend gap was identified. The application-wide goal remains active.
