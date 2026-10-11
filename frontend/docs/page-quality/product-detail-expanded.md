# Product detail — expanded brief

Route: `/parts/[productId]`. Date: 7 October 2026. Status: complete; expanded local acceptance gate passed. This extends the [September assessment](product-detail.md). Checkout, customer order management and deployment remain separate gates.

## Audit and scope

Vehicle detail passed its expanded gate before this reassessment. Fresh baseline captures at 390, 768, 1280 and 1440px showed no overflow or page errors. The page nevertheless had a predominantly white composition, an oversized desktop heading, repeated mobile prices, low-priority part identifiers, and cart/favourites controls visible to anonymous and work accounts until submission was rejected.

Source inspection also found that the normalized backend quantity error was indexed twice, displaying its first character rather than the complete safe message. The expanded account visibility introduced a form remount that exposed a stale draft: an account change reset the quantity, but the old draft restored it afterward. Both issues are addressed by this milestone.

Reviewed the server page, gallery, action component, schemas, account mutation hook, form drafts, catalogue routes, checkout/fulfilment code, Login-derived controls and installed Next.js client-boundary guidance. Public browsing is available to everyone; cart and favourites are customer operations. The backend remains authoritative for roles, inventory, prices and order rules.

## Design and behavior

Three [ImageGen concepts](product-detail-oct-concepts/README.md) were generated and inspected before source changes. They cover the gallery/purchase composition, information/compatibility/delivery sections, and mobile/account states. Actual Nippo, Quicksand, navigation, approved business information and API data supersede generated sample branding, claims and products.

- Cool-grey canvas, 36px maximum display heading, white framed gallery, factual brand/part-number/SKU strip, and a white purchase panel with an ink top rule and restrained shadow.
- Semantic anchor navigation to overview, product information, compatibility and delivery. All sections remain rendered; these controls do not simulate tabs or hide crawlable content.
- One mobile price above the gallery, including the valid comparison price and per-item label. Desktop retains pricing inside the purchase panel. The existing gallery keeps image containment, horizontal thumbnails, keyboard/touch navigation, modal focus trapping and focus restoration.
- Separate checking, anonymous, customer, work-account and failed-check states. Anonymous users receive sign-in guidance, work accounts receive a dashboard path, and failed checks offer retry. Unsupported cart/favourites controls and quantity inputs are absent. Contact remains available.
- A fresh session preflight precedes every mutation. Customer quantities remain integer totals from 1 to 1,000, not increments or reservations. Out-of-stock cart controls stay disabled while favourites remain available to customers.
- Quantity errors display the full normalized safe message and focus the associated input. Existing quantity retention, busy guards, verified receipts and uncertain-outcome guidance remain intact.
- Account changes abort pending browser operations and clear private state. The native form reset now also clears the persisted draft before React Hook Form resets its values, preventing stale quantity restoration when controls remount. This does not undo a mutation already committed by the server.
- An ink assistance band, white information/compatibility surface, three ordering steps and native collection/delivery disclosures provide practical guidance. The approved address remains beside Kilimanjaro. Checkout supplies current fulfilment options and charges; no delivery dates, nationwide availability, free shipping, warranty or return policy is invented.
- Related products retain bounded category reads and independent recovery, with a compact package fallback that no longer clips the missing-image label. Motion is restrained and respects reduced motion.

No new production imagery, video, 3D dependency, password field or backend capability is required. A Buy now shortcut would still require the cart, branch, fulfilment and policy checks, so the existing explicit cart workflow remains appropriate.

## Contracts preserved

| Contract                                            | Verified use                                                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /public/catalog/products/{productId}`          | UUID and matching response identity; active product/category; real images, brand/SKU/part number, exact kobo prices, compatibility and branch stock booleans.                       |
| `GET /public/catalog/products?categoryId=…&limit=3` | Same-category related results, excluding the current product and displaying at most two; independent loading/empty/failure states.                                                  |
| `GET /auth/session`, `GET /auth/csrf`               | Optional display-time session check, fresh mutation preflight and existing CSRF protection.                                                                                         |
| `PUT /customers/cart/items/{productId}`             | Replaces total quantity; the response must include this product with the requested quantity before success. Actual stock remains server-validated.                                  |
| `PUT /customers/favourites/{productId}`             | Customer-only save with an empty object body and a matching returned product identity.                                                                                              |
| Existing checkout/fulfilment                        | Delivery options depend on approved policy configuration and zones. Product detail supplies guidance and the approved collection address, not a fabricated fee or delivery promise. |

Main-record validation remains before streaming, with 404/noindex for missing records and safe unavailable behavior for malformed data. Existing Product/BreadcrumbList JSON-LD, exact decimal money, canonical-origin policy and SSR request deduplication remain in place. No public inventory quantity or invented compatibility guarantee is added.

## Fidelity ledger

| Comparison point                                                     | Final treatment                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Flat white baseline and oversized title                              | Cool-grey canvas, compact actual Nippo heading and distinct white media/purchase surfaces.                                     |
| Concept emphasizes a product identity strip                          | Actual brand, manufacturer part number and SKU appear below the gallery and wrap safely.                                       |
| Mobile repeats the price                                             | One leading current/comparison price with per-item label; lower duplicate hidden.                                              |
| Purchase controls appear before role is known                        | Explicit access states replace unavailable mutations; fresh preflight remains mandatory.                                       |
| Concept introduces fake search/navigation and logos                  | Keep the existing real public shell, wordmark and destinations.                                                                |
| Generated example filter photography                                 | Use published API imagery only; real QA missing-media state remains honest. Test photos are fixtures, not catalogue content.   |
| Lower concept repeats the gallery and uses rigid compatibility cells | Keep one gallery and readable description/specification/compatibility columns that support real nullable years and long notes. |
| Concept guidance and mobile states                                   | Native FAQ disclosures, correct collection address, safe delivery wording, full validation message and real receipts.          |
| Large global fallback clips related media copy                       | Scoped compact package icon/fallback dimensions preserve the label and row density.                                            |

## Verification evidence

Production standalone preview: `http://localhost:3001`; isolated API: 5012; PostgreSQL: 55439, database `allied_vehicles_qa`. Browser fixtures use preview 3002 and API 5021. Browser plugin not available; repository Playwright and installed Microsoft Edge are the fallback.

