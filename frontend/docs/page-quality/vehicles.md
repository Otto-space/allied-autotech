# Vehicles listing milestone

The [expanded 7 October reassessment](vehicles-expanded.md) records the later marketplace refinement and its own verification status. This September report remains the historical baseline.

Route: `/vehicles`  
Status: complete; local route acceptance passed on 30 September 2026. Contact passed its gate before this milestone began. Vehicle detail is a later, separate milestone. This does not establish completion of the other routes in the page-by-page brief.

## Existing surface

The server page loads `/public/vehicles?limit=12` through the existing request-cached public seed loader. `VehicleCatalogue` renders the real listing projection and performs client-side API reads. Keep that server/client separation and the safe media/price components.

Baseline screenshots were captured at 390, 768, 1280 and 1440 pixels from the local production build, with the isolated real API returning an empty inventory. First-viewport, full-page and filter screenshots are outside the repository at `C:/Users/PC/.codex/vehicles-before-{width}-{viewport|full|filters}.png`. Filter views at all four widths were inspected with `view_image` before any redesign.

Findings:

- Search and make inputs blend into the filter panel without visible borders.
- The filter panel is tall on mobile/tablet and exposes a plain details disclosure instead of the required filter drawer.
- Filters and cursor history exist only in component state. There is no URL-backed selection, reload restoration or browser Back/Forward filter history.
- Search requires explicit form submission and is not debounced.
- Body type, featured and price bounds are supported by the backend but absent from the current controls.
- There is no active-filter summary/removal or result-page count, and no public breadcrumb.
- Existing server data, real media, price formatting, empty/error handling and current public visibility rules must be preserved.

## Backend contract

`GET /public/vehicles` is an anonymous read. The strict query schema rejects unknown parameters. Public listings are limited by the service/repository to AVAILABLE listings at active branches; an availability or branch filter must not be invented.

| Parameter                      | Supported behavior                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `search`                       | Trimmed nonempty text, up to 100 characters; case-insensitive contains across listing title, vehicle make and model |
| `make`, `model`                | Trimmed nonempty text, up to 80 characters; case-insensitive exact matching                                         |
| `year`                         | Integer, 1886–2200                                                                                                  |
| `bodyType`                     | SEDAN, SUV, COUPE, HATCHBACK, WAGON, PICKUP, VAN, TRUCK, BUS, OTHER                                                 |
| `transmission`                 | AUTOMATIC, MANUAL, CVT, OTHER                                                                                       |
| `fuelType`                     | PETROL, DIESEL, HYBRID, ELECTRIC, OTHER                                                                             |
| `featured`                     | Literal query string `true` or `false`                                                                              |
| `minPriceKobo`, `maxPriceKobo` | Positive integer strings, at most 16 digits; minimum cannot exceed maximum                                          |
| `sort`                         | `newest` (default), `price_asc`, `price_desc`, `year_desc`; repository adds an ID tie-breaker                       |
| `cursor`, `limit`              | UUID cursor; limit 1–50, default 20; current frontend uses 12                                                       |

The response contains `items` and optional `nextCursor`, without a total-match count or facets. A result summary must describe the current page rather than invent an inventory total. Make/model filter inputs cannot assume a global options endpoint or present choices derived from one page as an exhaustive dataset.

Listing cards use real title, price in kobo, NGN currency, branch and vehicle fields. Images come from the actual listing projection, choosing a primary image or first image. Missing media must remain honest. Public image access is through `/public/vehicles/images/{imageId}`; listing details are `/vehicles/{listingId}`. Listing reads do not require CSRF or a mutation review.

Evidence: [query schema](../../../backend/src/modules/vehicles/vehicles.schemas.ts), [routes](../../../backend/src/modules/vehicles/vehicles.routes.ts), [repository](../../../backend/src/modules/vehicles/vehicles.repository.ts), [service](../../../backend/src/modules/vehicles/vehicles.service.ts), [frontend listing schema](../../lib/api/vehicle-schemas.ts), [catalogue component](../../app/components/vehicle-catalogue.tsx).

A real baseline filter interaction returned HTTP 200 for `?limit=12&search=Toyota&sort=newest`, while the visible URL remained `/vehicles`; reloading cleared the search field. This confirms the URL persistence gap in the browser.

## Concepts and implementation

Three coordinated concepts were generated with the built-in ImageGen tool before implementation and retained in [vehicles-concepts](vehicles-concepts/): [listing and introduction](vehicles-concepts/01.webp), [filters and states](vehicles-concepts/02.webp), and [lifestyle/contact continuation](vehicles-concepts/03.webp). Each includes a desktop and mobile composition. All three were inspected with `view_image` at their native 1536 × 1024 dimensions.

