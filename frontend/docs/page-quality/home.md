# Home — expanded-brief quality report

Route: `/`. Review date: 7 October 2026. Status: complete; local expanded-brief gate passed.

## Scope and audit

Home remains a public discovery page. `PublicHome` is a Server Component with four parallel, validated public seed reads; interactive islands retain the existing resource hook and carousel. No private customer data, booking mutation, payment action or new backend endpoint was added. Existing header/footer, company identity, contact details, catalogue destinations and reduced-motion behavior remain.

Before editing, inspected the component tree, local Next.js documentation, catalogue/vehicle/service/review schemas, server fetch utilities, media allowlist and shared styling. Baseline screenshots at 390, 768, 1280 and 1440px showed a 630px desktop hero with oversized display text, repetitive 76px section spacing, basic catalogue cards, large generic media fallbacks and an inconsistent legacy reviews section. There was no baseline page overflow or JavaScript exception.

The local products API initially returned 500 because the isolated QA database lacked the repository's existing additive `20260930030000_product_media_version` migration. Created a database backup and applied the pending migration to that isolated database. The same catalogue read then returned 200. No backend source, schema, contract or production database was changed.

## Design and implementation

The [six coordinated concepts and source-of-truth corrections](home-concepts/README.md) cover the hero/partner, services/journey/trust, vehicles/lifestyle, Shop/equipment, closing sections and mobile adaptation. The existing Nippo and Quicksand fonts, approved copy and real assets override illustrative generated substitutions.

- Home-scoped typography and spacing reduce the desktop hero to 530px, use a 49px maximum headline and 26–34px section headings, and reduce section padding to 56px/40px desktop/mobile.
- A workshop photograph anchors three service preview rows. Service images remain real API media, with the existing service-icon fallback. The journey becomes a connected six-step rail on desktop and a vertical sequence on narrow phones.
- The original supplied technician poster is preserved; four approved operating principles form a compact two-column layout where space permits.
- Vehicle previews use current API price, year, make/model, mileage, transmission, fuel and branch location. Zero mileage remains visible, missing specifications are omitted and no featured/inspection badge is fabricated. A vehicle icon replaces the generic product icon for missing vehicle photographs.
- Product previews show real brand/category, price and branch availability. Product and vehicle card layouts differ; product rows become horizontal on narrow phones. Empty catalogues retain useful enquiry links.
- Grey feedback, white FAQ and ink contact/footer sections give the closing page a consistent hierarchy. Reviews remain API-backed; the empty state never invents ratings or testimonials. FAQ retains native disclosure semantics and gains a visible chevron.
- Retry states expose loading text, busy state and static placeholders without unnecessary motion. Catalogue cards and lifestyle images gain restrained hover feedback only when motion is permitted.
- `PublicMedia` accepts optional image sizing and a fallback icon; default behavior, permitted hosts and private-preview boundaries are preserved. Home keys it by URL so replacement media can recover after an earlier failed image.

## Data and permissions

| Data     | Existing endpoint, omitting `/api/v1`  | Preserved boundary                                           |
| -------- | -------------------------------------- | ------------------------------------------------------------ |
| Products | `GET /public/catalog/products?limit=4` | Published catalogue projection; branch stock booleans only   |
| Vehicles | `GET /public/vehicles?limit=2`         | Public listing projection; no internal stock fields          |
| Services | `GET /public/services?limit=3`         | Active services, actual fixed/quotation pricing              |
| Reviews  | `GET /public/support/reviews?limit=3`  | Published feedback; no fabricated author or aggregate rating |

Successful seeds do not trigger a duplicate client collection fetch. Normal Next.js detail-link prefetches are distinct requests and remain enabled. Failed seeds retain the resource hook's automatic recovery attempt and manual retry. Home links lead to existing destinations, whose actual booking/account permissions remain authoritative.

## Fidelity ledger

| Comparison       | Baseline / concept evidence                                                                              | Correction and browser result                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Hero scale       | Baseline 68px heading and 630px hero; concept 01 has a compact editorial hierarchy                       | 49px maximum, 530px hero; partner section visible in the desktop first viewport                                                    |
| Services         | Baseline plain rows without editorial anchor; concept 02 pairs workshop image and compact rows           | Split layout, actual thumbnail/fallback, readable price/quote and detail link; single-column mobile collapse                       |
| Process          | Baseline repeated three-column blocks; concept 02 uses connected steps                                   | Six steps across desktop, three at intermediate widths and a vertical mobile sequence; original workflow copy retained             |
| Trust            | Concept's generated portrait is not the supplied person's identity                                       | Original poster retained with contained framing; principles in two columns, one on narrow phones                                   |
| Vehicle previews | Baseline oversized generic placeholders; concept 03 has horizontal photographic cards and specifications | Compact domain-specific fallback, API specifications/location, complete images preserved with letterboxing where necessary         |
| Shop             | Baseline category/price-only cards; concept 04 adds real availability and stronger hierarchy             | Distinct product cards with exact kobo formatting, zero-price handling and explicit branch stock text                              |
| Reviews          | Baseline legacy heading/container; concept 05 uses coordinated grey section                              | Matching heading scale, truthful empty/published states, refresh control; darker brand red fixes the measured 4.22:1 link contrast |
| FAQ              | Concept 05 uses directional indicators                                                                   | Native `details`/`summary` retained with Lucide chevrons, approved answers and real destinations                                   |
| Narrow layouts   | Concept 06 requires readable mobile content                                                              | 320px actions wrap naturally; images reserve space; long catalogue names wrap; no page overflow in the responsive suite            |

