# Shop listing milestone

Route: `/parts`  
Status: complete; local acceptance gate passed. Contact and Vehicles have passed their separate local gates. Product detail and checkout remain later milestones.

## Baseline and current behavior

The server page loads `/public/catalog/products?limit=12` through the cached public seed loader. `PartsCatalogue` reads products and active categories, submits uncontrolled form values, keeps cursor history in component state and renders real images, prices and branch availability. It has a generic large filter panel, a native category select and a compatibility disclosure.

Before screenshots were captured at 390, 768, 1280 and 1440px from the current production frontend and isolated real API, with an empty product/category dataset. Files are `C:/Users/PC/.codex/shop-before-{width}-{viewport|filters|full}.png`; no page overflow was observed. The filters at all four widths and mobile/desktop introductory views were inspected with `view_image`.

Problems to address:

- Search has no visible input boundary; the filter panel is excessively tall on mobile/tablet.
- There is no breadcrumb, URL persistence, debounced search, active-filter summary or current-page result count.
- Category options use a native select despite a potentially large dataset. More categories replaces the options instead of accumulating them, risking selection loss. Loading, empty and selected-category restoration need deliberate behavior.
- Compatibility/brand fields need visible borders and compact grouping; mobile needs a filter drawer with persistent actions and retained draft selections.
- The introduction and product results need a more deliberate shopping hierarchy and a product-specific help action.

A real search for `engine oil` returned HTTP 200 for `/public/catalog/products?limit=12&search=engine+oil&sort=newest`. The visible URL remained `/parts`; reloading cleared the search. Evidence: `C:/Users/PC/.codex/shop-baseline.log`.

## Authoritative public contract

Anonymous reads:

- `GET /public/catalog/products` — active products in active categories only.
- `GET /public/catalog/categories` — active categories, sorted by name then ID, paginated.
- `GET /public/catalog/categories/{categoryId}` — one active category; can restore a readable label for a shared category filter even if it is absent from the loaded option page.
- `GET /public/catalog/products/{productId}` — existing detail route; presentation redesign is outside this milestone.

| Product query     | Accepted behavior                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `search`          | Trimmed, nonempty, max 100 characters; case-insensitive contains across name, SKU, brand and manufacturer part number |
| `categoryId`      | UUID                                                                                                                  |
| `brand`           | Trimmed, nonempty, max 100 characters; case-insensitive exact match                                                   |
| `make`, `model`   | Trimmed, nonempty, max 100 characters; case-insensitive exact matches within one compatibility row                    |
| `year`            | Integer 1886–2100; within inclusive `yearFrom`/`yearTo`, with null bounds treated as unbounded                        |
| `featured`        | Literal query string `true` or `false`                                                                                |
| `sort`            | `newest`, `name`, `price_asc`, `price_desc`; each has an ID tie-breaker                                               |
| `cursor`, `limit` | UUID cursor; limit 1–100, default 25; frontend uses 12 products per page                                              |

Text values reject control characters. Unknown parameters are rejected. There are no public minimum/maximum price, stock, branch, product-type or make/model/brand-options parameters. Do not implement these as client-side filtering over one result page. Category queries accept only cursor and limit, so local category search must explicitly describe its loaded scope and retain a way to retrieve more options.

Both collection responses contain `items` and optional `nextCursor`, without totals. Display the current-page product count rather than a global match count. Category IDs must not leak into chips or control labels when a readable label can be resolved.

The product DTO includes category, image projection, price/compare-at price in integer kobo, brand/SKU, compatibility rows and availability per active branch. `inStock` is computed from `quantity - reserved > 0`. Stock presentation must follow this projection and must not expose internal quantities or invent collection/delivery promises. Existing safe media validation remains required.

This listing has no mutation. Preserve detail navigation; cart/favourites/checkout and their authentication, CSRF and stock rules stay in their existing flows. There is no password field.

Evidence: [query schemas](../../../backend/src/modules/catalog/catalog.schemas.ts), [routes](../../../backend/src/modules/catalog/catalog.routes.ts), [repository](../../../backend/src/modules/catalog/catalog.repository.ts), [service](../../../backend/src/modules/catalog/catalog.service.ts), [OpenAPI registration](../../../backend/src/modules/catalog/catalog.openapi.ts), [frontend DTOs](../../lib/api/commerce-schemas.ts), [current catalogue](../../app/components/parts-catalogue.tsx).