All 26 Product detail scenarios passed against the final production build. The initial run exposed the stale-draft reset defect described above; the acceptance run includes its correction and the deferred submit handler. Five additional account-isolation cases and three crawler/server-rendering cases also passed.

| Gate                     | Final result                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build         | Compilation, TypeScript, 70 route entries and standalone packaging passed; `product-detail-oct-build-final.log`.                                                                                                                                        |
| Code quality             | Full frontend lint passed; targeted ESLint passed again after the final action-handler correction. Scoped Prettier and diff checks passed.                                                                                                              |
| Detail browser suite     | 26 passed, including gallery keyboard/touch/focus, quantity validation and complete backend error text, duplicate guards, verified receipts, failed/uncertain outcomes, role changes, draft reset, related states and structured data.                  |
| Account regression       | Five passed: completed/late cart and favourite responses across accounts, plus expired-cart-session recovery; `product-detail-oct-accounts.log`.                                                                                                        |
| SSR/crawlers             | Three passed: product content without JavaScript, SSR credential isolation, missing product 404/noindex; `product-detail-oct-seo.log`.                                                                                                                  |
| Responsive/accessibility | 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px; no horizontal overflow, whole-page Axe, visible quantity borders, keyboard FAQ, long records, short touch viewport and modal checks passed.                                                  |
| Visual comparison        | Final native 1536px upper page, mobile/tablet, information/compatibility, ordering, purchase/account states and expanded gallery inspected with the three references. Deliberate source-data and shell differences are recorded in the fidelity ledger. |

Interaction loops: part identifiers → compatibility anchor → delivery disclosure; gallery thumbnail/keyboard/swipe → expanded photo → Escape and restored focus; quantity entry → exact validated cart receipt → persisted total after reload; favourites → confirmed saved-item destination; account change → reset quantity and cleared results, with late responses ignored.

The real API/database run passed: one favourite persisted, cart quantity 3 was replaced with 2, quantity 6 was rejected for insufficient stock without changing 2, refresh preserved both records, and Cart/Saved destinations opened successfully with no page errors. All writes used synthetic isolated QA customers; no production writes or external messages occurred.

Final page health confirms the expected product title/heading and URL, HTTP 200, no framework overlay, unexpected console/page errors, failed responses, overflow or broken rendered images. Expected anonymous session 401 is excluded. Fresh real-page captures at 390, 768, 1280 and 1440px are also recorded.

Commands: `npm run build`; `npm run lint`; targeted ESLint; scoped Prettier; `npx playwright test tests/e2e/product-detail-quality.spec.ts` with the isolated fixture environment; focused account and SEO regressions; real API/database harness; `git diff --check`. No implementation-mirroring unit tests were added: the changed behavior is verified through browser interactions and real API/database writes.

Local artifacts live outside the repository under `C:/Users/PC/.codex/`: `product-detail-oct-build-final.log`, `product-detail-oct-lint.log`, browser/account/SEO logs, `product-detail-oct-real.log`, `product-detail-oct-health.json` and `product-detail-oct-{before,after}-{width}-{viewport,full}.png`. The OS temporary directory contains `product-detail-{width}-{viewport,full}.png`, focused purchase/details/ordering/related captures, account-state images and gallery/receipt captures. These are local evidence, not deployment certification.

## Boundaries

The real QA catalogue has no product photographs; fixture cases cover published and failed images. This gate does not verify Safari, Firefox, physical devices, manual screen-reader use, deployed object storage or production delivery. Backend media release checks remain in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). No additional mandatory endpoint gap was identified.

Production files: [product-actions.tsx](../../app/components/product-actions.tsx), [page.tsx](../../app/parts/[productId]/page.tsx), [product-detail.css](../../app/parts/[productId]/product-detail.css). Acceptance coverage: [product-detail-quality.spec.ts](../../tests/e2e/product-detail-quality.spec.ts).

Next: reassess Service detail `/services/[serviceId]`, preserving the separately verified Booking creation flow. Product detail acceptance does not certify checkout or the rest of the application.
