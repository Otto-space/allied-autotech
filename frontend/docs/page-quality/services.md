# Services listing milestone

Route: `/services`  
Status: complete; local acceptance gate passed. Contact, Vehicles and Shop passed their separate local gates. Vehicle detail is next; Service detail and booking remain later milestones.

## Baseline

The [7 October expanded assessment](services-expanded.md) records the latest listing implementation and local acceptance. This September report retains its original verification scope.

Captured the production page at 390, 768, 1280 and 1440px against the isolated real API before implementation. Screenshots: `C:/Users/PC/.codex/services-before-{width}-{viewport|full}.png`. Inspected all four viewport screenshots. There was no page overflow. The dataset was empty. The service-type selection was component state only: selecting FIXED kept the URL at `/services`, and reload reset the filter. Evidence: `C:/Users/PC/.codex/services-baseline.log`.

The page lacked a breadcrumb, URL state, active-filter summary and result count. Its introductory banner was large; empty pagination remained visible; the lower journey/contact sections linked back to the same page. Shared `ServiceList` also serves homepage previews, so the route-specific catalogue is implemented separately.

## Backend contract

Read-only audit of service routes, schemas, repository, service layer and public frontend parser:

- Anonymous `GET /public/services`: `pricingType=FIXED|QUOTE_REQUIRED`, UUID `cursor`, `limit` from 1–100 (API default 25; page requests 12). Strict query validation; no search, category, branch or sort query.
- Public visibility is active services only, ascending ID with cursor pagination. Response is `items` and optional `nextCursor`, without a global total.
- Service records provide ID, name, slug, descriptions, pricing type, integer-string kobo price, NGN currency, duration, version and optional managed image. Render actual values and do not infer appointment availability from catalogue visibility.
- Service media is optional. Public application image URLs use `/api/v1/public/media/images/{imageId}` and respect active-service visibility. The existing photo component handles failed reads.
- Detail links use `/services/{id}`. Availability/booking requests belong to later page milestones.
- Richer catalogue search/categories/totals are optional backend enhancements recorded in the root gaps document.

## Design and implementation

Three complete [concept references](services-concepts/README.md) were generated and inspected before source edits: introduction/catalogue, journey/customer care, and mobile/recovery states. See that specification for tokens and intentional contract-driven corrections to generated details.

Route-only `ServicesCatalogue` and CSS preserve shared homepage previews. Pricing uses accessible native radios, normalized URL state, Back/Forward and reload, removable selection, clear/reset and cursor reset on filter changes. UI-only bounded cursor history never reaches the API. Raw cursor links offer a first-page recovery without inventing a page number. Server rendering uses the same normalized query as the client and metadata seed.

The list reports records on the current page, displays real prices or quotation labels, retains actual service images and uses a neutral missing-image icon. Loading, empty, invalid-link, network/server failure and retry states are distinct. Page controls focus the result heading; clear actions focus the all-services radio. No password inputs exist on this route.

## Acceptance evidence

The page was verified through Playwright with installed Microsoft Edge because the Browser plugin was unavailable. Browser fixtures cover controlled UI states; the separate real API/database run verifies the actual public contract. No deployed-storage verification is implied.

| Gate                               | Evidence and result                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production build                   | Passed, including TypeScript, static generation and standalone packaging; `C:/Users/PC/.codex/services-build-final.log`                                                                                                                                                                                            |
| Type checking and lint             | Standalone `tsc --noEmit` and targeted ESLint passed; the final build repeated TypeScript after all application changes. Final lint also includes the updated browser tests.                                                                                                                                       |
| Query unit tests                   | Three passed: public query allowlist/page bound, invalid shared links, bounded UI cursor history excluded from API requests. `services-unit.log`                                                                                                                                                                   |
| Browser interactions               | All 14 cases passed in the final run. `services-browser-final.log`                                                                                                                                                                                                                                                 |
| Server rendering                   | Four cases passed: JavaScript-free content, empty versus malformed responses, deduplicated seed/filter/page/reset behavior, and outage versus empty-state distinction. `services-seo.log`                                                                                                                          |
| Real API/database                  | Passed against loopback API `5012` and isolated database `allied_vehicles_qa` on `55439`: 15 public records, 13 fixed-price and two quotation records; an inactive record excluded; two-page traversal exactly matched active database IDs. `services-real-final.log`                                              |
| Real browser integration           | Filtered SSR and reload have no duplicate initial client read; pricing changes, next/previous, reload, clear, zero-price display and navigation to a real service detail all passed.                                                                                                                               |
| Responsive and accessibility       | 360, 390, 430, 768, 1024, 1280 and 1440px passed overflow, control-size and Axe checks. Active-filter summaries retain the same result start position. Native concept width 1536px and short 360/390px viewports were also checked.                                                                                |
| Keyboard and touch                 | Native radio arrow keys and Space work; selected state and focus remain clear. Clear/removal restores focus to All services; pagination focuses the result heading. A short 360px touch viewport with reduced motion passed long-name/description/large-price checks.                                              |
| Recovery states                    | Loading, filtered/unfiltered empty, invalid links, raw cursor recovery, 503, 429, network failure and retry passed. Failed image reads were verified using actual intercepted 404 responses and preserve service text/links. Supplementary loading/empty/error Axe checks passed: `services-visual-states.log`.    |
| Runtime and shared-component smoke | Homepage still renders its three-service preview. Breadcrumb Home navigation and Contact/WhatsApp destinations passed. No page errors, unexpected console errors or failed responses in the real flow; expected anonymous session 401 responses are excluded from that error classification. `services-health.log` |
| Visual comparison                  | All three concepts, all seven final first-viewport renders, native-size focused sections, mobile filter focus, long content and recovery-state images were inspected. Lower sections were also inspected separately at 390, 768 and 1440px.                                                                        |