## Design and implementation

Three generated concepts were inspected before coding and retained in [Shop concepts](shop-concepts/README.md). They cover introduction/results, desktop/mobile filters and category states, recovery states and the page ending. The specification records tokens, typography, hierarchy, interactions and contract-driven deviations from generated sample data.

Implemented only the audited query contract. Server and client share a query normalizer; search is debounced, filter changes reset pagination, and cursor history survives reload. Category choices accumulate pages, search only loaded options and resolve selected IDs through the category detail endpoint. The advanced filter panel becomes a native mobile modal, retains drafts, validates years and restores focus. Cards retain real prices, availability and detail links. The page now has a semantic breadcrumb, compact hero, current-page count, removable chips, recovery states, fitment guidance and product-specific contact actions. Shared header, footer, public media and unrelated routes are unchanged.

## Verification results

Environment: production preview at `http://127.0.0.1:3001`, real isolated API at `127.0.0.1:5012`, isolated PostgreSQL database `allied_vehicles_qa` at port 55439. Browser plugin not available; repository Playwright uses installed Edge. The flow under test is `/parts` → search/category/advanced filters → real query results, URL restoration and detail navigation.

- Final production build and standalone packaging passed (`shop-build-visual.log`), including TypeScript. Targeted implementation/test lint, formatting and diff checks passed. Seven unit tests verify strict query boundaries, unsupported parameter exclusion and cursor-trail handling.
- Real API/browser script passed: 14 public products in pages of 12 + 2 without duplicates, exclusion of an inactive product and inactive-category product, combined search/category/brand/make/model/year/featured/sort returning the expected row, reload/Previous, readable selected category, no-results recovery and filtered SSR with JavaScript disabled. No page errors. Final evidence: `C:/Users/PC/.codex/shop-real-final.log`.
- **19 unique browser cases passed cumulatively.** The full 17-case suite passed in `shop-tests-final.log`. After the final category positioning/scrolling refinement, 10 affected cases passed in `shop-tests-visual.log`; the remaining two were interrupted by computer sleep (`ERR_NETWORK_IO_SUSPENDED` and a browser launch timeout) and passed unchanged in `shop-resume.log`. This rerun adds the 100-option keyboard/short-viewport case. The additional unavailable-selected-category recovery case passed in `shop-selected-category.log`.
- Widths 360, 390, 430, 768, 1024, 1280 and 1440 passed overflow, breadcrumb, keyboard, modal focus, retained draft, long category, popup collision and Axe checks. The 390 × 500 emulated touch flow passed. Native concept-size evidence was captured at 1536 × 1024. Updated mobile/desktop category screenshots were inspected and show the search remaining visible while options scroll independently.
- Four SSR regression cases passed in `shop-seo.log`: JavaScript-disabled readability, one deduplicated initial seed, filtering/pagination/reset, and distinct empty/malformed/outage behavior with appropriate indexing rules.
- Actual Shop → product detail navigation passed in `shop-health.log`, with no page errors, failed assets or unexpected console messages. Two anonymous session-probe 401 network messages are expected; no hydration/framework errors were observed. The temporary SSR fixture preview was stopped after verification.

Files: [page](../../app/parts/page.tsx), [catalogue](../../app/components/parts-catalogue.tsx), [search and filters](../../app/parts/product-filters.tsx), [category picker](../../app/parts/product-category.tsx), [route styles](../../app/parts/parts.css), [query contract](../../lib/product-discovery.ts), [unit tests](../../tests/unit/product-discovery.test.ts), [browser tests](../../tests/e2e/shop-quality.spec.ts), and the Shop expectations in [SSR regression tests](../../tests/e2e/seo.spec.ts).

No password control is applicable to this listing route. Services listing is the next milestone; no later route is marked complete by this work. Verification used Edge and emulated touch, not a physical mobile device. Production deployment and live inventory/media configuration are outside this local gate.