Above-the-fold copy remains the original wordmark/navigation, four slide titles/descriptions/actions and service strip. No generated marketing claims, unsupported nationwide reach or replacement logo was adopted. Lower editorial copy also remains unchanged; new card labels describe only existing API fields and destinations. Concept deviations are documented in the concept README rather than treated as backend facts.

## Verification and evidence

Browser plugin capability discovery found no usable Browser tool in this session. Used the repository Playwright installation with Microsoft Edge Chromium and the standalone production build. Real API preview: `http://localhost:3001/`, isolated API `5012`; controlled-state preview: `http://localhost:3002/`, test-owned SSR fixture `5021`. Fixtures are confined to tests and never shipped as production data.

Baseline and real-API screenshots/logs are outside the repository in `C:/Users/PC/.codex/`; controlled browser screenshots are in the OS temporary directory. Concept assets alone are kept with this report.

| Check                      | Final evidence and result                                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build and types | `home-oct-build-release.log`: optimized compile, TypeScript, all 70 static-generation entries and tracing passed; standalone packaging completed                                                                                                                 |
| Whole-workspace lint       | `home-oct-lint-release.log`: ESLint with zero warnings, exit 0                                                                                                                                                                                                   |
| Relevant unit regression   | `home-oct-unit.log`: currency/media, gallery, public-resource and background-refresh suites, 36 tests passed                                                                                                                                                     |
| Home browser suite         | `home-oct-browser-release.log`: all 17 scenarios passed on the final build                                                                                                                                                                                       |
| Shared media regression    | `home-oct-shared-media.log`: four existing Product detail scenarios passed, covering gallery navigation/focus, missing media, image failure/long content, and mobile touch gallery                                                                               |
| Real API                   | `home-oct-real.json`: four collection reads returned 200; the rendered four products, two vehicles, three services and zero reviews matched current API records; correct detail identities, no failed image responses, no page exceptions or horizontal overflow |
| Formatting and links       | Changed Home source, tests and reports passed Prettier and repository whitespace checks; relative documentation targets checked                                                                                                                                  |

The responsive suite checks **320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1536px**, captures first viewport/full-page and section evidence, and scrolls through the major sections to check overflow. The 1536×1024 real-data capture matches the concepts' native desktop dimensions. `view_image` comparisons covered the concept set and final desktop/mobile renders, including actual poster framing, service/vehicle/product anatomy, section hierarchy, typography, colours, spacing, fallback states and icons. The implementation faithfully follows the selected direction with the explicit brand, copy, asset and contract corrections above; no material unresolved visual mismatch was identified in this local gate.

Interaction evidence includes all four hero destinations, previous/next/wrap and keyboard navigation, touch-pointer swipe, manually paused and resumed autoplay, reduced motion, mobile menu close/focus restoration, native FAQ expansion and approved directions, product-detail navigation, four independent public API retries, delayed loading placeholders, review refresh/busy state, real ratings, zero prices/mileage, missing specifications, broken media and long unbroken names. The scoped Axe check passed WCAG 2 A/AA, 2.1 AA and 2.2 AA rule tags. This is automated evidence, not a manual screen-reader certification.

Initial runs found test assumptions as well as the contrast issue recorded above: Next.js detail prefetches were incorrectly counted as Home seed duplicates; the FAQ and menu-close selectors also matched controls in the Help panel/backdrop; the failure fixture initially recovered before the Retry action could be exercised; and product/vehicle fixture images needed their resource-specific approved public paths. The final suite fixes those test setups while retaining request-count, visibility, real-image, recovery and accessibility assertions.

Key commands: `next build --webpack`, `node scripts/prepare-standalone.mjs`, `eslint --max-warnings=0 .`, the four named Vitest suites with `--maxWorkers=1`, `playwright test tests/e2e/home-quality.spec.ts` under `RUN_HOME_TESTS=true`, and the four selected existing Product detail scenarios under `RUN_PRODUCT_DETAIL_TESTS=true`. Both browser runs use `PLAYWRIGHT_BASE_URL=http://localhost:3002` with a test-owned fixture on 5021. The separate real-data harness reads the isolated API and verifies the rendered page at 3001 without data mutations.

## Files and boundaries

Production changes: `app/home.css`, `app/components/public-home.tsx`, `home-catalogue-preview.tsx`, `home-reviews-preview.tsx`, `public-media.tsx` and the preview-loading branch in `service-list.tsx`. Browser coverage: `tests/e2e/home-quality.spec.ts`. Concepts: this report's `home-concepts/` directory.

The Home refinement does not certify other routes against the expanded brief. Backend media deployment, payment/email provider verification and keyed Maps remain separate release items in [Backend Implementation Gaps](../../../BACKEND_IMPLEMENTATION_GAPS.md). No new Home endpoint gap was found. No production deployment or manual screen-reader test is claimed. Browser coverage is Chromium, not an assertion of Safari/Firefox or production Core Web Vitals.