The implemented system uses marketplace navy `#091B38`, brand red `#E60301`, white, cool grey surfaces and an explicit `#8290A1` control border. Nippo is the display face; Quicksand is the UI face. Controls are 44px high, labels 13px, field grids have three desktop columns, cards have three desktop/two tablet/one mobile columns, and the existing 1248px public container is retained.

The existing header, footer, editorial assets and lifestyle component remain authoritative. Concept-generated financing, inspection guarantees, verification, foreign/Nigerian-used distinctions, favourite buttons and inventory examples are not product requirements. They were excluded because they are not supported by this listing contract. Existing approved copy replaces the generated promotional claims. Lifestyle retains its existing two photographs and text-based everyday guidance; generated third-car inventory implications and unsupported footer destinations are excluded. The desktop filters expand inline; only mobile uses a modal drawer.

Implementation files:

- [Server page](../../app/vehicles/page.tsx): Home / Vehicles breadcrumb, compact introduction, real query-aware server seed, retained lifestyle content and vehicle-specific contact invitation.
- [Catalogue](../../app/components/vehicle-catalogue.tsx): URL-backed filters, active removable chips, accurate page counts, loading skeletons, empty/error recovery and cursor navigation.
- [Filter controls](../../app/vehicles/vehicle-filters.tsx): debounced search, exact-name inputs, short-enum selects, optional year and price fields, validation, desktop disclosure and native mobile dialog with retained drafts, focus restoration and fixed actions.
- [Route styles](../../app/vehicles/vehicles.css): explicit borders, hover/focus/invalid/disabled states, compact layouts and responsive drawer.
- [Query boundary](../../lib/vehicle-discovery.ts): supported-parameter allowlist, strict numeric bounds, exact decimal-to-kobo conversion and invalid shared-link handling.

Native History API changes integrate with Next's `useSearchParams`. Filtering/sorting clears pagination. A validated presentation-only `_trail` records preceding cursors so Previous works after reload or sharing; it is excluded from API requests. After 50 trail entries, or when opening a raw cursor link, the UI honestly offers First page instead of inventing preceding pages. The server and client use the same normalized query. No unsupported availability or branch parameter is sent.

Make/model remain optional exact-name text fields because no complete options dataset exists. Short enum selectors use the browser's native keyboard, selection, collision and scrolling behavior. No fake facets or global counts are introduced. No password input exists on this route.

## Verification

The first production build passed. Seventeen query-boundary tests passed, covering precise money conversion, invalid prices, parameter allowlisting, shared-link validation and cursor metadata. Targeted lint passed. The first visual pass identified a display-font fallback and an unstyled search submit control; both were corrected.

The installed PostgreSQL service was stopped and starting it required unavailable Windows service privileges. A separate user-owned test cluster was created at `127.0.0.1:55439`, database `allied_vehicles_qa`, with current repository migrations. It binds only to loopback. Synthetic test records are isolated there: 14 AVAILABLE listings and one SOLD listing. The API runs on 5012 and the tested production frontend on 3001. No business database records or backend source were modified for this milestone.

A real API and browser check passed against that database: all supported filters combined, exact-name case-insensitive matching, 12+2 cursor traversal without duplicates, exclusion of the sold listing, query-aware server rendering, reload restoration, Previous after reload, filter reset and no-match recovery. Browser page errors were empty. Evidence: `C:/Users/PC/.codex/vehicles-real-api.log` and `vehicles-real-empty.png`. Real test listings deliberately have no attached media; the honest media-unavailable state remains in place. Separate browser fixtures exercise successful image display using existing local editorial assets; those fixtures are confined to tests.

Browser/IAB is unavailable in this session; the existing Playwright setup with installed Microsoft Edge is the fallback. [Browser acceptance tests](../../tests/e2e/vehicles-quality.spec.ts) cover seven widths, accessibility, focus, URL history, reloads, pagination, exact queries, loading, empty and failure states.

### Final acceptance evidence