The original image-failure test reused an already decoded successful image, so it did not exercise a failed request. It was replaced with an independent fresh-page test that asserts the 404 response and fallback. The final 14-case run passed without that test defect. Supplementary state-review harness corrections supplied the required success-envelope `message` and explicit browser context; no application change was needed for either correction.

Commands: `npx tsc --noEmit`; targeted `npx eslint ... --max-warnings=0`; `npx vitest run tests/unit/service-discovery.test.ts`; `npm run build`; `npx playwright test tests/e2e/services-quality.spec.ts`; and `RUN_SEO_SERVER_TESTS=true`, `SEO_FIXTURE_PORT=5019` with `seo.spec.ts --grep ': /services$'`. Formatting and diff checks cover the changed files. Temporary QA scripts, screenshots, logs and browser outputs are outside the repository. Concept references and repeatable regression tests are retained in the repository.

## Fidelity ledger

Concept references are `services-concepts/01.webp` through `03.webp`. Final screenshots are in the OS temporary directory under `services-quality-{width}-{viewport|full|filters}.png`, `services-quality-native-{introduction|catalogue|journey|contact}.png`, and focused/state filenames described below.

| Area                      | Concept and initial browser evidence                                                                  | Correction or intentional constraint                                                                                                                                                   | Final evidence                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introduction              | Concept 01 has a compact white introduction with workshop imagery; baseline used a large dark banner. | White copy area, bounded image and separate aligned breadcrumb. Existing workshop asset replaces the concept's generated photograph.                                                   | Seven viewport screenshots and native introduction inspected.                                                                                                           |
| Typography                | Concepts approximate the brand fonts.                                                                 | Actual locally bundled Nippo display and Quicksand UI are authoritative. Computed styles verified; no substitute display font introduced.                                              | Final headings, body text, service names and controls inspected at mobile and desktop.                                                                                  |
| Pricing choices           | Concepts 01/03 show a small bordered selection group.                                                 | Native radios provide keyboard semantics; three choices wrap into two rows on mobile. Outer mobile fieldset framing was removed while each choice retains its border.                  | Mobile filter screenshot shows visible selected and keyboard-focus states; all seven widths passed.                                                                     |
| Active summary            | Concept 03 includes a removable filter and clear action.                                              | Reserved summary space and compact mobile padding prevent result movement when the chip replaces guidance text.                                                                        | Result-position assertion passed at all seven widths.                                                                                                                   |
| Service row density       | Concept 01 uses compact divider-based rows. Initial browser output inherited 20px paragraph margins.  | Strengthened route-specific selectors restore 5px/0 paragraph spacing; descriptions remain readable and bounded.                                                                       | Final native catalogue and all responsive screenshots inspected.                                                                                                        |
| Floating help clearance   | Initial 1024/1280px screenshots placed row links near the floating help controls.                     | Added route-specific action clearance at smaller desktop widths.                                                                                                                       | Final 1024/1280px screenshots show the links clear of the floating controls.                                                                                            |
| Real content and imagery  | Concept names/prices illustrate anatomy only; optional image anatomy appears in concept 03.           | Real API values, exact kobo formatting, real optional image URLs and a neutral fallback. Descriptions clamp to three lines with a detail link; names wrap without horizontal overflow. | Real API pass, 404-image test and long-content screenshot. No concept inventory shipped.                                                                                |
| Journey and customer care | Concept 02 preserves six steps followed by an ink help band.                                          | Kept approved journey copy and functioning Contact/WhatsApp links; removed lower-page self-links. Shared header/footer remain the existing brand components.                           | Native sections plus `services-quality-{390                                                                                                                             | 768 | 1440}-{journey | contact}-focused.png`; all inspected. Focused captures position fixed chrome outside the section bounds. |
| Recovery                  | Concept 03 distinguishes loading, empty and error states.                                             | Static skeletons, explicit empty guidance, existing accessible feedback and real retry; empty lists do not show unusable pagination.                                                   | `services-quality-loading.png`, `services-quality-empty.png`, `services-quality-error.png`, `services-quality-mobile-error.png`; inspected and state Axe checks passed. |

## Scope and remaining boundaries

No blocker remains for this listing's local acceptance. Search, service categories, sort controls and global totals remain optional backend extensions and are not simulated. Real deployed service imagery depends on the separately documented media/storage setup. Booking availability is read on the service detail/booking flow, not inferred from the listing. These checks do not certify those later page milestones, a production deployment or real object storage.

Application files changed:

- [Services page](../../app/services/page.tsx)
- [Route-specific catalogue](../../app/components/services-catalogue.tsx)
- [Services styles](../../app/services/services.css)
- [URL and API query normalization](../../lib/service-discovery.ts)

Verification and documentation:

- [Browser regression tests](../../tests/e2e/services-quality.spec.ts)
- [Query unit tests](../../tests/unit/service-discovery.test.ts)
- [Existing SSR tests adapted to native radios](../../tests/e2e/seo.spec.ts)
- This milestone report, [concept references/specification](services-concepts/README.md) and [quality register](README.md).

Backend source, shared homepage service rendering and existing media lifecycle components were preserved during this page milestone.