| Gate                                | Result and evidence                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Page identity and meaningful render | Pass: Shop heading, breadcrumb, real/fixture products and no-JavaScript SSR                                  |
| Framework/console health            | Pass: no page errors, unexpected console messages or failed assets in real navigation                        |
| Interaction integrity               | Pass: exact backend queries, URL history/reload, pagination, clear/debounce, category recovery, detail links |
| Responsive/accessibility            | Pass: seven widths, Axe, keyboard, modal focus, short emulated touch viewport, long and 100-option lists     |
| Screenshot fidelity                 | Pass: all three concepts and final native/mobile/desktop renders inspected; deviations below are intentional |
| Code quality                        | Pass: production build, TypeScript, targeted ESLint/Prettier, seven unit tests and diff check                |

Commands used: `npm run build`; `npm run typecheck`; targeted `npx eslint ... --max-warnings=0` and `npx prettier --check ...`; `npx vitest run tests/unit/product-discovery.test.ts`; `npx playwright test tests/e2e/shop-quality.spec.ts` and scoped reruns; `RUN_SEO_SERVER_TESTS=true` / `SEO_FIXTURE_PORT=5019` with `seo.spec.ts --grep ': /parts$'`. Each browser run used its own external output directory. Logs named above are retained under `C:/Users/PC/.codex/`.

## Fidelity ledger

Concept evidence is in `shop-concepts/01.webp` through `03.webp`; browser evidence is in the OS temporary directory under `shop-quality-{width}-{viewport|full|filters|category}.png` and `shop-quality-native-{introduction|inventory|filters|category|guidance|contact}.png`.

| Review point            | Concept / requirement                                                  | Browser finding and correction                                                                                                                                                                                                 | Disposition                                                                               |
| ----------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Introduction            | Compact ink/photo split, image-first mobile, two-line heading          | 270px desktop band and 168px mobile image retain product context without the former oversized filter form                                                                                                                      | Matches hierarchy; retained unbranded editorial asset                                     |
| Typography and identity | Nippo headings, Quicksand controls, ink/red/white                      | Explicit local font variables prevent display fallback; existing Allied wordmark and real navigation retained                                                                                                                  | Intentional brand-correct adaptation of generated logo/font approximations                |
| Toolbar density         | Compact bordered search/category/filter/sort                           | Four columns desktop, two rows tablet, search/category full-width mobile; 44px controls and visible focus rings                                                                                                                | Matched across seven widths                                                               |
| Advanced filters        | Three columns desktop, scrolling mobile drawer, persistent actions     | Native modal contains focus, retains drafts, restores trigger; desktop Escape handling added explicitly                                                                                                                        | Keyboard and touch gates passed in the full suite                                         |
| Category picker         | Search, long choices, selected marker, Load more/retry                 | Disabling Load more initially closed the popup; blur handling and focus recovery corrected. Screenshot review then found the search area could scroll away; options now scroll independently with improved collision placement | Final seven-width and large-list reruns passed; updated screenshots inspected             |
| Product cards           | Three/two/one columns with image, name, price, stock and detail action | Real DTOs and approved image handling; contained product images, accurate branch availability, cursor pagination                                                                                                               | Generated sample brands, prices, branch names and total page count intentionally excluded |
| Recovery                | Distinct loading, filtered-empty, no-inventory, error and retry        | Loading skeletons preserve structure; no-match and inventory-empty guidance differ; 503/429/network retry checked                                                                                                              | Full functional suite passed                                                              |
| Page continuation       | Fitment guidance, product-specific help band and corporate footer      | Native-size contact and full-page screenshots inspected; real Contact/WhatsApp actions, approved address, existing footer                                                                                                      | Matched content hierarchy; no generated guarantees or fabricated footer links             |
| URL/reset behavior      | Deep links, history, reload and clear                                  | Product queries and cursor trail restored; Clear now remounts the search control to cancel an uncommitted debounce even when search was not an applied filter                                                                  | Regression passed                                                                         |

Native-size desktop introduction, filter panel and contact band were inspected together with the concepts. Viewport screenshots at 360, 390, 430, 768, 1024, 1280 and 1440 were inspected during refinement. Fixture images illustrate layout only; real API verification uses clearly synthetic QA records in the isolated database and does not claim production inventory or media availability.