- **Production build:** passed after the final visual changes; `C:/Users/PC/.codex/vehicles-build-visual.log`. TypeScript, targeted lint, formatting and scoped diff checks passed. No dependency changes.
- **Unit tests:** 17 passed in `tests/unit/vehicle-discovery.test.ts`, including exact decimal conversions at the largest supported amount and unsupported API-parameter exclusion.
- **Browser interactions:** 15 passed in the comprehensive run, `vehicles-tests-final.log`. After the final CSS changes, all seven responsive/accessibility cases, loading/empty/error recovery and the added native-size capture passed again: 9 passed in `vehicles-tests-visual.log`. This represents 16 distinct acceptance cases, with affected visual cases rerun.
- **Existing SSR regressions:** 4 passed in `vehicles-seo-final.log`: empty versus malformed responses, readable vehicle cards without JavaScript, one server seed without a duplicate initial client read, and filter/pagination/reset behavior. The existing SEO test uses the new Vehicles search/reset controls. Its fixture port can be overridden for independent QA runs; this check used 5019 and frontend 3002 without interrupting other processes.
- **Real integration:** the final real API/browser run passed again, `vehicles-real-final.log`. Records came from the isolated PostgreSQL database, with public status filtering and exact query semantics preserved.
- **Responsive/accessibility:** 360, 390, 430, 768, 1024, 1280 and 1440px passed overflow and Axe checks in the catalogue and open filter states. 80-character make/model values and wrapping/removable chips were exercised. The mobile drawer passed Escape, forward Tab wrapping, retained draft, focus restoration, background scroll restoration and emulated touch at a short 390 × 500 viewport. Reduced motion was enabled for the width checks.
- **Recovery:** slow responses show skeletons while preserving controls; no-match and empty-inventory states differ; HTTP 503, HTTP 429 and a failed network request retain recovery actions; Retry returns real-shaped results. Invalid URL filters are excluded from API reads and explained. Back cancels an uncommitted search, including when only the sort changed in the previous history entry.
- **Browser errors:** no application page errors or hydration exceptions in the responsive checks or real integration run. The shared header's unauthenticated session probe returns the expected HTTP 401; deliberate outage fixtures produce expected failed HTTP/network responses.

Screenshot evidence is outside the repository at `C:/Users/PC/AppData/Local/Temp/vehicles-quality-{width}-{viewport|filters|lifestyle|full}.png`. Focused states are `vehicles-quality-{loading|no-matches|error}.png`. Native concept-size inspection used a 1536 × 1024 browser viewport plus complete section captures: `vehicles-quality-native-{introduction|inventory|panel|lifestyle|contact}.png`. Concepts and rendered screenshots were opened using `view_image`; desktop, tablet, mobile, complete panel, cards and lower-page continuation were inspected directly.

### Fidelity ledger

| Comparison               | Concept and rendered evidence                                                                                              | Resolution                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand typography         | Concept 01 uses squared display headings and rounded UI text. The first rendered headings incorrectly inherited Quicksand. | Changed the route to the actual `--font-nippo` variable; final headings, forms and cards inspected at mobile, desktop and native size.                                                                                                                                                                                 |
| Introduction and framing | Concept 01 uses a compact navy/photo split, stacked on mobile. Initial tablet crop cut the front of the editorial car.     | Preserved the existing showroom asset and adjusted its focal position to the right; final 768px capture shows the complete front.                                                                                                                                                                                      |
| Toolbar and borders      | Concepts 01/02 use bounded compact controls, aligned search/filter/sort and visible chips.                                 | Explicit border/focus tokens and an integrated search button correct the first unstyled submit control and alignment. All seven widths pass overflow checks.                                                                                                                                                           |
| Filters and drawer       | Concept 02 groups related fields and keeps mobile Apply/Clear available.                                                   | Three desktop columns, scrolling mobile body, fixed actions and native modal inertness. Explicit Tab wrapping repairs focus leaving the last control; Escape and trigger restoration pass. Optional fields replace generated required markers.                                                                         |
| Inventory cards          | Concept 01 has photograph-led cards, titles/specifications, prices and location.                                           | Real response fields and safe media rendering retained. Vehicle-only cover styling removes unintended letterboxing. Focused native capture verifies all card fields and pagination. Examples remain test-only.                                                                                                         |
| Loading and recovery     | Concept 02 shows compact recovery and card-shaped loading.                                                                 | Distinct empty/no-match messages, skeletons, status announcements and Retry verified with delayed/failed responses. Excess action-row spacing reduced.                                                                                                                                                                 |
| Lower-page rhythm        | Concept 03 connects lifestyle imagery to a navy contact band.                                                              | Existing family/executive imagery and everyday guidance retained with an editorial caption. Contact/WhatsApp actions use working routes; unintended action-row top margin removed. Native lifestyle/contact and mobile continuation inspected.                                                                         |
| Copy and claims          | Generated concepts introduced claims and navigation absent from the actual product.                                        | Above-the-fold copy checked against the approved heading/description, route labels and API fields. No financing, verification, guaranteed availability, fabricated counts or unsupported favourites are shipped. Retained assets/navigation/footer and the two-photo lifestyle arrangement are intentional departures. |

The implementation was visually verified against the concept set and authoritative decisions above. No known fixable route-level design or functional mismatch remains from this inspection. Browser automation does not certify physical device keyboards, every browser engine or a manual screen-reader session; those are not claimed. Optional make/model facets and total-match metadata are documented in the root backend gap file and are not blockers for the truthful current interface.

Vehicles is ready for the next page-by-page milestone: Shop listing at `/parts`. Vehicle detail, other forms and dashboard routes remain outside this completed gate.
